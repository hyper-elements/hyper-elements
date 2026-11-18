/**
 * JSX → Elements document. One React render: each primitive records its props
 * and renders markers around its children, and React renders everything else
 * (the user's components, hooks, Context, Fragments, arrays), so the document
 * holds what React would show. The markers and the text between them are then
 * read back into nodes, and the result is checked like any JSON document.
 *
 * A stack shared by every copy of Elements in a process, not React context:
 * Server Components have no context.
 */
import React from "react";
import { checkDocument, CUSTOM_TYPE, Registry, type CheckResult, type CustomDefinition, type Diagnostic } from "@hyper-elements/core";
import { isAsyncComponent, nonce, within } from "../utils/collect";
import { renderToString } from "../utils/server-renderer";
import { withRenderScope } from "../utils/render-scope";

interface Recorded {
  type: string;
  props: Record<string, unknown>;
}

/**
 * A template used as a design's root (`<Newsletter subject="…" />`): its component records this on the collection under
 * way and renders nothing. Part of the frame every copy of Elements shares, so a template from another copy records
 * here too: `template` is the template object, `props` its props as the component was given them (owned: plain data).
 */
export interface TemplateRequest {
  template: unknown;
  props: Record<string, unknown>;
}

/** A template's own check, on the template object under this symbol: what an entry point given a template design calls. */
export const TEMPLATE_RECORD = Symbol.for("hyper-elements.template");

/** The brand every copy of Elements recognizes a snapshot by (`snapshot()`): its collected design is under it. */
export const SNAPSHOT = Symbol.for("hyper-elements.snapshot");

/** A required rule a template's check couldn't decide yet (one measured with fonts): a writer refuses the snapshot. */
export interface PendingRule {
  rule: string;
  format?: string;
  /** The writer that decides it ("@hyper-elements/react/image's renderImage()"). */
  decidedBy: string;
}

/** What a snapshot holds, under `SNAPSHOT`. */
export interface SnapshotData {
  collected: CollectedTemplate;
  template?: { id: string; version: string };
  pending?: readonly PendingRule[];
}

/** A snapshot's data, where the value is one (from any copy of Elements). */
export function snapshotData(value: unknown): SnapshotData | undefined {
  const data = value && typeof value === "object" ? (value as Record<symbol, unknown>)[SNAPSHOT] : undefined;
  return data && typeof data === "object" && "collected" in data ? (data as SnapshotData) : undefined;
}

/** What a template object carries under `TEMPLATE_RECORD`: its id, version and formats, and its check. */
export interface TemplateRecord {
  id: string;
  version: string;
  /** Its format names; none for a template with one size. */
  formats: readonly string[];
  /** Its values checked, its design built for each format (or `format`), and checked. Never throws. */
  check(props: Record<string, unknown>, options: { format?: string }): TemplateCheck;
}

export interface TemplateCheck {
  valid: boolean;
  /** Everything found, in every format checked. */
  diagnostics: Diagnostic[];
  /** What the template found that its design's own checks don't (its values, its bindings, its images): said beside them. */
  own: Diagnostic[];
  /** The design for each format checked (`default` without formats), as a snapshot (or, from an older copy, an element). */
  snapshots: Record<string, unknown>;
}

interface PrimitiveCollection {
  nonce: string;
  recorded: Recorded[];
  /** Templates used as the root (one is a template design; more, or one beside a node, isn't). */
  templates?: TemplateRequest[];
  /** The custom components the JSX used. */
  components: Map<string, CustomDefinition<any>>;
  /** Types two different custom components were both made with. */
  clashes: Set<string>;
  /** An async component was left out (not called: React would drop the promise it returns, unhandled). */
  async?: boolean;
}

const SHARED = Symbol.for("@hyper-elements/react/primitives/collecting");
const frames = ((globalThis as Record<symbol, unknown>)[SHARED] ??= []) as PrimitiveCollection[];

export function collectingPrimitives(): PrimitiveCollection | undefined {
  return frames[frames.length - 1];
}

const MARK = "elements-node";

function marker(collection: PrimitiveCollection, at: number, edge: "o" | "c"): React.ReactElement {
  return React.createElement(MARK, { key: `${at}${edge}`, "data-n": collection.nonce, "data-i": at, "data-e": edge });
}

/** A custom component the JSX being collected uses. */
export function registerUsed(collection: PrimitiveCollection, definition: CustomDefinition<any>): void {
  const known = collection.components.get(definition.type);
  // (A frame made by an older copy of Elements has no clashes.)
  if (known && known !== definition) (collection.clashes ??= new Set()).add(definition.type);
  else collection.components.set(definition.type, definition);
}

/** What a primitive renders while JSX is collected: its props recorded, markers around its children. */
export function recordPrimitive(collection: PrimitiveCollection, type: string, props: Record<string, unknown>): React.ReactElement {
  const { children, ...rest } = props;
  const at = collection.recorded.push({ type, props: rest }) - 1;
  return React.createElement(React.Fragment, null, marker(collection, at, "o"), withoutAsync(children as React.ReactNode, collection), marker(collection, at, "c"));
}

const PROVIDER = Symbol.for("react.provider");
const CONTEXT = Symbol.for("react.context");

/**
 * React's own wrappers, which render their children as they are: Fragment, Suspense, StrictMode, Profiler, a
 * context's provider (a consumer's child is a function, called with the value).
 */
function wraps(element: React.ReactElement): boolean {
  const type = element.type as unknown;
  if (typeof (element.props as { children?: unknown }).children === "function") return false;
  const kind = (type as { $$typeof?: symbol } | null)?.$$typeof;
  return typeof type === "symbol" || kind === PROVIDER || kind === CONTEXT;
}

const childrenOf = (element: React.ReactElement) => (element.props as { children?: React.ReactNode }).children;

/** Whether children hold an async component, directly or in React's own wrappers. */
function holdsAsync(children: React.ReactNode): boolean {
  let found = false;
  React.Children.forEach(children, (child) => {
    if (!found && React.isValidElement(child)) found = isAsyncComponent(child.type) || (wraps(child) && holdsAsync(childrenOf(child)));
  });
  return found;
}

/**
 * A primitive's children with the async components among them (in React's own wrappers too) left out, and
 * noted: React would call them and drop the promise they return, whose rejection would then go unhandled.
 * Children without one stay as they are (rebuilt, they'd move useId's ids). One inside a component of the
 * user's own is called by React, and reported as React fails on it.
 */
function withoutAsync(children: React.ReactNode, collection: PrimitiveCollection): React.ReactNode {
  if (!holdsAsync(children)) return children;
  collection.async = true;
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    if (isAsyncComponent(child.type)) return null;
    return wraps(child) ? React.cloneElement(child, undefined, withoutAsync(childrenOf(child), collection)) : child;
  });
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'" };
const unescape = (text: string) => text.replace(/&amp;|&lt;|&gt;|&quot;|&#x27;/g, (entity) => ENTITIES[entity]);

/**
 * Where a node's own keys go: the rest of its JSX props are its semantic props. Phone and hover styles are blocks of its
 * style; a mobile={…} or hover={…} prop is an unknown prop, whose message says so.
 */
const NODE_KEYS = new Set(["id", "style", "hidden"]);
/**
 * A built-in's theme props (its variants, a scope's tokens, a root's theme) and the template field it shows. A
 * custom element keeps props of these names: a `field` it declares is its own.
 */
const THEME_KEYS = new Set(["variant", "tokens", "theme", "field"]);

export interface JsonNode {
  type: string;
  [key: string]: unknown;
  children: Array<JsonNode | string>;
}

function toJsonNode({ type, props }: Recorded, diagnostics: Diagnostic[]): JsonNode {
  const node: JsonNode = { type, children: [] };
  const semantic: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    // What Elements 0.2's components gave the writers as they lowered into the tree (markup and CSS): the engine has
    // none now, and a template never had a say in it.
    if (key === "compat") diagnostics.push({ code: "jsx/compat", severity: "warning", message: `A <${type}>'s compat isn't a prop of a template: it's left out`, path: "jsx" });
    // An annotated template's marker that reached a render: one in a component's own render, never in its design.
    else if (key === "field" && typeof value === "object" && value !== null && (value as Record<symbol, unknown>)[Symbol.for("hyper-elements.open")]) {
      diagnostics.push({ code: "template/inline-hidden", severity: "error", message: `A <${type}> holds a template's marker (open()) inside a component's own render: markers go on built-ins written in the template's design itself`, path: "jsx" });
    }
    else if (NODE_KEYS.has(key) || (THEME_KEYS.has(key) && !CUSTOM_TYPE.test(type))) node[key] = value;
    else semantic[key] = value;
  }
  if (Object.keys(semantic).length) node.props = semantic;
  return node;
}

/** The markers and text of a collected render, as JSON nodes; markup that isn't a primitive is reported. */
function read(html: string, collection: PrimitiveCollection, diagnostics: Diagnostic[]): Array<JsonNode | string> {
  const pattern = new RegExp(`<${MARK} data-n="${collection.nonce}" data-i="(\\d+)" data-e="([oc])"></${MARK}>`, "g");
  const top: Array<JsonNode | string> = [];
  const open: Array<{ node: JsonNode | null; children: Array<JsonNode | string> }> = [{ node: null, children: top }];
  let last = 0;
  const text = (between: string) => {
    if (!between) return;
    const into = open[open.length - 1];
    // What an Html block holds is its markup, as React writes it.
    if (into.node?.type === "Html") {
      const props = (into.node.props ??= {}) as Record<string, unknown>;
      props.html = `${typeof props.html === "string" ? props.html : ""}${between}`;
      return;
    }
    if (/<[a-zA-Z!/]/.test(between)) {
      const where = into.node ? `in a ${into.node.type}` : "around the root";
      diagnostics.push({
        code: "jsx/markup",
        severity: "error",
        message: `HTML ${where} isn't part of an Elements document: use the primitives (Text, Link, Image, …) instead of ${JSON.stringify(between.slice(0, 60))}. Every element: @hyper-elements/react/GUIDE.md`,
        path: "jsx",
      });
      return;
    }
    into.children.push(unescape(between));
  };
  for (const match of html.matchAll(pattern)) {
    text(html.slice(last, match.index));
    last = match.index! + match[0].length;
    if (match[2] === "o") {
      const node = toJsonNode(collection.recorded[Number(match[1])], diagnostics);
      open[open.length - 1].children.push(node);
      open.push({ node, children: node.children });
    } else open.pop();
  }
  text(html.slice(last));
  return top;
}

/**
 * React's own comments in renderToString's output (between text nodes, around Suspense and Activity boundaries).
 * The template's content never holds one: React escapes text and attributes.
 */
const COMMENTS = /<!--[\s\S]*?-->/g;
/** What React throws for an async component, or one that suspends outside a <Suspense> (its own words, or its production code's). */
const ASYNC_ERROR =
  /^(?:Objects are not valid as a React child \(found: \[object Promise\]\)|A component suspended while responding to synchronous input|Minified React error #426\b|Minified React error #31\b.*%5Bobject%20Promise%5D)/;
const ASYNC_MESSAGE =
  "A component is async or suspends (an async function, React.lazy, use()): render() doesn't wait for it yet. Load its data first and pass it in as props";
/** Why React didn't finish a Suspense boundary, when it says (development builds): it was waiting for something. */
const SUSPENDED = /does not support Suspense|did not finish this Suspense boundary/;

/**
 * The Suspense boundaries React didn't finish (`<!--$!-->` … `<!--/$-->`, its fallback in place of the content)
 * taken out, with the reason React gives for each in development (`<template data-msg>`), else "".
 */
function unfinished(html: string): { html: string; reasons: string[] } {
  const reasons: string[] = [];
  let [out, at] = ["", 0];
  for (let start = html.indexOf("<!--$!-->"); start >= 0; start = html.indexOf("<!--$!-->", at)) {
    out += html.slice(at, start);
    reasons.push(unescape(/^<!--\$!--><template[^>]*?\bdata-msg="([^"]*)"/.exec(html.slice(start))?.[1] ?? ""));
    // To the boundary's own end: boundaries can nest.
    const marks = /<!--(\$[!?]?|\/\$)-->/g;
    marks.lastIndex = start;
    let depth = 0;
    for (let mark = marks.exec(html); mark; mark = marks.exec(html)) {
      depth += mark[1] === "/$" ? -1 : 1;
      if (depth === 0) break;
    }
    at = depth === 0 ? marks.lastIndex : html.length;
  }
  return { html: out + html.slice(at), reasons };
}

/** A boundary that didn't finish: something in it was async or suspended, or threw (React says which in development). */
function unfinishedDiagnostic(reason: string): Diagnostic {
  const said = reason.replace(/^Switched to client rendering because the server rendering errored:\s*/, "");
  // (What React threw there can be its own words for an async component inside a component of the user's.)
  const thrown = reason && !SUSPENDED.test(reason) && !ASYNC_ERROR.test(said) ? said : "";
  if (thrown) return { code: "jsx/error", severity: "error", message: `A component inside <Suspense> threw: ${thrown}`, path: "jsx" };
  const message = reason ? ASYNC_MESSAGE : `${ASYNC_MESSAGE}. (With React's production build, a component that threw inside <Suspense> looks the same: check it too.)`;
  return { code: "jsx/async", severity: "error", message, path: "jsx" };
}

/** What a slot's mark is recorded as (`slotMark()`): a node only a snapshot reads, filling it with the slot's content. */
export const SLOT_MARK = "#slot";

/**
 * JSX rendered once, read back as JSON nodes, with the custom components it used. With `whitespace`, text that's only
 * whitespace at the top level is kept (a fragment's: `Hello{mark}world` keeps the space a slot gives).
 */
export function collectNodes(
  element: React.ReactElement,
  options: { whitespace?: boolean } = {}
): {
  nodes: Array<JsonNode | string>;
  components: CustomDefinition<any>[];
  diagnostics: Diagnostic[];
  /** Nothing was collected, for a reason already said: React couldn't render it, or all of it suspended. */
  aborted?: boolean;
  /** Templates used as the root, in a render that finished (none from one that didn't: their props may be partial). */
  templates: TemplateRequest[];
} {
  const diagnostics: Diagnostic[] = [];
  const collection: PrimitiveCollection = { nonce: nonce(), recorded: [], components: new Map(), clashes: new Set() };
  let html: string;
  try {
    html = withRenderScope(() => {
      frames.push(collection);
      try {
        // On the shared stack too: a component that renders another template inside this one (toDesign() in a
        // useMemo) renders it with another module of react-dom's, so the hooks after it keep theirs (withBuild).
        return within(collection, () => renderToString(element));
      } finally {
        frames.pop();
      }
    });
  } catch (error) {
    // An async component's promise isn't a child React can render; React 18 and 19 say so in their own words.
    if (!ASYNC_ERROR.test(String((error as Error | undefined)?.message))) throw error;
    diagnostics.push({ code: "jsx/async", severity: "error", message: ASYNC_MESSAGE, path: "jsx" });
    return { nodes: [], components: [...collection.components.values()], diagnostics, aborted: true, templates: [] };
  }
  if (collection.async) diagnostics.push({ code: "jsx/async", severity: "error", message: ASYNC_MESSAGE, path: "jsx" });
  // A Suspense boundary that didn't finish: React wrote its fallback in place of the content. Neither is read.
  const done = unfinished(html);
  for (const reason of done.reasons) {
    const diagnostic = unfinishedDiagnostic(reason);
    // The same problem in several places is said once.
    if (!diagnostics.some((d) => d.code === diagnostic.code && d.message === diagnostic.message)) diagnostics.push(diagnostic);
  }
  const nodes = read(done.html.replace(COMMENTS, ""), collection, diagnostics).filter((child) => options.whitespace || typeof child !== "string" || child.trim());
  for (const type of collection.clashes) {
    diagnostics.push({
      code: "custom/duplicate",
      severity: "error",
      message: `Two different elements made with defineElement() are named ${type}. If defineElement() ran more than once (inside a function or a component, or in a module loaded twice), call it once, at the top of a module; if they're different elements, give each its own type`,
      path: "jsx",
    });
  }
  // A template's request from a render that didn't finish isn't used: what it was given may not be what it would be.
  const templates = done.reasons.length || collection.async ? [] : (collection.templates ?? []);
  // All of it was in a boundary that didn't finish: that says why there's no root.
  return { nodes, components: [...collection.components.values()], diagnostics, aborted: nodes.length === 0 && done.reasons.length > 0, templates };
}


/** Whether a tree holds a slot's mark anywhere. */
export const holdsMark = (node: JsonNode): boolean => node.type === SLOT_MARK || node.children.some((child) => typeof child !== "string" && holdsMark(child));

/** Each bound node's template field, by its path as collected (the paths diagnostics name). */
export function boundFields(node: JsonNode, path: string, out: Map<string, string>): Map<string, string> {
  if (typeof node.field === "string") out.set(path, node.field);
  node.children.forEach((child, index) => typeof child !== "string" && boundFields(child, `${path}.children[${index}]`, out));
  return out;
}

/**
 * Diagnostics with the template field of the node each is about, or of the nearest bound node holding it: a problem in
 * a bound Heading's Span is the headline's too.
 */
export function withFields(diagnostics: Diagnostic[], fields: ReadonlyMap<string, string> | undefined): Diagnostic[] {
  if (!fields?.size) return diagnostics;
  return diagnostics.map((diagnostic) => {
    if (diagnostic.field !== undefined) return diagnostic;
    for (let path = diagnostic.path; path; ) {
      const field = fields.get(path);
      if (field !== undefined) return { ...diagnostic, field };
      // Up one step: past a key (".style.color"), an expansion ("(acme.Card)") or a child index.
      const cut = Math.max(path.lastIndexOf("."), path.lastIndexOf("("));
      path = cut > 0 ? path.slice(0, cut) : "";
    }
    return diagnostic;
  });
}

/**
 * What the collecting render's read of a design said, then what core found on the document it read: core reads that
 * document again, and says again what's as true of it read (a block hidden on phones and on desktops), which a design
 * is told once.
 */
export function withFound(said: Diagnostic[], found: Diagnostic[], fields: ReadonlyMap<string, string> | undefined): Diagnostic[] {
  // Its severity too: an error is never left out for a warning that reads the same.
  const key = (diagnostic: Diagnostic) => `${diagnostic.severity}\n${diagnostic.code}\n${diagnostic.path}\n${diagnostic.message}`;
  const heard = new Set(said.map(key));
  return [...said, ...withFields(found, fields).filter((diagnostic) => !heard.has(key(diagnostic)))];
}

/** A template collected from JSX: its tree (internal: never part of the API), the problems, the custom components it uses. */
export interface CollectedTemplate extends CheckResult {
  components: CustomDefinition<any>[];
  /**
   * The root as collected, before it's read: every component the JSX gave, those an error leaves out of `document`
   * too, at the paths diagnostics name (reading merges text and drops what's left out, so `document`'s may differ).
   */
  collected: JsonNode | null;
  /** Each bound node's template field, by its path as collected. */
  fields?: ReadonlyMap<string, string>;
  /** The template the design's root was, where it was one: its id and version. */
  template?: { id: string; version: string };
  /** Required rules its template couldn't decide (measured ones): a writer refuses it, or decides them (/image). */
  pending?: readonly PendingRule[];
  /**
   * A template design checked in every format (`all`, and no `format` among its props): no one document, but what the
   * template's check found in each.
   */
  checkedFormats?: TemplateCheck;
}

const notRoot = (message: string): Diagnostic => ({
  code: "template/not-root",
  severity: "error",
  message,
  path: "jsx",
  fix: "Make the template the design's root, alone: export default () => <Newsletter … />",
});

/** The record a template object carries, where it carries one a template's check can be called through. */
function recordOf(template: unknown): TemplateRecord | undefined {
  const record = (typeof template === "function" || (typeof template === "object" && template !== null)) ? (template as Record<symbol, unknown>)[TEMPLATE_RECORD] : undefined;
  return record && typeof (record as TemplateRecord).check === "function" ? (record as TemplateRecord) : undefined;
}

/**
 * JSX collected into Elements' internal tree and checked, never throwing for what's in it. A design whose root is a
 * template is handed to the template: its check runs, and the design it built for the format is what's collected.
 * With `all`, a template with formats and no `format` among its props is checked in each (validate() reports them all).
 */
export function collectTemplate(element: React.ReactElement | object, options: { all?: boolean; built?: boolean } = {}): CollectedTemplate {
  // A snapshot: collected once already, and never again.
  const snapshot = snapshotData(element);
  if (snapshot) return { ...snapshot.collected, ...(snapshot.template ? { template: snapshot.template } : {}), ...(snapshot.pending?.length ? { pending: snapshot.pending } : {}) };
  const { nodes: top, components, diagnostics, aborted, templates } = collectNodes(element as React.ReactElement);
  if (templates.length) {
    // What a template's render built is a design, never another template's.
    if (options.built) return { document: null, diagnostics: [...diagnostics, notRoot("A template's render returns a root (an Email, a Page, a Document or a Canvas), not another template")], components, collected: null };
    if (templates.length > 1) return { document: null, diagnostics: [...diagnostics, notRoot("A design has one template as its root, used once: this one renders a template more than once")], components, collected: null };
    if (top.length) return { document: null, diagnostics: [...diagnostics, notRoot("A template is a whole design: it's the root, with nothing beside it or around it")], components, collected: null };
    return handOff(templates[0], diagnostics, options);
  }
  if (top.length !== 1 || typeof top[0] === "string") {
    // (A render React couldn't do has already said why nothing was collected.)
    if (!aborted) {
      diagnostics.push({
        code: "jsx/root",
        severity: "error",
        message: top.length ? "A design renders one root (an Email, a Page, a Document or a Canvas) and nothing beside it" : "The JSX rendered no Elements root (an Email, a Page, a Document or a Canvas)",
        path: "jsx",
      });
    }
    return { document: null, diagnostics, components, collected: null };
  }
  if (holdsMark(top[0])) {
    diagnostics.push({ code: "jsx/slot-mark", severity: "error", message: "A slot's mark (slotMark()) is filled only by a snapshot of a template's design: render the template, or check() it", path: "jsx" });
    return { document: null, diagnostics, components, collected: null };
  }
  const result = checkDocument({ root: top[0] }, new Registry(components));
  const fields = boundFields(top[0], "root", new Map());
  return { document: result.document, diagnostics: withFields([...diagnostics, ...result.diagnostics], fields), components, collected: top[0], fields };
}

/** A template design: the template's check run, and the design it built for the format collected. */
function handOff(request: TemplateRequest, said: Diagnostic[], options: { all?: boolean }): CollectedTemplate {
  const record = recordOf(request.template);
  if (!record) {
    return { document: null, diagnostics: [...said, { code: "template/not-root", severity: "error", message: "The design's root recorded a template that carries no check (made by another tool, or an Elements too old)", path: "jsx" }], components: [], collected: null };
  }
  const template = { id: record.id, version: record.version };
  const { format, ...props } = request.props;
  if (format !== undefined && (typeof format !== "string" || !record.formats.includes(format))) {
    const message = record.formats.length ? `${record.id} has the formats ${record.formats.join(", ")}, not ${JSON.stringify(format)}` : `${record.id} has one size, and no formats: leave format out`;
    return { document: null, diagnostics: [...said, { code: "template/format", severity: "error", message, path: "values.format" }], components: [], collected: null, template };
  }
  if (format === undefined && record.formats.length > 1 && !options.all) {
    return {
      document: null,
      diagnostics: [...said, { code: "template/format", severity: "error", message: `${record.id} has ${record.formats.length} formats (${record.formats.join(", ")}): this writes one, so the design names it with format`, path: "values.format", fix: `<${record.id.split(".").pop()} format="${record.formats[0]}" … />, or check(design) from @hyper-elements/react/template for every format` }],
      components: [],
      collected: null,
      template,
    };
  }
  const checked = record.check(props, format === undefined ? {} : { format });
  if (!checked.valid) return { document: null, diagnostics: [...said, ...checked.diagnostics], components: [], collected: null, template };
  const names = Object.keys(checked.snapshots);
  if (names.length !== 1) return { document: null, diagnostics: [...said, ...checked.diagnostics], components: [], collected: null, template, checkedFormats: checked };
  const inner = collectTemplate(checked.snapshots[names[0]] as React.ReactElement, { built: true });
  return { ...inner, diagnostics: [...said, ...inner.diagnostics, ...checked.own], template };
}
