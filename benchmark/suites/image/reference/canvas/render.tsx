import { readFile } from "node:fs/promises";
import { GlobalFonts, createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { draw, size } from "./card";

GlobalFonts.registerFromPath("fonts/Inter-Regular.ttf", "Inter");
GlobalFonts.registerFromPath("fonts/Inter-Bold.ttf", "Inter");
GlobalFonts.registerFromPath("fonts/Lora-Italic.ttf", "Lora");

export type Ctx = SKRSContext2D;
export type Text = { size: number; weight?: number; family?: string; italic?: boolean; color: string; lineHeight?: number; spacing?: number };

const fontOf = (t: Text) => `${t.italic ? "italic " : ""}${t.weight ?? 400} ${t.size}px ${t.family ?? "Inter"}`;

/** The text's lines at a width: words wrapped where they don't fit. */
export function lines(ctx: Ctx, text: string, t: Text, width: number): string[] {
  ctx.font = fontOf(t);
  ctx.letterSpacing = `${t.spacing ?? 0}px`;
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** The text's width on one line. */
export function widthOf(ctx: Ctx, text: string, t: Text): number {
  ctx.font = fontOf(t);
  ctx.letterSpacing = `${t.spacing ?? 0}px`;
  return ctx.measureText(text).width;
}

/** Draws the text wrapped to `width` from (x, y), its top; aligned left or centered on x. Returns its height. */
export function text(ctx: Ctx, s: string, t: Text, x: number, y: number, width: number, align: "left" | "center" = "left"): number {
  const ls = lines(ctx, s, t, width);
  const lh = t.size * (t.lineHeight ?? 1.2);
  ctx.fillStyle = t.color;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * lh + (lh - t.size) / 2));
  return ls.length * lh;
}

/** The height text takes, wrapped to `width`. */
export const heightOf = (ctx: Ctx, s: string, t: Text, width: number) => lines(ctx, s, t, width).length * t.size * (t.lineHeight ?? 1.2);

/** A pill: text on a fully rounded fill, from (x, y), its top-left. Returns its width and height. */
export function pill(ctx: Ctx, s: string, t: Text, fill: string, x: number, y: number, padY: number, padX: number) {
  const w = widthOf(ctx, s, t) + padX * 2, h = t.size * 1.2 + padY * 2;
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  text(ctx, s, t, x + padX, y + padY, w);
  return { w, h };
}

/** An image at (x, y) and its size, its corners rounded by `radius`. */
export function image(ctx: Ctx, img: Image, x: number, y: number, w: number, h: number, radius = 0) {
  ctx.save();
  if (radius) { ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.clip(); }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

export default async function render() {
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d");
  const load = (f: string) => loadImage(`assets/${f}`);
  await draw(ctx, load);
  return canvas.toBuffer("image/png");
}

export { readFile };
