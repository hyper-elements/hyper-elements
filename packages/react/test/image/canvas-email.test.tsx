/**
 * An Email's pictures through render() and emailImages(): each Canvas in it, and each Svg on its own, drawn as a PNG
 * at twice its size, the HTML linking to it. What core writes and says is in core's pictures tests; this is the
 * drawing, its name and what render() returns.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Canvas, Circle, defineElement, ElementsError, Email, Image, Rect, Section, Svg, Text, render } from "@hyper-elements/react";
import { emailImages, renderImage, type ImageFont } from "../../src/image";
import { pixel, pngSize } from "./png";

const FONT = readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", "LiberationSans-Regular.ttf"));
const fonts = [{ family: "Liberation Sans", src: FONT }];
const BASE = "https://cdn.example.com/email/";

const launch = (
  <Email>
    <Section>
      <Text>Tonight</Text>
      <Canvas width={300} height={120} alt="Launch night: doors at 8" style={{ backgroundColor: "#1e1b4b", color: "#fde68a", fontFamily: "Liberation Sans", padding: 20 }}>
        <Text style={{ fontSize: 28 }}>Launch night</Text>
        <Svg width={40} height={40}>
          <Circle cx={20} cy={20} r={16} style={{ fill: "#fde68a" }} />
        </Svg>
      </Canvas>
    </Section>
  </Email>
);

describe("an Email's Canvas through render() and emailImages()", () => {
  it("returns its PNG at twice its size, the HTML linking to it, drawn with the fonts given", async () => {
    const { html, files } = await render(launch, { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } });
    expect(files!.length).toBe(1);
    const [png] = files!;
    expect(png!.name).toMatch(/^[0-9a-f]{32}-2x\.png$/);
    expect(png!.contentType).toBe("image/png");
    expect(html).toContain(`src="${BASE}${png!.name}"`);
    expect([png!.width, png!.height]).toEqual([300, 120]);
    expect(pngSize(png!.bytes)).toEqual([600, 240]);
    // Its background at a corner; the moon below the heading (padding 20, then the heading's line: its center about
    // 40, 80 in px, 80, 160 at 2x); and the heading's text drawn in its color across its line.
    expect(await pixel(png!.bytes, 2, 2)).toEqual([0x1e, 0x1b, 0x4b, 255]);
    expect(await pixel(png!.bytes, 80, 160)).toEqual([0xfd, 0xe6, 0x8a, 255]);
    const row = await Promise.all(Array.from({ length: 300 }, (_, x) => pixel(png!.bytes, 40 + x, 85)));
    expect(row.filter(([r, g, b]) => r === 0xfd && g === 0xe6 && b === 0x8a).length).toBeGreaterThan(20);
  });

  it("draws the same file every time, and another at another scale or with other fonts", async () => {
    const one = await render(launch, { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } });
    const two = await render(launch, { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } });
    expect(two.files![0]!.name).toBe(one.files![0]!.name);
    expect(Buffer.from(two.files![0]!.bytes).equals(Buffer.from(one.files![0]!.bytes))).toBe(true);
    const three = await render(launch, { assets: { baseUrl: BASE, draw: emailImages({ fonts, scale: 3 }) } });
    expect(three.files![0]!.name).toMatch(/-3x\.png$/);
    expect(pngSize(three.files![0]!.bytes)).toEqual([900, 360]);
    // Another file of the same family, another image given: another key, so another name.
    const key = (options: Parameters<typeof emailImages>[0]) => emailImages(options).key;
    expect(key({ fonts })).toBe(key({ fonts: [{ family: "Liberation Sans", src: Uint8Array.from(FONT) }] }));
    expect(key({ fonts: [{ family: "Liberation Sans", src: Uint8Array.from(FONT.subarray(0, 100)) }] })).not.toBe(key({ fonts }));
    expect(key({ fonts, images: { "https://example.com/a.png": new Uint8Array([1]) } })).not.toBe(key({ fonts }));
    expect(() => emailImages({ scale: 1.5 })).toThrow("emailImages({ scale }) takes a whole number from 1 to 4");
  });

  it("names it by the engines it's drawn with, as installed", () => {
    // Read from satori's and resvg's own package.json: another version is another key, so another file.
    const require = createRequire(import.meta.url);
    const versions = [require("satori/package.json").version as string, require("@resvg/resvg-js/package.json").version as string];
    expect(versions.every((v) => /^\d+\.\d+\.\d+/.test(v))).toBe(true);
    expect(emailImages({ fonts }).key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects where its text's font isn't given, at the Canvas's place in the Email", async () => {
    const error = await render(launch, { assets: { baseUrl: BASE, draw: emailImages() } }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ElementsError);
    const found = (error as ElementsError).diagnostics.filter((d) => d.severity === "error");
    expect(found.map((d) => d.code)).toContain("image/font");
    expect(found.every((d) => d.path.startsWith("root.children[0].children[1]"))).toBe(true);
    // A family the Email loads as a web font, with another family's file given: an error too, not a warning and a
    // picture in another type than the email around it.
    const webFont = (
      <Email fonts={[{ family: "Liberation Sans", src: "https://fonts.example.com/liberation.woff" }]}>
        <Canvas width={300} height={120} alt="Launch night" style={{ backgroundColor: "#1e1b4b", fontFamily: "Liberation Sans" }}>
          <Text>Launch night</Text>
        </Canvas>
      </Email>
    );
    const other = await render(webFont, { assets: { baseUrl: BASE, draw: emailImages({ fonts: [{ family: "Other", src: FONT }] }) } }).catch((e: unknown) => e);
    expect(other).toBeInstanceOf(ElementsError);
    const errors = (other as ElementsError).diagnostics.filter((d) => d.severity === "error");
    // The family's file missing, where the Email gives its fonts, said with what to pass.
    expect(errors.map((d) => [d.code, d.path])).toEqual([["image/font", "root.props.fonts"]]);
    expect(errors[0]!.message).toContain("emailImages({ fonts })");
    // A family the Email doesn't load (a system font, as Georgia), with another's file given: drawn, with a warning
    // naming both.
    const georgia = (
      <Email>
        <Canvas width={300} height={120} alt="Launch night" style={{ backgroundColor: "#1e1b4b", fontFamily: "Georgia, serif" }}>
          <Text>Launch night</Text>
        </Canvas>
      </Email>
    );
    const drawn = await render(georgia, { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } });
    expect(drawn.diagnostics.filter((d) => d.code === "image/font-family").map((d) => [d.severity, d.path, d.message])).toEqual([
      ["warning", "root.children[0].children[0]", "Text in Georgia, serif is drawn in Liberation Sans: none of its fonts is given. Give its file in emailImages({ fonts })"],
    ]);
  });

  it("says what runs past it, and rejects a character its font doesn't have", async () => {
    const long = (
      <Email>
        <Canvas width={300} height={60} alt="A long line" style={{ backgroundColor: "#1e1b4b", fontFamily: "Liberation Sans" }}>
          <Text fit={{ sizes: [40, 30, 20] }}>A long line that can't fit on one line at any of these sizes</Text>
        </Canvas>
      </Email>
    );
    // Drawn, with a warning: as a Canvas of its own would be.
    const { files, diagnostics } = await render(long, { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } });
    expect(files!.length).toBe(1);
    expect(diagnostics.filter((d) => d.code === "image/overflow").map((d) => [d.severity, d.path])).toEqual([["warning", "root.children[0].children[0]"]]);
    // A character the font doesn't have would be a box in the picture: an error.
    const arabic = (
      <Email dir="rtl">
        <Canvas width={300} height={60} alt="مرحبا" style={{ backgroundColor: "#1e1b4b", fontFamily: "Liberation Sans" }}>
          <Text>مرحبا</Text>
        </Canvas>
      </Email>
    );
    const error = await render(arabic, { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } }).catch((e: unknown) => e);
    expect((error as ElementsError).diagnostics.filter((d) => d.severity === "error").map((d) => [d.code, d.path])).toEqual([["image/glyph", "root.children[0].children[0]"]]);
  });

  it("rejects an Email with a Canvas and no assets, saying what to pass", async () => {
    const error = await render(launch).catch((e: unknown) => e);
    expect((error as ElementsError).diagnostics.map((d) => [d.code, d.path])).toEqual([["email/canvas-assets", "root.children[0].children[1]"]]);
    expect((error as ElementsError).diagnostics[0]!.fix).toContain("emailImages from @hyper-elements/react/image");
  });
});

describe("an Email's Svg on its own", () => {
  const moon = (
    <Email>
      <Svg width={120} height={60} title="The moon over the sea">
        <Rect width={120} height={60} style={{ fill: "#1e1b4b" }} />
        <Circle cx={90} cy={30} r={14} style={{ fill: "#fde68a" }} />
      </Svg>
    </Email>
  );

  it("is a PNG of its drawing at twice its size, with no font given", async () => {
    const { html, files } = await render(moon, { assets: { baseUrl: BASE, draw: emailImages() } });
    const [png] = files!;
    expect(html).toContain(`alt="The moon over the sea"`);
    expect(pngSize(png!.bytes)).toEqual([240, 120]);
    expect(await pixel(png!.bytes, 2, 2)).toEqual([0x1e, 0x1b, 0x4b, 255]);
    expect(await pixel(png!.bytes, 180, 60)).toEqual([0xfd, 0xe6, 0x8a, 255]);
  });

  it("keeps what shows in a fractional viewBox, and draws a far translucent shape without ending the process", () => {
    // resvg ends the process (SIGABRT) on a layer far outside the canvas: run where that can't stop the tests.
    const run = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
        import assert from "node:assert/strict";
        import { createElement as h } from "react";
        import { Email, Rect, Svg, render } from "@hyper-elements/react";
        import { emailImages } from "@hyper-elements/react/image";
        const assets = { baseUrl: "https://cdn.example.com/email/", draw: emailImages() };
        // A visible shape in the letterbox margin of a 600 x 20.51 drawing.
        const margin = await render(h(Email, null, h(Svg, { width: 600, height: 20.51, viewBox: "0 0 400 20.51" }, h(Rect, { x: 495, width: 2, height: 20.51, style: { fill: "#d40852" } }))), { assets });
        const bytes = margin.files[0].bytes;
        assert.ok(bytes.length > 0);
        // A distant translucent shape in a drawing less than a pixel tall.
        const far = await render(h(Email, null, h(Svg, { width: 40, height: 0.4, viewBox: "0 0 40 20" }, h(Rect, { width: 40, height: 20 }), h(Rect, { x: 20000, width: 40, height: 20, style: { opacity: 0.5 } }))), { assets });
        assert.equal(far.files.length, 1);
        process.stdout.write(Buffer.from(bytes).toString("base64"));
      `,
      ],
      { cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8", timeout: 20_000 }
    );
    expect(run.signal, run.stderr).toBeNull();
    expect(run.status, run.stderr).toBe(0);
    return (async () => {
      const bytes = Uint8Array.from(Buffer.from(run.stdout, "base64"));
      // The rect at x 495 of 400 units, centered in 600 px at 1.5 px a unit: shown at 2x, about x 1191.
      const found = await Promise.all(Array.from({ length: 12 }, (_, i) => pixel(bytes, 1186 + i, 20)));
      expect(found.some(([r, g, b, a]) => r === 0xd4 && g === 0x08 && b === 0x52 && a === 255)).toBe(true);
    })();
  });
});

describe("the engines' versions, in a drawer's key", () => {
  it("are read as installed, and unknown where a package isn't", async () => {
    const { installedVersion } = await import("../../src/image/engines");
    const require = createRequire(import.meta.url);
    expect(installedVersion("satori")).toBe(require("satori/package.json").version);
    expect(installedVersion("@resvg/resvg-js")).toBe(require("@resvg/resvg-js/package.json").version);
    expect(installedVersion("no-such-package-anywhere")).toBe("unknown");
  });
});

describe("an Email's picture, as the Canvas it is", () => {
  it("is drawn as the Canvas on its own is, a custom element's fitted text in it measured", async () => {
    const Title = defineElement({ type: "acme.Title", label: "Title", props: {}, render: () => <Text fit={{ sizes: [30, 20] }}>Promo</Text> });
    const canvas = (
      <Canvas width={120} height={60} style={{ fontFamily: "Liberation Sans", backgroundColor: "#ffffff" }}>
        <Title />
      </Canvas>
    );
    const alone = await renderImage(canvas, { fonts, scale: 2 });
    const { files } = await render(<Email>{canvas}</Email>, { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } });
    expect(Buffer.from(files![0]!.bytes).equals(Buffer.from(alone.image))).toBe(true);
  });

  it("starts its text on its own direction's side, in an Email of the other", async () => {
    const canvas = (
      <Canvas width={120} height={50} dir="rtl" style={{ fontFamily: "Liberation Sans", backgroundColor: "#ffffff" }}>
        <Text>Promo</Text>
      </Canvas>
    );
    // Where the first dark pixel of the text's line is, from the left.
    const ink = async (bytes: Uint8Array) => (await Promise.all(Array.from({ length: 120 }, (_, x) => pixel(bytes, x, 12)))).findIndex(([r, g, b]) => r! < 128 && g! < 128 && b! < 128);
    expect(await ink((await renderImage(canvas, { fonts })).image)).toBeGreaterThan(60);
    const { files } = await render(<Email dir="ltr">{canvas}</Email>, { assets: { baseUrl: BASE, draw: emailImages({ fonts, scale: 1 }) } });
    expect(await ink(files![0]!.bytes)).toBeGreaterThan(60);
  });

  it("is drawn with the files its drawer was given then, whatever is done with them after", async () => {
    const square = async (fill: string) =>
      (
        await renderImage(
          <Canvas width={20} height={20}>
            <Svg width={20} height={20}>
              <Rect width={20} height={20} style={{ fill }} />
            </Svg>
          </Canvas>
        )
      ).image;
    const url = "https://example.com/logo.png";
    const images: Record<string, Uint8Array> = { [url]: await square("#ff0000") };
    const draw = emailImages({ images });
    const email = (
      <Email>
        <Canvas width={20} height={20} alt="Logo">
          <Image src={{ src: url, width: 20, height: 20 }} alt="" />
        </Canvas>
      </Email>
    );
    const first = (await render(email, { assets: { baseUrl: BASE, draw } })).files![0]!;
    // The bytes given changed where they are, then another file under the same URL: the drawer made with the first
    // still draws the first, under the first's name.
    images[url]!.fill(0);
    images[url] = await square("#0000ff");
    const again = (await render(email, { assets: { baseUrl: BASE, draw } })).files![0]!;
    expect(again.name).toBe(first.name);
    expect(await pixel(again.bytes, 10, 10)).toEqual([255, 0, 0, 255]);
    // A drawer given the second draws it, under another name.
    const other = (await render(email, { assets: { baseUrl: BASE, draw: emailImages({ images }) } })).files![0]!;
    expect(other.name).not.toBe(first.name);
    expect(await pixel(other.bytes, 10, 10)).toEqual([0, 0, 255, 255]);
  });

  it("shows its alt in a color that reads on its background, written as a name or as hex", async () => {
    for (const backgroundColor of ["#000000", "black", "navy"]) {
      const { html } = await render(
        <Email>
          <Svg width={80} height={30} title="Concert tonight" style={{ backgroundColor }} />
        </Email>,
        { assets: { baseUrl: BASE, draw: emailImages() } }
      );
      const style = /<img[^>]*alt="Concert tonight"[^>]*style="([^"]+)"/.exec(html)?.[1];
      expect(style, backgroundColor).toMatch(/(?:^|;)color:#fff(?:fff)?(?:;|$)/);
    }
  });
});

describe("an Email's pictures' fonts, given as a class's", () => {
  const card = (
    <Canvas width={120} height={60} alt="Promo" style={{ fontFamily: "Liberation Sans" }}>
      <Text>Promo</Text>
    </Canvas>
  );

  it("are drawn as the same fonts given as plain objects, the same files", async () => {
    // A family, a weight and a style read through getters, as a class gives them.
    class Regular implements ImageFont {
      readonly src = FONT;
      get family() {
        return "Liberation Sans";
      }
    }
    const plain = (await render(<Email>{card}</Email>, { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } })).files![0]!;
    const fromClass = (await render(<Email>{card}</Email>, { assets: { baseUrl: BASE, draw: emailImages({ fonts: [new Regular()] }) } })).files![0]!;
    expect(fromClass.name).toBe(plain.name);
    expect(Buffer.from(fromClass.bytes).equals(Buffer.from(plain.bytes))).toBe(true);
    const boldItalic = readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", "LiberationSans-BoldItalic.ttf"));
    class BoldItalic implements ImageFont {
      readonly family = "Liberation Sans";
      readonly src = boldItalic;
      get weight() {
        return 700;
      }
      get style() {
        return "italic" as const;
      }
    }
    const loud = (
      <Email>
        <Canvas width={120} height={60} alt="Promo" style={{ fontFamily: "Liberation Sans" }}>
          <Text style={{ fontWeight: 700, fontStyle: "italic" }}>Promo</Text>
        </Canvas>
      </Email>
    );
    const draw = async (face: ImageFont) => (await render(loud, { assets: { baseUrl: BASE, draw: emailImages({ fonts: [...fonts, face] }) } })).files![0]!;
    const given = await draw({ family: "Liberation Sans", src: boldItalic, weight: 700, style: "italic" });
    const got = await draw(new BoldItalic());
    expect(got.name).toBe(given.name);
    expect(Buffer.from(got.bytes).equals(Buffer.from(given.bytes))).toBe(true);
  });

  it("leave the Email's rules for what's after a Canvas: a custom element there takes phone styles", async () => {
    const Title = defineElement({ type: "acme.FitTitle", label: "Title", props: {}, render: () => <Text fit={{ sizes: [30, 20] }}>Promo</Text> });
    const Caption = defineElement({ type: "acme.Caption", label: "Caption", props: {}, render: () => <Text style={{ mobile: { fontSize: 20 } }}>Caption</Text> });
    // Its own alignment over its direction's, and drawn as the Canvas on its own is.
    const canvas = (
      <Canvas width={120} height={60} dir="rtl" style={{ fontFamily: "Liberation Sans", textAlign: "left" }}>
        <Title />
      </Canvas>
    );
    const alone = await renderImage(canvas, { fonts, scale: 2 });
    const email = await render(
      <Email dir="ltr">
        {canvas}
        <Caption />
      </Email>,
      { assets: { baseUrl: BASE, draw: emailImages({ fonts }) } }
    );
    expect(Buffer.from(email.files![0]!.bytes).equals(Buffer.from(alone.image))).toBe(true);
    expect(email.html).toContain("font-size:20px!important");
  });
});
