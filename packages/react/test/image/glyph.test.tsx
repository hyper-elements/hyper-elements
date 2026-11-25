/**
 * Characters no given font covers (Decision 18): each segment Satori asks a font for is matched to the text nodes that
 * hold it, each confirmed on its own, and said as image/glyph, a warning, or an error with strict or on fitted text.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Canvas, Heading, Text } from "@hyper-elements/react";
import { layoutImage, renderImage } from "../../src/image";

const STANDARD = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts");
const fonts = [{ family: "Liberation Sans", src: readFileSync(join(STANDARD, "LiberationSans-Regular.ttf")) }];

it("says Arabic and an emoji no font covers, at each node that holds them", async () => {
  const design = (
    <Canvas width={600} height={300} style={{ fontFamily: "Liberation Sans" }}>
      <Heading field="title">Launch إطلاق</Heading>
      <Text field="subtitle">Also إطلاق 🚀</Text>
      <Text>Only Latin here</Text>
    </Canvas>
  );
  const { glyphs, diagnostics } = await layoutImage(design, { fonts });
  expect(glyphs.map((g) => [g.path, g.field])).toEqual([
    ["root.children[0]", "title"],
    ["root.children[1]", "subtitle"],
  ]);
  expect(glyphs[0].text).toContain("إ");
  expect(glyphs[1].text).toContain("🚀");
  expect(diagnostics.filter((d) => d.code === "image/glyph").map((d) => d.severity)).toEqual(["warning", "warning"]);
  await expect(renderImage(design, { fonts, strict: true })).rejects.toThrow(/image\/glyph/);
});

it("is an error on fitted text, and says nothing where the font covers every character", async () => {
  const fitted = (
    <Canvas width={600} height={300} style={{ fontFamily: "Liberation Sans" }}>
      <Heading fit={{ sizes: [40, 30] }}>إطلاق</Heading>
    </Canvas>
  );
  expect((await layoutImage(fitted, { fonts })).diagnostics.filter((d) => d.code === "image/glyph").map((d) => d.severity)).toEqual(["error"]);
  const covered = (
    <Canvas width={600} height={300} style={{ fontFamily: "Liberation Sans" }}>
      <Heading>Ölfass café — naïve, £12</Heading>
    </Canvas>
  );
  const { glyphs, diagnostics } = await layoutImage(covered, { fonts });
  expect(glyphs).toEqual([]);
  expect(diagnostics.filter((d) => d.code === "image/glyph")).toEqual([]);
});
