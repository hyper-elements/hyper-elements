/**
 * The fonts a preview draws with: the open stand-ins the captures were scored with (Selawik for Segoe UI, Carlito for
 * Calibri, Inter at Aptos's widths for Aptos, Office's cloud fonts, Android's own fonts for the Gmail apps; SIL OFL 1.1,
 * in fonts/ with their licences, as WOFF2), loaded from a
 * URL or inlined. Which
 * files each client loads, and the faces drawn from them, are the models package's (fontFiles, and its browser
 * script's fontCss).
 */
import { loadModelsPackage } from "./models";
import { version } from "../package.json";
import type { Computer, ModelClient } from "./clients";

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
 * The stand-ins for a family an email chooses itself, by their files here: loaded, and inlined, only where the email
 * names the family. The others (Segoe UI, Calibri, Aptos, the client's default) are what the client draws with whatever
 * the email names. Since models 1.9.0, Office's cloud fonts, which classic Outlook draws by name (Inter was one until
 * models 1.7.0, when they learnt Windows doesn't have it).
 */
export const NAMED_ONLY: Readonly<Record<string, readonly string[]>> = {
  Lato: ["Lato-Regular.woff2", "Lato-Bold.woff2", "Lato-Italic.woff2", "Lato-BoldItalic.woff2"],
  Montserrat: ["Montserrat-Variable.woff2", "Montserrat-Italic-Variable.woff2"],
  "Open Sans": ["OpenSans-Variable.woff2", "OpenSans-Italic-Variable.woff2"],
  Poppins: ["Poppins-Regular.woff2", "Poppins-SemiBold.woff2", "Poppins-Bold.woff2", "Poppins-Italic.woff2", "Poppins-BoldItalic.woff2"],
  "Nunito Sans": ["NunitoSans-Variable.woff2", "NunitoSans-Italic-Variable.woff2"],
};

const ENTITIES: Record<string, string> = { quot: '"', apos: "'", "#39": "'", "#x27": "'", amp: "&" };

/** Of `families` (NAMED_ONLY's), those a font-family in `html` names (its inline styles, <style>s and Html blocks alike). */
export function namedFamilies(html: string, families: Readonly<Record<string, readonly string[]>> = NAMED_ONLY): Set<string> {
  const named = new Set<string>();
  for (const [, value] of html.matchAll(/font-family\s*:\s*((?:&[a-z#0-9]+;|[^;}<>])+)/gi)) {
    const decoded = value!.replace(/&([a-z#0-9]+);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity);
    for (const family of decoded.split(",").map((f) => f.trim().replace(/^["']+|["']+$/g, "").toLowerCase())) {
      for (const known of Object.keys(families)) if (family === known.toLowerCase()) named.add(known);
    }
  }
  return named;
}

/** The files and faces of `known`'s families (NAMED_ONLY's) `html` doesn't name: a preview leaves them out. */
export function unnamed(html: string, known: Readonly<Record<string, readonly string[]>> = NAMED_ONLY): { files: Set<string>; families: string[] } {
  const named = namedFamilies(html, known);
  const families = Object.keys(known).filter((family) => !named.has(family));
  return { files: new Set(families.flatMap((family) => known[family]!)), families };
}

/** The source each of a client's files is given: its URL, or a data: URL. `skip`: files the email doesn't need. */
export async function fontSources(client: ModelClient, how: "url" | "inline", read: ReadFont = readPackageFont, skip: ReadonlySet<string> = new Set(), computer?: Computer): Promise<Record<string, string>> {
  const files = (await loadModelsPackage()).fontFiles(client, computer).filter((file) => !skip.has(file));
  const sources = await Promise.all(files.map(async (file) => [file, how === "url" ? fontUrl(file) : `data:font/woff2;base64,${await read(file)}`] as const));
  return Object.fromEntries(sources);
}
