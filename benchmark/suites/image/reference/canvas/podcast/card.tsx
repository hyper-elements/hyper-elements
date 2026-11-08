import { image, text, type Ctx } from "./render";
import type { Image } from "@napi-rs/canvas";

export const size = { width: 1080, height: 1080 };

export async function draw(ctx: Ctx, load: (f: string) => Promise<Image>) {
  const P = 80, W = size.width - P * 2, cx = size.width / 2;
  ctx.fillStyle = "#fef3c7"; ctx.fillRect(0, 0, size.width, size.height);
  let y = P;
  image(ctx, await load("podcast-cover.png"), cx - 180, y, 360, 360, 24); y += 360 + 24;
  y += text(ctx, "EPISODE 42", { size: 28, weight: 700, color: "#b45309", spacing: 3 }, cx, y, W, "center") + 24;
  y += text(ctx, "Designing APIs that agents can read", { size: 64, weight: 700, color: "#1c1917", lineHeight: 1.15 }, cx, y, W, "center") + 24;
  text(ctx, "with Priya Natarajan", { size: 32, color: "#44403c" }, cx, y, W, "center");
  const bottom = size.height - P - (28 * 1.2 + 6 + 24 * 1.2);
  text(ctx, "The Build Log", { size: 28, weight: 700, color: "#1c1917" }, cx, bottom, W, "center");
  text(ctx, "Listen wherever you get podcasts", { size: 24, color: "#78716c" }, cx, bottom + 28 * 1.2 + 6, W, "center");
}
