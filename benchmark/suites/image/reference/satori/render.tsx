import { readFile, readdir } from "node:fs/promises";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import Card, { size } from "./card";

export default async function render() {
  const assets: Record<string, string> = {};
  for (const f of (await readdir("assets")).filter((f) => f.endsWith(".png"))) assets[f] = `data:image/png;base64,${(await readFile(`assets/${f}`)).toString("base64")}`;
  const svg = await satori(<Card assets={assets} />, {
    ...size,
    fonts: [
      { name: "Inter", data: await readFile("fonts/Inter-Regular.ttf"), weight: 400, style: "normal" },
      { name: "Inter", data: await readFile("fonts/Inter-Bold.ttf"), weight: 700, style: "normal" },
      { name: "Lora", data: await readFile("fonts/Lora-Italic.ttf"), weight: 400, style: "italic" },
    ],
  });
  return new Resvg(svg).render().asPng();
}
