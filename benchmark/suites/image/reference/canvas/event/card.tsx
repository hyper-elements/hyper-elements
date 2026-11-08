import { pill, text, type Ctx } from "./render";
import type { Image } from "@napi-rs/canvas";

export const size = { width: 1500, height: 500 };

export async function draw(ctx: Ctx, _load: (f: string) => Promise<Image>) {
  const P = 64;
  ctx.fillStyle = "#111827"; ctx.fillRect(0, 0, size.width, size.height);
  // Left: three lines, 16px apart, centered vertically.
  const leftH = 24 * 1.2 + 16 + 80 * 1.2 + 16 + 32 * 1.2;
  let y = (size.height - leftH) / 2;
  y += text(ctx, "LUMEN CONF 2027", { size: 24, weight: 700, color: "#f87171", spacing: 4 }, P, y, 900) + 16;
  y += text(ctx, "Build what's next.", { size: 80, weight: 700, color: "#ffffff" }, P, y, 1000) + 16;
  text(ctx, "March 18–19, 2027 · Lisbon", { size: 32, color: "#d1d5db" }, P, y, 900);
  // Right: a card 420px wide.
  const cardH = 32 + 32 * 1.2 + 12 + 24 * 1.2 + 12 + (24 * 1.2 + 24) + 32, x = size.width - P - 420;
  let cy = (size.height - cardH) / 2;
  ctx.fillStyle = "#1f2937"; ctx.beginPath(); ctx.roundRect(x, cy, 420, cardH, 16); ctx.fill();
  cy += 32;
  cy += text(ctx, "Early-bird tickets", { size: 32, weight: 700, color: "#ffffff" }, x + 32, cy, 356) + 12;
  cy += text(ctx, "Until January 31", { size: 24, color: "#9ca3af" }, x + 32, cy, 356) + 12;
  pill(ctx, "Get tickets", { size: 24, weight: 700, color: "#ffffff" }, "#ef4444", x + 32, cy, 12, 24);
}
