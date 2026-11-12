/**
 * Any HTML email through `check` and `preview`: an `.html` or `.htm` file given by name, or `-` for stdin, read as
 * UTF-8 text and given to email-clients' `renderInEmailClients(html)`, in this process. No template code runs, so no
 * loader module is written and no child is started; email-clients loads neither core nor React for HTML.
 *
 * email-clients is the one the HTML file's folder resolves (the current folder's, for stdin) where it's 0.4.3 or
 * later, the first to take HTML; otherwise the CLI's own copy, with an `info` note, `cli/email-clients-copy`.
 *
 * `check` keeps only the call's diagnostics (the email client checks, for `--clients` or the clients the plugin checks
 * a template for) and writes nothing; `preview` writes its previews as a template's are written.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { cliDiagnostic } from "./commands/shared";
import { packageVersion } from "./elements";
import { errorLine, messageOf } from "./errors";
import type { Input } from "./inputs";
import type { Outcome } from "./output";
import type { Diagnostic, PreviewFile } from "./protocol";

const NAME = "@hyper-elements/email-clients";
/** The first email-clients whose renderInEmailClients() takes an HTML string. */
export const HTML_SINCE = "0.4.3";

/** What the CLI calls on email-clients for HTML, typed loosely: the project's copy, of any version from 0.4.3. */
export interface HtmlEmailClients {
  DEFAULT_EMAIL_CLIENTS: readonly string[];
  EMAIL_CLIENTS?: Record<string, unknown>;
  renderInEmailClients(
    html: string,
    options?: { emailClients?: readonly string[]; dark?: boolean; fonts?: "url" | "inline" },
  ): Promise<{
    previews: Array<{ id: string; client: string; filename: string; html: string }>;
    skipped: Array<{ client: string; dark: boolean; reason: string }>;
    diagnostics: Diagnostic[];
  }>;
}

/** The copy of email-clients an HTML input is checked with: its folder, and the note where it's the CLI's own. */
interface Copy {
  module: HtmlEmailClients;
  folder: string;
  note?: Diagnostic;
}

/** Whether `version` is `since` or later (its x.y.z numbers; a pre-release counts as its numbers). */
export function atLeast(version: string, since: string): boolean {
  const parse = (v: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(v)?.slice(1).map(Number);
  const [a, b] = [parse(version), parse(since)];
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/** The folder of the package `name` whose file this is (the nearest package.json above it with that name), and its manifest. */
function packageOf(file: string, name: string): { folder: string; manifest: Record<string, unknown> } | undefined {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const path = join(dir, "package.json");
    if (existsSync(path)) {
      try {
        const manifest = JSON.parse(readFileSync(path, "utf8"));
        if (manifest.name === name) return { folder: dir, manifest };
      } catch {
        // keep looking
      }
    }
    if (dirname(dir) === dir) return undefined;
  }
}

/** The ES module entry of a package's main export (its `import` condition), else the file `require` resolved. */
function esmEntry(folder: string, manifest: Record<string, unknown>, resolved: string): string {
  const exported = (manifest.exports as Record<string, unknown> | undefined)?.["."] ?? manifest.exports;
  const pick = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const conditions = value as Record<string, unknown>;
      return pick(conditions.import) ?? pick(conditions.default);
    }
    return undefined;
  };
  const entry = pick(exported) ?? (typeof manifest.module === "string" ? manifest.module : undefined);
  return entry ? join(folder, entry) : resolved;
}

/** The CLI's own email-clients (a dependency), loaded once. */
let own: Promise<{ module: HtmlEmailClients; folder: string; version: string }> | undefined;
function ownCopy() {
  return (own ??= (async () => {
    const require = createRequire(import.meta.url);
    const manifest = require.resolve(`${NAME}/package.json`);
    const version = (JSON.parse(readFileSync(manifest, "utf8")) as { version?: string }).version ?? "of an unknown version";
    return { module: (await import(NAME)) as HtmlEmailClients, folder: dirname(manifest), version };
  })());
}

const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

/** Whether a node_modules at or above `folder` holds email-clients. */
function installedAbove(folder: string): boolean {
  for (let dir = folder; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "node_modules", NAME, "package.json"))) return true;
    if (dirname(dir) === dir) return false;
  }
}

/** Each project copy, by its entry, loaded once. */
const projects = new Map<string, Promise<HtmlEmailClients>>();

/**
 * The email-clients an HTML file is checked with: the one its folder resolves (with `createRequire(file)`), where it's
 * 0.4.3 or later; else the CLI's own, with a note naming the project's version where it has one.
 */
export async function emailClientsFor(file: string): Promise<Copy> {
  let found: { folder: string; version: string | undefined; entry: string } | undefined;
  try {
    // Bun installs a package no node_modules holds, from its cache or npm (auto-install): that's not the project's.
    if (bun && !installedAbove(dirname(file))) throw new Error(`${NAME} isn't installed`);
    const resolved = createRequire(file).resolve(NAME);
    const pkg = packageOf(resolved, NAME);
    if (pkg) found = { folder: pkg.folder, version: packageVersion(resolved, NAME), entry: esmEntry(pkg.folder, pkg.manifest, resolved) };
  } catch {
    found = undefined;
  }
  if (found?.version && atLeast(found.version, HTML_SINCE)) {
    const entry = found.entry;
    let loading = projects.get(entry);
    if (!loading) {
      loading = import(pathToFileURL(entry).href).then((mod) => ((mod as { renderInEmailClients?: unknown }).renderInEmailClients ? mod : (mod as { default: unknown }).default) as HtmlEmailClients);
      projects.set(entry, loading);
    }
    return { module: await loading, folder: found.folder };
  }
  const copy = await ownCopy();
  const message = found
    ? `This project's ${NAME} is ${found.version ?? "of an unknown version"}, which takes no HTML (${HTML_SINCE} and later do): the CLI's own copy (${copy.version}) is used`
    : `${NAME} isn't installed where this file is: the CLI's own copy (${copy.version}) is used`;
  return {
    module: copy.module,
    folder: copy.folder,
    note: cliDiagnostic("email-clients-copy", "info", message, found ? `npm i -D ${NAME}@^${HTML_SINCE}` : undefined),
  };
}

/** An HTML input's outcome, with the preview files the parent writes, and whether the run was asked what it can't do. */
export interface HtmlResult {
  outcome: Outcome;
  previews?: PreviewFile[];
  usage?: boolean;
}

export interface HtmlOptions {
  clients?: string[];
  dark?: boolean;
  fonts?: "url" | "inline";
  /** For the CLI's own tests: which copy of email-clients each input used. */
  probe?: (text: string) => void;
}

/** Reads all of stdin as UTF-8 text. */
export async function readStdin(stream: NodeJS.ReadableStream = process.stdin): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * `check` or `preview` of one HTML email: `renderInEmailClients(html, options)`. Where the call rejects (the HTML isn't
 * a whole email, the models package can't be imported, or it speaks a protocol email-clients doesn't read), the input
 * is an error; where only the captured checks couldn't run, email-clients says so in a diagnostic and the call goes on.
 */
export async function checkHtml(command: "check" | "preview", input: Input, html: string | Error, options: HtmlOptions): Promise<HtmlResult> {
  const base = { file: input.display, root: null, outputs: [], input: "html" as const };
  const failed = (fields: Partial<Outcome>, usage?: boolean): HtmlResult => ({ outcome: { ...base, status: "error", diagnostics: [], ...fields }, ...(usage ? { usage } : {}) });
  if (html instanceof Error) return failed({ error: errorLine(html) });
  let copy: Copy;
  try {
    copy = await emailClientsFor(input.file);
  } catch (error) {
    return failed({ error: errorLine(error) });
  }
  options.probe?.(JSON.stringify({ file: input.display, emailClients: copy.folder }));
  const notes = copy.note ? [copy.note] : [];
  const { module } = copy;
  // An email client email-clients doesn't know: what the run was asked can't be done (as for a template).
  const known = module.EMAIL_CLIENTS;
  const unknown = options.clients && known ? options.clients.filter((client) => !Object.prototype.hasOwnProperty.call(known, client)) : [];
  if (unknown.length) {
    return failed({ error: `--clients takes a list of ${Object.keys(known!).join(", ")}, not ${unknown.map((c) => JSON.stringify(c)).join(", ")}`, diagnostics: notes }, true);
  }
  const call =
    command === "check"
      ? { emailClients: options.clients ?? module.DEFAULT_EMAIL_CLIENTS }
      : { ...(options.clients ? { emailClients: options.clients } : {}), ...(options.dark ? { dark: true } : {}), ...(options.fonts ? { fonts: options.fonts } : {}) };
  let result;
  try {
    result = await module.renderInEmailClients(html, call);
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    if (name === "email-clients/version-mismatch") {
      return failed({ diagnostics: [{ code: name, severity: "error", message: errorLine(error), path: "" }, ...notes] });
    }
    if (error instanceof TypeError && options.clients && /emailClients/.test(messageOf(error))) {
      return failed({ error: errorLine(error).replace(/^\[Elements\] /, "").replace("renderInEmailClients({ emailClients })", "--clients"), diagnostics: notes }, true);
    }
    // Not a whole email (email-clients' message), or the models package can't be imported (the import's).
    return failed({ error: errorLine(error), diagnostics: notes });
  }
  if (command === "check") {
    // The previews made in memory aren't wanted: the checks are.
    return { outcome: { ...base, status: "ok", diagnostics: [...result.diagnostics, ...notes] } };
  }
  const skipped = result.skipped.map((skip) => ({
    ...cliDiagnostic("preview-skipped", "info", `No ${skip.dark ? "dark " : ""}preview of ${skip.client}: ${skip.reason}`),
    clients: [skip.client],
  }));
  return {
    outcome: { ...base, status: "ok", diagnostics: [...result.diagnostics, ...skipped, ...notes] },
    previews: result.previews.map(({ id, client, filename, html: text }) => ({ id, client, filename, html: text })),
  };
}
