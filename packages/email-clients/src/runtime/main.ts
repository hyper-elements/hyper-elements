/**
 * The runtime a preview file carries (built into one script by scripts/build-runtime.mjs). It never runs code inside
 * the frames and never measures the shell:
 *
 * 1. Reads the email and its config, compiles the models (the preview's other script, models.ts), and makes the
 *    client's version, noting what the client removed.
 * 2. Writes two sandboxed frames at the client's width, each with the client's font CSS after its own processing: the
 *    client's version, and a baseline (the email as written, with its block paths, no client processing).
 * 3. In each: waits for it to load, loads every stand-in face, waits for every image (one that failed, or is still
 *    loading at the deadline, is drawn as a gray box and listed), and lists the email's own web fonts that failed.
 * 4. Checks the system fonts the client's version draws with, by measurement (the models' checkSystemFonts).
 * 5. Runs the client's step on its frame, then waits for its fonts again.
 * 6. Finds what's robust to find (the models' findings, and Gmail's clip), and writes it to `email-client-findings`
 *    and the note.
 * 7. Says it's done: `data-email-client-ready` is "ok", "incomplete" (something was missing, or 10 seconds passed), or
 *    "error" (with the error in the findings).
 */
import type { BlockMap } from "@hyper-elements/react";
import { scriptJson } from "../shell";
import { clipped, type Finding } from "./findings";
import { frame, grow, loadFaces, missingAuthorFonts, settleImages, until, webFontFamilies, withCss, withoutFaces } from "./frames";
import { markPaths } from "./marks";
import { loadModels, type Client } from "./models";

/** How tall a client's window is, while a frame loads and is measured: a desktop's, or a phone's. */
const WINDOW = { desktop: 900, phone: 812 } as const;

export interface Config {
  id: string;
  client: Client;
  name: string;
  variant: "desktop" | "phone";
  dark: boolean;
  width: number;
  approximate: boolean;
  blocks: BlockMap;
  fontOrigin: string | null;
  /** Where each of the client's open font files loads from: its URL, or a data: URL. */
  fontSources: Record<string, string>;
  /** Each stand-in face to load before measuring, and their families (the models'). */
  faces: string[];
  /** Families whose stand-ins aren't loaded, as the email doesn't name them (Inter): their @font-face rules are left out. */
  leftOut: string[];
  standIns: string[];
  /** The Elements version the client's model was measured on, the runtime's sha256, and the models' script's and protocol. */
  elements: string | null;
  runtime: string;
  models: { script: string; protocol: number };
}

type Missing = { kind: "font" | "substituted"; family: string } | { kind: "author-font"; family: string; src: string } | { kind: "image"; src: string };

/** How long a preview may take to draw, in ms. */
const DEADLINE = 10_000;

const json = <T>(id: string): T => JSON.parse(document.getElementById(id)!.textContent!) as T;

function writeFindings(findings: Record<string, unknown>): void {
  const script = document.createElement("script");
  script.type = "application/json";
  script.id = "email-client-findings";
  script.textContent = scriptJson(findings);
  document.body.append(script);
}

/** The note: how the preview went, what the client removed, what was missing, what it found. */
function writeNote(findings: { ready: string; removed: Array<{ what: string; count: number }>; missing: Missing[]; diagnostics: Finding[]; error: string | null }): void {
  const note = document.getElementById("findings")!;
  const list = (title: string, items: string[]) => {
    if (!items.length) return;
    const h = document.createElement("h2");
    h.textContent = title;
    const ul = document.createElement("ul");
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      ul.append(li);
    }
    note.append(h, ul);
  };
  const status = document.createElement("p");
  status.textContent = findings.error ? `The preview failed: ${findings.error}` : findings.ready === "ok" ? "Drawn." : "Drawn, with something missing (listed below): it may differ from the client.";
  note.append(status);
  list("Found", findings.diagnostics.map((d) => `${d.severity} ${d.code} at ${d.path}${d.selector ? ` (${d.selector})` : ""}: ${d.message}.${d.fix ? ` Fix: ${d.fix}` : ""}`));
  list("What the client removed or changed", findings.removed.map(({ what, count }) => `${what}${count > 1 ? ` (${count})` : ""}`));
  list("Missing", findings.missing.map((m) => (m.kind === "image" ? `image ${m.src}` : m.kind === "author-font" ? `web font ${m.family} (${m.src})` : m.kind === "substituted" ? `font ${m.family} (another font of other widths drew instead)` : `font ${m.family}`)));
}

async function main(): Promise<void> {
  const started = performance.now();
  const deadline = started + DEADLINE;
  const root = document.documentElement;
  const config = json<Config>("email-client-config");
  const findings = {
    version: 1,
    client: config.client,
    variant: config.variant,
    dark: config.dark,
    width: config.width,
    ready: "ok" as "ok" | "incomplete" | "error",
    elements: config.elements,
    runtime: config.runtime,
    models: config.models.script,
    browser: navigator.userAgent,
    approximate: config.approximate,
    removed: [] as Array<{ what: string; count: number }>,
    missing: [] as Missing[],
    fonts: [] as Array<{ family: string; verified: "present" | "widths" }>,
    diagnostics: [] as Finding[],
    error: null as string | null,
  };
  try {
    const html = json<string>("email");
    const models = await loadModels(config.models.protocol);
    const mark = (text: string, limit?: number) => markPaths(text, config.blocks.entries, limit);
    const processed = models.process(config.client, html, { mark, dark: config.dark, fonts: config.fontSources });
    findings.removed = Object.entries(processed.removed).map(([what, count]) => ({ what, count }));
    const fontCss = withoutFaces(models.fontCss(config.client, config.fontSources), config.leftOut ?? []);
    // Outlook.com's version has its web font from the model itself, as its scorer's has.
    const clientHtml = config.client === "outlook-com" ? processed.html : withCss(processed.html, fontCss);
    const height = WINDOW[config.variant];
    const [shown, baseline] = await Promise.all([
      frame(clientHtml, config.width, height, `${config.name}: the email as it draws`, deadline),
      frame(withCss(mark(html), fontCss), config.width, height, "The email as written", deadline),
    ]);
    const docs = [shown.contentDocument!, baseline.contentDocument!];
    await Promise.all(docs.map((doc) => loadFaces(doc, config.faces, deadline)));
    const [images] = await Promise.all(docs.map((doc) => settleImages(doc, deadline)));
    const standIns = new Set(config.standIns);
    const author = await missingAuthorFonts(docs[0]!, standIns, deadline);
    const loaded = new Set([...docs[0]!.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replace(/^["']|["']$/g, "")));
    // A stand-in with no face loaded (its file unreachable; Helvetica Neue not on this machine for Aptos) is missing.
    const standInsMissing = config.standIns.filter((family) => !loaded.has(family) && [...docs[0]!.fonts].some((face) => face.family.replace(/^["']|["']$/g, "") === family));
    const report = processed.frameStep(shown.contentWindow!);
    await until(docs[0]!.fonts.ready.then(() => undefined), deadline, undefined);
    // After the client's step: classic Outlook's rules write the one font Outlook draws each run in.
    // The email's web fonts as written: a client that removed their rules leaves the families in its stacks.
    const system = models.checkSystemFonts(docs[0]!, { loaded: [...loaded, ...standInsMissing], standIns, webFonts: webFontFamilies(docs[1]!, standIns) });
    findings.missing = [...standInsMissing.map((family) => ({ kind: "font" as const, family })), ...system.missing, ...author.map((a) => ({ kind: "author-font" as const, ...a })), ...images!.map((src) => ({ kind: "image" as const, src }))];
    findings.fonts = system.fonts;
    const types = new Map(config.blocks.entries.map((entry) => [entry.path, entry.type]));
    findings.diagnostics.push(...models.findings(config.client, { shown: docs[0]!, baseline: docs[1]!, report, types, dark: config.dark }));
    if (processed.cut !== null && (config.client === "gmail" || config.client === "gmail-app" || config.client === "gmail-app-other")) findings.diagnostics.push(clipped(config.client, processed.cut, processed.size ?? 0, config.blocks.entries));
    grow(shown);
    baseline.hidden = true;
    findings.ready = findings.missing.length || performance.now() > deadline ? "incomplete" : "ok";
  } catch (error) {
    findings.ready = "error";
    findings.error = error instanceof Error ? error.message : String(error);
  }
  writeFindings(findings);
  writeNote(findings);
  root.setAttribute("data-email-client-ready", findings.ready);
}

void main();
