import { image, pill, text, widthOf, type Ctx } from "./render";
import type { Image } from "@napi-rs/canvas";

export const size = { width: 1200, height: 630 };

export async function draw(ctx: Ctx, load: (f: string) => Promise<Image>) {
  const P = 72, W = size.width - P * 2;
  ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, size.width, size.height);
  image(ctx, await load("orbit-logo-white.png"), P, P, 126, 64);
  const tag = { size: 20, weight: 700, color: "#ffffff", spacing: 2 };
  const tagW = widthOf(ctx, "ENGINEERING", tag) + 32;
  pill(ctx, "ENGINEERING", tag, "#2563eb", size.width - P - tagW, P + 32 - (20 * 1.2 + 16) / 2, 8, 16);
  text(ctx, "How we cut our build times in half with incremental bundling", { size: 60, weight: 700, color: "#ffffff", lineHeight: 1.15 }, P, P + 64 + 40, W);
  const top = size.height - P - 64;
  image(ctx, await load("avatar-maya.png"), P, top, 64, 64, 32);
  const nameH = 28 * 1.2, metaH = 24 * 1.2, y = top + (64 - nameH - 4 - metaH) / 2;
  text(ctx, "Maya Chen", { size: 28, weight: 700, color: "#ffffff" }, P + 80, y, W);
  text(ctx, "June 12, 2027 · 8 min read", { size: 24, color: "#94a3b8" }, P + 80, y + nameH + 4, W);
}
