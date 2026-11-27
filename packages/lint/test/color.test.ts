/** Colors as Elements takes them, composited and compared as WCAG 2.1 does. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contrast, hex, luminance, namedColors, over, parseColor } from "../src/color";

describe("colors", () => {
  it("has core's value for every name core takes, and no other", () => {
    // Core's names and values ("name:rrggbb"), and transparent, which has none.
    const kinds = readFileSync(join(__dirname, "../../internal/core/src/kinds.ts"), "utf8");
    const list = /const NAMED_COLOR_VALUES[^=]*= new Map\(\s*\(([\s\S]*?)\)\s*\.split/.exec(kinds)![1]!;
    const core = new Map(
      list
        .match(/"([^"]*)"/g)!
        .map((s) => s.slice(1, -1))
        .join(" ")
        .split(/\s+/)
        .filter(Boolean)
        .map((entry) => entry.split(":") as [string, string])
    );
    expect(kinds).toContain('new Set([...NAMED_COLOR_VALUES.keys(), "transparent"])');
    expect([...namedColors().keys()].sort()).toEqual([...core.keys()].sort());
    for (const [name, value] of core) expect(namedColors().get(name), name).toBe(value);
    expect(namedColors().get("rebeccapurple")).toBe("663399");
  });

  it("parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba() and names", () => {
    expect(parseColor("#abc")).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 1 });
    expect(parseColor("#ABCD")).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 0xdd / 255 });
    expect(parseColor("#0879a1")).toEqual({ r: 8, g: 121, b: 161, a: 1 });
    expect(parseColor("#00000080")!.a).toBeCloseTo(0.502, 3);
    expect(parseColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor("rgba(1,2,3,0.5)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseColor("rgba(1, 2, 3, 50%)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseColor(" Navy ")).toEqual({ r: 0, g: 0, b: 128, a: 1 });
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    for (const bad of ["rgb(256, 0, 0)", "rgba(0, 0, 0, 2)", "hsl(0, 0%, 0%)", "#12", "nocolor", 12, undefined]) expect(parseColor(bad), String(bad)).toBeUndefined();
  });

  it("composites source-over, and contrasts by relative luminance", () => {
    const white = parseColor("#ffffff")!;
    const black = parseColor("#000000")!;
    expect(over({ ...black, a: 0.5 }, white)).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
    expect(over({ ...black, a: 0 }, { ...white, a: 0 })).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(luminance(white)).toBe(1);
    expect(contrast(black, white)).toBe(21);
    expect(contrast(white, black)).toBe(21);
    expect(contrast(parseColor("#767676")!, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parseColor("#777777")!, white)).toBeLessThan(4.5);
    expect(hex({ r: 127.5, g: 0, b: 255, a: 1 })).toBe("#8000ff");
  });
});
