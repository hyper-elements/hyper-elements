/**
 * `preview --findings`: the preview files drawn in a Chromium the CLI finds, with playwright-core (which downloads no
 * browser when installed). The only module that imports it: it's loaded only for `--findings`, `--screenshots` and
 * `--install-browser`, so `render`, `check` and a `preview` without them never load it. It's an optional peer: where
 * it isn't installed, those say so (`missing`) and the rest of the CLI works as before.
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

export type Opened =
  | { browser: DrawingBrowser; name: string; /** Whether it started in Chromium's sandbox. */ sandboxed: boolean }
  | { browser: null; tried: string[]; bun?: string; /** playwright-core isn't installed. */ missing?: boolean };

/** Said once where the browser drawing the previews couldn't start sandboxed. */
export const NO_SANDBOX_HELP =
  "the previews are drawn in a browser without Chromium's sandbox, which it couldn't start with: on Linux that needs the kernel's user namespaces (a container started with --cap-add=SYS_ADMIN, or an unprivileged user). The previews are the same either way.";

/** Whether `error` says playwright-core itself can't be found (not a module it imports). */
function isMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null)?.code;
  return (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND" || /^Cannot find (package|module)/.test(message)) && /['"]playwright-core(\/package\.json)?['"]/.test(message);
}

/** playwright-core, as the CLI resolves it; null where it isn't installed. */
async function playwright(): Promise<typeof import("playwright-core") | null> {
  try {
    return await import("playwright-core");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** A failure that says only that the browser isn't there (not that it couldn't be started). */
const NOT_THERE = /Executable doesn't exist|is not found at|is not installed|ENOENT|no such file|not found|cannot find/i;
/**
 * A failure that says the browser took too long, which the sandbox isn't the reason for: a loaded machine can miss
 * the deadline, and starting again without the sandbox would turn that into a browser drawing untrusted HTML
 * without one. A sandbox a kernel won't give fails at once, well inside the deadline.
 */
const TOO_SLOW = /Timeout .* exceeded|timed out/i;
/**
 * A failure that says the sandbox is why, anywhere in it: Playwright's own heading over what Chromium wrote as it
 * ended, and Chromium's words for a kernel that gives it no user namespaces ("No usable sandbox!"), for root
 * ("Running as root without --no-sandbox is not supported") and for a setuid helper that isn't set up.
 */
const NAMES_SANDBOX = /Chromium sandboxing failed|No usable sandbox|without --no-sandbox|sandbox helper/i;

/** A failed start's first line, which says what failed (the browser's own output follows it). */
const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split("\n").find((l) => l.trim()) ?? "";

/**
 * One browser, started in Chromium's sandbox, or without it where it can't start in one.
 *
 * A preview draws an email the CLI was given, which is content from outside: it's drawn in Chromium's sandbox.
 * Playwright starts a browser without one unless it's asked (`chromiumSandbox` is false by default), and some
 * machines can't start one at all (root in a container, a kernel without user namespaces, GitHub's Ubuntu runners):
 * there the browser is started as before, and says so in its name.
 *
 * The sandbox is dropped at once only where the failure names it. A browser that isn't there, or was too slow, is
 * never started without it. Any other failed start (a crash, say) is tried in the sandbox once more, so that one bad
 * start doesn't draw a run's previews without it; a second one is taken for a sandbox that can't start and doesn't
 * say so, which is still better drawn than not.
 */
async function start(launch: (sandbox: boolean) => Promise<Browser>): Promise<{ browser: Browser; sandboxed: boolean } | { failure: string }> {
  for (let tries = 0; tries < 2; tries++) {
    try {
      return { browser: await launch(true), sandboxed: true };
    } catch (error) {
      const failure = firstLine(error);
      if (NOT_THERE.test(failure) || TOO_SLOW.test(failure)) return { failure };
      if (NAMES_SANDBOX.test(error instanceof Error ? error.message : String(error))) break;
    }
  }
  try {
    return { browser: await launch(false), sandboxed: false };
  } catch (error) {
    return { failure: firstLine(error) };
  }
}

/** The channels tried after Playwright's Chromium. (`HYPER_ELEMENTS_CLI_BROWSER_CHANNELS`, for the CLI's own tests.) */
function channels(): string[] {
  const set = process.env.HYPER_ELEMENTS_CLI_BROWSER_CHANNELS;
  return set === undefined ? ["chrome", "msedge"] : set.split(",").map((c) => c.trim()).filter(Boolean);
}

/** The first browser that starts, of those tried in order; or null, with what was tried. */
export async function openBrowser(): Promise<Opened> {
  const core = await playwright();
  if (!core) return { browser: null, tried: [], missing: true };
  const { chromium } = core;
  const attempts: Array<{ label: (version: string) => string; options: LaunchOptions; what: string }> = [];
  const chromePath = process.env.CHROME_PATH;
  if (chromePath) attempts.push({ what: `CHROME_PATH (${chromePath})`, label: (v) => `chromium ${v}, CHROME_PATH`, options: { executablePath: chromePath } });
  attempts.push({ what: "Playwright's Chromium", label: (v) => `chromium ${v}, playwright`, options: {} });
  for (const channel of channels()) attempts.push({ what: `${channel} (channel)`, label: (v) => `${channel} ${v}, channel`, options: { channel } });
  const tried: string[] = [];
  let startFailed: string | undefined;
  for (const attempt of attempts) {
    const started = await start((sandbox) => chromium.launch({ ...attempt.options, headless: true, chromiumSandbox: sandbox, timeout: LAUNCH_TIMEOUT }));
    if ("failure" in started) {
      tried.push(`${attempt.what}: ${started.failure.replace(/^browserType\.launch: /, "")}`);
      if (!NOT_THERE.test(started.failure)) startFailed ??= started.failure;
      continue;
    }
    const { browser, sandboxed } = started;
    return { browser: drawing(browser), name: `${attempt.label(browser.version())}${sandboxed ? "" : ", no sandbox"}`, sandboxed };
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
 * `--install-browser`: playwright-core's own install of Chromium (`playwright-core install chromium`), from the copy
 * the CLI resolves, so the Chromium it downloads is the one it launches. What it prints goes to stderr. Resolves with
 * its exit code, or "missing" where playwright-core isn't installed.
 */
export function installBrowser(): Promise<number | "missing"> {
  let cli: string;
  try {
    cli = join(dirname(createRequire(import.meta.url).resolve("playwright-core/package.json")), "cli.js");
  } catch (error) {
    if (isMissing(error)) return Promise.resolve("missing");
    throw error;
  }
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, "install", "chromium"], { stdio: ["ignore", 2, 2] });
    child.on("error", () => resolve(1));
    child.on("close", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}
