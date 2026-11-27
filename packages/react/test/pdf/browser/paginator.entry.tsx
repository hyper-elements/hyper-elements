/** What paginator.test.tsx runs in Chromium, bundled for a browser: each design paginated (laid out with its lines, and drawn as SVG), and the report typed into. */
import { createPaginator } from "../../../src/pdf";
import { designs, report, typing } from "./paginated";

declare global {
  interface Window {
    paginateAll(arabic: number[]): Promise<string>;
  }
}

window.paginateAll = async (arabic) => {
  const paginator = await createPaginator({ fonts: [{ family: "Noto Arabic", src: new Uint8Array(arabic) }] });
  const plans = Object.fromEntries(Object.entries(designs).map(([name, design]) => [name, paginator.paginate(design)]));
  const typed = typing.map((text) => paginator.paginate(report(80, text), { diagnostics: false }).plan);
  const layouts = Object.fromEntries(Object.entries(designs).map(([name, design]) => [name, paginator.paginate(design, { diagnostics: false, layout: true, svg: true })]));
  return JSON.stringify({ plans, typed, layouts });
};
