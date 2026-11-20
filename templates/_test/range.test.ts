/** The sample brands differ: a table of them along six axes, and no two the same on every one. */
import { luminance, rgbOf } from "../_brand";
import { brands } from "./discover";

const saturation = (hex: string) => {
  const [r, g, b] = rgbOf(hex)!.map((c) => c / 255);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
};

it("covers a range of looks", async () => {
  const rows = (await brands()).map(({ id, brand }) => {
    const t = brand.theme as unknown as Record<string, Record<string, unknown>>;
    return {
      id,
      background: luminance(t.colors.background as string) < 0.2 ? "dark" : "light",
      type: /serif/.test(String(t.fonts.heading)) && !/sans-serif/.test(String(t.fonts.heading)) ? "serif" : /mono/i.test(String(t.fonts.heading)) ? "mono" : "sans",
      corners: Number(t.radii.md) >= 8 ? "rounded" : "sharp",
      spacing: Number(t.spacing.md) >= 16 ? "airy" : "dense",
      color: saturation(t.colors.primary as string) > 0.6 ? "saturated" : "muted",
      direction: brand.dir === "rtl" ? "rtl" : "ltr",
    };
  });
  console.table(rows);
  const keys = rows.map(({ id: _, ...axes }) => JSON.stringify(axes));
  const twins = rows.filter((_, i) => keys.indexOf(keys[i]) !== i).map((r) => r.id);
  expect(twins, "brands that match on every axis").toEqual([]);
  for (const axis of ["background", "type", "corners", "spacing", "color"] as const) expect(new Set(rows.map((r) => r[axis])).size, axis).toBeGreaterThan(1);
});
