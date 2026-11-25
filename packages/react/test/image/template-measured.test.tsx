/**
 * A template's measured rules, decided by the image entry (Decision 31): renderImage() of a template design draws its
 * snapshot strict, measures it, and rejects a required rule that fails; any other writer still refuses the snapshot.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Canvas, Heading, prop, render } from "@hyper-elements/react";
import type React from "react";
import { renderImage } from "../../src/image";
import { template } from "../../src/template";

const STANDARD = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts");
const fonts = [
  { family: "Liberation Sans", src: readFileSync(join(STANDARD, "LiberationSans-Regular.ttf")) },
  { family: "Liberation Sans", src: readFileSync(join(STANDARD, "LiberationSans-Bold.ttf")), weight: 700 },
];

const Card = template({
  id: "acme.Card",
  version: "1.0.0",
  label: "Card",
  root: "Canvas",
  formats: { square: { width: 400, height: 120 } },
  fields: { title: prop.text({ label: "Title", required: true }) },
  rules: { require: { core: ["image/overflow"] } },
  example: { title: "Short" },
  render: (v) => (
    <Canvas width={400} height={120} style={{ fontFamily: "Liberation Sans", padding: 10 }}>
      <Heading field="title" style={{ fontSize: 28 }}>{v.title}</Heading>
    </Canvas>
  ),
});
const C = Card as unknown as React.FC<Record<string, unknown>>;
const LONG = "A title much too long for this card, which runs line after line after line past the bottom of the Canvas";

it("rejects a template design whose text runs past the Canvas, naming the rule, with no strict given", async () => {
  await expect(renderImage(<C format="square" title={LONG} />, { fonts })).rejects.toMatchObject({
    diagnostics: expect.arrayContaining([expect.objectContaining({ code: "image/overflow", severity: "error", message: expect.stringContaining("(required by acme.Card)") })]),
  });
});

it("renders text that fits, the bytes its snapshot gives drawn strict; render() of the snapshot is still refused", async () => {
  const checked = Card.check({ title: "Short" }, { format: "square" });
  const fromDesign = await renderImage(<C format="square" title="Short" />, { fonts });
  const fromSnapshot = await renderImage(checked.snapshots.square!, { fonts, strict: true });
  expect(Buffer.from(fromDesign.image).equals(Buffer.from(fromSnapshot.image))).toBe(true);
  await expect(render(checked.snapshots.square!)).rejects.toThrow(/template\/rule-not-run/);
});
