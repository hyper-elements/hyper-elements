/**
 * Plugins: what a package outside core adds to `validate()` and `render()`, without core depending on it. The email
 * client checks are one (`@hyper-elements/email-clients`'s `emailClients()`): core checks the template and its own
 * writers, and a plugin checks what it knows (plan email-client-models, D5).
 *
 * A plugin's hooks are synchronous and see copies: `check` a frozen copy of the laid-out tree, `checkOutput` the written
 * HTML. Core checks every diagnostic a plugin returns, drops what doesn't fit, maps paths to the template's, merges
 * equal ones, and keeps the order: plugins in the order passed, each one's diagnostics in the order returned. Nothing a
 * plugin does can make a render fail.
 */
import { CONDITIONS } from "./conditions";
import type { Diagnostic } from "./diagnostics";
import type { Json } from "./model";
import type { ResolvedDocument, ResolvedNode, ResolvedText } from "./resolve";
import { builtIn } from "./writers/email/support";
import { oneLineWidth, wrapsPastIts } from "./writers/shared/estimate";

/** The version of this contract; a plugin can check the core it runs on. */
export const PLUGIN_API = 1;

/** A laid-out node's data, copied: JSON values only, with its component's defaults (what an author didn't set). */
export interface PluginNode {
  id?: string;
  /** Its place in the tree as laid out (`root.children[2]`); `PluginInput.templatePath` gives the template's. */
  path: string;
  type: string;
  props: Record<string, Json>;
  /** Its style, its component's defaults under its own. */
  style: Record<string, Json>;
  hover?: Record<string, Json>;
  mobile?: Record<string, Json>;
  hidden?: { mobile?: boolean; desktop?: boolean };
  text: ResolvedText;
  available: number | null;
  width: number | null;
  contentWidth: number | null;
  columns?: number[] | null;
  columnSizes?: Array<"px" | "share" | "free"> | null;
  children: ReadonlyArray<PluginNode | string>;
  /** Its component's defaults: props, style, and style by a prop's value. */
  defaults: { props: Record<string, Json>; style: Record<string, Json>; styleBy?: { prop: string; values: Record<string, Record<string, Json>> } };
}

export interface PluginInput {
  /** A deeply frozen copy of the laid-out tree. */
  root: PluginNode;
  /** A laid-out path as the template's (inside a Grid, a custom component). */
  templatePath(path: string): string;
  /** Whether a template path is inside a built-in component's expansion (a Menu's separators). */
  builtIn(templatePath: string): boolean;
  /** Core's estimates, on its own tree, by laid-out path: a Row's content on one line, and how far that runs past it. */
  estimate: { oneLineWidth(path: string, phone?: number): number; wrapsPastIts(path: string): number | null };
}

/** The written output, compact (before `pretty`): `stylesheet` is the `<style>` text an Email's writer wrote ("" otherwise). */
export interface PluginOutput {
  /** The root's type (`Email`, `Page`, `Document`, `Canvas`): which output this is. */
  root: string;
  html: string;
  head: string;
  body: string;
  stylesheet: string;
}

export interface PluginDiagnostic {
  code: string;
  severity: "info" | "warning";
  message: string;
  path: string;
  nodeId?: string;
  clients?: readonly string[];
  fix?: string;
  see?: string;
}

export interface ElementsPlugin {
  /** Unique among the plugins passed. */
  name: string;
  api: typeof PLUGIN_API;
  check?(input: PluginInput): readonly PluginDiagnostic[];
  checkOutput?(output: PluginOutput): readonly PluginDiagnostic[];
}

export interface PluginsOption {
  /** Packages that add checks: `[await emailClients()]` from @hyper-elements/email-clients. */
  plugins?: readonly ElementsPlugin[];
}

/** The plugins that can run, and what core said about the ones that can't. */
export interface AcceptedPlugins {
  plugins: ElementsPlugin[];
  diagnostics: Diagnostic[];
}

const isThenable = (v: unknown): boolean => !!v && (typeof v === "object" || typeof v === "function") && typeof (v as { then?: unknown }).then === "function";
/** An error's message, whatever was thrown (one that can't be turned into text too). */
const reason = (error: unknown): string => {
  try {
    return String((error as Error)?.message ?? error).slice(0, 500);
  } catch {
    return "something that can't be shown as text was thrown";
  }
};
const describe = (v: unknown): string => (v === null ? "null" : Array.isArray(v) ? "an array" : typeof v === "object" ? "an object without a name and api" : typeof v);

/** Throws where `plugins` isn't a list: the caller's mistake, as a bad option is (called before the template is read). */
export function checkPluginsOption(plugins: unknown): void {
  if (plugins !== undefined && !Array.isArray(plugins)) throw new TypeError(`[Elements] plugins takes a list of plugins (such as [await emailClients()]), not ${describe(plugins)}`);
}

/**
 * Checks `plugins` itself, before any hook runs. Not a list throws (checkPluginsOption); an entry that isn't a plugin is
 * skipped with a warning (a Promise: `emailClients()` not awaited). Reading an entry can't throw past here.
 */
export function acceptPlugins(plugins: unknown): AcceptedPlugins {
  const out: AcceptedPlugins = { plugins: [], diagnostics: [] };
  checkPluginsOption(plugins);
  if (plugins === undefined) return out;
  const names = new Set<string>();
  (plugins as unknown[]).forEach((entry: unknown, i) => {
    const at = (code: string, message: string) => out.diagnostics.push({ code, severity: "warning", message, path: "root" });
    try {
      if (isThenable(entry)) return at("plugin/invalid", `plugins[${i}] got a Promise: pass \`await emailClients()\`, not \`emailClients()\``);
      const p = entry as Partial<ElementsPlugin> | null;
      if (!p || typeof p !== "object" || typeof p.name !== "string" || !p.name || !("api" in p)) return at("plugin/invalid", `plugins[${i}] isn't a plugin: it got ${describe(entry)}`);
      if (p.api !== PLUGIN_API) return at("plugin/unsupported", `The plugin "${p.name}" is written for plugin api ${JSON.stringify(p.api)}; this core reads api ${PLUGIN_API}`);
      if (names.has(p.name)) return at("plugin/duplicate", `The plugin "${p.name}" is passed twice; the second is ignored`);
      names.add(p.name);
      out.plugins.push(p as ElementsPlugin);
    } catch (error) {
      at("plugin/invalid", `plugins[${i}] couldn't be read: ${reason(error)}`);
    }
  });
  return out;
}

/** A deep copy of a JSON-like value, then frozen all the way down. */
function frozenCopy<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (v: unknown) => {
    if (v && typeof v === "object") {
      Object.freeze(v);
      for (const child of Object.values(v)) freeze(child);
    }
  };
  freeze(copy);
  return copy;
}

/** A ResolvedNode's data as a PluginNode: no definition (it's shared with COMPONENTS), no object the caller passed. */
function pluginNode(node: ResolvedNode): PluginNode {
  const d = node.definition;
  const defaultProps: Record<string, Json> = {};
  for (const [key, spec] of Object.entries(d.props)) if (spec.default !== undefined) defaultProps[key] = spec.default as Json;
  return {
    ...(node.id !== undefined ? { id: node.id } : {}),
    path: node.path,
    type: node.type,
    props: node.props,
    style: node.style,
    ...(node.hover ? { hover: node.hover } : {}),
    ...(node.mobile ? { mobile: node.mobile } : {}),
    ...(node.hidden ? { hidden: node.hidden } : {}),
    text: node.text,
    available: node.available,
    width: node.width,
    contentWidth: node.contentWidth,
    ...(node.columns !== undefined ? { columns: node.columns } : {}),
    ...(node.columnSizes !== undefined ? { columnSizes: node.columnSizes } : {}),
    children: node.children.map((c) => (typeof c === "string" ? c : pluginNode(c))),
    defaults: {
      props: defaultProps,
      style: (d.defaultStyle as Record<string, Json> | undefined) ?? {},
      ...(d.defaultStyleBy ? { styleBy: d.defaultStyleBy as { prop: string; values: Record<string, Record<string, Json>> } } : {}),
    },
  };
}

/** Each laid-out node by its path, once per laid-out tree (both hooks and the path check read it). */
const indexes = new WeakMap<ResolvedDocument, Map<string, ResolvedNode>>();
function nodeIndex(resolved: ResolvedDocument): Map<string, ResolvedNode> {
  let byPath = indexes.get(resolved);
  if (!byPath) {
    const index = (node: ResolvedNode) => {
      byPath!.set(node.path, node);
      for (const c of node.children) if (typeof c !== "string") index(c);
    };
    byPath = new Map();
    index(resolved.root);
    indexes.set(resolved, byPath);
  }
  return byPath;
}

function pluginInput(resolved: ResolvedDocument): PluginInput {
  const byPath = nodeIndex(resolved);
  const row = (path: string) => {
    const node = byPath.get(path);
    if (!node) throw new Error(`[Elements] estimate: no node at ${path}`);
    return node;
  };
  return Object.freeze({
    root: frozenCopy(pluginNode(resolved.root)),
    templatePath: (path: string) => (resolved.templatePath ? resolved.templatePath(path) : path),
    builtIn,
    estimate: Object.freeze({ oneLineWidth: (path: string, phone?: number) => oneLineWidth(row(path), phone), wrapsPastIts: (path: string) => wrapsPastIts(row(path)) }),
  });
}

const PREFIX: Record<string, string> = { Email: "email", Page: "page", Document: "document", Canvas: "canvas" };
const KEY = /^[A-Za-z][\w-]*$/;

/** Whether `path` is one a plugin may report at: root, a node, or a node's prop, style, condition or condition key. */
function validPath(path: string, nodes: ReadonlyMap<string, unknown>): boolean {
  if (path === "root" || nodes.has(path)) return true;
  for (let end = path.lastIndexOf("."); end > 0; end = path.lastIndexOf(".", end - 1)) {
    const node = path.slice(0, end);
    if (!nodes.has(node)) continue;
    const rest = path.slice(end + 1).split(".");
    const [first, key] = rest;
    if (rest.length === 2 && (first === "props" || first === "style") && KEY.test(key!)) return true;
    if (CONDITIONS.some((c) => c.name === first) && (rest.length === 1 || (rest.length === 2 && KEY.test(key!)))) return true;
    return false;
  }
  return false;
}

/** Copies what a plugin returned that fits the contract, field by field; null for one that doesn't. */
function accept(d: unknown, rootType: string, nodes: ReadonlyMap<string, unknown>): Diagnostic | null {
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const code = r.code;
  if (typeof code !== "string" || !/^(email|page|document|canvas)\/[a-z][a-z-]*$/.test(code)) return null;
  if (r.severity !== "info" && r.severity !== "warning") return null;
  // Another root's code only as a plugin's note that what it was given doesn't apply to this root (`email/clients-ignored`
  // on a Page): an info ending in -ignored.
  if (code.split("/")[0] !== PREFIX[rootType] && !(r.severity === "info" && code.endsWith("-ignored"))) return null;
  if (typeof r.message !== "string" || !r.message) return null;
  if (typeof r.path !== "string" || !validPath(r.path, nodes)) return null;
  for (const k of ["nodeId", "fix", "see"] as const) if (r[k] !== undefined && typeof r[k] !== "string") return null;
  if (typeof r.see === "string" && !r.see.startsWith("https://")) return null;
  if (r.clients !== undefined) {
    const c = r.clients;
    if (!Array.isArray(c) || !c.length || c.some((x) => typeof x !== "string") || new Set(c).size !== c.length) return null;
  }
  const out: Diagnostic = { code, severity: r.severity, message: r.message, path: r.path };
  if (typeof r.nodeId === "string") out.nodeId = r.nodeId;
  if (Array.isArray(r.clients)) out.clients = [...(r.clients as string[])];
  if (typeof r.fix === "string") out.fix = r.fix;
  if (typeof r.see === "string") out.see = r.see;
  return out;
}

/** Merges equal diagnostics that both name clients (code, path, severity and message alike), joining their clients. */
function merge(diagnostics: Diagnostic[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Map<string, Diagnostic>();
  for (const d of diagnostics) {
    if (!d.clients) {
      out.push(d);
      continue;
    }
    const key = JSON.stringify([d.code, d.path, d.severity, d.message]);
    const same = seen.get(key);
    if (same) same.clients = [...new Set([...same.clients!, ...d.clients])];
    else {
      seen.set(key, d);
      out.push(d);
    }
  }
  return out;
}

/** Runs one hook of every plugin that has it: their diagnostics checked, mapped to template paths, merged. */
function run(
  plugins: readonly ElementsPlugin[],
  hook: "check" | "checkOutput",
  arg: () => PluginInput | PluginOutput,
  resolved: ResolvedDocument
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const withHook: Array<{ plugin: ElementsPlugin; fn: (a: unknown) => unknown }> = [];
  for (const plugin of plugins) {
    try {
      const fn = plugin[hook];
      if (typeof fn === "function") withHook.push({ plugin, fn: fn as (a: unknown) => unknown });
    } catch (error) {
      out.push({ code: "plugin/failed", severity: "warning", message: `The plugin "${plugin.name}" failed in ${hook}: ${reason(error)}`, path: "root" });
    }
  }
  if (!withHook.length) return out;
  const nodes = nodeIndex(resolved);
  const input = arg();
  for (const { plugin, fn } of withHook) {
    let returned: unknown;
    try {
      returned = fn.call(plugin, input);
    } catch (error) {
      out.push({ code: "plugin/failed", severity: "warning", message: `The plugin "${plugin.name}" failed in ${hook}: ${reason(error)}`, path: "root" });
      continue;
    }
    // What it returned is read with care too: a getter, or a Proxy, that throws is the plugin failing, not the render.
    const kept: Diagnostic[] = [];
    let dropped = 0;
    try {
      if (!Array.isArray(returned)) {
        out.push({ code: "plugin/failed", severity: "warning", message: `The plugin "${plugin.name}" returned ${describe(returned)} from ${hook}, not a list of diagnostics`, path: "root" });
        continue;
      }
      for (const d of returned as unknown[]) {
        let one: Diagnostic | null;
        try {
          one = accept(d, resolved.root.type, nodes);
        } catch {
          one = null;
        }
        if (one) kept.push(one);
        else dropped++;
      }
    } catch (error) {
      out.push({ code: "plugin/failed", severity: "warning", message: `The plugin "${plugin.name}" returned a list from ${hook} that couldn't be read: ${reason(error)}`, path: "root" });
      continue;
    }
    out.push(...kept);
    if (dropped) out.push({ code: "plugin/invalid", severity: "warning", message: `The plugin "${plugin.name}" returned ${dropped} diagnostic${dropped === 1 ? "" : "s"} from ${hook} that core can't show (a code, severity, message or path it doesn't take)`, path: "root" });
  }
  const { templatePath } = resolved;
  return merge(templatePath ? out.map((d) => ({ ...d, path: templatePath(d.path) })) : out);
}

/** What the plugins' `check` hooks find on the laid-out tree. */
export function pluginChecks(plugins: readonly ElementsPlugin[], resolved: ResolvedDocument): Diagnostic[] {
  return run(plugins, "check", () => pluginInput(resolved), resolved);
}

/** What the plugins' `checkOutput` hooks find in the written output. */
export function pluginOutputChecks(plugins: readonly ElementsPlugin[], output: PluginOutput, resolved: ResolvedDocument): Diagnostic[] {
  return run(plugins, "checkOutput", () => Object.freeze({ ...output }), resolved);
}
