/**
 * Templates in the child (Decisions 18–20): a values file read against its template and checked, a template module
 * checked with its example in each format, and `design new` and `design set`. Every command runs on the snapshot the
 * template's check returns, never on an element collected again; a Canvas is measured (`layoutImage()`, then the
 * template's `checkLayout()`) at the scale it's rendered, strict.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { loadAssets, offlineFailure } from "../assets";
import type { TemplateModule, TemplateObject } from "../elements";
import type { ChildOptions, Diagnostic, DesignRequest, ResultMessage, SlotsNeeded, SlotsReply, TemplateLayout } from "../protocol";
import { checkTemplate } from "./check";
import { inspectTemplate } from "./inspect";
import { outlineTemplate } from "./outline";
import { loadEntry, renderTemplate } from "./render";
import { cliDiagnostic, hasErrors, type CommandResult, type TemplateContext } from "./shared";

const RECORD = Symbol.for("hyper-elements.template");

/**
 * The template a module's default export is (a template, or memo()/forwardRef() of one), or undefined. An element
 * made from a template (`export default <Launch … />`) isn't one: it's a design, exported as an element.
 */
export function templateObjectOf(value: unknown): TemplateObject | undefined {
  let current = value as { $$typeof?: unknown; type?: unknown; render?: unknown } | undefined;
  for (let i = 0; i < 4 && current; i++) {
    if (typeof current === "function" && (current as unknown as Record<symbol, unknown>)[RECORD]) return current as unknown as TemplateObject;
    current = (current.$$typeof === Symbol.for("react.memo") ? current.type : current.$$typeof === Symbol.for("react.forward_ref") ? current.render : undefined) as typeof current;
  }
  return undefined;
}

export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const posix = (path: string) => path.split(sep).join("/");
/**
 * Whether an image's src is a file beside the design, as the asset loader reads one (assets.ts): no scheme (`https:`,
 * `data:`, `cid:`), not `//host/…` or root-relative, and no tag an email service fills in (`{{logo_url}}`).
 */
const local = (src: string) => !/^([a-z][a-z0-9+.-]*:|\/)/i.test(src) && !/<%[\s\S]*?%>|\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/.test(src);
/** The roots whose images the CLI reads from disk to draw them. An Email's or a Page's src is written as it's given. */
export const readsImages = (root: string) => root === "Canvas" || root === "Document";

/** Every image value in some values, with its field path (`artwork`, `stories[1].image`). */
export function imageValues(values: unknown, prefix = ""): Array<{ path: string; value: { src: string; width: number; height: number } }> {
  const out: Array<{ path: string; value: { src: string; width: number; height: number } }> = [];
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((item, i) => visit(item, `${path}[${i}]`));
    else if (value && typeof value === "object") {
      const image = value as { src?: unknown; width?: unknown; height?: unknown };
      if (typeof image.src === "string" && typeof image.width === "number" && typeof image.height === "number") out.push({ path, value: image as { src: string; width: number; height: number } });
      else for (const [key, item] of Object.entries(value)) visit(item, path ? `${path}.${key}` : key);
    }
  };
  visit(values, prefix);
  return out;
}

/** Values with each local image's path read from one folder and written relative to another (`./art/x.png`). */
export function rebase<T>(values: T, from: string, to: string): T {
  const copy = JSON.parse(JSON.stringify(values)) as T;
  for (const { value } of imageValues(copy)) {
    if (!local(value.src)) continue;
    const path = posix(relative(to, resolve(from, value.src)));
    value.src = path.startsWith(".") ? path : `./${path}`;
  }
  return copy;
}

/** A module a slot may be stored as (`{ "module": "./launch.body.tsx" }`), by its extension. */
export const SLOT_MODULE = /\.(tsx|ts|jsx|js|mts|mjs|cts|cjs)$/;

/** The slots stored as `{ module }` among some values (a template's slots are its top-level fields that take JSX). */
export function storedModules(tpl: TemplateObject, values: Record<string, unknown>): Array<{ path: string; module: string }> {
  const fields = (tpl.describe() as { fields: Array<{ path: string; allow?: unknown }> }).fields;
  return fields
    .filter((field) => field.allow !== undefined && /^[A-Za-z_$][\w$]*$/.test(field.path))
    .flatMap((field) => {
      const value = values[field.path] as { module?: unknown } | undefined;
      return value && typeof value === "object" && typeof value.module === "string" ? [{ path: field.path, module: value.module }] : [];
    });
}

/** The captures for a design's slots stored as modules: asked of the parent, which captures them in a process of their own. */
async function fragmentsFor(run: TemplateRun, values: Record<string, unknown>, from: string): Promise<{ fragments?: Record<string, unknown>; error?: Diagnostic }> {
  const needed = storedModules(run.tpl, values);
  if (!needed.length) return {};
  if (!run.slots) return { error: cliDiagnostic("slot-module", "error", "A slot stored as its module needs a capture child, which this command doesn't start") };
  const reply = await run.slots(needed, from);
  if (reply.type === "slots-failed") return { error: cliDiagnostic("slot-module", "error", reply.error, "fix the slot module so it loads and its default export renders the slot's content") };
  return { fragments: reply.captures };
}

/** Each local file a design names (an image, a slot's module), by field path, as its values give it. */
function filesOf(tpl: TemplateObject, values: Record<string, unknown>): Array<{ path: string; src: string }> {
  return [...imageValues(values).filter(({ value }) => local(value.src)).map(({ path, value }) => ({ path, src: value.src })), ...storedModules(tpl, values).map(({ path, module }) => ({ path, src: module }))];
}

export interface TemplateRun {
  tpl: TemplateObject;
  module: TemplateModule;
  /** The context the commands take, but for its element and root, set per format. */
  context: Omit<TemplateContext, "element" | "root" | "inspection">;
  inspect(element: unknown): TemplateContext["inspection"];
  options: ChildOptions;
  command: string;
  /** The captures of slots stored as `{ module }`, from the parent's capture child (the template channel's exchange). */
  slots?(slots: SlotsNeeded["slots"], from: string): Promise<SlotsReply>;
}

type Fields = Partial<ResultMessage> & Pick<ResultMessage, "status">;

/**
 * A Canvas measured at the scale it's rendered, strict, and checked by its template: its fitted text, each image's
 * region and its file against the rules, and the measured rules decided.
 */
async function measure(run: TemplateRun, context: TemplateContext, checked: ReturnType<TemplateObject["check"]>, format: string | undefined): Promise<{ diagnostics: Diagnostic[]; layout: TemplateLayout; usage?: boolean; filesRead?: string[]; decided?: string[] }> {
  const entry = await loadEntry(context, "Canvas");
  if (entry === "old" || Array.isArray(entry) || !entry.layoutImage) {
    const missing = Array.isArray(entry) ? entry.join(" and ") : "@hyper-elements/react/image's layoutImage()";
    return { usage: true, diagnostics: [cliDiagnostic("engine-missing", "error", `Checking a Canvas template's design measures it with ${missing}, not installed where its template is`, Array.isArray(entry) ? `npm i ${entry.join(" ")}` : undefined)], layout: {} };
  }
  const loaded = await loadAssets(entry.templateAssets(context.element), { template: context.file, cwd: context.cwd, public: run.options.public, refreshSince: run.options.refreshSince, offline: run.options.offline });
  if (offlineFailure(loaded)) return { diagnostics: loaded.diagnostics, layout: {} };
  const scale = run.options.scale ?? (format !== undefined ? run.tpl.formats?.[format]?.scale : undefined) ?? 1;
  const layout = await entry.layoutImage(context.element, { fonts: loaded.fonts, images: loaded.images, scale, strict: true });
  // Each image's file, sniffed: by the src its value gives (as rebased for this run).
  const files: Record<string, unknown> = {};
  for (const { path, value } of imageValues(checked.values)) {
    const bytes = loaded.images[value.src];
    const sniffed = bytes && run.module.sniffImage(bytes);
    if (sniffed) files[path] = sniffed;
  }
  const report = run.module.checkLayout(run.tpl, checked.values, { ...(format !== undefined ? { format } : {}), scale, layout, files, checked });
  // The measured rules its template requires, decided here: one that failed is said once, as the template's (raised to
  // an error), and none of them is still "decided when the image is measured".
  const before = new Map((checked.rules as Array<{ rule: string; status: string }>).map((rule) => [rule.rule, rule.status]));
  const now = report.rules as Array<{ rule: string; status: string }>;
  const decided = now.filter((rule) => before.get(rule.rule) === "not-run" && rule.status !== "not-run").map((rule) => rule.rule);
  const raised = new Set(now.filter((rule) => decided.includes(rule.rule) && rule.status === "failed").map((rule) => rule.rule));
  const measured = layout.diagnostics.filter((d: Diagnostic) => !raised.has(d.code));
  return { diagnostics: [...loaded.diagnostics, ...measured, ...report.diagnostics], layout: { fits: report.fits, regions: report.regions, rules: report.rules }, filesRead: Object.keys(files), decided };
}

/**
 * Where a design isn't measured (an Email, a Page, a Document): each image that's a file beside the design, read and
 * checked against its rules (its type, its transparency, the size it's given as). One that isn't a file there (a URL,
 * a service's tag) isn't read, and what only its file says stays undecided (`template/asset-unread`).
 */
function checkFiles(run: TemplateRun, checked: ReturnType<TemplateObject["check"]>, format: string | undefined, folder: string): { diagnostics: Diagnostic[]; filesRead: string[] } {
  const files: Record<string, unknown> = {};
  for (const { path, value } of imageValues(checked.values)) {
    if (!local(value.src)) continue;
    let bytes: Uint8Array;
    try {
      bytes = readFileSync(resolve(folder, value.src));
    } catch {
      continue;
    }
    const sniffed = run.module.sniffImage(bytes);
    if (sniffed) files[path] = sniffed;
  }
  if (!Object.keys(files).length) return { diagnostics: [], filesRead: [] };
  const report = run.module.checkLayout(run.tpl, checked.values, { ...(format !== undefined ? { format } : {}), layout: { nodes: [], fits: [], diagnostics: [] }, files });
  return { diagnostics: report.diagnostics, filesRead: Object.keys(files) };
}

/**
 * Diagnostics without what this run settled: `template/asset-unread` for each image whose file was read, and
 * `template/rule-not-run` for each measured rule the layout decided.
 */
const settled = (diagnostics: Diagnostic[], filesRead: readonly string[] | undefined, decided: readonly string[] | undefined): Diagnostic[] =>
  diagnostics.filter(
    (d) =>
      !(d.code === "template/asset-unread" && filesRead?.includes(d.path.replace(/^values\./, ""))) &&
      !(d.code === "template/rule-not-run" && decided?.some((rule) => d.message.startsWith(`${rule} `)))
  );

const tag = (diagnostics: readonly Diagnostic[], format: string | undefined): Diagnostic[] => (format === undefined ? [...diagnostics] : diagnostics.map((d) => ({ ...d, templateFormat: format })));
/** What validate() says of fit is the HTML preview's: not said where the CLI measures the Canvas (check, render), or draws nothing (design). */
const measuredHere = (run: TemplateRun, diagnostics: Diagnostic[]): Diagnostic[] =>
  run.tpl.root === "Canvas" && (run.command === "check" || run.command === "render" || run.command === "design") ? diagnostics.filter((d) => !(d.code === "web/degraded" && /\.props\.fit$/.test(d.path))) : diagnostics;
/**
 * The template's own check validates its design with its own plugins, so it says where the email client checks come
 * from (`email/more-checks`); where the CLI's run then made those checks, that note is no longer true.
 */
const withoutStaleNote = (fromTemplate: readonly Diagnostic[], fromRun: readonly Diagnostic[]): Diagnostic[] =>
  fromRun.some((d) => d.code === "email/more-checks") ? [...fromTemplate] : fromTemplate.filter((d) => d.code !== "email/more-checks");
/**
 * And where the CLI's run never gets that far it isn't said at all: a design its template refuses is refused for its
 * errors, and `design` writes a file. Neither is a moment to say where more checks come from.
 */
const withoutHint = (diagnostics: readonly Diagnostic[]): Diagnostic[] => diagnostics.filter((d) => d.code !== "email/more-checks");
const unique = (diagnostics: Diagnostic[]): Diagnostic[] => {
  const seen = new Set<string>();
  return diagnostics.filter((d) => {
    const key = `${d.code}|${d.path}|${d.message}|${d.templateFormat ?? ""}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
};

/** One format of a template's design: its command run on the snapshot the check returned. */
async function runFormat(run: TemplateRun, checked: ReturnType<TemplateObject["check"]>, format: string | undefined, folder: string): Promise<CommandResult & { layout?: TemplateLayout; filesRead?: string[]; decided?: string[] }> {
  const snapshot = checked.snapshots[format ?? "default"];
  const inspection = run.inspect(snapshot);
  const context: TemplateContext = { ...run.context, element: snapshot, root: run.tpl.root as TemplateContext["root"], inspection, strict: true, ...(format !== undefined && run.tpl.formats?.[format]?.scale !== undefined ? { scale: run.tpl.formats[format].scale } : {}) };
  if (run.command === "render") {
    // A Canvas is measured first, as check measures it: one its template's checks fail isn't drawn (Decision 25).
    if (run.tpl.root !== "Canvas") {
      // Its images' files checked first, as a Canvas's are: one its template's rules refuse isn't written.
      const files = checkFiles(run, checked, format, folder);
      if (hasErrors(files.diagnostics)) return { status: "error", diagnostics: files.diagnostics, filesRead: files.filesRead };
      const written = await renderTemplate(context);
      return { ...written, filesRead: files.filesRead };
    }
    const measured = await measure(run, context, checked, format);
    if (hasErrors(measured.diagnostics)) return { status: "error", diagnostics: measured.diagnostics, layout: measured.layout, filesRead: measured.filesRead, decided: measured.decided, ...(measured.usage ? { usage: true } : {}) };
    const drawn = await renderTemplate(context);
    return { ...drawn, diagnostics: unique([...measured.diagnostics, ...drawn.diagnostics]), layout: measured.layout, filesRead: measured.filesRead, decided: measured.decided };
  }
  if (run.command === "outline") return outlineTemplate(context);
  if (run.command === "inspect") return inspectTemplate(context);
  // check: the design's own checks with the CLI's plugins, then a Canvas measured.
  const own = await checkTemplate(context);
  if (run.tpl.root !== "Canvas") {
    const files = checkFiles(run, checked, format, folder);
    const diagnostics = [...own.diagnostics, ...files.diagnostics];
    return { ...own, status: hasErrors(diagnostics) ? "error" : own.status, diagnostics, filesRead: files.filesRead };
  }
  const measured = await measure(run, context, checked, format);
  const diagnostics = [...own.diagnostics, ...measured.diagnostics];
  return { status: hasErrors(diagnostics) ? "error" : "ok", diagnostics, layout: measured.layout, filesRead: measured.filesRead, decided: measured.decided, ...(measured.usage ? { usage: true } : {}) };
}

/** A values file's input: its values read and checked against the template, then its command on the snapshot. */
export async function runValues(run: TemplateRun, input: { file: string; values: { file: string; envelope: Record<string, unknown> }; templateFormat?: string }): Promise<Fields> {
  const { tpl, module } = run;
  const envelope = input.values.envelope;
  const template = { id: tpl.id, version: tpl.version };
  if (envelope.draft === true && run.command === "render") {
    return { status: "error", template, diagnostics: [cliDiagnostic("draft", "error", `${relative(run.context.cwd, input.values.file)} is a draft: it's missing ${((envelope.missing as string[] | undefined) ?? []).join(", ") || "values"}`, "fill it with design set, then render it")] };
  }
  const notes: Diagnostic[] = [];
  // The same version, other bytes: the template changed under it (only the entry file is hashed).
  const recorded = (envelope.template as { sha256?: string; version?: string }).sha256;
  if (recorded && (envelope.template as { version?: string }).version === tpl.version && recorded !== sha256(readFileSync(input.file))) {
    notes.push({ code: "template/changed", severity: "warning", message: `${tpl.id} ${tpl.version} isn't the file this design was made with: its module changed under the same version`, path: "template", fix: "give a changed template a new version" });
  }
  const read = module.readValuesFile(envelope, tpl);
  if (!read.values || hasErrors(read.diagnostics)) return { status: "error", template, diagnostics: [...notes, ...read.diagnostics] };
  // Its images are relative to the values file; the run reads them as its template's own, relative to the module.
  // A file whose hash isn't the one recorded changed under the same name (Decision 7): said, never refused.
  const recordedAssets = (read.assets ?? {}) as Record<string, { sha256?: string }>;
  for (const { path, src } of filesOf(tpl, read.values)) {
    const expected = recordedAssets[path]?.sha256;
    if (!expected) continue;
    let actual: string | undefined;
    try {
      actual = sha256(readFileSync(resolve(dirname(input.values.file), src)));
    } catch {
      continue;
    }
    if (actual !== expected) notes.push({ code: "template/asset-changed", severity: "warning", message: `${src} isn't the file this design recorded: it changed under the same name`, path: `values.${path}`, field: path, fix: "check it, then record it again with design set (with --source where it has one)" });
  }
  const slotted = await fragmentsFor(run, read.values, input.values.file);
  if (slotted.error) return { status: "error", template, diagnostics: [...notes, slotted.error] };
  // Where the CLI draws the design it reads its images, as its template's own: relative to the module. An Email's or
  // a Page's src is a URL its HTML holds, kept as written.
  const values = readsImages(tpl.root) ? rebase(read.values, dirname(input.values.file), dirname(input.file)) : read.values;
  const format = input.templateFormat;
  // A template with formats is checked in the ones the file lists: a file that lists none can't pass by checking nothing.
  const names = Object.keys(tpl.formats ?? {});
  if (format === undefined && names.length) {
    return { status: "error", template, diagnostics: [...notes, { code: "template/format", severity: "error", message: `${relative(run.context.cwd, input.values.file)} lists no formats: ${tpl.id} has ${names.join(", ")}`, path: "formats", fix: `list the ones wanted: "formats": ${JSON.stringify(names)}` }] };
  }
  const checked = tpl.check(values, { ...(format !== undefined ? { format } : {}), ...(slotted.fragments ? { fragments: slotted.fragments } : {}) });
  // An image whose file has no source recorded is of unknown origin: a reviewer checks it (Decision 7).
  const assets = (read.assets ?? {}) as Record<string, { source?: unknown }>;
  const unknown = imageValues(read.values)
    .filter(({ path, value }) => local(value.src) && !assets[path]?.source)
    .map(({ path }) => ({ field: path, guidance: "Of unknown origin: no source is recorded for this image (give one with design set … --source)" }));
  const review = [...checked.review, ...unknown];
  const layout: TemplateLayout = { rules: checked.rules, review };
  if (!checked.valid) return { status: "error", template, layout, diagnostics: [...notes, ...read.diagnostics, ...withoutHint(checked.diagnostics)] };
  // Its images' files are beside the values file; where the CLI draws it, they were written relative to the module.
  const { filesRead, decided, ...result } = await runFormat(run, checked, format, readsImages(tpl.root) ? dirname(input.file) : dirname(input.values.file));
  const said = run.command === "check" || run.command === "render" ? withoutStaleNote(checked.diagnostics, result.diagnostics) : checked.diagnostics;
  const diagnostics = settled(measuredHere(run, unique([...notes, ...read.diagnostics, ...said, ...result.diagnostics])), filesRead, decided);
  return { ...result, status: hasErrors(diagnostics) ? "error" : result.status, template, layout: { ...layout, ...result.layout, review }, diagnostics };
}

/** A template module as an input: its example checked in each format (`render` takes values files, not a module). */
export async function runTemplateModule(run: TemplateRun): Promise<Fields> {
  const { tpl } = run;
  const template = { id: tpl.id, version: tpl.version };
  const names = Object.keys(tpl.formats ?? {});
  if (run.command === "render") {
    return { status: "error", usage: true, template, diagnostics: [cliDiagnostic("render-template", "error", `${tpl.id} is a template: render a design made from it (a values file, design new ${tpl.id})`, "design new <template> -o <name.values.json>, then render the values file")] };
  }
  const selected = run.options.templateFormat;
  if (selected !== undefined && !names.includes(selected)) {
    return { status: "error", template, diagnostics: [cliDiagnostic("template-format", "error", `${tpl.id} has the formats ${names.join(", ") || "(none)"}, not ${selected}`)] };
  }
  const formats = selected !== undefined ? [selected] : names.length ? names : [undefined];
  if (run.command === "outline" && formats.length > 1) {
    return { status: "error", usage: true, template, diagnostics: [cliDiagnostic("template-format", "error", `${tpl.id} has ${formats.length} formats (${names.join(", ")}): outline takes one, with --template-format`)] };
  }
  const diagnostics: Diagnostic[] = [];
  const layout: Required<TemplateLayout> = { fits: [], regions: {}, rules: [], review: [] };
  let outputs: Record<string, string> | undefined;
  let inspection: unknown;
  let status: ResultMessage["status"] = "ok";
  let usage = false;
  for (const format of formats) {
    const checked = tpl.check(tpl.example, format !== undefined ? { format } : {});
    layout.review = checked.review;
    if (!checked.valid) {
      diagnostics.push(...tag(withoutHint(checked.diagnostics), format));
      layout.rules.push(...checked.rules);
      status = "error";
      continue;
    }
    const { filesRead, decided, ...result } = await runFormat(run, checked, format, dirname(run.context.file));
    const said = run.command === "check" ? withoutStaleNote(checked.diagnostics, result.diagnostics) : checked.diagnostics;
    diagnostics.push(...tag(settled(measuredHere(run, [...said, ...result.diagnostics]), filesRead, decided), format));
    layout.rules.push(...((result.layout?.rules as unknown[] | undefined) ?? checked.rules));
    layout.fits.push(...((result.layout?.fits as Array<Record<string, unknown>> | undefined) ?? []).map((fit) => ({ ...fit, ...(format !== undefined ? { templateFormat: format } : {}) })));
    for (const [field, byFormat] of Object.entries(result.layout?.regions ?? {})) layout.regions[field] = { ...(layout.regions[field] as object | undefined), ...(byFormat as object) };
    if (result.status === "error") status = "error";
    if (result.usage) usage = true;
    outputs ??= result.outputs;
    inspection ??= result.inspection;
  }
  return { status: hasErrors(diagnostics) ? "error" : status, template, layout, diagnostics: unique(diagnostics), ...(outputs ? { outputs } : {}), ...(inspection !== undefined ? { inspection } : {}), ...(usage ? { usage: true } : {}) };
}

// ─── design new and design set ──────────────────────────────────────────────

/** One step of a field path (`features[1].title` is features, 1, title). */
const steps = (path: string) => (path.match(/[A-Za-z_$][A-Za-z0-9_$]*|\[\d+\]/g) ?? []).map((step) => (step.startsWith("[") ? Number(step.slice(1, -1)) : step));

/** `values` with the value at a path set (lists and objects copied on the way, the rest kept); undefined removes it. */
export function setAt(values: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = steps(path);
  if (typeof keys[0] !== "string" || keys.join("").length === 0) throw new Error(`A field path starts with a field's name (features[1].title), not ${JSON.stringify(path)}`);
  const put = (target: unknown, rest: Array<string | number>): unknown => {
    if (!rest.length) return value;
    const [key, ...more] = rest;
    const copy = (Array.isArray(target) ? [...target] : typeof key === "number" && target === undefined ? [] : { ...((target as Record<string, unknown>) ?? {}) }) as Record<string | number, unknown>;
    const next = put((target as Record<string | number, unknown> | undefined)?.[key], more);
    if (next === undefined && !Array.isArray(copy)) delete copy[key];
    else copy[key] = next;
    return copy;
  };
  return put(values, keys) as Record<string, unknown>;
}

/** The paths whose values differ between two sets of values: each changed leaf (an image is one). */
function changes(before: unknown, after: unknown, path = ""): string[] {
  // An image, and a slot stored as its module or its capture, is one value.
  const leaf = (value: unknown) => value === null || typeof value !== "object" || ("src" in (value as object) && "width" in (value as object)) || "module" in (value as object) || "fragment" in (value as object);
  if (leaf(before) || leaf(after) || Array.isArray(before) !== Array.isArray(after)) return JSON.stringify(before) === JSON.stringify(after) ? [] : [path];
  const keys = new Set([...Object.keys(before as object), ...Object.keys(after as object)]);
  const out: string[] = [];
  for (const key of keys) {
    const next = Array.isArray(after) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
    out.push(...changes((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], next));
  }
  return out;
}

/** The assets entries for some values (Decision 7): each local image's hash, its source carried by its file, not its path. */
function assetsFor(
  tpl: TemplateObject,
  values: Record<string, unknown>,
  folder: string,
  old: Record<string, { sha256?: string; source?: unknown }>,
  oldValues: Record<string, unknown> | undefined,
  sources: Record<string, Record<string, unknown>>,
  notes: Diagnostic[]
): Record<string, { sha256?: string; source?: unknown }> {
  const bySrc = new Map<string, { sha256?: string; source?: unknown }>();
  for (const { path, src } of filesOf(tpl, oldValues ?? {})) if (old[path]) bySrc.set(src, old[path]);
  const out: Record<string, { sha256?: string; source?: unknown }> = {};
  for (const { path, src } of filesOf(tpl, values)) {
    let hash: string | undefined;
    try {
      hash = sha256(readFileSync(resolve(folder, src)));
    } catch {
      hash = undefined;
    }
    const before = bySrc.get(src);
    const changed = before?.sha256 !== undefined && hash !== undefined && before.sha256 !== hash;
    if (changed) notes.push({ code: "template/asset-changed", severity: "warning", message: `${src} changed under the same name: it's a new file, with no source unless --source gives one`, path: `values.${path}` });
    const source = sources[path] ?? (before && !changed ? before.source : undefined);
    out[path] = { ...(hash ? { sha256: hash } : {}), ...(source ? { source } : {}) };
  }
  return out;
}

/**
 * `design new` and `design set`, in the child: the values with each `--set` applied, checked by the template in every
 * format the file lists, and the values file returned for the parent to write (`designed`). Nothing to write where they
 * fail, unless --draft, which returns the file as a draft with what's missing.
 */
export async function runDesign(run: TemplateRun, input: { file: string }, request: DesignRequest): Promise<Fields> {
  const { tpl, module } = run;
  const template = { id: tpl.id, version: tpl.version };
  const folder = dirname(request.output);
  const diagnostics: Diagnostic[] = [];
  const failed = (list: Diagnostic[]): Fields => ({ status: "error", template, diagnostics: unique([...diagnostics, ...list]) });
  let before: Record<string, unknown> = {};
  let oldAssets: Record<string, { sha256?: string; source?: unknown }> = {};
  let formats: string[];
  let moduleSpec: string;
  if (request.kind === "new") {
    formats = Object.keys(tpl.formats ?? {});
    const path = posix(relative(folder, input.file));
    moduleSpec = path.startsWith(".") ? path : `./${path}`;
  } else {
    const envelope = request.envelope!;
    const read = module.readValuesFile(envelope, tpl);
    // Its values as this template takes them (its id and version accepted, its migrations run), valid or not yet: a
    // draft's, and a file's that a set here repairs. What each set gives is checked below, with the rest. A file the
    // template can't read at all (another template's, a newer version's, a migration that fails) is left as it is.
    const start = read.values ?? read.migrated;
    if (!start) return failed(read.diagnostics);
    diagnostics.push(...read.diagnostics.filter((d) => d.severity !== "error" && d.code !== "template/upgraded"));
    before = start;
    oldAssets = read.assets as typeof oldAssets;
    formats = read.formats ?? (envelope.formats as string[] | undefined) ?? [];
    moduleSpec = (envelope.template as { module: string }).module;
  }
  // --from: the design's images are files beside it, written here relative to the values file (where they're read).
  const given = request.valuesFolder !== undefined && readsImages(tpl.root) ? rebase(request.values ?? {}, request.valuesFolder, folder) : request.values;
  let values: Record<string, unknown> = request.kind === "new" ? { ...(given ?? {}) } : before;
  for (const set of request.sets) {
    let value = set.value;
    // `@path`: an image, its size read from its file, its path relative to the values file.
    if (set.file !== undefined && SLOT_MODULE.test(set.file)) {
      // A module: a slot's content, stored as its module (its hash recorded with the images').
      const path = posix(relative(folder, set.file));
      value = { module: path.startsWith(".") ? path : `./${path}` };
    } else if (set.file !== undefined) {
      let bytes: Uint8Array;
      try {
        bytes = readFileSync(set.file);
      } catch (error) {
        return failed([cliDiagnostic("design", "error", `${set.path}=@${relative(run.context.cwd, set.file)}: ${(error as Error).message}`)]);
      }
      const sniffed = module.sniffImage(bytes);
      if (!sniffed) return failed([cliDiagnostic("design", "error", `${set.path}: ${relative(run.context.cwd, set.file)} isn't a PNG, JPEG, GIF or SVG`)]);
      const path = posix(relative(folder, set.file));
      value = { src: path.startsWith(".") ? path : `./${path}`, width: sniffed.width, height: sniffed.height };
    }
    try {
      values = setAt(values, set.path, value);
    } catch (error) {
      return failed([cliDiagnostic("design", "error", (error as Error).message)]);
    }
  }
  // Checked as a run would check it: in every format, its images read as the template's own.
  const slotted = await fragmentsFor(run, values, request.output);
  if (slotted.error) return failed([slotted.error]);
  const checking = readsImages(tpl.root) ? rebase(values, folder, dirname(input.file)) : values;
  let valid = true;
  for (const format of formats.length ? formats : [undefined]) {
    const checked = tpl.check(checking, { ...(format !== undefined ? { format } : {}), ...(slotted.fragments ? { fragments: slotted.fragments } : {}) });
    // Said once: a value's problem is the same in each format.
    diagnostics.push(...withoutHint(measuredHere(run, checked.diagnostics)));
    if (!checked.valid) valid = false;
  }
  const errors = diagnostics.filter((d) => d.severity === "error");
  const missing = [...new Set(errors.filter((d) => d.code === "template/required").map((d) => d.path.replace(/^values\./, "")))];
  if (!valid && !request.draft) return failed([]);
  const assets = assetsFor(tpl, values, folder, oldAssets, request.kind === "set" ? before : undefined, request.sources ?? {}, diagnostics);
  const sha = sha256(readFileSync(input.file));
  const options = { module: moduleSpec, ...(formats.length ? { formats } : {}), sha256: sha, ...(Object.keys(assets).length ? { assets } : {}) };
  let file: Record<string, unknown>;
  if (valid) {
    // Defaults written out; a valid set clears a draft's keys.
    file = module.toValuesFile(tpl, values, options);
  } else {
    // A draft: its values as given, with what's missing (a field, or one with a problem).
    const problems = missing.length ? missing : [...new Set(errors.map((d) => d.path.replace(/^values\./, "")))];
    file = { version: 1, template: { module: moduleSpec, id: tpl.id, version: tpl.version, sha256: sha }, ...(formats.length ? { formats } : {}), values, ...(Object.keys(assets).length ? { assets } : {}), draft: true, missing: problems };
  }
  const written = file.values as Record<string, unknown>;
  return {
    status: valid ? "ok" : "error",
    template,
    diagnostics: unique(diagnostics),
    designed: { file, valid, ...(valid ? {} : { missing: file.missing as string[] }), changed: changes(request.kind === "new" ? {} : before, written) },
  };
}
