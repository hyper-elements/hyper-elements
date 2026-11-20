import { checkBrand, contrast } from "../_brand";
import { brand as orbit } from "../_brands/orbit";
import { assetBytes } from "../_scripts/assets";
import { brands } from "./discover";
import { contractOnly } from "./probes";

for (const { id, brand } of await brands()) {
  it(`${id} is a brand every design can take`, () => {
    expect(checkBrand(brand)).toEqual([]);
    expect(checkBrand(contractOnly(brand))).toEqual([]);
    // Its logo and fonts are files in this folder.
    expect(assetBytes(brand.logo.src).length).toBeGreaterThan(0);
    for (const face of brand.fonts) expect(assetBytes(face.src).length).toBeGreaterThan(0);
  });
}

it("names a missing token by its path", () => {
  const { muted: _, ...colors } = orbit.theme.colors as Record<string, string>;
  const broken = { ...orbit, theme: { ...(orbit.theme as object), colors } as never };
  expect(checkBrand(broken)).toContain("brand.theme.colors.muted is missing");
});

it("refuses a pair under 4.5:1, a WOFF2 font, a weight range and a color set outside the tokens", () => {
  const colors = { ...(orbit.theme.colors as Record<string, string>), muted: "#c0c4d0" };
  const theme = { ...(orbit.theme as object), colors, elements: { ...(orbit.theme.elements as object), Button: { color: "#ff0000" } } } as never;
  const problems = checkBrand({ ...orbit, theme, fonts: [...orbit.fonts, { family: "Inter", src: `${orbit.fonts[0].src.replace(".ttf", ".woff2")}`, weight: 450.5, style: "normal" }] }).join("\n");
  expect(problems).toMatch(/colors\.muted on colors\.background is \d\.\d\d:1/);
  expect(problems).toMatch(/TTF or OTF/);
  expect(problems).toMatch(/one weight, 100 to 900/);
  expect(problems).toMatch(/elements\.Button\.color sets a color/);
});

it("measures contrast as WCAG does", () => {
  expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
  expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
});
