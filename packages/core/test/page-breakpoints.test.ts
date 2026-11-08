import { prepareTemplate, renderTemplate } from "../src/writers";

const page = (props: Record<string, unknown> = {}) => ({
  root: { type: "Page", props: { width: 900, ...props }, children: [{ type: "Column", style: { padding: 20 }, mobile: { padding: 8 }, children: [{ type: "Text", children: ["a"] }] }] },
});

describe("a Page's phone width", () => {
  it("is 480px where it isn't set, as before", () => {
    const { head } = renderTemplate(page());
    expect(head).toContain("@media (max-width: 480px){");
    expect(head).not.toContain("@media (max-width: 600px)");
  });

  it("is breakpoints.mobile where it's set, for phone styles and hiding", () => {
    const { head } = renderTemplate({
      root: { type: "Page", props: { width: 900, breakpoints: { mobile: 600 } }, children: [{ type: "Text", mobile: { fontSize: 12 }, hidden: { desktop: true }, children: ["a"] }] },
    });
    expect(head).toContain("@media (max-width: 600px){");
    expect(head).toContain("@media (min-width: 601px){");
    expect(head).not.toContain("480px");
  });

  it("changes nothing else", () => {
    const plain = renderTemplate(page());
    const set = renderTemplate(page({ breakpoints: { mobile: 600 } }));
    expect(set.body).toBe(plain.body);
    expect(set.head.replace(/600px/g, "480px").replace(/601px/g, "481px")).toBe(plain.head);
  });

  it("warns where it's as wide as the content or wider", () => {
    const at = (mobile: number) => prepareTemplate(page({ breakpoints: { mobile } })).diagnostics.filter((d) => d.code === "page/phone-width");
    expect(at(899)).toEqual([]);
    expect(at(900)).toEqual([expect.objectContaining({ severity: "warning", path: "root.props.breakpoints" })]);
  });

  it("takes only a whole number of px from 240 for mobile, and no other breakpoint", () => {
    for (const breakpoints of [{ mobile: 200 }, { mobile: 480.5 }, { mobile: "480px" }, { tablet: 900 }, 480]) {
      const { diagnostics } = prepareTemplate(page({ breakpoints }));
      expect(diagnostics, JSON.stringify(breakpoints)).toContainEqual(expect.objectContaining({ code: "prop/invalid", path: "root.props.breakpoints" }));
    }
  });

  it("is left out where nothing is set in it, as if not given", () => {
    for (const breakpoints of [{}, { mobile: undefined }]) {
      const { resolved, diagnostics } = prepareTemplate(page({ breakpoints }));
      expect(diagnostics).toEqual([]);
      expect(resolved!.root.props).not.toHaveProperty("breakpoints");
    }
  });

  it("is a Page's alone", () => {
    for (const type of ["Email", "Document"]) {
      const { diagnostics } = prepareTemplate({ root: { type, props: { breakpoints: { mobile: 600 } }, children: [{ type: "Text", children: ["a"] }] } });
      expect(diagnostics, type).toContainEqual(expect.objectContaining({ code: "prop/unknown", path: "root.props.breakpoints" }));
    }
  });
});
