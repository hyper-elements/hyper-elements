/**
 * Box layouts in Chromium (Decision 19): every box the resolver gives a width, at the base sample V0, is that wide in
 * Chromium, rounded the same way: grids (px, rem, %, fr, minmax(), repeat() with a count, auto-fill and auto-fit,
 * spans, named areas), flex rows (a share, a basis, a fixed child beside a growing one, wrapping), a Box spanning the
 * window, nested Boxes, padding and gaps in rem, and an Image in a grid cell.
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

  it("renders with no warnings (but the phone width over the content's, which V0 is about)", () => {
    expect(diagnostics.filter((d) => d.severity !== "info" && d.code !== "page/phone-width")).toEqual([]);
  });

  it("gives every box the resolver gives a width that width at the base sample V0", async () => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.setContent(html);
    const measured: Record<string, number> = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element.getBoundingClientRect().width])));
    const expected = sized(resolved.root);
    expect(expected.length).toBeGreaterThan(3);
    for (const node of expected) expect([node.id, Math.round(measured[node.id!])]).toEqual([node.id, node.width]);
  });
});
