/**
 * The fonts a preview draws with: the open stand-ins email-renderer measured with (Selawik for Segoe UI, Carlito for
 * Calibri, Inter itself; SIL OFL 1.1, in fonts/ with their licences, as WOFF2), loaded from a URL or inlined; and, for
 * the system fonts the clients draw with (Arial, Georgia and the rest), the width of a probe string at 100px on the
 * fonts the captures were scored with, so a preview can tell a font that's there from one the browser swapped.
 */
import { version } from "../package.json";
import type { PreviewClient } from "./clients";

/** A stand-in face: the family a client's CSS names, its file in fonts/, its weight and style. */
export interface Face {
  family: string;
  file: string;
  weight: number | string;
  style?: "normal" | "italic";
}

/** Classic Outlook's stand-ins, as its scorer injects them (email-renderer fonts.mjs). */
const OUTLOOK: Face[] = [
  { family: "Segoe UI", file: "selawkl.woff2", weight: 300 },
  { family: "Segoe UI", file: "selawksl.woff2", weight: 350 },
  { family: "Segoe UI", file: "selawk.woff2", weight: 400 },
  { family: "Segoe UI", file: "selawksb.woff2", weight: 600 },
  { family: "Segoe UI", file: "selawkb.woff2", weight: 700 },
  { family: "Inter", file: "InterVariable.woff2", weight: "100 900" },
  { family: "Inter", file: "InterVariable-Italic.woff2", weight: "100 900", style: "italic" },
  { family: "Calibri", file: "Carlito-Regular.woff2", weight: 400 },
  { family: "Calibri", file: "Carlito-Bold.woff2", weight: 700 },
];

/** Outlook.com's web font, Segoe UI Web (West European): Selawik, by the file names outlook-com.js asks for. */
export const OUTLOOK_COM_FILES: Record<string, string> = { "selawkl.ttf": "selawkl.woff2", "selawk.ttf": "selawk.woff2", "selawksb.ttf": "selawksb.woff2", "selawkb.ttf": "selawkb.woff2" };

/** Each client's stand-in faces (Gmail and Apple Mail draw with the viewer's system fonts, as measured). */
export const FACES: Record<PreviewClient, Face[]> = {
  outlook: OUTLOOK,
  "outlook-com": Object.values(OUTLOOK_COM_FILES).map((file) => OUTLOOK.find((face) => face.file === file)!).map((face) => ({ ...face, family: "Segoe UI Web (West European)" })),
  gmail: [],
  "gmail-app": [],
  "gmail-app-other": [],
  "apple-mail": [],
};

/** What classic Outlook's scorer adds beside its faces: Aptos drawn with Helvetica Neue at 93.5%, and Inter's display optical size. */
const OUTLOOK_EXTRA =
  '@font-face{font-family:"Aptos Stand-in";src:local("Helvetica Neue"),local("HelveticaNeue");size-adjust:93.5%}' +
  '@font-face{font-family:"Aptos Stand-in";src:local("Helvetica Neue Bold"),local("HelveticaNeue-Bold");font-weight:700;size-adjust:93.5%}' +
  '*{font-variation-settings:"opsz" 32!important}';

/** The probe drawn to check a system font: its width at 100px, by family and weight, on the fonts the captures were scored with. */
export const PROBE = "Hamburgefonstiv 0123456789";
export const PROBE_WIDTHS: Record<string, Record<number, number>> = {
  Arial: { 400: 1339.84, 700: 1406.25 },
  Georgia: { 400: 1347.81, 700: 1553.52 },
  Verdana: { 400: 1530.77, 700: 1714.84 },
  Tahoma: { 400: 1327.3, 700: 1535.55 },
  "Trebuchet MS": { 400: 1312.36, 700: 1409.14 },
  "Times New Roman": { 400: 1223.05, 700: 1275 },
  "Courier New": { 400: 1560.27, 700: 1560.27 },
  Helvetica: { 400: 1339.84, 700: 1406.25 },
  "Helvetica Neue": { 400: 1347.81, 700: 1401.31 },
};

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

/** The source each of a client's files is given: its URL, or a data: URL. */
export async function fontSources(client: PreviewClient, how: "url" | "inline", read: ReadFont = readPackageFont): Promise<Record<string, string>> {
  const files = [...new Set(FACES[client].map((face) => face.file))];
  const sources = await Promise.all(files.map(async (file) => [file, how === "url" ? fontUrl(file) : `data:font/woff2;base64,${await read(file)}`] as const));
  return Object.fromEntries(sources);
}

/** The font CSS a client's frames get: its stand-in faces from `sources`, and what its scorer adds beside them. */
export function fontCss(client: PreviewClient, sources: Record<string, string>): string {
  const faces = FACES[client].map(({ family, file, weight, style = "normal" }) => `@font-face{font-family:"${family}";src:url("${sources[file]}") format("woff2");font-weight:${weight};font-style:${style}}`).join("");
  return client === "outlook" ? faces + OUTLOOK_EXTRA : faces;
}

/** The faces a frame loads before measuring ("style weight 16px family"): its stand-ins, and classic Outlook's Aptos stand-in. */
export const facesToLoad = (client: PreviewClient) => [
  ...FACES[client].map(({ family, weight, style = "normal" }) => `${style} ${String(weight).split(" ")[0]} 16px "${family}"`),
  ...(client === "outlook" ? ['normal 400 16px "Aptos Stand-in"', 'normal 700 16px "Aptos Stand-in"'] : []),
];
