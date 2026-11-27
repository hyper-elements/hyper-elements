import { chromium } from "playwright";

/**
 * Converts print-ready HTML (produced by `render()` with a `<Document>` root)
 * to a PDF buffer using Playwright's Chromium.
 *
 * Run in a Node.js environment with Chromium installed:
 *
 * ```bash
 * npx playwright install chromium
 * ```
 *
 * **Puppeteer equivalent** — if you prefer Puppeteer over Playwright:
 *
 * ```ts
 * import puppeteer from "puppeteer";
 *
 * async function htmlToPdf(html: string): Promise<Buffer> {
 *   const browser = await puppeteer.launch();
 *   try {
 *     const page = await browser.newPage();
 *     await page.emulateMediaType("print");
 *     await page.setContent(html, { waitUntil: "load" });
 *     await page.evaluate(async () => {
 *       await document.fonts.ready;
 *       await Promise.all(Array.from(document.images, (img) => img.decode()));
 *     });
 *     // `<Document size="A4">` already writes the @page CSS — no need to set
 *     // format or margins here.
 *     return Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
 *   } finally {
 *     await browser.close();
 *   }
 * }
 * ```
 *
 * For a fully browserless PDF (no Chromium required) use `renderPdf()` from
 * `@hyper-elements/react/pdf` — see packages/react/docs/react-to-pdf.md.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Switch to print media so the Document's @page CSS is active.
    await page.emulateMedia({ media: "print" });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    // Wait for fonts and images before printing so nothing is clipped.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (img) => img.decode()));
    });
    // The Document's own `size` and `margin` write the @page CSS, so Chromium
    // picks up the paper size automatically — no format or margin overrides here.
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await browser.close();
  }
}
