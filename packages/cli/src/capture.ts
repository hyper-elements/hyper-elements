/**
 * A capture child (Decision 29): it loads agent code (slot modules, TSX template designs) in a process of its own,
 * and replies only with captures, once per request: `captured` for a slot (its JSX as captureFragment() captures it),
 * `captured-design` for a design (its template request: which template, imported from where, with what values), or
 * `capture-failed`. It never sends `result` or `done`; the parent ends it once every request has its reply. Nothing it
 * sends is trusted beyond that shape: the code it runs can call or replace `process.send`.
 *
 * A slot's Elements is the template's: the loader module is written beside the template module, so the
 * `captureFragment()` called is the one the template's own imports get. A design's is the design's own.
 */
import { rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { defaultExport, templateComponent } from "@hyper-elements/template-loader";
import { exportsOf, type ReactModule } from "./elements";
import { errorLine } from "./errors";
import { moduleFormat } from "./inputs";
import { elementsLoaderText, loaderModulePath, loaderModuleText, parseToken } from "./loader-module";
import type { CaptureMessage, ChildInput, StartMessage } from "./protocol";
import { reactCopies } from "./react-copies";

const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

interface Loader {
  template: Record<string, unknown>;
  load(specifier: string): unknown;
}

interface Elements {
  captureFragment(element: unknown): unknown;
  templateRequest?(element: unknown): { template?: unknown; props?: Record<string, unknown>; format?: string; diagnostics: Array<{ code: string; message: string }> };
  templateOf?(value: unknown): unknown;
}

function send(message: CaptureMessage): Promise<void> {
  return new Promise((resolve) => {
    if (!process.send) return resolve();
    process.send(message, undefined, {}, () => resolve());
  });
}

/** A loader module beside `beside`, imported and deleted: the template it loads (if any), and a load() from there. */
async function loaderFor(message: StartMessage, beside: string, text: string, format: "esm" | "cjs", written: Set<string>, sequence: { n: number }): Promise<Loader> {
  const owner = parseToken(`// ${message.token}`)!.pid;
  let path: string | undefined;
  for (let attempt = 0; attempt < 1000 && !path; attempt++) {
    const candidate = loaderModulePath(dirname(beside), beside, owner, sequence.n++);
    try {
      writeFileSync(candidate, text, { flag: "wx" });
      path = candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  if (!path) throw new Error("no free name for the loader module");
  written.add(path);
  try {
    const mod = (format === "cjs" && !bun ? createRequire(path)(path) : await import(pathToFileURL(path).href)) as Record<string, unknown>;
    return exportsOf<Loader>(mod, "template");
  } finally {
    rmSync(path, { force: true });
    written.delete(path);
  }
}

/** Plain data only (Decision 29's grammar): strings, numbers, booleans, null, plain objects and arrays. A path where it isn't. */
function notPlain(value: unknown, path: string): string | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? undefined : path;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const bad = notPlain(value[i], `${path}[${i}]`);
      if (bad) return bad;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return path;
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      const bad = notPlain(item, `${path}.${key}`);
      if (bad) return bad;
    }
    return undefined;
  }
  return path;
}

/**
 * The element a module's default export renders. A design's, with the props the CLI renders any design with (`--props`,
 * then its `PreviewProps`, then none); a slot's content is its own, and takes none.
 */
function elementOf(mod: Record<string, unknown>, react: ReactModule, design?: { props: Record<string, unknown> | undefined }): unknown {
  const value = defaultExport(mod);
  const component = templateComponent(value);
  if (!component) throw new Error("its default export isn't a component");
  return react.createElement(component.exported, design ? (design.props ?? component.props) : {});
}

const failed = (input: ChildInput, error: unknown, code?: string) => send({ type: "capture-failed", request: input.id, error: errorLine(error), ...(code ? { code } : {}) });

export async function capture(message: StartMessage, written: Set<string>): Promise<void> {
  const sequence = { n: message.sequence };
  // Slots: Elements from the template's folder, each slot module imported by its path.
  let slotElements: { elements: Elements; react: ReactModule } | undefined;
  const slotsFrom = async () => {
    if (slotElements) return slotElements;
    const format = moduleFormat(message.resolveFrom!);
    const loader = await loaderFor(message, message.resolveFrom!, elementsLoaderText(message.token, format, bun, message.resolveFrom!), format, written, sequence);
    slotElements = { elements: exportsOf<Elements>(await loader.load("@hyper-elements/react"), "captureFragment"), react: exportsOf<ReactModule>(await loader.load("react"), "createElement") };
    return slotElements;
  };
  for (const input of message.inputs) {
    try {
      if (input.capture?.kind === "design") {
        await captureDesign(message, input, input.capture.imports, written, sequence);
        continue;
      }
      const { elements, react } = await slotsFrom();
      const mod = (input.format === "cjs" && !bun ? createRequire(input.file)(input.file) : await import(pathToFileURL(input.file).href)) as Record<string, unknown>;
      if (reactCopies().length > 1) {
        await failed(input, new Error("it loads another copy of React than its template's: hooks and context don't work across copies"));
        continue;
      }
      const element = elementOf(mod, react);
      await send({ type: "captured", request: input.id, capture: JSON.parse(JSON.stringify(elements.captureFragment(element))) });
    } catch (error) {
      await failed(input, error);
    }
  }
  // No `done`: the parent ends this process once every request has its reply.
}

/** A TSX design's template request: its template's id, version and formats, the import it came from, its values. */
async function captureDesign(message: StartMessage, input: ChildInput, imports: string[], written: Set<string>, sequence: { n: number }): Promise<void> {
  const DESIGN = "cli/template-design";
  const loader = await loaderFor(message, input.file, loaderModuleText(input.file, message.token, input.format, bun), input.format, written, sequence);
  const elements = exportsOf<Elements>(await loader.load("@hyper-elements/react"), "captureFragment");
  const template = exportsOf<Elements>(await loader.load("@hyper-elements/react/template"), "templateOf");
  const react = exportsOf<ReactModule>(await loader.load("react"), "createElement");
  if (typeof template.templateRequest !== "function" || typeof template.templateOf !== "function") return void (await failed(input, new Error("this design's @hyper-elements/react has no templateRequest(): templates need 0.5.0 or later"), DESIGN));
  const request = template.templateRequest(elementOf(loader.template, react, { props: message.options.props }));
  if (!request.template) return void (await failed(input, new Error(request.diagnostics.filter((d) => d.code.startsWith("template/") || d.code.startsWith("jsx/")).map((d) => `${d.code}: ${d.message}`).join("; ") || "its root isn't a template"), DESIGN));
  const tpl = request.template as { id: string; version: string; formats?: Record<string, unknown> };
  // Which import it is: an export of one of the design's own imports that is the template (or wraps it).
  let found: { specifier: string; name: string } | undefined;
  for (const specifier of imports) {
    let mod: Record<string, unknown>;
    try {
      mod = (await loader.load(specifier)) as Record<string, unknown>;
    } catch {
      continue;
    }
    for (const [name, value] of Object.entries(mod ?? {})) {
      if (template.templateOf(value) === tpl) {
        found = { specifier, name };
        break;
      }
    }
    if (found) break;
  }
  if (!found) return void (await failed(input, new Error(`a template design imports its template: ${tpl.id} isn't an export of a module it imports`), DESIGN));
  // Its values: plain data, a slot's JSX captured.
  const values: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(request.props ?? {})) {
    if (value === undefined) continue;
    if (react.isValidElement?.(value) ?? (typeof value === "object" && value !== null && "$$typeof" in value)) {
      values[name] = { fragment: JSON.parse(JSON.stringify(elements.captureFragment(value))) };
      continue;
    }
    const bad = notPlain(value, name);
    if (bad) return void (await failed(input, new Error(`${bad} is ${typeof value === "function" ? "a function" : "a value that isn't data"}: a template design's props are data (text, numbers, lists, objects) and slots' JSX`), DESIGN));
    values[name] = value;
  }
  const assets = loader.template.assets;
  await send({
    type: "captured-design",
    request: input.id,
    template: { id: tpl.id, version: tpl.version, formats: Object.keys(tpl.formats ?? {}) },
    format: request.format ?? null,
    specifier: found.specifier,
    export: found.name,
    values,
    ...(assets && typeof assets === "object" && !Array.isArray(assets) && !notPlain(assets, "assets") ? { assets: assets as Record<string, unknown> } : {}),
  });
}
