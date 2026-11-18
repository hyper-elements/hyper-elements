/**
 * The home page as a Page with Box and page styles (test/page/reference/home.tsx): the themes and pages plan's
 * Phase 3 exit check. It validates, and renders; HOME_PAGE_OUT writes its HTML there to look at.
 */
import { writeFileSync } from "node:fs";
import { formatDiagnostics, render, validate } from "../../src/primitives";
import HomePage from "./reference/home";

describe("the home page as a Page", () => {
  it("validates and renders", async () => {
    const { diagnostics } = validate(<HomePage />);
    if (diagnostics.length) console.log(formatDiagnostics(diagnostics));
    const { html } = await render(<HomePage />);
    if (process.env.HOME_PAGE_OUT) writeFileSync(process.env.HOME_PAGE_OUT, html);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
});
