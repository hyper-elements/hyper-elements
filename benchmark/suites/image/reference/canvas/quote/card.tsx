import { image, text, type Ctx } from "./render";
import type { Image } from "@napi-rs/canvas";

export const size = { width: 1200, height: 675 };

export async function draw(ctx: Ctx, load: (f: string) => Promise<Image>) {
  const bar = 12, P = 72, x = bar + P, W = size.width - x - P;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size.width, size.height);
  ctx.fillStyle = "#6d5efc"; ctx.fillRect(0, 0, bar, size.height);
  text(ctx, "We replaced four template systems with one. Our emails, invoices and social cards now ship from the same components.", { size: 44, family: "Lora", italic: true, color: "#111827", lineHeight: 1.4 }, x, P, W);
  const top = size.height - P - 72;
  image(ctx, await load("avatar-daniel.png"), x, top, 72, 72, 36);
  const y = top + (72 - (28 * 1.2 + 4 + 24 * 1.2)) / 2;
  text(ctx, "Daniel Okafor", { size: 28, weight: 700, color: "#111827" }, x + 92, y, 600);
  text(ctx, "Head of Platform, Northwind", { size: 24, color: "#6b7280" }, x + 92, y + 28 * 1.2 + 4, 600);
  image(ctx, await load("orbit-logo.png"), size.width - P - 100, top + (72 - 51) / 2, 100, 51);
}
