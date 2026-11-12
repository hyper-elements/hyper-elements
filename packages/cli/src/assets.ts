/**
 * A Document's and a Canvas's fonts and images, as bytes: what `templateAssets()` lists, loaded the way the CLI
 * supports, for `renderPdf()` and `renderImage()` (which load nothing themselves).
 *
 * - `data:`: a font's is decoded and given like any other file (renderPdf() reads only the font files it's given,
 *   and renderImage() skips a template's face of a family it's given a file for). An image keeps its URI, which both
 *   renderers read.
 * - `http:` and `https:`: fetched and cached by URL, in `node_modules/.cache/hyper-elements/` in the nearest
 *   `node_modules` above the template, else in the OS's cache folder under `hyper-elements/`. No expiry: `--refresh`
 *   fetches again, `--offline` fetches nothing (a URL not in the cache fails the template, `cli/offline`). An entry
 *   is written to a temporary file and renamed into place only once a whole 2xx response has arrived. A cache folder
 *   the CLI can't write is read from only.
 * - A relative path, from the template's folder; a root-relative one (`/logo.png`), from `--public` or the first
 *   `public/` beside a `package.json` from the template's folder up to the workspace root.
 *
 * Any other form (a scheme-relative `//host/…`, another scheme), and a source that can't be loaded, is left out with a
 * `cli/asset` warning naming it and why; the renderer's own diagnostic follows.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { workspaceRoot } from "@unlayer-internal/template-loader";
import { cliDiagnostic } from "./commands/shared";
import { errorLine } from "./errors";
import type { Diagnostic } from "./protocol";

/** A font face as `templateAssets()` gives it (packages/core/src/kinds.ts's FontFace). */
export interface FontFace {
  family: string;
  src: string;
  format?: string;
  weight?: number | [number, number];
  style?: "normal" | "italic";
}

/** What `templateAssets()` returns. */
export interface TemplateAssets {
  fonts: FontFace[];
  images: string[];
}

/** A font file, as renderPdf()'s and renderImage()'s `fonts` take it. */
export interface FontFile {
  family: string;
  src: Uint8Array;
  weight?: number;
  style?: "normal" | "italic";
}

export interface LoadedAssets {
  fonts: FontFile[];
  /** Image files by the URL the template gives (a data: URI isn't here: the renderers read it). */
  images: Record<string, Uint8Array>;
  /** `cli/asset` and `cli/offline` diagnostics, in the order of the sources. */
  diagnostics: Diagnostic[];
}

export interface AssetOptions {
  /** The template's file (absolute). */
  template: string;
  /** The run's folder, for the paths messages show. */
  cwd: string;
  /** `--public`, absolute. */
  public?: string;
  /** `--refresh`: entries cached before this time (ms) are fetched again. */
  refreshSince?: number;
  offline?: boolean;
}

/** How long one fetch may take. */
const FETCH_TIMEOUT = 30_000;
/** A cache entry's first line: what it is, and its format's version. */
const ENTRY_HEAD = "hyper-elements-cache 1";

interface Fetched {
  body?: Uint8Array;
  type: string | null;
  /** Why it couldn't be had: left out with `cli/asset`. */
  failure?: string;
  /** Not in the cache, and `--offline`. */
  offline?: boolean;
  /** The cache folder couldn't be written. */
  readOnly?: string;
}

/** Fetches in this process, by cache folder and URL: one request per URL, however many templates name it. */
const fetches = new Map<string, Promise<Fetched>>();

/** The folder fetched files are cached in, for a template: in its nearest node_modules, else the OS's cache folder. */
export function cacheFolder(template: string, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string {
  for (let dir = dirname(template); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "node_modules"))) return join(dir, "node_modules", ".cache", "hyper-elements");
    if (dirname(dir) === dir) break;
  }
  return join(osCache(env, platform), "hyper-elements");
}

/** The OS's cache folder: `$XDG_CACHE_HOME` or `~/.cache` on Linux, `~/Library/Caches` on macOS, `%LOCALAPPDATA%` on Windows. */
export function osCache(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string {
  if (platform === "win32") return env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  if (platform === "darwin") return join(homedir(), "Library", "Caches");
  return env.XDG_CACHE_HOME || join(homedir(), ".cache");
}

/** The default public folder: the first `public/` beside a package.json, from `folder` up to the workspace root. */
export function publicFolder(folder: string): string | undefined {
  const top = workspaceRoot(folder);
  for (let dir = folder; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) {
      const candidate = join(dir, "public");
      if (isFolder(candidate)) return candidate;
      // Without a workspace, the template's own package is as far as it looks.
      if (!top) return undefined;
    }
    if (dir === top || dirname(dir) === dir) return undefined;
  }
}

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** A source as messages name it: a data: URI by its kind, a long URL shortened. */
function named(src: string): string {
  if (/^data:/i.test(src)) {
    const comma = src.indexOf(",");
    const type = src.slice(5, comma < 0 ? undefined : comma).split(";")[0].slice(0, 60);
    return `a data: URI (${type || "no type"})`;
  }
  return src.length > 160 ? `${src.slice(0, 157)}…` : src;
}

/** A data: URI's bytes, or undefined where it isn't one. */
export function decodeDataUri(src: string): Uint8Array | undefined {
  const match = /^data:([^,]*),(.*)$/is.exec(src);
  if (!match) return undefined;
  const base64 = /;base64$/i.test(match[1].trim());
  try {
    return base64 ? new Uint8Array(Buffer.from(match[2].replace(/\s+/g, ""), "base64")) : new Uint8Array(Buffer.from(decodeURIComponent(match[2]), "utf8"));
  } catch {
    return undefined;
  }
}

/** A path in a URL, as a file's: without its query and fragment, percent-decoded. */
function urlPath(src: string): string {
  const path = src.replace(/[?#].*$/s, "");
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

const display = (cwd: string, path: string) => relative(cwd, path).split(sep).join("/") || ".";

/** Loads a template's fonts and images (see the top of this file). */
export async function loadAssets(sources: TemplateAssets, options: AssetOptions): Promise<LoadedAssets> {
  const diagnostics: Diagnostic[] = [];
  const folder = dirname(options.template);
  let publicDir: string | null | undefined = options.public;
  const cache = cacheFolder(options.template);
  let readOnlySaid = false;

  /** A source's bytes (and its type, where fetched), or undefined with a diagnostic said. */
  const bytesOf = async (src: string, what: string, font: boolean): Promise<Uint8Array | undefined> => {
    const leftOut = (why: string, fix?: string) => {
      diagnostics.push(cliDiagnostic("asset", "warning", `Couldn't load ${what} ${named(src)}: ${why}. It's left out`, fix));
      return undefined;
    };
    if (/^data:/i.test(src)) return decodeDataUri(src) ?? leftOut("it isn't a data: URI the CLI can decode");
    if (src.startsWith("//")) return leftOut("a scheme-relative URL (//host/…) has no scheme to fetch it with, and the CLI doesn't load it", "give its URL with https:");
    if (/^https?:\/\//i.test(src)) {
      const fetched = await fetchCached(src, cache, options);
      if (fetched.readOnly && !readOnlySaid) {
        readOnlySaid = true;
        diagnostics.push(cliDiagnostic("asset", "info", `The cache folder ${display(options.cwd, cache)} can't be written (${fetched.readOnly}): it's read from only, and what isn't in it is fetched each run`));
      }
      if (fetched.offline) {
        diagnostics.push(cliDiagnostic("offline", "error", `${what} ${named(src)} isn't in the cache, and --offline fetches nothing`, "run once without --offline to cache it"));
        return undefined;
      }
      if (fetched.failure) return leftOut(fetched.failure);
      if (font && fetched.type && /^text\/css\b/i.test(fetched.type)) {
        return leftOut("it answers with a stylesheet (text/css), as Google Fonts' css2 API does, not a font file", "give the font file's own URL (a src: url(…) in that stylesheet)");
      }
      return fetched.body;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return leftOut(`the CLI doesn't load ${src.slice(0, src.indexOf(":") + 1)} URLs`);
    let path: string;
    if (src.startsWith("/")) {
      if (publicDir === undefined) publicDir = publicFolder(folder) ?? null;
      if (publicDir === null) {
        return leftOut("a root-relative path is read from the public folder, and there's none: no public/ beside a package.json from the template's folder up to the workspace root", "give the folder with --public <dir>");
      }
      path = resolve(publicDir, `.${urlPath(src)}`);
      if (path !== publicDir && !path.startsWith(publicDir.endsWith(sep) ? publicDir : publicDir + sep)) return leftOut(`it leads out of the public folder ${display(options.cwd, publicDir)}`);
    } else {
      path = resolve(folder, urlPath(src));
    }
    try {
      return new Uint8Array(readFileSync(path));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return leftOut(code === "ENOENT" ? `${display(options.cwd, path)} doesn't exist` : code === "EISDIR" ? `${display(options.cwd, path)} is a folder` : `${display(options.cwd, path)}: ${errorLine(error)}`);
    }
  };

  const fonts: FontFile[] = [];
  for (const face of sources.fonts) {
    const src = await bytesOf(face.src, `${face.family}'s font file`, true);
    if (!src) continue;
    const weight = Array.isArray(face.weight) ? face.weight[0] : face.weight;
    fonts.push({ family: face.family, src, ...(weight !== undefined ? { weight } : {}), ...(face.style ? { style: face.style } : {}) });
  }
  const images: Record<string, Uint8Array> = {};
  for (const src of sources.images) {
    // The renderers read a data: URI themselves.
    if (/^data:/i.test(src) || src in images) continue;
    const bytes = await bytesOf(src, "the image", false);
    if (bytes) images[src] = bytes;
  }
  return { fonts, images, diagnostics };
}

/** Whether loading left a template unable to render: an http(s) source not in the cache with `--offline`. */
export function offlineFailure(loaded: LoadedAssets): boolean {
  return loaded.diagnostics.some((d) => d.code === "cli/offline");
}

function fetchCached(url: string, cache: string, options: AssetOptions): Promise<Fetched> {
  const key = `${cache}\0${url}`;
  let pending = fetches.get(key);
  if (!pending) {
    pending = fetchEntry(url, cache, options);
    fetches.set(key, pending);
  }
  return pending;
}

/** A cache entry's file for a URL. */
export function entryPath(cache: string, url: string): string {
  return join(cache, createHash("sha256").update(url).digest("hex"));
}

/** A cache entry: its first line, a JSON line with its URL and type, then the response's bytes. */
function readEntry(path: string, url: string): Fetched | undefined {
  let data: Buffer;
  try {
    data = readFileSync(path);
  } catch {
    return undefined;
  }
  const first = data.indexOf(10);
  const second = first < 0 ? -1 : data.indexOf(10, first + 1);
  if (second < 0 || data.subarray(0, first).toString("utf8") !== ENTRY_HEAD) return undefined;
  try {
    const meta = JSON.parse(data.subarray(first + 1, second).toString("utf8")) as { url?: unknown; type?: unknown };
    if (meta.url !== url) return undefined;
    return { body: new Uint8Array(data.subarray(second + 1)), type: typeof meta.type === "string" ? meta.type : null };
  } catch {
    return undefined;
  }
}

let temporary = 0;

async function fetchEntry(url: string, cache: string, options: AssetOptions): Promise<Fetched> {
  const path = entryPath(cache, url);
  let fresh = true;
  if (options.refreshSince !== undefined) {
    try {
      fresh = statSync(path).mtimeMs >= options.refreshSince;
    } catch {
      fresh = false;
    }
  }
  if (fresh) {
    const hit = readEntry(path, url);
    if (hit) return hit;
  }
  if (options.offline) return { type: null, offline: true };
  let response: Response;
  let body: Uint8Array;
  try {
    response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { type: null, failure: `the server answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""}` };
    }
    body = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    return { type: null, failure: fetchFailure(error) };
  }
  const type = response.headers.get("content-type");
  // The whole response arrived with a 2xx: written to a temporary file, then renamed into place.
  let readOnly: string | undefined;
  const file = `${path}.${process.pid}-${temporary++}.tmp`;
  try {
    mkdirSync(cache, { recursive: true });
    writeFileSync(file, Buffer.concat([Buffer.from(`${ENTRY_HEAD}\n${JSON.stringify({ url, type })}\n`, "utf8"), body]), { flag: "wx" });
    renameSync(file, path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    readOnly = code ?? errorLine(error);
    try {
      rmSync(file, { force: true });
    } catch {
      // nothing more to do
    }
  }
  return { body, type, ...(readOnly ? { readOnly } : {}) };
}

/** Why a fetch failed, in a few words. */
function fetchFailure(error: unknown): string {
  const value = error as { name?: string; code?: string; cause?: { code?: string; message?: string } } | null;
  if (value?.name === "TimeoutError" || value?.name === "AbortError") return `no answer within ${FETCH_TIMEOUT / 1000} s`;
  const code = value?.cause?.code ?? value?.code;
  return `the request failed${code ? ` (${code})` : ""}`;
}
