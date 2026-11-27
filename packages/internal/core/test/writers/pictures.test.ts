/**
 * An Email's pictures: each Canvas in it, and each Svg on its own, cut out and written as an Image of a PNG file under
 * `assets.baseUrl` (writers/email/pictures.ts). What's drawn, and how, is the image entry's (@hyper-elements/react's
 * image tests); here, what core writes, names and says.
 */
import { JSDOM } from "jsdom";
import { ElementsError } from "../../src/diagnostics";
import { finishRender, prepareTemplate, renderTemplate, validateTemplate, type PictureDrawer, type PictureSource } from "../../src/writers";
import { stylesOfText, type ResolvedNode } from "../../src/resolve";
import { defineCustomComponent } from "../../src";

const email = (children: unknown[], extra: Record<string, unknown> = {}) => ({ root: { type: "Email", props: { width: 600 }, children, ...extra } });

/** A drawer that draws nothing: what it was asked to draw is kept, and each file is a byte of the call's number. */
function drawer(key = "k"): PictureDrawer & { asked: PictureSource[] } {
  const asked: PictureSource[] = [];
  return { key, suffix: "2x", extension: "png", contentType: "image/png", asked, draw: async (picture) => (asked.push(picture), { bytes: new Uint8Array([asked.length]), diagnostics: [] }) };
}
const assets = (draw = drawer()) => ({ baseUrl: "https://cdn.example.com/email/", draw });

const card = (extra: Record<string, unknown> = {}, children: unknown[] = [{ type: "Text", children: ["Launch night"] }]) => ({
  type: "Canvas",
  props: { width: 300, height: 100, alt: "Launch night" },
  style: { backgroundColor: "#1e1b4b", color: "#ffffff" },
  children,
  ...extra,
});

const images = (html: string) => [...new JSDOM(html).window.document.querySelectorAll("img")];
const NAME = /^[0-9a-f]{32}-2x\.png$/;

describe("a Canvas in an Email", () => {
  it("is an Image of its PNG under assets.baseUrl, at its size, its alt and background where it doesn't load", async () => {
    const written = renderTemplate(email([{ type: "Text", children: ["Hi"] }, card()]), { assets: assets() });
    const [img] = images(written.html);
    const name = img!.getAttribute("src")!.replace("https://cdn.example.com/email/", "");
    expect(name).toMatch(NAME);
    expect([img!.getAttribute("width"), img!.getAttribute("height"), img!.getAttribute("alt")]).toEqual(["300", "100", "Launch night"]);
    // Images off: its background, its alt text in the text's font, in a color that reads on it (the email's black
    // doesn't, on this dark blue: white does).
    const style = img!.getAttribute("style")!;
    expect(style).toContain("background-color:#1e1b4b");
    expect(style).toMatch(/[;"]color:#fff(fff)?;font-family:Arial, Helvetica, sans-serif;font-size:16px/);
    // On a light background, the text's own color.
    const light = images(renderTemplate(email([card({ style: { backgroundColor: "#fef3c7" } })]), { assets: assets() }).html)[0]!.getAttribute("style")!;
    expect(light).toMatch(/background-color:#fef3c7;color:#000(000)?;/);
    // One picture, its file not drawn yet: finishRender draws it.
    expect(written.pictures!.map((p) => [p.name, p.path, p.width, p.height])).toEqual([[name, "root.children[1]", 300, 100]]);
    expect(written.diagnostics).toEqual([]);
  });

  it("is drawn by finishRender as its own Canvas, with the text styles and fonts of where it is", async () => {
    const draw = drawer();
    const fonts = [{ family: "Inter", src: "https://fonts.example.com/inter.woff" }];
    const template = email([{ type: "Section", style: { color: "#ff0000", fontFamily: "Inter, sans-serif" }, children: [card({ style: { backgroundColor: "#1e1b4b" } })] }], { props: { width: 600, lang: "fr", fonts } });
    const result = await finishRender(renderTemplate(template, { assets: assets(draw) }), { assets: assets(draw) });
    expect(result.files!.map((f) => [f.name, f.contentType, [...f.bytes], f.width, f.height])).toEqual([[result.files![0]!.name, "image/png", [1], 300, 100]]);
    const [asked] = draw.asked;
    expect([asked!.width, asked!.height]).toEqual([300, 100]);
    const root = asked!.document.root;
    expect(root.type).toBe("Canvas");
    expect(root.style).toMatchObject({ color: "#ff0000", fontFamily: "Inter, sans-serif", backgroundColor: "#1e1b4b" });
    expect(root.props).toMatchObject({ width: 300, height: 100, lang: "fr", fonts });
    // What isn't drawn isn't in it: its alt, its place.
    expect(root.props!.alt).toBeUndefined();
    expect(root.id).toBeUndefined();
  });

  it("takes the text the layout gives its place in the Email, all of it, and not a Link's", () => {
    // Around it: the root's theme and text, a Row's direction, a Column's own text styles.
    const placed = email(
      [{ type: "Row", props: { dir: "rtl" }, children: [{ type: "Column", style: { fontSize: 20, letterSpacing: 1, textTransform: "uppercase" }, children: [{ type: "Canvas", props: { width: 300, height: 100, alt: "x" }, style: { backgroundColor: "#000000" }, children: [{ type: "Text", children: ["Hi"] }] }] }] }],
      { props: { width: 600 }, style: { color: "#333333", fontFamily: "Georgia, serif" }, theme: { lineHeights: { body: 1.4 } } }
    );
    const prepared = prepareTemplate(placed, { assets: assets() });
    expect(prepared.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const picture = prepared.pictures![0]!;
    const find = (node: ResolvedNode): ResolvedNode | undefined => (node.path === picture.laidOut ? node : node.children.flatMap((c) => (typeof c === "string" ? [] : [find(c)])).find(Boolean));
    // What the layout gives the Image in its place is the picture's text, every style of it (its own background over it).
    const { backgroundColor, ...text } = picture.document.root.style as Record<string, unknown>;
    expect(backgroundColor).toBe("#000000");
    expect(text).toEqual(stylesOfText(find(prepared.resolved!.root)!.text));
    expect(text).toMatchObject({ color: "#333333", fontFamily: "Georgia, serif", fontSize: 20, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" });
    // In a Link: the Link's color is its words', not the picture's.
    const linked = renderTemplate(email([{ type: "Link", props: { href: "https://example.com" }, children: [card({ style: { backgroundColor: "#000000" } })] }]), { assets: assets() });
    expect((linked.pictures![0]!.document.root.style as Record<string, unknown>).color).toBe("#000000");
  });

  it("takes the text, direction and language of its place, wherever that is, as the Email gives them there", () => {
    // A value (not the root's) of each text style the layout passes down. One it passes that has no value here fails
    // this, so each is tried in every place below.
    const outer: Record<string, unknown> = { color: "#123456", fontFamily: "Georgia, serif", fontSize: 21, fontWeight: 700, fontStyle: "italic", lineHeight: 1.3, letterSpacing: 2, textAlign: "center", textTransform: "uppercase" };
    const passedDown = Object.keys(stylesOfText(prepareTemplate(email([{ type: "Text", children: ["x"] }])).resolved!.root.text));
    expect(Object.keys(outer).sort()).toEqual(passedDown.sort());
    const inner = { fontSize: 13, color: "#abcdef", textTransform: "lowercase" };
    const canvas = { type: "Canvas", props: { width: 300, height: 100, alt: "x" }, style: { backgroundColor: "#000000" }, children: [{ type: "Text", children: ["Hi"] }] };
    const svg = { type: "Svg", props: { width: 40, height: 20, title: "A moon" }, children: [{ type: "Circle", props: { cx: 20, cy: 10, r: 8 } }] };
    const photo = { type: "Image", props: { src: { src: "https://example.com/photo.png", width: 600, height: 300 }, alt: "" } };
    const holder = (picture: unknown) => defineCustomComponent({ type: "acme.Holder", label: "Holder", props: {}, expand: () => ({ type: "Column", style: inner, children: [picture] }) as never });
    const text = { type: "Text", children: ["y"] };
    // Each place: the Email's children around the picture, and what's on its root.
    const places: Record<string, (picture: unknown) => { children: unknown[]; root?: Record<string, unknown> }> = {
      "the Email": (p) => ({ children: [p], root: { style: outer } }),
      "a Section": (p) => ({ children: [{ type: "Section", style: outer, children: [p] }] }),
      "a Column in a Section": (p) => ({ children: [{ type: "Section", style: outer, children: [{ type: "Column", style: inner, children: [p] }] }] }),
      "a Row right to left": (p) => ({ children: [{ type: "Section", style: outer, children: [{ type: "Row", props: { dir: "rtl" }, children: [{ type: "Column", children: [p] }, { type: "Column", children: [text] }] }] }] }),
      "a Grid": (p) => ({ children: [{ type: "Section", style: outer, children: [{ type: "Grid", props: { columns: 2 }, children: [p, text] }] }] }),
      "a Layer": (p) => ({ children: [{ type: "Section", style: outer, children: [{ type: "Layer", children: [photo, p] }] }] }),
      "a Link": (p) => ({ children: [{ type: "Section", style: outer, children: [{ type: "Link", props: { href: "https://example.com" }, children: [p] }] }] }),
      "a custom element": () => ({ children: [{ type: "Section", style: outer, children: [{ type: "acme.Holder" }] }] }),
      "a theme and a scope": (p) => ({ children: [{ type: "Section", tokens: { colors: { foreground: "#00aa00" }, fontSizes: { body: 19 } }, children: [p] }], root: { theme: { colors: { foreground: "#222222" } } } }),
      "an Email right to left, in Arabic": (p) => ({ children: [{ type: "Section", style: inner, children: [p] }], root: { props: { width: 600, dir: "rtl", lang: "ar" } } }),
    };
    const at = (node: ResolvedNode, path: string): ResolvedNode | undefined => (node.path === path ? node : node.children.flatMap((c) => (typeof c === "string" ? [] : [at(c, path)])).find(Boolean));
    const up = (path: string) => path.replace(/\.children\[\d+\]$/, "");
    for (const [where, place] of Object.entries(places)) {
      // An Svg goes in a Link in a Canvas (a Link takes a Canvas, not an Svg).
      for (const picture of where === "a Link" ? [canvas] : [canvas, svg]) {
        const label = `a ${picture.type} in ${where}`;
        const { children, root } = place(picture);
        const template = email(children, root);
        const options = { assets: assets(), components: [holder(picture)] };
        const prepared = prepareTemplate(template, options);
        expect(prepared.diagnostics.filter((d) => d.severity === "error"), label).toEqual([]);
        const cut = prepared.pictures![0]!;
        // What the layout gives its place: its Image's parent's text (a Link gives a picture what it's given).
        const given = where === "a Link" ? up(up(cut.laidOut)) : up(cut.laidOut);
        const drawn: Record<string, unknown> = { ...(cut.document.root.style as Record<string, unknown>) };
        if (picture === canvas) delete drawn.backgroundColor;
        expect(drawn, label).toEqual(stylesOfText(at(prepared.resolved!.root, given)!.text));
        // Its direction and language: those the Email writes around its Image.
        const img = images(renderTemplate(template, options).html)[0]!;
        expect(cut.document.root.props!.dir ?? null, label).toBe(img.closest("[dir]")?.getAttribute("dir") ?? null);
        expect(cut.document.root.props!.lang ?? null, label).toBe(img.closest("[lang]")?.getAttribute("lang") ?? null);
      }
    }
  });

  it("names its file by what's drawn and what draws it, the same however it was written", () => {
    const src = (template: unknown, key = "k") => images(renderTemplate(template, { assets: assets(drawer(key)) }).html).map((img) => img.getAttribute("src"));
    const one = src(email([card()]));
    expect(src(email([card()]))).toEqual(one);
    // Its props in another order: the same picture.
    const reordered = { ...card(), props: { alt: "Launch night", height: 100, width: 300 } };
    expect(src(email([reordered]))).toEqual(one);
    // Its alt isn't drawn: the same file.
    expect(src(email([card({ props: { width: 300, height: 100, alt: "Other" } })]))).toEqual(one);
    // Another text, another size, another drawer: another file.
    expect(src(email([card({}, [{ type: "Text", children: ["Launch day"] }])]))).not.toEqual(one);
    expect(src(email([card({ props: { width: 301, height: 100, alt: "Launch night" } })]))).not.toEqual(one);
    expect(src(email([card()]), "other")).not.toEqual(one);
    // The same picture twice: one file.
    expect(new Set(src(email([card(), card()]))).size).toBe(1);
  });

  it("draws each file once, and rejects with its errors at the Canvas's place where one can't be drawn", async () => {
    const draw = drawer();
    const twice = email([card(), card()]);
    const result = await finishRender(renderTemplate(twice, { assets: assets(draw) }), { assets: assets(draw) });
    expect(result.files!.length).toBe(1);
    expect(draw.asked.length).toBe(1);
    const failing: PictureDrawer = { ...drawer(), draw: async () => Promise.reject(new ElementsError([{ code: "image/font", severity: "error", message: "no font", path: "root.children[0]" }])) };
    const error = await finishRender(renderTemplate(email([{ type: "Text", children: ["x"] }, card()]), { assets: assets(failing as never) }), { assets: assets(failing as never) }).catch((e: unknown) => e);
    expect((error as ElementsError).diagnostics.map((d) => [d.code, d.path])).toEqual([["image/font", "root.children[1].children[0]"]]);
    const broken: PictureDrawer = { ...drawer(), draw: async () => Promise.reject(new Error("engine gone")) };
    const other = await finishRender(renderTemplate(email([card()]), { assets: assets(broken as never) }), { assets: assets(broken as never) }).catch((e: unknown) => e);
    expect((other as ElementsError).diagnostics.map((d) => [d.code, d.path, d.message])).toEqual([["email/canvas-draw", "root.children[0]", "This picture couldn't be drawn: engine gone"]]);
  });

  it("needs assets to render, not to validate, and says what to pass", () => {
    expect(() => renderTemplate(email([{ type: "Text", children: ["x"] }, card()]))).toThrow(ElementsError);
    const error = (() => {
      try {
        renderTemplate(email([{ type: "Text", children: ["x"] }, card()]));
      } catch (e) {
        return e as ElementsError;
      }
    })()!;
    expect(error.diagnostics.map((d) => [d.code, d.path])).toEqual([["email/canvas-assets", "root.children[1]"]]);
    expect(error.diagnostics[0]!.fix).toContain("emailImages from @hyper-elements/react/image");
    expect(validateTemplate(email([card()])).valid).toBe(true);
    for (const bad of [{ baseUrl: "cdn/", draw: drawer() }, { baseUrl: "https://cdn.example.com/?v=2", draw: drawer() }, { baseUrl: "https://cdn.example.com/", draw: {} }]) {
      expect(() => renderTemplate(email([card()]), { assets: bad as never })).toThrow("assets");
    }
  });

  it("links its file in the folder baseUrl names, with or without its last slash", () => {
    const src = (baseUrl: string) => images(renderTemplate(email([card()]), { assets: { ...assets(), baseUrl } }).html)[0]!.getAttribute("src")!;
    expect(src("https://cdn.example.com/assets")).toBe(src("https://cdn.example.com/assets/"));
    expect(src("https://cdn.example.com")).toMatch(/^https:\/\/cdn\.example\.com\/[0-9a-f]{32}-2x\.png$/);
  });

  it("is drawn in the direction and theme of where it is", () => {
    // A Row's direction, which what's in it takes.
    const rtl = renderTemplate(email([{ type: "Row", props: { dir: "rtl" }, children: [{ type: "Column", children: [card()] }] }]), { assets: assets() });
    expect(rtl.pictures![0]!.document.root.props!.dir).toBe("rtl");
    const own = renderTemplate(email([{ type: "Row", props: { dir: "rtl" }, children: [{ type: "Column", children: [card({ props: { width: 300, height: 100, alt: "x", dir: "ltr" } })] }] }]), { assets: assets() });
    expect(own.pictures![0]!.document.root.props!.dir).toBe("ltr");
    // The template's theme, which its named styles and tokens are read against when it's drawn.
    const theme = { colors: { brand: "#ff0000" }, styles: { loud: { color: "{colors.brand}" } } };
    const themed = email([card({}, [{ type: "Text", style: { apply: ["loud"] }, children: ["Loud"] }])], { theme });
    const written = renderTemplate(themed, { assets: assets() });
    expect(written.pictures![0]!.document.theme).toEqual(theme);
    expect(validateTemplate(written.pictures![0]!.document).valid).toBe(true);
    // A token a scope around it gives, as it gives it there.
    const scoped = renderTemplate(
      email([{ type: "Section", tokens: { colors: { brand: "#00ff00" } }, children: [card({ style: { backgroundColor: { $token: "colors.brand" } } })] }], { theme }),
      { assets: assets() }
    );
    expect(scoped.pictures![0]!.document.root.style).toMatchObject({ backgroundColor: "#00ff00" });
    // Another theme is another picture.
    const other = renderTemplate(email([card({}, [{ type: "Text", style: { apply: ["loud"] }, children: ["Loud"] }])], { theme: { ...theme, colors: { brand: "#00ff00" } } }), { assets: assets() });
    expect(other.pictures![0]!.name).not.toBe(written.pictures![0]!.name);
  });

  it("says a font the Email gives at its place among the Email's fonts", () => {
    const fonts = [{ family: "Brand", src: "https://fonts.example.com/brand.woff" }];
    const own = [{ family: "Own", src: "https://fonts.example.com/own.woff" }];
    const written = renderTemplate(email([card({ props: { width: 300, height: 100, alt: "x", fonts: own } })], { props: { width: 600, fonts } }), { assets: assets() });
    const picture = written.pictures![0]!;
    expect(picture.document.root.props!.fonts).toEqual([...own, ...fonts]);
    expect([picture.at("root.props.fonts[0]"), picture.at("root.props.fonts[1].src"), picture.at("root.children[0]")]).toEqual(["root.children[0].props.fonts[0]", "root.props.fonts[0].src", "root.children[0].children[0]"]);
  });

  it("is drawn a few at a time, and not without the assets it was written with", async () => {
    let now = 0;
    let most = 0;
    const slow: PictureDrawer = {
      ...drawer(),
      draw: async () => {
        most = Math.max(most, ++now);
        await new Promise((done) => setTimeout(done, 5));
        now--;
        return { bytes: Uint8Array.of(1), diagnostics: [] };
      },
    };
    const many = email(Array.from({ length: 9 }, (_, i) => card({}, [{ type: "Text", children: [`Card ${i}`] }])));
    const result = await finishRender(renderTemplate(many, { assets: assets(slow as never) }), { assets: assets(slow as never) });
    expect(result.files!.length).toBe(9);
    expect(most).toBe(4);
    await expect(finishRender(renderTemplate(many, { assets: assets() }))).rejects.toThrow("pass them to finishRender() too");
  });

  it("says what each drawing found in the pictures' order, whichever is drawn first", async () => {
    // The first picture takes longest: its finding still comes first.
    const late: PictureDrawer = {
      ...drawer(),
      draw: async (picture) => {
        const words = JSON.stringify(picture.document.root.children);
        await new Promise((done) => setTimeout(done, words.includes("First") ? 20 : 1));
        return { bytes: Uint8Array.of(1), diagnostics: [{ code: "image/note", severity: "info", message: words.includes("First") ? "first" : "second", path: "root" }] };
      },
    };
    const two = email([card({}, [{ type: "Text", children: ["First"] }]), card({}, [{ type: "Text", children: ["Second"] }])]);
    const result = await finishRender(renderTemplate(two, { assets: assets(late as never) }), { assets: assets(late as never) });
    expect(result.diagnostics.filter((d) => d.code === "image/note").map((d) => [d.message, d.path])).toEqual([
      ["first", "root.children[0]"],
      ["second", "root.children[1]"],
    ]);
  });

  it("is a root or a picture in an Email, and nothing else", () => {
    const codes = (template: unknown) => validateTemplate(template).diagnostics.filter((d) => d.severity === "error").map((d) => [d.code, d.path]);
    expect(codes({ root: { type: "Page", children: [card()] } })).toEqual([["element/not-supported", "root.children[0]"]]);
    expect(codes({ root: { type: "Canvas", props: { width: 400, height: 200 }, children: [card()] } })).toEqual([["element/not-supported", "root.children[0]"]]);
    expect(codes({ root: { type: "Canvas", props: { width: 400, height: 200 }, children: [{ type: "Text", children: ["x"] }] } })).toEqual([]);
    // What's in it is a Canvas's: fit, which an Email's Text doesn't take.
    const fitted = card({}, [{ type: "Text", props: { fit: { sizes: [40, 32, 24] } }, children: ["Launch night"] }]);
    expect(codes(email([fitted]))).toEqual([]);
    // (What a page preview says of fit isn't said of a picture: it's measured where it's drawn.)
    expect(validateTemplate(email([fitted])).diagnostics).toEqual([]);
  });

  it("links where it's in a Link, and is left out where it's hidden, its file kept", () => {
    const linked = renderTemplate(email([{ type: "Link", props: { href: "https://example.com/launch" }, children: [card()] }]), { assets: assets() });
    expect(new JSDOM(linked.html).window.document.querySelector('a[href="https://example.com/launch"] img')).not.toBeNull();
    const hidden = renderTemplate(email([{ type: "Text", children: ["x"] }, card({ hidden: { mobile: true, desktop: true } })]), { assets: assets() });
    expect(images(hidden.html)).toEqual([]);
    expect(hidden.pictures!.length).toBe(1);
  });
});

describe("an Svg on its own in an Email", () => {
  const svg = (extra: Record<string, unknown> = {}) => ({ type: "Svg", props: { width: 40, height: 20, title: "A moon" }, children: [{ type: "Circle", props: { cx: 20, cy: 10, r: 8 } }], ...extra });

  it("is a picture of its box: a Canvas that size, its padding and background drawn in, its title its alt", async () => {
    const draw = drawer();
    const template = email([{ type: "Row", children: [svg({ style: { padding: 4, backgroundColor: "#eeeeee", flex: "none" } })] }]);
    const result = await finishRender(renderTemplate(template, { assets: assets(draw) }), { assets: assets(draw) });
    const [img] = images(result.html);
    expect([img!.getAttribute("width"), img!.getAttribute("height"), img!.getAttribute("alt")]).toEqual(["48", "28", "A moon"]);
    const root = draw.asked[0]!.document.root;
    expect([root.type, root.props!.width, root.props!.height]).toEqual(["Canvas", 48, 28]);
    const drawn = root.children![0] as { type: string; style: Record<string, unknown> };
    expect(drawn.type).toBe("Svg");
    expect(drawn.style).toMatchObject({ backgroundColor: "#eeeeee" });
    // Its place in the Row is the Image's.
    expect(drawn.style.flex).toBeUndefined();
  });

  it("draws a fraction of a pixel on a whole one, and leaves out one of no size", () => {
    const fraction = renderTemplate(email([svg({ props: { width: 600, height: 20.51 } }), svg({ props: { width: 40, height: 0.4 } })]), { assets: assets() });
    expect(images(fraction.html).map((img) => img.getAttribute("height"))).toEqual(["21", "1"]);
    const none = renderTemplate(email([{ type: "Text", children: ["x"] }, svg({ props: { width: 0, height: 20 } })]), { assets: assets() });
    expect(images(none.html)).toEqual([]);
    expect(none.pictures).toBeUndefined();
  });
});

describe("what a picture can't do, said where it is", () => {
  const codes = (children: unknown[]) => validateTemplate(email(children)).diagnostics.map((d) => [d.code, d.severity, d.path]);

  it("says a merge tag can't be filled in, and text that reads as one", () => {
    expect(codes([card({}, [{ type: "Text", children: ["Hi ", { type: "MergeTag", props: { name: "first_name" } }] }])])).toEqual([["email/canvas-merge-tag", "error", "root.children[0].children[0].children[1]"]]);
    expect(codes([card({}, [{ type: "Text", children: ["Hi {{first_name}}"] }])])).toEqual([["email/canvas-merge-tag", "warning", "root.children[0].children[0].children[0]"]]);
    expect(codes([card({}, [{ type: "Text", children: ["Hi *|FNAME|*"] }])]).map((c) => c[0])).toEqual(["email/canvas-merge-tag"]);
  });

  it("says a link in it can't be clicked", () => {
    expect(codes([card({}, [{ type: "Text", children: ["Go to ", { type: "Link", props: { href: "https://example.com" }, children: ["the site"] }] }])])).toEqual([["email/canvas-link", "warning", "root.children[0].children[0].children[1]"]]);
  });

  it("says text needs an alt and a background, and that body copy is best as Text", () => {
    expect(codes([card({ props: { width: 300, height: 100 } })])).toEqual([["email/canvas-alt", "warning", "root.children[0]"]]);
    expect(codes([card({ style: {} })])).toEqual([["email/canvas-background", "warning", "root.children[0]"]]);
    const long = Array.from({ length: 31 }, (_, i) => `word${i}`).join(" ");
    expect(codes([card({ props: { width: 600, height: 400, alt: "x" } }, [{ type: "Text", children: [long] }])])).toEqual([["email/canvas-text", "info", "root.children[0]"]]);
    // A drawing with no text needs neither.
    expect(codes([card({ props: { width: 300, height: 100 }, style: {} }, [{ type: "Svg", props: { width: 10, height: 10 }, children: [] }])])).toEqual([]);
  });

  it("says one wider than its column shows past it in classic Outlook", () => {
    expect(codes([card({ props: { width: 700, height: 100, alt: "Wide" } })])).toEqual([["email/canvas-width", "warning", "root.children[0]"]]);
    expect(codes([{ type: "Section", style: { padding: 24 }, children: [card({ props: { width: 600, height: 100, alt: "x" } })] }])).toEqual([["email/canvas-width", "warning", "root.children[0].children[0]"]]);
  });

  it("says what's wrong inside it as a Canvas does, where it is in the Email", () => {
    // A Text past the Canvas's bottom is cut off.
    const tall = card({ props: { width: 300, height: 20, alt: "x" } }, [{ type: "Text", style: { fontSize: 40 }, children: ["Too tall"] }]);
    expect(codes([tall]).map(([code, , path]) => [code, path])).toEqual([["canvas/overflow", "root.children[0]"]]);
  });
});
