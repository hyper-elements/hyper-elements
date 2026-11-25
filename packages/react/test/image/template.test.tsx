/**
 * A template as a design's root, drawn by the image entry: renderImage() goes through prepare(), so the template's
 * check runs first, a failing one rejects with its problems, and what's drawn is the design the template built.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type React from "react";
import { Canvas, Heading, Text, prop } from "@hyper-elements/react";
import { layoutImage, renderImage } from "../../src/image";
import { template } from "../../src/template";
import { launch } from "../../src/template/examples";

const STANDARD = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts");
const regular = { family: "Liberation Sans", src: readFileSync(join(STANDARD, "LiberationSans-Regular.ttf")) };
// A template's design is drawn strict: each weight it uses has its file.
const fonts = [regular, { family: "Liberation Sans", src: readFileSync(join(STANDARD, "LiberationSans-Bold.ttf")), weight: 700 }];
/** A 1×1 PNG, for each image the example names. */
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const images = { [launch.example.screenshot.src]: PNG, [launch.example.artwork.src]: PNG };
const Launch = launch as unknown as React.FC<Record<string, unknown>>;

it("draws a template design in its format, the same bytes as the design it builds", async () => {
  const fromDesign = await renderImage(<Launch format="landscape" {...launch.example} />, { fonts, images });
  const built = await renderImage(launch.design(launch.example, { format: "landscape" }), { fonts, images });
  expect([fromDesign.width, fromDesign.height]).toEqual([1200, 675]);
  expect(Buffer.from(fromDesign.image).equals(Buffer.from(built.image))).toBe(true);
});

it("rejects a design the template refuses, with the template's problems, and one with no format named", async () => {
  await expect(renderImage(<Launch format="square" {...launch.example} features={["one"]} />, { fonts, images })).rejects.toMatchObject({
    diagnostics: expect.arrayContaining([expect.objectContaining({ code: "template/count", path: "values.features" })]),
  });
  await expect(renderImage(<Launch {...launch.example} />, { fonts, images })).rejects.toMatchObject({
    diagnostics: expect.arrayContaining([expect.objectContaining({ code: "template/format" })]),
  });
});

describe("a template's design, whatever its rules", () => {
  let renders = 0;
  // No rule of its requires anything measured.
  const Card = template({
    id: "acme.Card",
    version: "1.0.0",
    label: "Card",
    root: "Canvas",
    fields: { title: prop.text({ label: "Title", required: true }) },
    example: { title: "Hi" },
    render: (v) => {
      renders++;
      return (
        <Canvas width={400} height={120} style={{ fontFamily: "Liberation Sans", padding: 10 }}>
          <Heading field="title" style={{ fontSize: 40 }}>{v.title}</Heading>
          <Text>Subtitle</Text>
        </Canvas>
      );
    },
  });
  const CardDesign = Card as unknown as React.FC<Record<string, unknown>>;
  const LONG = "A title that runs well past the bottom of a Canvas this small, on every line it takes";
  const errors = (thrown: unknown) => (thrown as { diagnostics: Array<{ code: string; severity: string }> }).diagnostics.filter((d) => d.severity === "error").map((d) => d.code);

  it("is drawn strict: a weight with no file, and content past the Canvas, reject its snapshot and its design alike", async () => {
    const checked = Card.check({ title: LONG });
    expect([checked.valid, checked.rules]).toEqual([true, []]);
    for (const design of [checked.snapshots.default!, <CardDesign title={LONG} />]) {
      expect(errors(await renderImage(design, { fonts: [regular] }).catch((thrown) => thrown))).toEqual(["image/font-weight", "image/overflow"]);
      expect((await layoutImage(design, { fonts: [regular] })).diagnostics.filter((d) => d.severity === "error").map((d) => d.code)).toEqual(["image/font-weight", "image/overflow"]);
    }
    // The same design outside a template is drawn with warnings, unless strict is asked for.
    const plain = Card.design({ title: LONG });
    expect((await renderImage(plain, { fonts: [regular] })).diagnostics.map((d) => `${d.severity} ${d.code}`)).toEqual(expect.arrayContaining(["warning image/font-weight", "warning image/overflow"]));
  });

  it("is collected once by each call: its template's check, and its components, run once", async () => {
    renders = 0;
    await renderImage(<CardDesign title="Hi" />, { fonts });
    expect(renders).toBe(1);
    renders = 0;
    await layoutImage(<CardDesign title="Hi" />, { fonts });
    expect(renders).toBe(1);
    let plain = 0;
    const Plain = () => {
      plain++;
      return <Canvas width={400} height={120} style={{ fontFamily: "Liberation Sans" }}><Text>Hi</Text></Canvas>;
    };
    await renderImage(<Plain />, { fonts });
    expect(plain).toBe(1);
  });
});
