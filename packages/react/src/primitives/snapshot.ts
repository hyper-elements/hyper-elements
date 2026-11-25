/**
 * What is checked is what is rendered: a design collected once and captured as inert data (`snapshot()`), which every
 * entry point takes in place of an element and never collects again. Slot content, the code an agent wrote, runs
 * once, on its own (`captureFragment()`), and is spliced in at its mark (`slotMark()`); a preflight sees each slot's
 * captured content before anything is read or expanded, so a refused component's render never runs.
 *
 * A capture holds owned plain data only (strings, numbers, booleans, null, plain objects and arrays, each read once):
 * a getter can't give one value to a check and another to a writer, and nothing the agent wrote runs after it.
 */
import React from "react";
import { checkDocument, ElementsError, Registry, type CustomDefinition, type Diagnostic, type Json } from "@hyper-elements/core";
import { boundFields, collectNodes, SLOT_MARK, SNAPSHOT, withFields, type CollectedTemplate, type JsonNode, type SnapshotData } from "./collect";
import { collectingPrimitives, recordPrimitive } from "./collect";

// ─── Captures ───────────────────────────────────────────────────────────────

/** A captured node: what a component was given, as plain data. */
export interface CapturedNode {
  type: string;
  id?: string;
  field?: string;
  props?: { [key: string]: Json };
  style?: { [key: string]: Json };
  mobile?: { [key: string]: Json };
  hover?: { [key: string]: Json };
  hidden?: { mobile?: boolean; desktop?: boolean };
  variant?: Json;
  tokens?: { [key: string]: Json };
  theme?: { [key: string]: Json };
  children: Array<CapturedNode | string>;
}

/** Content collected on its own and captured: plain JSON, which can be stored and sent, and read back with `readFragment()`. */
export interface FragmentCapture {
  kind: "hyper-elements.fragment";
  version: 1;
  nodes: Array<CapturedNode | string>;
  /** What collecting it found (markup, an async component): a capture with an error is never read. */
  diagnostics: Diagnostic[];
  /** Nothing was collected, for a reason its diagnostics give. */
  aborted: boolean;
}

/** The custom components a capture made in this process registered, held off its JSON, for a check by identity. */
const DEFINITIONS = Symbol.for("hyper-elements.fragment.definitions");
const NODE_KEYS = ["type", "id", "field", "props", "style", "mobile", "hover", "hidden", "variant", "tokens", "theme", "children"];
const MAX_DEPTH = 64;
const MAX_BYTES = 8 * 1024 * 1024;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** A value copied as plain data, each key read once; what isn't plain data is `jsx/value` at its path. */
function owned(value: unknown, path: string, problems: Diagnostic[], depth = 0): Json | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
  } else if (value === undefined) return undefined;
  else if (depth < MAX_DEPTH && Array.isArray(value)) {
    const out: Json[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = owned(value[i], `${path}[${i}]`, problems, depth + 1);
      out.push(item === undefined ? null : item);
    }
    return out;
  } else if (depth < MAX_DEPTH && isPlainObject(value)) {
    const out: { [key: string]: Json } = {};
    for (const key of Object.keys(value)) {
      const item = owned(value[key], `${path}.${key}`, problems, depth + 1);
      if (item !== undefined) out[key] = item;
    }
    return out;
  }
  const what = typeof value === "function" ? "a function" : typeof value === "number" ? String(value) : typeof value === "object" ? `${depth >= MAX_DEPTH ? "nested past 64 levels" : `a ${(value as object).constructor?.name ?? "class"} instance`}` : `a ${typeof value}`;
  problems.push({ code: "jsx/value", severity: "error", message: `A value in a design is plain data (text, numbers, lists, objects), not ${what}`, path });
  return undefined;
}

/** Collected nodes captured as plain data. */
function captureNodes(nodes: Array<JsonNode | string>, at: string, problems: Diagnostic[]): Array<CapturedNode | string> {
  return nodes.map((node, index) => (typeof node === "string" ? node : captureNode(node, `${at}[${index}]`, problems)));
}

function captureNode(node: JsonNode, at: string, problems: Diagnostic[]): CapturedNode {
  const out = { type: node.type, children: [] } as unknown as CapturedNode;
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "children") continue;
    const value = owned(node[key], `${at}.${key}`, problems);
    if (value !== undefined) (out as unknown as Record<string, Json>)[key] = value;
  }
  out.children = captureNodes(node.children, `${at}.children`, problems);
  return out;
}

/**
 * An element collected on its own and captured as plain data: a slot's content, ready to splice into a design, or
 * to store and send (it's JSON). Its top-level whitespace is kept. A template inside it is `template/not-root`.
 */
export function captureFragment(element: React.ReactElement): FragmentCapture {
  if (!React.isValidElement(element)) throw new TypeError(`[Elements] captureFragment() takes JSX, not ${element === null ? "null" : typeof element}`);
  const { nodes, components, diagnostics, aborted, templates } = collectNodes(element, { whitespace: true });
  const problems = [...diagnostics];
  if (templates.length) problems.push({ code: "template/not-root", severity: "error", message: "A template is a whole design: content captured on its own (a slot's) can't hold one", path: "jsx" });
  const capture: FragmentCapture = { kind: "hyper-elements.fragment", version: 1, nodes: captureNodes(nodes, "fragment", problems), diagnostics: problems, aborted: !!aborted };
  Object.defineProperty(capture, DEFINITIONS, { value: Object.freeze([...components]) });
  produced.add(capture);
  return capture;
}

/** Captures this copy made, so a snapshot takes them as they are (with their definitions); others are read again. */
const produced = new WeakSet<object>();

/** The custom components a capture registered where it was made, if it was made in this process. */
export function fragmentDefinitions(capture: FragmentCapture): readonly CustomDefinition<any>[] {
  return ((capture as unknown as Record<symbol, unknown>)[DEFINITIONS] as readonly CustomDefinition<any>[] | undefined) ?? [];
}

const fragmentError = (message: string): never => {
  throw new ElementsError([{ code: "jsx/fragment", severity: "error", message, path: "fragment" }]);
};

/**
 * A capture that came from elsewhere (a file, another process) checked and read: its kind and version, every node's
 * keys, every value plain data, at most 64 levels deep and 8 MB. Throws an `ElementsError` (`jsx/fragment`).
 */
export function readFragment(json: unknown): FragmentCapture {
  let size = 0;
  try {
    size = new TextEncoder().encode(JSON.stringify(json) ?? "").length;
  } catch {
    fragmentError("A fragment is JSON");
  }
  if (size > MAX_BYTES) fragmentError(`A fragment is at most 8 MB; this one is ${Math.ceil(size / 1024 / 1024)} MB`);
  if (!isPlainObject(json) || json.kind !== "hyper-elements.fragment") fragmentError('A fragment is { kind: "hyper-elements.fragment", version: 1, nodes, diagnostics, aborted }');
  const input = json as Record<string, unknown>;
  if (input.version !== 1) fragmentError(`This Elements reads fragments of version 1, not ${JSON.stringify(input.version)}`);
  if (!Array.isArray(input.nodes) || !Array.isArray(input.diagnostics) || typeof input.aborted !== "boolean") fragmentError("A fragment has nodes, diagnostics (lists) and aborted (true or false)");
  const problems: Diagnostic[] = [];
  const node = (value: unknown, at: string, depth: number): CapturedNode | string => {
    if (typeof value === "string") return value;
    if (depth > MAX_DEPTH) fragmentError(`A fragment is at most ${MAX_DEPTH} levels deep: ${at} is deeper`);
    if (!isPlainObject(value) || typeof value.type !== "string") return fragmentError(`${at} is a node ({ type, …, children }) or text`);
    const extra = Object.keys(value).find((key) => !NODE_KEYS.includes(key));
    if (extra) fragmentError(`${at}.${extra} isn't part of a node (${NODE_KEYS.join(", ")})`);
    const out = { type: value.type, children: [] } as unknown as CapturedNode;
    for (const key of NODE_KEYS) {
      if (key === "type" || key === "children" || value[key] === undefined) continue;
      const copy = owned(value[key], `${at}.${key}`, problems, depth);
      if (copy !== undefined) (out as unknown as Record<string, Json>)[key] = copy;
    }
    if (value.children !== undefined && !Array.isArray(value.children)) fragmentError(`${at}.children is a list`);
    out.children = ((value.children as unknown[] | undefined) ?? []).map((child, i) => node(child, `${at}.children[${i}]`, depth + 1));
    return out;
  };
  const nodes = (input.nodes as unknown[]).map((child, i) => node(child, `fragment[${i}]`, 1));
  if (problems.length) fragmentError(problems[0].message.replace(/^A value in a design/, `${problems[0].path}: a value in a fragment`));
  const diagnostics = (input.diagnostics as unknown[]).map((d) => {
    const copy = owned(d, "fragment.diagnostics", problems) as unknown as Diagnostic;
    if (!isPlainObject(copy) || typeof copy.code !== "string" || typeof copy.message !== "string" || !["error", "warning", "info"].includes(copy.severity as string)) fragmentError("A fragment's diagnostics each have a code, a severity and a message");
    return { ...copy, path: typeof copy.path === "string" ? copy.path : "jsx" };
  });
  return { kind: "hyper-elements.fragment", version: 1, nodes, diagnostics, aborted: input.aborted as boolean };
}

// ─── Marks ──────────────────────────────────────────────────────────────────

/**
 * The mark a template's render sees in place of a slot's content: `snapshot()` splices the slot's captured content in
 * where it is. Anywhere else it's an error (`jsx/slot-mark`).
 */
export function slotMark(path: string): React.ReactElement {
  return React.createElement(SlotMark, { path });
}

function SlotMark({ path }: { path: string }): React.ReactElement | null {
  const collection = collectingPrimitives();
  return collection ? recordPrimitive(collection, SLOT_MARK, { path }) : null;
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

/** A design collected once and captured: every entry point takes it in place of an element, and collects nothing again. */
export interface Snapshot {
  readonly kind: "hyper-elements.snapshot";
}

export interface SnapshotOptions {
  /** Each slot's content, by its path: an element (captured here, once) or a capture. */
  fragments?: Record<string, React.ReactElement | FragmentCapture>;
  /** Each slot's custom components, by path: the definitions its custom type names may resolve to (no other). */
  bind?: Record<string, readonly CustomDefinition<any>[]>;
  /**
   * Called for each slot after its content is spliced in, before anything is read or expanded: its captured host
   * (`null` where the mark was placed other than once, with `marks` the count) and the host's path. Returns diagnostics.
   */
  preflight?: (slot: string, capture: FragmentCapture, host: { node: CapturedNode; path: string } | null, marks: number) => Diagnostic[];
}

const isElement = (value: unknown): value is React.ReactElement => React.isValidElement(value);

/** Where each slot's mark is, as (parent, index) pairs, and the parent's path. */
function findMarks(node: CapturedNode, path: string, out: Map<string, Array<{ parent: CapturedNode; index: number; path: string }>>): void {
  node.children.forEach((child, index) => {
    if (typeof child === "string") return;
    if (child.type === SLOT_MARK) {
      const slot = String((child.props as { path?: unknown } | undefined)?.path ?? "");
      out.set(slot, [...(out.get(slot) ?? []), { parent: node, index, path }]);
    } else findMarks(child, `${path}.children[${index}]`, out);
  });
}

/** Adjacent strings joined, as reading the tree would: paths assigned after this are the ones diagnostics give. */
function joinText(children: Array<CapturedNode | string>): Array<CapturedNode | string> {
  const out: Array<CapturedNode | string> = [];
  for (const child of children) {
    if (typeof child === "string" && typeof out[out.length - 1] === "string") out[out.length - 1] += child;
    else out.push(child);
  }
  return out;
}

/**
 * A design collected once and captured as inert data, its slots' content spliced in at their marks: what every entry
 * point (`render()`, `validate()`, `prepare()`, `inspect()`, `renderImage()`, `renderPdf()`) takes in place of the
 * element, without collecting it again.
 */
export function snapshot(element: React.ReactElement, options: SnapshotOptions = {}): Snapshot {
  if (!isElement(element)) throw new TypeError(`[Elements] snapshot() takes a design as JSX, not ${element === null ? "null" : typeof element}`);
  const { nodes: top, components, diagnostics: said, aborted, templates } = collectNodes(element);
  const diagnostics: Diagnostic[] = [...said];
  const done = (collected: CollectedTemplate): Snapshot => brand(collected);
  if (templates.length) {
    diagnostics.push({ code: "template/not-root", severity: "error", message: "snapshot() takes a design; a design whose root is a template is check()ed by @hyper-elements/react/template", path: "jsx" });
    return done({ document: null, diagnostics, components, collected: null });
  }
  if (top.length !== 1 || typeof top[0] === "string") {
    if (!aborted) diagnostics.push({ code: "jsx/root", severity: "error", message: top.length ? "A design renders one root (an Email, a Page, a Document or a Canvas) and nothing beside it" : "The JSX rendered no Elements root (an Email, a Page, a Document or a Canvas)", path: "jsx" });
    return done({ document: null, diagnostics, components, collected: null });
  }
  const root = captureNode(top[0], "root", diagnostics);
  // Each slot's content captured once, on its own.
  const fragments = new Map<string, FragmentCapture>();
  for (const [slot, given] of Object.entries(options.fragments ?? {})) {
    fragments.set(slot, isElement(given) ? captureFragment(given) : produced.has(given) ? given : readFragment(given));
  }
  const marks = new Map<string, Array<{ parent: CapturedNode; index: number; path: string }>>();
  findMarks(root, "root", marks);
  for (const slot of marks.keys()) {
    if (!fragments.has(slot)) diagnostics.push({ code: "jsx/slot-mark", severity: "error", message: `The mark for the slot ${slot || "(unnamed)"} has no content: snapshot() is given none for it`, path: "jsx" });
  }
  // Splice each slot's content in at its mark, the last mark in a parent first so the earlier ones' indexes hold.
  const byParent = new Map<CapturedNode, Array<{ slot: string; index: number }>>();
  for (const [slot, at] of marks) if (fragments.has(slot)) for (const { parent, index } of at) byParent.set(parent, [...(byParent.get(parent) ?? []), { slot, index }]);
  for (const [parent, list] of byParent) {
    for (const { slot, index } of list.sort((a, b) => b.index - a.index)) {
      const nodes = fragments.get(slot)!.nodes.map((node) => (typeof node === "string" ? node : (JSON.parse(JSON.stringify(node)) as CapturedNode)));
      parent.children.splice(index, 1, ...nodes);
    }
  }
  const joinAll = (node: CapturedNode) => {
    node.children = joinText(node.children);
    for (const child of node.children) if (typeof child !== "string") joinAll(child);
  };
  joinAll(root);
  // Each slot: what collecting it found (at the slot's field), and the preflight on its captured host.
  let refused = false;
  for (const [slot, fragment] of fragments) {
    const at = marks.get(slot) ?? [];
    for (const d of fragment.diagnostics) diagnostics.push(d.path === "jsx" || d.path === "fragment" || d.path.startsWith("fragment") ? { ...d, path: `values.${slot}` } : d);
    if (fragment.aborted || fragment.diagnostics.some((d) => d.severity === "error")) refused = true;
    if (options.preflight) {
      const host = at.length === 1 ? { node: at[0].parent, path: at[0].path } : null;
      const found = options.preflight(slot, fragment, host, at.length);
      diagnostics.push(...found);
      if (found.some((d) => d.severity === "error")) refused = true;
    } else if (at.length !== 1) {
      diagnostics.push({ code: "jsx/slot-mark", severity: "error", message: `The slot ${slot}'s mark is placed ${at.length} times: once, in the node that holds its content`, path: "jsx" });
      refused = true;
    }
  }
  if (refused || diagnostics.some((d) => d.severity === "error")) return done({ document: null, diagnostics, components, collected: root as unknown as JsonNode });
  // The definitions read: the design's own, and for each slot only those it's bound to (a custom component the slot
  // defined itself is never read in place of the template's).
  const definitions = new Map<string, CustomDefinition<any>>();
  for (const definition of components) definitions.set(definition.type, definition);
  for (const [slot, fragment] of fragments) {
    const bound = options.bind?.[slot];
    for (const definition of bound ?? fragmentDefinitions(fragment)) {
      const known = definitions.get(definition.type);
      if (known && known !== definition) {
        diagnostics.push({ code: "custom/duplicate", severity: "error", message: `Two different custom elements are named ${definition.type}: the design's and the slot ${slot}'s`, path: `values.${slot}` });
      } else definitions.set(definition.type, definition);
    }
  }
  const collected = root as unknown as JsonNode;
  if (diagnostics.some((d) => d.severity === "error")) return done({ document: null, diagnostics, components: [...definitions.values()], collected });
  const read = checkDocument({ root: collected }, new Registry([...definitions.values()]));
  const fields = boundFields(collected, "root", new Map());
  return done({ document: read.document, diagnostics: withFields([...diagnostics, ...read.diagnostics], fields), components: [...definitions.values()], collected, fields });
}

/** A collected design branded as a snapshot: every copy of Elements reads it by the shared symbol. */
function brand(collected: CollectedTemplate, extra: Partial<SnapshotData> = {}): Snapshot {
  const out = { kind: "hyper-elements.snapshot" as const };
  Object.defineProperty(out, SNAPSHOT, { value: Object.freeze({ collected, ...extra }) });
  return Object.freeze(out);
}

/** A snapshot with what a template adds to it: its id and version, and its required rules not yet decided. */
export function withTemplate(snap: Snapshot, extra: Pick<SnapshotData, "template" | "pending">): Snapshot {
  const data = (snap as unknown as Record<symbol, SnapshotData>)[SNAPSHOT];
  return brand({ ...data.collected, ...(extra.template ? { template: extra.template } : {}) }, extra);
}
