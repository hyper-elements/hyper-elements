// The playground's sandbox, core bundle: runs in a Web Worker inside a sandboxed frame (see ../README.md). It compiles
// the code a visitor wrote (or a link carried), runs it, and renders what it exports with Hyper Elements itself. Each
// worker answers one request and is then thrown away, so no run sees what another left behind.
//
// Nothing here is trusted by the page: the code it runs shares this worker's globals, so the page reads every result
// as data (text shown as text, HTML only inside another sandboxed frame).
import * as Elements from "@hyper-elements/react";
import { lint } from "@hyper-elements/lint";
import { describeComponents, inspect } from "@hyper-elements/react/inspect";
import { shownAnywhere } from "@hyper-elements/core";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { transform } from "sucrase";
// Sucrase's own parser, for its tokens (closingTags below). Not its public entry: its version is pinned in package.json.
import { parse } from "sucrase/dist/esm/parser";
import { TokenType as tt } from "sucrase/dist/esm/parser/tokenizer/types";
import type { Diagnostic, FontNeed, PlaygroundError, Request, Result, RootName, SourceNode } from "../protocol";

type Extras = {
  pdf?: { renderPdf: (element: React.ReactElement, options: object) => Promise<{ pdf: Uint8Array; diagnostics: Elements.Diagnostic[] }> };
  image?: {
    renderImage: (element: React.ReactElement, options: object) => Promise<{ image: Uint8Array; width: number; height: number; diagnostics: Elements.Diagnostic[] }>;
    loadResvg: (wasm: WebAssembly.Module | ArrayBuffer) => Promise<void>;
  };
  clients?: {
    emailClients: (options?: object) => Promise<Elements.ElementsPlugin>;
    renderInEmailClients: (element: React.ReactElement, options?: object) => Promise<{ previews: Array<Record<string, unknown>>; skipped: Array<Record<string, unknown>>; diagnostics: Elements.Diagnostic[] }>;
    /** Each client's name, as @hyper-elements/email-clients says it. */
    names: Record<string, string>;
  };
};

// ─── No network ────────────────────────────────────────────────────────────

// The frame's Content-Security-Policy already denies this worker the network. This is the second lock, for a browser
// that doesn't hand a frame's policy to its workers: everything that makes a request, or another worker to make one
// from, is taken off the global and what it inherits from, before any code a visitor wrote runs. Nothing here needs
// them: the bundles, the fonts and the images all arrive as messages.
{
  const scope = globalThis as unknown as Record<string, unknown>;
  const chain: object[] = [];
  for (let object: object | null = globalThis; object && object !== Object.prototype; object = Object.getPrototypeOf(object)) chain.push(object);
  for (const name of ["fetch", "importScripts", "XMLHttpRequest", "WebSocket", "WebSocketStream", "EventSource", "WebTransport", "Worker", "SharedWorker", "BroadcastChannel", "FontFace"]) {
    for (const object of chain) {
      try {
        delete (object as Record<string, unknown>)[name];
      } catch {
        // Left where it can't be removed: the policy still denies it.
      }
    }
    if (name in scope) {
      try {
        Object.defineProperty(scope, name, { value: undefined, writable: false, configurable: false });
      } catch {
        // As above.
      }
    }
  }
}

/** What the bundles loaded after this one share with it (shims/shared-*.cjs), and where each registers itself. */
const sandbox = { React, jsxRuntime, Elements, extras: {} as Extras };
(globalThis as Record<string, unknown>).__HYPER_ELEMENTS_SANDBOX__ = sandbox;

const FILE = "template.tsx";
const ROOTS: readonly string[] = ["Email", "Page", "Document", "Canvas"];

// ─── Where each component is in the source ─────────────────────────────────

/** Each Elements component rendered, in the order React renders them (document order), with the line its JSX is on. */
/** Lint's plugin, made once: what makes an Email or a Page hard to read. */
let lintPlugin: Elements.ElementsPlugin | undefined;
const linter = () => (lintPlugin ??= lint());

let trace: Array<{ type: string; line?: number }> = [];

/** The prop a component's JSX line travels in, from the JSX runtime below to the component's stand-in. */
const LINE = "__playgroundLine";
const located = new WeakSet<object>();

/** A component that notes where it's rendered from, then renders the real one with the props it was given. */
function locate<T extends object>(name: string, Real: T): T {
  const Located = (props: Record<string, unknown>) => {
    const { [LINE]: line, ...rest } = props;
    trace.push({ type: name, line: typeof line === "number" ? line : undefined });
    return React.createElement(Real as unknown as React.ComponentType, rest);
  };
  Located.displayName = name;
  located.add(Located);
  return Located as unknown as T;
}

const isComponent = (name: string, value: unknown) => typeof value === "function" && /^[A-Z]/.test(name) && name !== "ElementsError";

/** @hyper-elements/react as the code imports it: every component a stand-in that notes its line, the rest as it is. */
const elementsModule: Record<string, unknown> = {};
for (const [name, value] of Object.entries(Elements)) {
  if (!isComponent(name, value)) {
    elementsModule[name] = value;
    continue;
  }
  const stand = locate(name, value as object) as unknown as Record<string, unknown>;
  // A component's parts (Document.Page).
  for (const [part, partValue] of Object.entries(value as object)) {
    stand[part] = typeof partValue === "function" && /^[A-Z]/.test(part) ? locate(`${name}.${part}`, partValue as object) : partValue;
  }
  elementsModule[name] = stand;
}
// A template's own component (component()) notes its line too.
elementsModule.component = (spec: { type?: string }) => locate(String(spec?.type ?? "component"), Elements.component(spec as never) as object);

type Source = { lineNumber?: number } | undefined;
const withLine = (type: unknown, props: Record<string, unknown>, source: Source) =>
  source?.lineNumber && typeof type === "function" && located.has(type) ? { ...props, [LINE]: source.lineNumber } : props;

const MODULES: Record<string, unknown> = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  // Sucrase's development JSX gives each element its line.
  "react/jsx-dev-runtime": {
    Fragment: React.Fragment,
    jsxDEV: (type: unknown, props: Record<string, unknown>, key: unknown, isStatic: boolean, source: Source) =>
      (isStatic ? jsxRuntime.jsxs : jsxRuntime.jsx)(type as never, withLine(type, props, source) as never, key as never),
  },
  "@hyper-elements/react": elementsExports(),
};

/**
 * The package as an import sees it: a name it doesn't export is said by name where it's used, with the nearest one it
 * has, where a plain object would give `undefined` and React an error about an element's type.
 */
function elementsExports(): object {
  // (An ES module to the compiled code's helpers, so `import * as E` is this object, not a copy of what it holds.)
  Object.defineProperty(elementsModule, "__esModule", { value: true });
  const names = Object.keys(elementsModule);
  return new Proxy(elementsModule, {
    get(target, name, receiver) {
      if (typeof name !== "string" || name in target || name === "then") return Reflect.get(target, name, receiver);
      if (name === "default") throw new SourceError("import", `@hyper-elements/react has no default export: import what you use by name, import { Email, Text } from "@hyper-elements/react"`);
      const near = nearest(name, names);
      throw new SourceError("import", `"${name}" isn't exported by @hyper-elements/react${near ? `. Did you mean "${near}"?` : ""}`);
    },
  });
}

/** The name in `names` a typo away from `name` (a third of its letters at most), or undefined. */
function nearest(name: string, names: readonly string[]): string | undefined {
  const distance = (a: string, b: string) => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row = next;
    }
    return row[b.length];
  };
  const wanted = name.toLowerCase();
  let best: string | undefined;
  let least = Math.max(1, Math.floor(name.length / 3)) + 1;
  for (const each of names) {
    const d = distance(wanted, each.toLowerCase());
    if (d < least) {
      least = d;
      best = each;
    }
  }
  return best;
}

// ─── Compiling ─────────────────────────────────────────────────────────────

class SourceError extends Error {
  constructor(
    readonly kind: PlaygroundError["kind"],
    message: string,
    readonly line?: number,
    readonly column?: number,
  ) {
    super(message);
  }
}

function compileModule(source: string): string {
  let js: string;
  try {
    js = transform(source, { transforms: ["typescript", "jsx", "imports"], jsxRuntime: "automatic", production: false, filePath: FILE }).code;
  } catch (error) {
    const { loc, message } = error as { loc?: { line: number; column: number }; message?: string };
    const text = String(message ?? error)
      .replace(/^Error transforming [^:]+: /, "")
      .replace(/\s*\(\d+:\d+\)$/, "");
    throw new SourceError("syntax", text, loc?.line, loc ? loc.column + 1 : undefined);
  }
  closingTags(source);
  return js;
}

/**
 * Stops at a closing tag that isn't its opening tag's. Sucrase compiles `<Text>…</Txt>` as it stands, where a
 * project's own compiler (tsc, esbuild, Babel) stops: code that rendered here would then fail there. Read from
 * Sucrase's own tokens, so a `<` that isn't a tag's (a comparison, a type's) is never taken for one.
 */
function closingTags(source: string): void {
  const { tokens } = parse(source, true, true, false);
  const lineOf = (at: number) => source.slice(0, at).split("\n").length;
  /** The elements open, innermost last. */
  const open: Array<{ name: string; at: number }> = [];
  /** The tags begun and not yet ended: a tag in another's attribute (`<Row gap={<Icon />}>`) ends first. */
  const tags: Array<{ name: string; at: number; closing: boolean }> = [];
  tokens.forEach((token, i) => {
    if (token.type === tt.jsxTagStart) {
      let next = i + 1;
      const closing = tokens[next]?.type === tt.slash;
      if (closing) next++;
      // Its name, with its parts (Document.Page): a name straight after a name is an attribute's.
      let name = "";
      for (; tokens[next]; next++) {
        const { type } = tokens[next];
        const part = type === tt.jsxName ? name === "" || /[.:]$/.test(name) : (type === tt.dot || type === tt.colon) && name !== "";
        if (!part) break;
        name += source.slice(tokens[next].start, tokens[next].end);
      }
      tags.push({ name, at: token.start, closing });
    } else if (token.type === tt.jsxTagEnd) {
      const tag = tags.pop();
      if (!tag) return;
      if (!tag.closing) {
        // `<Divider />` opens nothing.
        if (tokens[i - 1]?.type !== tt.slash) open.push(tag);
        return;
      }
      const opened = open.pop();
      if (opened && opened.name !== tag.name) {
        const column = tag.at - source.lastIndexOf("\n", tag.at - 1);
        throw new SourceError("syntax", `</${tag.name}> doesn't close <${opened.name}>, opened on line ${lineOf(opened.at)}: a closing tag has its opening tag's name`, lineOf(tag.at), column);
      }
    }
  });
}

/** What JSX written alone is given, on its own first line, to make it the module's template. */
const EXPORT = "export default (";

const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/**
 * The code as a module. A module with an `export` is compiled as it is. Without one, the JSX block the code ends with
 * (starting at the beginning of a line) is what it exports, so `<Email>…</Email>` alone is a template, as is one with
 * a few constants above it. Lines stay where they are either way.
 */
function compile(code: string): string {
  if (/^\s*export\s/m.test(stripComments(code))) return compileModule(code);
  const starts = [...code.matchAll(/(^|\n)(?=<[A-Za-z>])/g)].map((match) => match.index + match[1].length);
  let first: unknown;
  for (const start of starts) {
    try {
      return compileModule(`${code.slice(0, start)}${EXPORT}${code.slice(start).replace(/;\s*$/, "")}\n);`);
    } catch (error) {
      // An error on the line the export was written into is that many columns further along than in the code.
      const line = code.slice(0, start).split("\n").length;
      first ??= error instanceof SourceError && error.line === line && error.column ? new SourceError(error.kind, error.message, line, Math.max(1, error.column - EXPORT.length)) : error;
    }
  }
  if (first) throw first;
  // No export and no JSX block: compiled for its syntax errors, then it has nothing to render.
  compileModule(code);
  throw new SourceError("export", "Nothing to render: export a template (`export default function Welcome() { return <Email>…</Email>; }`), or end the code with its JSX");
}

// ─── Running ───────────────────────────────────────────────────────────────

const SCOPE = Object.keys(elementsModule).filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));

/** The compiled module as a function: Elements' names are in scope without an import, under the module's own. */
const HEAD = "return function (require, exports, module) {";
const moduleFunction = (js: string): ((...scope: unknown[]) => (require: unknown, exports: object, module: object) => void) =>
  new Function(...SCOPE, `${HEAD}${js}\n}\n//# sourceURL=${FILE}`) as never;

const FRAME = new RegExp(`${FILE.replace(".", "\\.")}:(\\d+):(\\d+)`);
/** How many lines the function's own head adds before the code's first, as this browser counts them. */
const lineOffset = (() => {
  try {
    moduleFunction("throw new Error()")()(null, {}, {});
  } catch (error) {
    const line = FRAME.exec(String((error as Error).stack))?.[1];
    if (line) return Number(line) - 1;
  }
  return undefined;
})();

/** Where in the code an error it threw came from, by its stack. */
function place(error: unknown): { line?: number; column?: number } {
  if (lineOffset === undefined) return {};
  const frame = FRAME.exec(String((error as Error)?.stack ?? ""));
  if (!frame) return {};
  const line = Number(frame[1]) - lineOffset;
  return line >= 1 ? { line, column: line === 1 ? Math.max(1, Number(frame[2]) - HEAD.length) : Number(frame[2]) } : {};
}

function requireModule(name: string): unknown {
  if (name in MODULES) return MODULES[name];
  throw new SourceError("import", `Can't import "${name}": the playground runs one file, with "@hyper-elements/react" and "react"`);
}

const isElement = (value: unknown): value is React.ReactElement => React.isValidElement(value);

/** The template a module exports: its default export, else its first exported element or component. */
function exported(exports: Record<string, unknown>): React.ReactElement {
  const named = Object.entries(exports).filter(([name]) => name !== "default" && name !== "__esModule");
  const template = exports.default ?? named.find(([, value]) => isElement(value))?.[1] ?? named.find(([name, value]) => typeof value === "function" && /^[A-Z]/.test(name))?.[1];
  if (isElement(template)) return template;
  if (typeof template === "function") {
    // Its example props, where it says them as React Email's templates do.
    const props = (template as { PreviewProps?: object }).PreviewProps ?? {};
    return React.createElement(template as React.ComponentType, props);
  }
  if (template === undefined) throw new SourceError("export", "Nothing to render: the code exports no template. Add `export default` to the component that returns its root");
  throw new SourceError("export", `The default export is ${template === null ? "null" : `a ${typeof template}`}: export a component or its JSX`);
}

function evaluate(code: string): React.ReactElement {
  const js = compile(code);
  const module = { exports: {} as Record<string, unknown> };
  try {
    moduleFunction(js)(...SCOPE.map((name) => elementsModule[name]))(requireModule, module.exports, module);
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError("runtime", describe(error), ...Object.values(place(error)));
  }
  return exported(module.exports);
}

const describe = (error: unknown): string => {
  const { name, message } = (error ?? {}) as { name?: unknown; message?: unknown };
  if (typeof message !== "string") return String(error);
  return typeof name === "string" && name !== "Error" ? `${name}: ${message}` : message;
};

// ─── Logs ──────────────────────────────────────────────────────────────────

const LEVELS = ["log", "info", "warn", "error"] as const;
function captureConsole(logs: Result["logs"]): () => void {
  const originals = LEVELS.map((level) => console[level]);
  const text = (value: unknown) => {
    if (typeof value === "string") return value;
    if (value instanceof Error) return describe(value);
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  };
  LEVELS.forEach((level) => {
    console[level] = (...args: unknown[]) => {
      if (logs.length < 50) logs.push({ level, message: args.map(text).join(" ").slice(0, 2000) });
    };
  });
  return () => LEVELS.forEach((level, i) => (console[level] = originals[i]));
}

// ─── What a template is made of ────────────────────────────────────────────

/** Each component's path and line: the paths `inspect()` gives, in document order, against the order they rendered in. */
function sourceNodes(nodes: ReadonlyArray<{ path: string; type: string }>, rendered: typeof trace): SourceNode[] {
  let next = 0;
  return nodes.map(({ path, type }) => {
    // A component rendered inside another's own render (a custom component's) is in `rendered` and not in `nodes`.
    const found = rendered.findIndex((entry, index) => index >= next && entry.type === type);
    if (found === -1) return { path, type };
    next = found + 1;
    return { path, type, line: rendered[found].line };
  });
}

/** The line of the component a diagnostic is about: the one whose path its own starts with. */
function withLines(diagnostics: readonly Elements.Diagnostic[], nodes: SourceNode[]): Diagnostic[] {
  const byPath = new Map(nodes.map((node) => [node.path, node]));
  return diagnostics.map((diagnostic) => {
    let path = diagnostic.path;
    while (path && !byPath.has(path)) path = path.slice(0, Math.max(path.lastIndexOf("."), 0));
    const node = byPath.get(path);
    return { ...diagnostic, clients: diagnostic.clients ? [...diagnostic.clients] : undefined, node: node?.path, line: node?.line };
  });
}

type Resolved = {
  type: string;
  path: string;
  props: Record<string, unknown>;
  text?: Record<string, unknown>;
  hidden?: { desktop?: boolean };
  definition: { children: { text?: boolean } };
  children: Array<Resolved | string>;
};

/** The block each line of outline() is about, as outline() walks them (packages/react/src/primitives/outline.ts). */
function outlinePaths(node: Resolved): string[] {
  if (node.type === "Svg") return [node.path];
  const blocks = node.children.filter((child): child is Resolved => typeof child !== "string" && shownAnywhere(child as never));
  const under = node.definition.children.text ? blocks.filter((child) => child.type === "List") : blocks;
  return [node.path, ...under.flatMap(outlinePaths)];
}

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "inherit", "-apple-system", "blinkmacsystemfont"]);

/** The fonts and images a Document's PDF or a Canvas's image is drawn with, which the page fetches: the sandbox can't. */
function assetsOf(root: Resolved): Result["assets"] {
  const fonts = new Map<string, FontNeed>();
  const images = new Set<string>();
  const visit = (node: Resolved) => {
    if (node.hidden?.desktop) return;
    if (node.type === "Image") {
      const src = node.props.src as string | { src?: string } | undefined;
      const url = typeof src === "string" ? src : src?.src;
      if (typeof url === "string" && /^https?:/.test(url)) images.add(url);
    }
    if (node.text && node.children.some((child) => typeof child === "string" && child.trim())) {
      const family = String(node.text.fontFamily ?? "")
        .split(",")
        .map((name) => name.trim().replace(/^["']|["']$/g, ""))
        .find((name) => name && !GENERIC.has(name.toLowerCase()));
      const weight = Number(node.text.fontWeight) || 400;
      const style = node.text.fontStyle === "italic" ? "italic" : "normal";
      if (family) fonts.set(`${family}|${weight}|${style}`, { family, weight, style });
    }
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(root);
  return { fonts: [...fonts.values()].slice(0, 24), images: [...images].slice(0, 24) };
}

// ─── Requests ──────────────────────────────────────────────────────────────

const failure = (error: unknown): PlaygroundError => {
  // (One thrown from inside the code as it ran, such as a name the package doesn't export, says its line by its stack.)
  if (error instanceof SourceError) return { kind: error.kind, message: error.message, line: error.line ?? place(error).line, column: error.column };
  return { kind: "runtime", message: describe(error), ...place(error) };
};

const missing = (name: string, what: string) => `${what} didn't load${unloaded.has(name) ? `: ${unloaded.get(name)}` : ""}`;

const isElementsError = (error: unknown): error is Elements.ElementsError => error instanceof Elements.ElementsError;

async function handle(request: Request): Promise<Result> {
  const started = performance.now();
  const result: Result = { ok: false, kind: request.kind, root: null, diagnostics: [], nodes: [], logs: [], ms: 0 };
  if (request.kind === "describe") {
    // What each component takes, from the definitions: no code runs for it.
    const named = (properties: ReadonlyArray<{ path: string; accepts: string }>, group: string) => properties.filter((p) => p.path.startsWith(`${group}.`)).map((p) => ({ name: p.path.slice(group.length + 1), detail: p.accepts }));
    result.components = describeComponents().components.map((component) => ({
      name: component.type === "DocumentPage" ? "Document.Page" : component.type,
      summary: component.description,
      props: named(component.properties, "props"),
      styles: named(component.properties, "style"),
    }));
    result.ok = true;
    return result;
  }
  const restore = captureConsole(result.logs);
  try {
    const element = evaluate(request.code);

    // What it holds, and where each component is in the code: before anything else renders it.
    trace = [];
    const inspection = inspect(element);
    const rendered = trace;
    result.root = inspection.root as RootName | null;
    result.nodes = sourceNodes(inspection.nodes, rendered);
    if (inspection.theme) result.theme = { tokens: inspection.theme.tokens.length, styles: inspection.theme.styles, variants: inspection.theme.components.flatMap((c) => c.variants.map((v) => `${c.type}.${v}`)) };
    const isEmail = result.root === "Email";
    if (isEmail && sandbox.extras.clients) result.clientNames = sandbox.extras.clients.names;
    // An Email's client checks, where their bundle is loaded and they're on (`checks`, the "Email clients" switch), and
    // lint's on an Email and a Page whatever the switch says. With the client checks off, core's note on where they are
    // (email/more-checks) isn't said either.
    const checks = request.checks !== false;
    const lintable = result.root === "Email" || result.root === "Page";
    const plugins = [...(isEmail && checks && sandbox.extras.clients ? [await sandbox.extras.clients.emailClients()] : []), ...(lintable ? [linter()] : [])];
    const options = plugins.length ? { plugins } : {};
    const lines = (diagnostics: readonly Elements.Diagnostic[]) => withLines(checks ? diagnostics : diagnostics.filter((d) => d.code !== "email/more-checks"), result.nodes);

    try {
      if (request.kind === "render") {
        const output = await Elements.render(element, { ...options, ...(isEmail ? { blockMap: true } : {}) });
        result.html = output.html;
        result.text = output.text;
        result.blocks = output.blocks?.entries.map(({ path, type, offset }) => ({ path, type, offset }));
        result.diagnostics = lines(output.diagnostics);
        result.outline = Elements.outline(element);
        const prepared = Elements.prepare(element).root as Resolved | null;
        if (prepared) {
          const paths = outlinePaths(prepared);
          // Only where they line up: an outline written another way than this file reads it has no paths.
          if (paths.length === result.outline.split("\n").length) result.outlinePaths = paths;
          result.assets = assetsOf(prepared);
          if (result.root === "Canvas") result.size = { width: Number(prepared.props.width), height: Number(prepared.props.height) };
        }
      } else if (request.kind === "pdf") {
        if (!sandbox.extras.pdf) throw new Error(missing("pdf", "The PDF writer"));
        const output = await sandbox.extras.pdf.renderPdf(element, { fonts: request.fonts, images: request.images });
        result.bytes = output.pdf;
        result.diagnostics = lines(output.diagnostics);
      } else if (request.kind === "image") {
        if (!sandbox.extras.image) throw new Error(missing("image", "The image writer"));
        const output = await sandbox.extras.image.renderImage(element, { fonts: request.fonts, images: request.images, format: request.format, scale: request.scale });
        result.bytes = output.image;
        result.size = { width: output.width, height: output.height };
        result.diagnostics = lines(output.diagnostics);
      } else if (request.kind === "previews") {
        if (!sandbox.extras.clients) throw new Error(missing("clients", "The email client previews"));
        const output = await sandbox.extras.clients.renderInEmailClients(element, { emailClients: request.clients, dark: request.dark, fonts: "url" });
        result.previews = output.previews.map((p) => ({ id: String(p.id), client: String(p.client), dark: Boolean(p.dark), width: Number(p.width), approximate: Boolean(p.approximate), html: String(p.html) }));
        result.skipped = output.skipped.map((s) => ({ client: String(s.client ?? s.id ?? ""), reason: String(s.reason ?? "") }));
        result.diagnostics = lines(output.diagnostics);
      }
      result.ok = true;
    } catch (error) {
      if (!isElementsError(error)) throw error;
      // The template's own problems: what validate() says of it, each with what to change.
      result.diagnostics = lines(error.diagnostics);
      result.error = { kind: "template", message: `${error.diagnostics.filter((d) => d.severity === "error").length || "Some"} problems to fix` };
    }
  } catch (error) {
    result.error = failure(error);
  } finally {
    restore();
  }
  result.ms = Math.round(performance.now() - started);
  return result;
}

// ─── The worker ────────────────────────────────────────────────────────────

type Run = { type: "warm" | "run"; id?: number; extras?: Array<{ name: string; code: string }>; wasm?: WebAssembly.Module; request?: Request };
const loaded = new Set<string>();
/** Why a bundle didn't load, for the request that needs it. */
const unloaded = new Map<string, string>();
let resvg: Promise<void> | undefined;
let warm: Promise<unknown> = Promise.resolve();

async function prepare(run: Run): Promise<void> {
  for (const { name, code } of run.extras ?? []) {
    if (loaded.has(name)) continue;
    loaded.add(name);
    try {
      // Each bundle is a script that registers itself in `sandbox.extras`.
      (0, eval)(code);
    } catch (error) {
      unloaded.set(name, describe(error));
    }
  }
  if (run.wasm && sandbox.extras.image) await (resvg ??= sandbox.extras.image.loadResvg(run.wasm));
  // The email client models compile once per worker: ahead of the request where there's time.
  if (loaded.has("clients")) await sandbox.extras.clients?.emailClients().catch(() => undefined);
}

addEventListener("message", (event: MessageEvent<Run>) => {
  const run = event.data;
  warm = warm.then(() => prepare(run)).catch(() => undefined);
  if (run.type !== "run" || !run.request) return;
  const { id, request } = run;
  warm
    .then(() => handle(request))
    .catch((error): Result => ({ ok: false, kind: request.kind, root: null, diagnostics: [], nodes: [], logs: [], ms: 0, error: { kind: "internal", message: describe(error) } }))
    .then((result) => (postMessage as (message: unknown, transfer: Transferable[]) => void)({ id, result }, result.bytes ? [result.bytes.buffer] : []));
});
