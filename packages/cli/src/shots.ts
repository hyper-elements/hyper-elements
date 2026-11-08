/**
 * Screenshots of rendered HTML, full page, at a desktop and a phone width: with the Chrome installed on this machine,
 * else a Chromium Playwright installed, else a browser named by HYPER_ELEMENTS_CHROME. None found: no screenshots,
 * and a message that says how to get one.
 */
import { pathToFileURL } from "node:url";

export interface Shot {
  file: string;
  width: number;
}

type Browser = { newPage: (options: Record<string, unknown>) => Promise<Page>; close: () => Promise<void> };
type Page = { goto: (url: string, options: Record<string, unknown>) => Promise<unknown>; screenshot: (options: Record<string, unknown>) => Promise<unknown>; close: () => Promise<void> };

async function launch(): Promise<Browser | string> {
  const { chromium } = (await import("playwright-core")) as unknown as { chromium: { launch: (options: Record<string, unknown>) => Promise<Browser> } };
  const tries: Array<Record<string, unknown>> = [];
  if (process.env.HYPER_ELEMENTS_CHROME) tries.push({ executablePath: process.env.HYPER_ELEMENTS_CHROME });
  tries.push({ channel: "chrome" }, {});
  for (const options of tries) {
    try {
      return await chromium.launch({ headless: true, ...options });
    } catch {
      // the next one
    }
  }
  return "No Chrome or Chromium found, so no screenshots. Install Google Chrome, or run: npx playwright install chromium (or set HYPER_ELEMENTS_CHROME to a browser's path).";
}

/** Each HTML file at each width, as full-page PNGs; a message instead where no browser can start. */
export async function screenshots(jobs: Array<{ html: string; png: string; width: number }>): Promise<{ shots: Shot[]; problem?: string }> {
  const browser = await launch();
  if (typeof browser === "string") return { shots: [], problem: browser };
  const shots: Shot[] = [];
  try {
    for (const job of jobs) {
      const page = await browser.newPage({ viewport: { width: job.width, height: 300 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(job.html).href, { waitUntil: "load", timeout: 30000 }).catch(() => undefined);
      await page.screenshot({ path: job.png, fullPage: true });
      await page.close();
      shots.push({ file: job.png, width: job.width });
    }
  } finally {
    await browser.close();
  }
  return { shots };
}
