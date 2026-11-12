/**
 * `preview --findings`: the preview files drawn in a Chromium the CLI finds, with playwright-core (which downloads no
 * browser when installed). The only module that imports it: it's loaded only for `--findings`, `--screenshots` and
 * `--install-browser`, so `render`, `check` and a `preview` without them never load it.
 *
 * The browsers tried, in order: CHROME_PATH where it's set; Playwright's own Chromium, where one is downloaded
 * (`npx playwright install chromium`, or `--install-browser`); an installed Chrome, then Edge. Only Chromium-based
 * browsers: the previews are drawn as Chromium lays them out.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, LaunchOptions } from "playwright-core";

/** How long a preview has to say it's done: its own 10-second deadline, plus 5 seconds. */
export const READY_TIMEOUT = 15_000;
const LAUNCH_TIMEOUT = 30_000;

const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

export interface DrawnPreview {
  ready: "ok" | "incomplete" | "error";
  /** What the page wrote in #email-client-findings, or null where it wrote nothing readable. */
  findings: Record<string, unknown> | null;
  /** Why the page couldn't be read, where it couldn't. */
  error?: string;
  /** `screenshot`: the drawn page, as a PNG. */
  screenshot?: Uint8Array;
}

export interface DrawingBrowser {
  draw(file: string, options?: { screenshot?: boolean }): Promise<DrawnPreview>;
  close(): Promise<void>;
}

export type Opened = { browser: DrawingBrowser; name: string } | { browser: null; tried: string[]; bun?: string };

/** A failure that says only that the browser isn't there (not that it couldn't be started). */
const NOT_THERE = /Executable doesn't exist|is not found at|is not installed|ENOENT|no such file|not found|cannot find/i;

/** The channels tried after Playwright's Chromium. (`HYPER_ELEMENTS_CLI_BROWSER_CHANNELS`, for the CLI's own tests.) */
function channels(): string[] {
  const set = process.env.HYPER_ELEMENTS_CLI_BROWSER_CHANNELS;
  return set === undefined ? ["chrome", "msedge"] : set.split(",").map((c) => c.trim()).filter(Boolean);
}

/** The first browser that starts, of those tried in order; or null, with what was tried. */
export async function openBrowser(): Promise<Opened> {
  const { chromium } = await import("playwright-core");
  const attempts: Array<{ label: (version: string) => string; options: LaunchOptions; what: string }> = [];
  const chromePath = process.env.CHROME_PATH;
  if (chromePath) attempts.push({ what: `CHROME_PATH (${chromePath})`, label: (v) => `chromium ${v}, CHROME_PATH`, options: { executablePath: chromePath } });
  attempts.push({ what: "Playwright's Chromium", label: (v) => `chromium ${v}, playwright`, options: {} });
  for (const channel of channels()) attempts.push({ what: `${channel} (channel)`, label: (v) => `${channel} ${v}, channel`, options: { channel } });
  const tried: string[] = [];
  let startFailed: string | undefined;
  for (const attempt of attempts) {
    let browser: Browser;
    try {
      browser = await chromium.launch({ ...attempt.options, headless: true, timeout: LAUNCH_TIMEOUT });
    } catch (error) {
      const line = (error instanceof Error ? error.message : String(error)).split("\n").find((l) => l.trim()) ?? "";
      tried.push(`${attempt.what}: ${line.replace(/^browserType\.launch: /, "")}`);
      if (!NOT_THERE.test(line)) startFailed ??= line;
      continue;
    }
    return { browser: drawing(browser), name: attempt.label(browser.version()) };
  }
  return {
    browser: null,
    tried,
    ...(bun && startFailed ? { bun: `playwright-core didn't start a browser under Bun (${startFailed}): run preview --findings with Node (npx hyper-elements)` } : {}),
  };
}

function drawing(browser: Browser): DrawingBrowser {
  const probe = !!process.env.HYPER_ELEMENTS_CLI_PROBE;
  return {
    async draw(file, options = {}) {
      const page = await browser.newPage();
      // For the CLI's own tests: every request the drawn preview makes.
      if (probe) page.on("request", (request) => process.stderr.write(`[probe] ${JSON.stringify({ request: request.url() })}\n`));
      try {
        await page.goto(pathToFileURL(file).href);
        try {
          await page.waitForFunction(() => document.documentElement.hasAttribute("data-email-client-ready"), null, { timeout: READY_TIMEOUT });
        } catch {
          return { ready: "error", findings: null, error: `it didn't say it was done (data-email-client-ready) within ${READY_TIMEOUT / 1000} s` };
        }
        const said = await page.evaluate(() => {
          const ready = document.documentElement.getAttribute("data-email-client-ready");
          const text = document.getElementById("email-client-findings")?.textContent ?? null;
          return { ready, text };
        });
        let findings: Record<string, unknown> | null = null;
        try {
          findings = said.text ? (JSON.parse(said.text) as Record<string, unknown>) : null;
        } catch {
          findings = null;
        }
        const ready = said.ready === "ok" || said.ready === "incomplete" || said.ready === "error" ? said.ready : "error";
        const drawn: DrawnPreview = { ready, findings, ...(ready === "error" && !findings ? { error: `it said ${JSON.stringify(said.ready)}, with no findings` } : {}) };
        if (options.screenshot) drawn.screenshot = await page.screenshot({ fullPage: true });
        return drawn;
      } catch (error) {
        return { ready: "error", findings: null, error: (error instanceof Error ? error.message : String(error)).split("\n")[0] };
      } finally {
        await page.close().catch(() => undefined);
      }
    },
    close: () => browser.close(),
  };
}

/**
 * `--install-browser`: playwright-core's own install of Chromium (`playwright-core install chromium`), from the CLI's
 * copy, so the Chromium it downloads is the one it launches. What it prints goes to stderr. Resolves with its exit code.
 */
export function installBrowser(): Promise<number> {
  const cli = join(dirname(createRequire(import.meta.url).resolve("playwright-core/package.json")), "cli.js");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, "install", "chromium"], { stdio: ["ignore", 2, 2] });
    child.on("error", () => resolve(1));
    child.on("close", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}
