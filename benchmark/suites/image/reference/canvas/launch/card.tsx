import { heightOf, image, pill, text, widthOf, type Ctx } from "./render";
import type { Image } from "@napi-rs/canvas";

export const size = { width: 1200, height: 630 };

export async function draw(ctx: Ctx, load: (f: string) => Promise<Image>) {
  const W = size.width - 144, cx = size.width / 2;
  image(ctx, await load("orbit-card-bg.png"), 0, 0, size.width, size.height);
  const title = { size: 72, weight: 700, color: "#ffffff" }, sub = { size: 30, color: "#c7d2fe" }, cta = { size: 28, weight: 700, color: "#ffffff" };
  const titleH = heightOf(ctx, "Ship every surface from one codebase", title, W), subH = heightOf(ctx, "Live previews, typed templates and one-click deploys.", sub, W), pillH = 28 * 1.2 + 28;
  let y = (size.height - (64 + 24 + titleH + 24 + subH + 24 + pillH)) / 2;
  image(ctx, await load("orbit-logo-white.png"), cx - 63, y, 126, 64); y += 64 + 24;
  y += text(ctx, "Ship every surface from one codebase", title, cx, y, W, "center") + 24;
  y += text(ctx, "Live previews, typed templates and one-click deploys.", sub, cx, y, W, "center") + 24;
  pill(ctx, "orbit.dev/2", cta, "#6d5efc", cx - (widthOf(ctx, "orbit.dev/2", cta) + 56) / 2, y, 14, 28);
}
