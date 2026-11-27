/**
 * A Document's print HTML, printed by Chromium (the test's only use of a browser: Elements writes the HTML without
 * one): one sheet of the Document's paper per page, whatever its content, and each page's header and footer on it.
 */
import { chromium, type Browser } from "playwright";
import { renderTemplate } from "../../src/writers";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => browser?.close());

const text = (...children: unknown[]) => ({ type: "Text", children });

async function print(html: string): Promise<{ sheets: Array<[number, number]>; pdf: string }> {
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  await page.close();
  // Each page object's MediaBox, in points.
  const sheets = [...pdf.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map((m) => [Math.round(Number(m[1])), Math.round(Number(m[2]))] as [number, number]);
  return { sheets, pdf };
}

describe("a Document printed in Chromium", () => {
  it("prints one sheet of its paper per page, landscape too", async () => {
    const long = Array.from({ length: 40 }, (_, i) => text(`Line ${i + 1} of a page that is full to its bottom margin and no further.`));
    const html = renderTemplate({
      root: {
        type: "Document",
        props: { size: "Letter", orientation: "landscape", margin: [36, 48] },
        children: [
          { type: "PageHeader", children: [text("Header")] },
          text("Cover"),
          { type: "PageBreak" },
          { type: "DocumentPage", children: long.slice(0, 12) },
          text("Back"),
          { type: "PageFooter", children: [text({ type: "PageNumber" }, " of ", { type: "PageNumber", props: { total: true } })] },
        ],
      },
    }).html;
    const { sheets } = await print(html);
    // Letter landscape: 11in × 8.5in, 792 × 612 points.
    expect(sheets).toEqual([
      [792, 612],
      [792, 612],
      [792, 612],
    ]);
  });

  it("cuts what doesn't fit above the footer: nothing is drawn over the footer or into the bottom margin", async () => {
    const footer = { type: "PageFooter", children: [text("Footer")] };
    // The page from the footer's top to the paper's bottom edge, as a screen shows it (in a window an A4 sheet fits).
    const bottom = async (children: unknown[]) => {
      const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
      await page.setContent(renderTemplate({ root: { type: "Document", children: [...children, footer] } }).html);
      const sheet = (await page.locator(".elements-page").boundingBox())!;
      const top = (await page.getByText("Footer", { exact: true }).boundingBox())!.y;
      const shot = await page.screenshot({ clip: { x: sheet.x, y: top, width: sheet.width, height: sheet.y + sheet.height - top } });
      await page.close();
      return shot;
    };
    const many = Array.from({ length: 80 }, (_, i) => text(`Line ${i + 1} of a page that goes on far past its footer.`));
    expect((await bottom(many)).equals(await bottom([text("Line 1")]))).toBe(true);
  });

  it("prints A4 portrait by default, a page that holds more than fits cut at its bottom margin rather than spilling onto a sheet of its own", async () => {
    const many = Array.from({ length: 80 }, (_, i) => text(`Line ${i + 1}`));
    const { sheets } = await print(renderTemplate({ root: { type: "Document", children: many } }).html);
    expect(sheets).toEqual([[595, 842]]);
  });
});
