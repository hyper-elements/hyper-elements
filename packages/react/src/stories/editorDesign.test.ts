/** The editor's copy of a design: images it can reach and fonts it loads, with `toDesign`'s own design left as it was. */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toDesign } from "../builder";
import { Document, Email, Heading, Image, Section, Table, TableCell, TableRow, Text } from "../primitives";
import { forTheEditor } from "./editorDesign";

const FACE = { family: "Geist", src: "https://fonts.example/geist.woff2", format: "woff2", weight: "100 900" };
const template = createElement(
  Email,
  { fonts: [FACE], style: { fontFamily: "Geist, Arial, sans-serif" } },
  createElement(Section, null, createElement(Text, null, "Words"), createElement(Image, { src: { src: "gallery/a.png", width: 100, height: 100 }, alt: "A" }), createElement(Image, { src: { src: "https://cdn.example/b.png", width: 100, height: 100 }, alt: "B" })),
);
const urls = (design: unknown) => JSON.stringify(design).match(/"url":"[^"]*"/g) ?? [];

afterEach(() => vi.unstubAllGlobals());

describe("forTheEditor", () => {
  it("makes a relative image absolute where it can't be read, and leaves an absolute one", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const { design } = await forTheEditor(template, toDesign(template).design, "https://stories.example/iframe.html");
    expect(urls(design)).toContain('"url":"https://stories.example/gallery/a.png"');
    expect(urls(design)).toContain('"url":"https://cdn.example/b.png"');
  });

  it("puts an image it can read in the design, as a data URI", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("png", { headers: { "content-type": "image/png" } })));
    const { design } = await forTheEditor(template, toDesign(template).design, "https://stories.example/");
    expect(urls(design).some((url) => url.startsWith('"url":"data:image/png'))).toBe(true);
    expect(JSON.stringify(design)).not.toContain("gallery/a.png");
  });

  it("gives each font the design names its stylesheet, and doesn't touch the design it was given", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const given = toDesign(template).design;
    const before = JSON.stringify(given);
    const { design, fonts } = await forTheEditor(template, given, "https://stories.example/");
    const [font] = fonts.customFonts;
    expect(font.label).toBe("Geist");
    expect(decodeURIComponent(font.url ?? "")).toContain("https://fonts.example/geist.woff2");
    expect(font.weights).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
    expect(JSON.stringify(design.body.values)).toContain("data:text/css");
    expect(JSON.stringify(given)).toBe(before);
  });

  it("gives the font picker each font's weights as the design lists them, and its faces' for a font no block is in", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const faces = [
      { family: "Geist", src: "https://fonts.example/geist-400.woff2", weight: 400 },
      { family: "Geist", src: "https://fonts.example/geist-600.woff2", weight: 600 },
      { family: "Lora", src: "https://fonts.example/lora.woff2", weight: [300, 500] },
    ];
    // A Heading at 500, which no face of Geist has.
    const medium = createElement(Email, { fonts: faces, style: { fontFamily: "Geist, Arial, sans-serif" } }, createElement(Heading, { style: { fontWeight: 500 } }, "Title"));
    const { fonts } = await forTheEditor(medium, toDesign(medium).design, "https://stories.example/");
    expect(fonts.customFonts.map((font) => [font.label, font.weights])).toEqual([["Geist", [400, 500, 600, 700]], ["Lora", [300, 400, 500, 700]]]);
  });

  it("takes a font's stack and weights from a table, where it's only a table's", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const table = createElement(Table, { style: { fontFamily: "Geist, Arial, sans-serif", fontWeight: 600 } }, createElement(TableRow, null, createElement(TableCell, null, "Words")));
    const document = createElement(Document, { fonts: [{ family: "Geist", src: "https://fonts.example/geist-400.woff2", weight: 400 }] }, table);
    const { fonts } = await forTheEditor(document, toDesign(document).design, "https://stories.example/");
    expect(fonts.customFonts.map(({ label, value, weights }) => [label, value, weights])).toEqual([["Geist", "Geist, Arial, sans-serif", [400, 600, 700]]]);
  });
});
