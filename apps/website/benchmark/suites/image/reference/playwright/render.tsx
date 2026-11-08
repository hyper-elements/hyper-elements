import { readFile, readdir } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import Card, { size } from "./card";

const face = async (family: string, file: string, weight: number, style: string) =>
  `@font-face { font-family: "${family}"; src: url(data:font/ttf;base64,${(await readFile(`fonts/${file}`)).toString("base64")}) format("truetype"); font-weight: ${weight}; font-style: ${style}; }`;

export default async function render() {
  const assets: Record<string, string> = {};
  for (const f of (await readdir("assets")).filter((f) => f.endsWith(".png"))) assets[f] = `data:image/png;base64,${(await readFile(`assets/${f}`)).toString("base64")}`;
  const css = [
    await face("Inter", "Inter-Regular.ttf", 400, "normal"),
    await face("Inter", "Inter-Bold.ttf", 700, "normal"),
    await face("Lora", "Lora-Italic.ttf", 400, "italic"),
    `* { box-sizing: border-box; margin: 0; } html, body { width: ${size.width}px; height: ${size.height}px; overflow: hidden; } body { display: flex; }`,
  ].join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${renderToStaticMarkup(<Card assets={assets} />)}</body></html>`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: size });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    return await page.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
}
