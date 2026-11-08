import { COMPONENTS, CONDITIONS, HOVER, MOBILE, type Target } from "../src";
import { pagedSupport, prepareTemplate } from "../src/writers";

const OUTPUT_OF: Record<string, Target> = { Email: "email", Page: "web", Document: "web", Canvas: "web" };

const button = (extra: Record<string, unknown> = {}) => ({ type: "Button", id: "go", props: { href: "https://example.com" }, children: ["Go"], ...extra });

describe("the condition list", () => {
  it("has the phone and hover conditions, in the order they're read", () => {
    expect(CONDITIONS.map((condition) => condition.name)).toEqual(["mobile", "hover"]);
  });

  it("declares how each output its roots render to shows each condition", () => {
    for (const condition of CONDITIONS) {
      for (const [root, target] of Object.entries(OUTPUT_OF)) {
        if (condition.roots && !condition.roots(COMPONENTS[root])) continue;
        expect(condition.support[target], `${condition.name} in ${root}`).toBeDefined();
      }
    }
  });

  it("names no condition after a style or a prop", () => {
    const names = new Set(Object.values(COMPONENTS).flatMap((definition) => [...Object.keys(definition.style), ...Object.keys(definition.props)]));
    for (const condition of CONDITIONS) expect(names.has(condition.name), condition.name).toBe(false);
  });

  it("allows phone styles only under a root with a phone width, and hover everywhere", () => {
    expect(["Email", "Page", "Document", "Canvas"].filter((root) => MOBILE.roots!(COMPONENTS[root]))).toEqual(["Email", "Page"]);
    expect(HOVER.roots).toBeUndefined();
    // Only a PDF or an image gets the hover warning; a phone block never reaches one.
    expect(MOBILE.paged).toBeUndefined();
    expect(HOVER.paged).toBeDefined();
  });
});

describe("support for conditions", () => {
  it("notes once that an email's hover doesn't show everywhere", () => {
    const { diagnostics } = prepareTemplate({ root: { type: "Email", children: [button({ hover: { backgroundColor: "#000000" } })] } });
    const notes = diagnostics.filter((d) => d.code === "email/degraded");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ severity: "info", path: "root.children[0].hover", nodeId: "go" });
    expect(notes[0]!.message).toContain("classic Outlook for Windows");
  });

  it("says nothing about a page's hover, nor a document's print HTML", () => {
    for (const root of ["Page", "Document"]) {
      const { diagnostics } = prepareTemplate({ root: { type: root, children: [button({ hover: { backgroundColor: "#000000" } })] } });
      expect(diagnostics.filter((d) => d.path.includes("hover")), root).toEqual([]);
    }
  });

  it("keeps a PDF's and an image's hover warning as it was", () => {
    for (const [root, output, where] of [
      ["Document", "pdf", "a PDF"],
      ["Canvas", "image", "an image"],
    ] as const) {
      const props = root === "Canvas" ? { width: 600, height: 300 } : {};
      const { resolved } = prepareTemplate({ root: { type: root, props, children: [button({ hover: { color: "#ffffff" } })] } });
      expect(pagedSupport(resolved!.root, output)).toEqual([
        { code: `${output}/unsupported`, severity: "warning", message: `A hover isn't possible in ${where}: nothing points at it. The Button shows its own colors`, path: "root.children[0].hover", nodeId: "go" },
      ]);
    }
  });

  it("keeps phone styles an error under a root without a phone width", () => {
    const { diagnostics } = prepareTemplate({ root: { type: "Document", children: [button({ mobile: { fontSize: 12 } })] } });
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "mobile/not-supported", severity: "error", path: "root.children[0].mobile", message: "Phone styles are for an Email or a Page, which have a phone width" }));
  });

  it("warns once about a stacking Grid's phone row gap, before the Grid is arranged", () => {
    const grid = (props: Record<string, unknown>) => ({ type: "Grid", props, mobile: { rowGap: 8 }, children: [{ type: "Text", children: ["a"] }, { type: "Text", children: ["b"] }, { type: "Text", children: ["c"] }] });
    for (const root of ["Email", "Page"]) {
      const stacked = prepareTemplate({ root: { type: root, children: [grid({})] } }).diagnostics.filter((d) => d.path === "root.children[0].mobile.rowGap");
      expect(stacked, root).toHaveLength(1);
      expect(stacked[0]!.code).toBe(`${OUTPUT_OF[root]}/unsupported`);
      const kept = prepareTemplate({ root: { type: root, children: [grid({ stackOnMobile: false })] } }).diagnostics.filter((d) => d.path === "root.children[0].mobile.rowGap");
      expect(kept, root).toEqual([]);
    }
  });

  it("warns about a page root's phone text styles, which it doesn't write", () => {
    const { diagnostics } = prepareTemplate({ root: { type: "Page", mobile: { fontSize: 14, gap: 8 }, children: [{ type: "Text", children: ["a"] }] } });
    expect(diagnostics.filter((d) => d.path.startsWith("root.mobile"))).toEqual([expect.objectContaining({ code: "web/unsupported", path: "root.mobile.fontSize" })]);
  });

  it("warns about an email image's and table cell's phone border", () => {
    const image = { type: "Image", props: { src: { src: "https://example.com/a.png", width: 300, height: 150 }, alt: "A" }, mobile: { border: "1px solid #000000" } };
    const table = { type: "Table", children: [{ type: "TableRow", children: [{ type: "TableCell", mobile: { border: "1px solid #000000" }, children: ["a"] }] }] };
    const { diagnostics } = prepareTemplate({ root: { type: "Email", children: [image, table] } });
    expect(diagnostics.filter((d) => d.path.endsWith(".mobile.border")).map((d) => d.path)).toEqual(["root.children[0].mobile.border", "root.children[1].children[0].children[0].mobile.border"]);
    // A page draws both.
    const page = prepareTemplate({ root: { type: "Page", children: [image, table] } });
    expect(page.diagnostics.filter((d) => d.path.endsWith(".mobile.border"))).toEqual([]);
  });

  it("warns about an email's phone line height of normal, and skips classic Outlook's notes inside a phone block", () => {
    const text = { type: "Text", mobile: { lineHeight: "normal", letterSpacing: 2 }, children: ["a"] };
    const { diagnostics } = prepareTemplate({ root: { type: "Email", children: [text] } });
    expect(diagnostics.filter((d) => d.path.startsWith("root.children[0].mobile"))).toEqual([expect.objectContaining({ code: "email/unsupported", path: "root.children[0].mobile.lineHeight" })]);
  });
});
