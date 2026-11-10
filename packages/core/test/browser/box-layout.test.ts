/**
 * Box layouts in Chromium (Decision 19): every box the resolver gives a width, at the base sample V0, is that wide in
 * Chromium, rounded the same way: grids (px, rem, %, fr, minmax(), repeat() with a count, auto-fill and auto-fit,
 * spans, named areas), flex rows (a share, a basis, a fixed child beside a growing one, wrapping), a Box spanning the
 * window, nested Boxes, padding and gaps in rem, an Image in a grid cell, and the second review's cases (padded flex
 * shares, a Row's flexBasis, minmax() ranges, auto-fit after placing, a repeat beside a track, an item's minimum, a span
 * back from its end line, a cell's percentages, border overrides, a fixed box, a figure).
 */
import { chromium, type Browser, type Page } from "playwright";
import { baseViewport, parseDocument, resolveDocument, type ResolvedNode } from "../../src";
import { renderTemplate } from "../../src/writers";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});
afterAll(async () => browser?.close());

let count = 0;
/** A node with an id of its own, so Chromium can find it. */
const n = (type: string, style: Record<string, unknown> = {}, children: unknown[] = [], props: Record<string, unknown> = {}) => ({ id: `${type.toLowerCase()}_${++count}`, type, style, props, children });
const text = (words = "words", style: Record<string, unknown> = {}) => n("Text", style, [words]);
const image = (width: number, height: number) => n("Image", {}, [], { src: { src: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'/>`, width, height }, alt: "" });

const TEMPLATES: Record<string, Record<string, unknown>> = {
  grids: {
    type: "Page",
    props: { width: 1000 },
    children: [
      n("Box", { maxWidth: 1000, padding: "0 2rem", display: "grid", gridTemplateColumns: "200px 1fr 2fr", columnGap: "1rem" }, [text(), text(), text(), n("Box", { gridColumn: "span 2" }, [text()]), text()]),
      n("Box", { maxWidth: 1000, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }, [text(), text(), text(), text()]),
      n("Box", { maxWidth: 1000, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }, [text(), text()]),
      n("Box", { maxWidth: 1000, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1.5rem", padding: 24 }, [image(120, 60), image(600, 300), text(), n("Box", { gridColumn: "2 / 4" }, [text()])]),
      n("Box", { maxWidth: 960, display: "grid", gridTemplateColumns: "1fr 3fr", gridTemplateAreas: ["nav main", "nav foot"], gap: 16 }, [n("Box", { gridArea: "main" }, [text()]), n("Box", { gridArea: "nav" }, [text()])]),
      n("Box", { maxWidth: 1000, display: "grid", gridTemplateColumns: "25% 1fr", gap: "2%" }, [text(), text()]),
      // Names as written (case-sensitive), and auto items after ones given a column or an area.
      n("Box", { maxWidth: 1000, display: "grid", gridTemplateColumns: "200px 1fr 100px", gridTemplateAreas: ["Side Main Main"] }, [n("Box", { gridArea: "Main" }, [text()]), text(), text(), n("Box", { gridColumn: "2" }, [text()]), text()]),
    ],
  },
  flex: {
    type: "Page",
    props: { width: 900 },
    children: [
      n("Box", { maxWidth: 900, flexDirection: "row", gap: 20 }, [n("Box", { width: 200 }), n("Box", { flex: 1 }), n("Box", { flex: 2 })]),
      n("Box", { maxWidth: 900, flexDirection: "row", columnGap: "1rem", padding: "1rem" }, [n("Box", { flexBasis: "10rem" }), n("Box", { flexBasis: 0, flexGrow: 1 }), n("Box", { width: "25%" })]),
      n("Box", { maxWidth: 900, flexDirection: "row" }, [n("Box", { width: 120 }), n("Box", { flex: 1 }, [text("Supercalifragilisticexpialidociouslylongwordthatdoesnotbreak")]), n("Box", { flex: 1 })]),
      n("Box", { maxWidth: 900, flexDirection: "row", flexWrap: "wrap", gap: 10 }, [n("Box", { width: 400 }), n("Box", { width: 400 }), n("Box", { width: 400 })]),
      n("Box", { maxWidth: 900, flexDirection: "row" }, [n("Box", { flex: 0, width: 100 }), n("Box", { flex: 1 }), n("Box", { flex: "none", width: 50 })]),
    ],
  },
  "a Box spanning the window": {
    type: "Page",
    props: { width: 600, breakpoints: { mobile: 800 } },
    children: [n("Box", { display: "grid", gridTemplateColumns: "1fr 1fr" }, [text(), text()]), text(), n("Box", { maxWidth: 700, padding: "2rem" }, [n("Box", { flexDirection: "row", gap: "5%" }, [n("Box", { flex: 1 }), n("Box", { flex: 1 })])])],
  },
  "fixes from the second review": {
    type: "Page",
    props: { width: 600 },
    children: [
      // A padded flex: 1 child starts from its padding; a Row's child by its flexBasis and flexGrow.
      n("Box", { flexDirection: "row" }, [n("Box", { flex: 1, padding: 20 }), n("Box", { flex: 1 })]),
      n("Row", {}, [n("Column", { flexBasis: 100, flexGrow: 0 }), n("Column")]),
      // Ranges grow equally; auto-fit collapses after placing; a repeat beside another track; an item's minimum in 1fr.
      n("Box", { width: 300, display: "grid", gridTemplateColumns: "minmax(100px, 300px) minmax(100px, 300px)" }, [text(), text()]),
      n("Box", { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))" }, [n("Box", { gridColumn: "span 2" }, [text()]), text()]),
      n("Box", { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr)) 200px", gap: 10 }, [text(), text(), text(), text(), text()]),
      n("Box", { display: "grid", gridTemplateColumns: "1fr 1fr" }, [n("Box", { minWidth: 400 }, [text()]), text()]),
      n("Box", { display: "grid", gridTemplateColumns: "100px 200px 300px" }, [n("Box", { gridColumn: "span 2 / 4" }, [text()]), n("Box", { gridColumn: 2 }, [text()])]),
      // A cell's percentages are of the cell; borders in the order written.
      n("Box", { display: "grid", gridTemplateColumns: "100px 500px" }, [n("Box", { padding: "10%" }, [text()])]),
      n("Box", { width: 300, paddingLeft: 20, borderWidth: 10, borderStyle: "solid" }, [text()]),
      n("Box", { width: 300, border: "10px solid #000", borderStyle: "none" }, [text()]),
      n("Box", { width: 300, borderStyle: "solid" }, [text()]),
      n("Box", { width: 200 }, [n("Box", { position: "fixed", width: "50%" })]),
      n("Box", {}, [text()], { as: "figure" }),
      // A Row laid out as a grid by its page styles: each child its own width.
      n("Row", { display: "grid", gridTemplateColumns: "100px 500px" }, [text("a", { width: 50 }), text()]),
    ],
  },
  "fixes from the third review": {
    type: "Page",
    props: { width: 600, breakpoints: { mobile: 800 } },
    children: [
      // A Section's percentage padding of the window (V0 801px); a border width with no style; auto-fill by a range's most.
      n("Section", { padding: "10%" }, [text()]),
      // Round 3: a Section's paddingLeft replacing its gutter; a minmax(auto, 200px) repeat counted at 200px.
      n("Section", { paddingLeft: "10%" }, [text()]),
      // Round 8: Images at their file's size in a flex row; a Section's padding range-checked as a whole.
      n("Box", { width: 300, flexDirection: "row" }, [{ ...image(400, 100), style: { maxWidth: 500 } }, image(400, 100)]),
      n("Section", { padding: "calc(1rem - 32px)" }, [text()]),
      // Round 7: an Image in a Box with its own maxWidth, wider than the Box; a calc() below 0.
      n("Box", { width: 200, alignItems: "stretch" }, [{ ...image(400, 100), style: { maxWidth: 500 } }]),
      n("Box", { width: "calc(100% - 700px)" }),
      n("Box", { width: 200, padding: "calc(1rem - 32px)" }, [text()]),
      // Round 6: an Image in a stretching Box keeps its file's size.
      n("Box", { maxWidth: 600, alignItems: "stretch" }, [image(400, 100)]),
      // Round 5: an auto-fit repeat of zero-minimum tracks, counted at 1px each, its empty tracks collapsed.
      n("Box", { maxWidth: 600, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))" }, [n("Box"), n("Box")]),
      n("Box", { maxWidth: 600, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(auto, 200px)) 50px" }, [text(), text(), text()]),
      n("Box", { width: 300, borderWidth: 10 }, [text()]),
      n("Box", { maxWidth: 600, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 200px))" }, [text(), text(), text(), text()]),
      // A Row's flexBasis 0 from its padding; a Row as a column with alignItems start.
      n("Box", { maxWidth: 600 }, [n("Row", {}, [n("Column", { flexBasis: 0, padding: 20 }), n("Column")])]),
      n("Box", { maxWidth: 600 }, [n("Row", { flexDirection: "column", alignItems: "start" }, [text()])]),
    ],
  },
  "fixes from the ninth review": {
    type: "Page",
    props: { width: 600, dir: "rtl" },
    children: [
      // A List right to left: its indent added to its right padding, range-checked as a whole.
      n("List", { padding: { top: 0, right: "calc(1rem - 32px)", bottom: 0, left: 0 } }, [n("ListItem", {}, ["words"])]),
      // A Row's columnGap between its children; an Image with its own width in a flex row, held by its max-width.
      n("Row", { columnGap: 40 }, [n("Column", {}, [text()]), n("Column", {}, [text()])]),
      n("Box", { width: 300, flexDirection: "row" }, [{ ...image(400, 100), style: { width: 400, flex: "none" } }]),
    ],
  },
  "fixes from the tenth review": {
    type: "Page",
    props: { width: 600 },
    children: [
      // An Image is content-box: a border outside its width and its max-width (wider than its Box, on purpose).
      n("Box", { width: 300, flexDirection: "row" }, [{ ...image(400, 100), style: { width: 400, flex: "none", border: "10px solid #000" } }]),
      // Images with width auto start from their files' sizes and shrink in proportion.
      n("Box", { width: 300, flexDirection: "row" }, [{ ...image(400, 100), style: { width: "auto" } }, { ...image(100, 100), style: { width: "auto" } }]),
    ],
  },
  "boxes in the layout components": {
    type: "Page",
    props: { width: 800 },
    children: [
      n("Section", { padding: 24 }, [n("Box", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, [text(), text()])]),
      n("Row", { gap: 16 }, [n("Column", { width: 300 }, [n("Box", { flexDirection: "row" }, [n("Box", { flex: 1 }), n("Box", { width: 50 })])]), n("Column", {}, [text()])]),
      n("Column", { display: "grid", gridTemplateColumns: "100px 1fr", padding: 10 }, [text(), text()]),
    ],
  },
};

/** Templates with a case that overflows its place on purpose (an Image at its file's size, wider than its Box). */
const OVERFLOWS = new Set(["fixes from the third review", "fixes from the tenth review"]);

/** Every node with a known width and an id. */
function sized(node: ResolvedNode, into: ResolvedNode[] = []): ResolvedNode[] {
  if (node.width !== null && node.id && node.path !== "root") into.push(node);
  for (const child of node.children) if (typeof child !== "string") sized(child, into);
  return into;
}

describe.each(Object.entries(TEMPLATES))("%s in Chromium", (_, root) => {
  const template = parseDocument({ root });
  const resolved = resolveDocument(template);
  const { html, diagnostics } = renderTemplate(template);
  const viewport = baseViewport({ type: "Page", props: root.props as Record<string, never> });

  it("renders with no warnings (but the phone width over the content's, which V0 is about, and an overflow a case means)", () => {
    expect(diagnostics.filter((d) => d.severity !== "info" && d.code !== "page/phone-width" && !(OVERFLOWS.has(_) && d.code === "layout/overflow"))).toEqual([]);
  });

  it("gives every box the resolver gives a width that width at the base sample V0", async () => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.setContent(html);
    const measured: Record<string, number> = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element.getBoundingClientRect().width])));
    // A Section's width is its content band's (the Page's width), though its box spans the window: where V0 is wider
    // than the Page, only what's in it is measured.
    const expected = sized(resolved.root).filter((node) => node.type !== "Section" || viewport.width === resolved.root.width);
    expect(expected.length).toBeGreaterThan(3);
    for (const node of expected) expect([node.id, Math.round(measured[node.id!])]).toEqual([node.id, node.width]);
  });
});
