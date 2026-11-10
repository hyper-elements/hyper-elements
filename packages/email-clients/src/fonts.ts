/**
 * The fonts a preview draws with: the open stand-ins the captures were scored with (Selawik for Segoe UI, Carlito for
 * Calibri, Inter itself; SIL OFL 1.1, in fonts/ with their licences, as WOFF2), loaded from a URL or inlined. Which
 * files each client loads, and the faces drawn from them, are the models package's (fontFiles, and its browser
 * script's fontCss).
 */
import { loadModelsPackage } from "./models";
import { version } from "../package.json";
import type { PreviewClient } from "./clients";

/** Where `fonts: "url"` loads the stand-ins from: this package's own files, by its version. */
export const FONT_ORIGIN = "https://cdn.jsdelivr.net";
export const fontUrl = (file: string) => `${FONT_ORIGIN}/npm/@hyper-elements/email-clients@${version}/fonts/${file}`;

/** The most base64 the inlined fonts of one preview may hold. */
export const INLINE_BUDGET = 2_000_000;

/** A font file as base64, read from the package's fonts/ (Node only: `fonts: "inline"`). */
export type ReadFont = (file: string) => Promise<string>;

/**
 * Reads the package's own font files (fonts/, beside dist/). Where a bundler has moved this package's code away from
 * its files (bundled into an app's server build), it says so: the files aren't there to read.
 */
export async function readPackageFont(file: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const url = new URL(`../fonts/${file}`, import.meta.url);
  try {
    return (await readFile(url)).toString("base64");
  } catch (cause) {
    const error: Error & { cause?: unknown } = new Error(
      `fonts: "inline" reads @hyper-elements/email-clients' font files from its fonts/ folder, and ${url.href} isn't there to read: ` +
        `the package was bundled away from its files. Leave it out of the bundle (Next.js: serverExternalPackages: ["@hyper-elements/email-clients"]), or use fonts: "url"`
    );
    error.name = "email-clients/fonts-unreadable";
    error.cause = cause;
    throw error;
  }
}

/**
 * The stand-ins for a family an email chooses itself (Inter, by its files here): loaded, and inlined, only where the
 * email names the family. The others (Segoe UI, Calibri, the client's default) are what the client draws with whatever
 * the email names. Inter's two files are half of classic Outlook's fonts.
 */
export const NAMED_ONLY: Readonly<Record<string, readonly string[]>> = { Inter: ["InterVariable.woff2", "InterVariable-Italic.woff2"] };

const ENTITIES: Record<string, string> = { quot: '"', apos: "'", "#39": "'", "#x27": "'", amp: "&" };

/** Of NAMED_ONLY's families, those a font-family in `html` names (its inline styles, <style>s and Html blocks alike). */
export function namedFamilies(html: string): Set<string> {
  const named = new Set<string>();
  for (const [, value] of html.matchAll(/font-family\s*:\s*((?:&[a-z#0-9]+;|[^;}<>])+)/gi)) {
    const decoded = value!.replace(/&([a-z#0-9]+);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity);
    for (const family of decoded.split(",").map((f) => f.trim().replace(/^["']+|["']+$/g, "").toLowerCase())) {
      for (const known of Object.keys(NAMED_ONLY)) if (family === known.toLowerCase()) named.add(known);
    }
  }
  return named;
}

/** The files and faces of NAMED_ONLY's families `html` doesn't name: a preview leaves them out. */
export function unnamed(html: string): { files: Set<string>; families: string[] } {
  const named = namedFamilies(html);
  const families = Object.keys(NAMED_ONLY).filter((family) => !named.has(family));
  return { files: new Set(families.flatMap((family) => NAMED_ONLY[family]!)), families };
}

/** The source each of a client's files is given: its URL, or a data: URL. `skip`: files the email doesn't need. */
export async function fontSources(client: PreviewClient, how: "url" | "inline", read: ReadFont = readPackageFont, skip: ReadonlySet<string> = new Set()): Promise<Record<string, string>> {
  const files = (await loadModelsPackage()).fontFiles(client).filter((file) => !skip.has(file));
  const sources = await Promise.all(files.map(async (file) => [file, how === "url" ? fontUrl(file) : `data:font/woff2;base64,${await read(file)}`] as const));
  return Object.fromEntries(sources);
}
