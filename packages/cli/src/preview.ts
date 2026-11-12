/**
 * `preview`, in the parent: where each template's previews go (`<out>/clients/<its path>/<name>/`, one folder per
 * template, reserved before anything runs), writing the files the child made, drawing them in a browser for
 * `--findings` and `--screenshots` (preview/browser.ts, loaded only then, with playwright-core), and serving them for
 * `--serve` (preview/serve.ts).
 */
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { UsageError } from "./args";
import { cliDiagnostic } from "./commands/shared";
import { canonicalPath, foldPath, inputHeldBy, planDestinations, writeAtomically } from "./destinations";
import { errorLine } from "./errors";
import { displayPath, type Input } from "./inputs";
import type { Outcome } from "./output";
import type { Diagnostic, Preview, PreviewFile } from "./protocol";

/** The folder the previews of every template go under: `<out>/clients`. */
export function clientsFolder(out: string, cwd: string): string {
  return join(resolve(cwd, out), "clients");
}

/**
 * Each input's preview folder, by input id: `<out>/clients/<its folder relative to the inputs' base>/<its name>/`.
 * `--out` is refused as `render`'s is; two inputs with one folder (`welcome.tsx` and `welcome.jsx`), compared as
 * `render`'s destinations are, exit 2 with nothing written.
 */
export function planPreviewFolders(inputs: Input[], base: string, out: string, cwd: string): Map<number, string> {
  // `render`'s refusals of --out (the filesystem root, the home folder, a project's root; stdin is no file), but not
  // that it holds an input: previews go only under <out>/clients/<name>/, so `render`'s output can be previewed from
  // out/. Each preview folder is checked itself: by its real path, it mustn't hold an input.
  planDestinations(inputs.filter((input) => !input.stdin), base, out, cwd, [], { holding: false });
  const folders = new Map<number, string>();
  const taken = new Map<string, Input>();
  for (const input of inputs) {
    // stdin's previews: `<out>/clients/stdin/`.
    const folder = input.stdin
      ? join(clientsFolder(out, cwd), "stdin")
      : join(clientsFolder(out, cwd), relative(base, dirname(input.file)), basename(input.file, extname(input.file)));
    const key = foldPath(canonicalPath(folder));
    const other = taken.get(key);
    if (other) throw new UsageError(`${other.display} and ${input.display} would both write their previews in ${displayPath(cwd, folder)}: rename one, or preview them in separate runs. Nothing was written.`);
    const held = inputHeldBy(folder, inputs);
    if (held) throw new UsageError(`${input.display}'s previews would go in ${displayPath(cwd, folder)}, which holds ${held.display} (by its real path): give another --out. Nothing was written.`);
    taken.set(key, input);
    folders.set(input.id, folder);
  }
  return folders;
}

/** Writes one template's preview files in its folder: the outcome gets its `outputs` and `previews`. */
export function writePreviews(outcome: Outcome, files: PreviewFile[], folder: string, cwd: string): void {
  outcome.previews = [];
  for (const file of files) {
    const path = join(folder, file.filename);
    try {
      writeAtomically(path, file.html);
    } catch (error) {
      outcome.status = "error";
      outcome.error = `couldn't write ${displayPath(cwd, path)}: ${errorLine(error)}`;
      return;
    }
    outcome.outputs.push(displayPath(cwd, path));
    outcome.previews.push({ id: file.id, client: file.client, path: displayPath(cwd, path), ready: null, findings: null });
  }
}

/** How to get a browser, where none was found. */
export const NO_BROWSER_HELP =
  "No Chromium was found to draw the previews in (tried CHROME_PATH, Playwright's Chromium, Chrome and Edge). The preview files are written: " +
  "run `hyper-elements preview --install-browser` (or `npx playwright install chromium`), or set CHROME_PATH to a Chromium-based browser, and run again; " +
  "or open each file in a browser, wait for <html data-email-client-ready>, and read #email-client-findings.";

/** How to get playwright-core, where it isn't installed. */
export const NO_PLAYWRIGHT_CORE_HELP =
  "--findings and --screenshots draw the previews in Chromium with playwright-core, which isn't installed. The preview files are written: " +
  "install it beside the CLI (`npm install -D playwright-core`; with npx, `npx -p @hyper-elements/cli -p playwright-core hyper-elements preview …`) and run again; " +
  "or open each file in a browser, wait for <html data-email-client-ready>, and read #email-client-findings.";

export interface Drawn {
  /** The browser drawn with, or null where none was found. */
  browser: string | null;
  /** Under Bun, where playwright-core doesn't start a browser: run with Node. */
  bun?: string;
  /** Where none was found: each browser tried, and why it didn't start. */
  tried?: string[];
  /** playwright-core isn't installed: nothing was tried. */
  missing?: boolean;
}

/**
 * `--findings`: each written preview drawn in a browser; its `ready` and `findings` are what the page says. A preview
 * whose page says `error` fails its input. Where no browser is found, nothing is drawn: `browser` is null.
 */
export async function drawPreviews(outcomes: Outcome[], options: { cwd: string; screenshots: boolean; stderr(text: string): void }): Promise<Drawn> {
  const previews = outcomes.flatMap((outcome) => (outcome.previews ?? []).map((preview) => ({ outcome, preview })));
  const { openBrowser } = await import("./preview/browser.js");
  const opened = await openBrowser();
  if (!opened.browser) {
    const reason = opened.missing ? ("no-playwright-core" as const) : ("no-browser" as const);
    for (const outcome of outcomes) if (outcome.previews) Object.assign(outcome, { browser: null, reason });
    return { browser: null, tried: opened.tried, ...(opened.bun ? { bun: opened.bun } : {}), ...(opened.missing ? { missing: true } : {}) };
  }
  const { browser, name } = opened;
  try {
    const queue = [...previews];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const { outcome, preview } = next;
        const file = resolve(options.cwd, preview.path);
        const png = options.screenshots ? join(dirname(file), `${basename(file, extname(file))}.png`) : undefined;
        const drawn = await browser.draw(file, { screenshot: !!png });
        preview.ready = drawn.ready;
        preview.findings = drawn.findings;
        if (png && drawn.screenshot) {
          try {
            writeAtomically(png, drawn.screenshot);
            preview.screenshot = displayPath(options.cwd, png);
            outcome.outputs.push(preview.screenshot);
          } catch (error) {
            outcome.status = "error";
            outcome.error = `couldn't write ${displayPath(options.cwd, png)}: ${errorLine(error)}`;
          }
        }
        if (drawn.ready === "error") {
          outcome.status = "error";
          const said = drawn.findings && typeof drawn.findings.error === "string" ? drawn.findings.error : drawn.error;
          outcome.diagnostics = [...outcome.diagnostics, cliDiagnostic("preview-failed", "error", `The ${preview.id} preview failed in ${name}: ${said ?? "it said error"}`)];
          outcome.formatted = undefined;
        }
      }
    };
    // A few at once: each draws two frames and runs the models' WebAssembly.
    await Promise.all(Array.from({ length: Math.min(4, previews.length) }, worker));
  } finally {
    await browser.close();
  }
  for (const outcome of outcomes) if (outcome.previews) outcome.browser = name;
  return { browser: name };
}

/** `--serve`: the previews served on 127.0.0.1 until Ctrl-C; each preview gets its `url`. */
export async function servePreviews(outcomes: Outcome[], root: string, cwd: string): Promise<string> {
  const { serve } = await import("./preview/serve");
  const server = await serve(root);
  for (const outcome of outcomes) for (const preview of outcome.previews ?? []) preview.url = server.url(resolve(cwd, preview.path));
  return server.base;
}

/** What a preview says, as a line of text. */
export function previewLine(preview: Preview): string {
  let line = `${preview.id}: ${preview.url ?? preview.path}`;
  if (preview.ready) {
    line += ` (${preview.ready}`;
    const findings = preview.findings as { missing?: Array<{ kind: string; family?: string; src?: string }>; removed?: unknown[]; diagnostics?: Diagnostic[]; error?: string | null } | null;
    const missing = findings?.missing ?? [];
    if (missing.length) line += `; missing: ${missing.map((m) => `${m.kind} ${m.family ?? m.src ?? ""}`.trim()).join(", ")}`;
    if (findings?.removed?.length) line += `; ${findings.removed.length} kind${findings.removed.length === 1 ? "" : "s"} of thing removed or changed`;
    if (findings?.diagnostics?.length) line += `; ${findings.diagnostics.map((d) => d.code).join(", ")}`;
    line += ")";
  }
  if (preview.screenshot) line += ` → ${preview.screenshot}`;
  return line;
}
