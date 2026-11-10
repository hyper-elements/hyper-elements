import { checkDocument } from "../normalize";
import { checkTargetExpanded, resolveExpanded, type ResolvedDocument, type ResolvedNode } from "../resolve";
import { ElementsError, type Diagnostic } from "../diagnostics";
import { acceptPlugins, pluginChecks, pluginOutputChecks, type PluginsOption } from "../plugins";
import { expandDocument } from "../expand";
import { registryOf, type ComponentsOption } from "../registry";
import type { Target } from "../define";
import { renderEmail, type EmailOptions } from "./email";
import { emailSupport } from "./email/support";
import { overflow, pagedSupport } from "./shared/paged";
import { support } from "./shared/support";
import { pageBreakpoints, renderPage, type PageOptions } from "./page";
import { renderText } from "./plain-text";
import { prettyHtml } from "./shared/pretty";
import type { BlockMap } from "./shared/block-map";

export { renderEmail, EMAIL_PHONE_MARGIN, type EmailHtml, type EmailOptions } from "./email";
export { renderPage, PAGE_PHONE_WIDTH, pagePhoneWidth, type PageHtml, type PageOptions } from "./page";
export { renderText, type TextOptions } from "./plain-text";
export { emailSupport } from "./email/support";
export { support } from "./shared/support";
export { overflow, pagedSupport } from "./shared/paged";
export { Stylesheet, CLASS_PREFIX, type Media } from "./shared/classes";
export { BLOCK_MAP_VERSION, type BlockMap, type BlockMapEntry } from "./shared/block-map";

export interface RenderOptions extends PageOptions, EmailOptions, PluginsOption {
  /** The HTML indented, for reading it; for sending, the compact HTML (white space may change how some email clients show it). */
  pretty?: boolean;
  /**
   * For tools that preview an Email: also return `blocks`, where each block is in `html` (its template path and the
   * UTF-8 byte offset just after its outermost element's tag name). The HTML is the same either way. Not with `pretty`.
   */
  blockMap?: boolean;
}

export interface RenderResult {
  /** The whole document, from `<!DOCTYPE html>`. */
  html: string;
  /** The plain-text version. */
  text: string;
  /** What goes in `<head>` and in `<body>`, and the body's own style: to embed the output in a page of your own. */
  head: string;
  body: string;
  bodyStyle: string;
  /** Warnings and notes (errors are thrown). */
  diagnostics: Diagnostic[];
  /** With `blockMap`, for an Email: where each block is in `html`. */
  blocks?: BlockMap;
}

/** The output each root renders to, and whether its writer exists yet. */
const OUTPUTS: Record<string, { target: Target; ready: boolean; later?: string }> = {
  Page: { target: "web", ready: true },
  // Print HTML: a page writer's, each page a box of the paper's size.
  Document: { target: "web", ready: true },
  // A Canvas as HTML, to look at (@hyper-elements/react/image writes the image).
  Canvas: { target: "web", ready: true },
  Email: { target: "email", ready: true },
};

export interface Prepared {
  /** The template laid out, its custom components expanded; null where it has errors. */
  resolved: ResolvedDocument | null;
  /** The output its root renders to. */
  target: Target | null;
  /** Everything found: errors, warnings and notes. */
  diagnostics: Diagnostic[];
}

/**
 * What both validating and rendering do, once: the template checked, its
 * custom components expanded (each rendered once), checked against the output
 * its root says, laid out, and what that output can't do as asked found; then
 * what the plugins find on the laid-out tree (their `check`). What needs the
 * written output is left to rendering (their `checkOutput`).
 */
export function prepareTemplate(input: unknown, options: ComponentsOption & PluginsOption = {}): Prepared {
  const accepted = acceptPlugins(options.plugins);
  const registry = registryOf(options);
  const checked = checkDocument(input, registry);
  const diagnostics = [...checked.diagnostics];
  const failed = () => diagnostics.some((d) => d.severity === "error");
  if (!checked.document || failed()) return { resolved: null, target: null, diagnostics: [...diagnostics, ...accepted.diagnostics] };
  const root = checked.document.root.type;
  /** What it found, then what core said about the plugins passed (their `check` runs only on a template laid out without errors). */
  const done = (resolved: ResolvedDocument | null, target: Target | null, checks: Diagnostic[] = []): Prepared => ({ resolved, target, diagnostics: [...diagnostics, ...accepted.diagnostics, ...checks] });
  const output = OUTPUTS[root];
  if (!output?.ready) {
    diagnostics.push({ code: "output/unavailable", severity: "error", message: output?.later ?? `A ${root} can't be rendered yet`, path: "root" });
    return done(null, null);
  }
  const expanded = expandDocument(checked.document, registry, output.target);
  diagnostics.push(...expanded.diagnostics);
  if (failed()) return done(null, output.target);
  diagnostics.push(...checkTargetExpanded(expanded.document, output.target, registry, expanded.paths));
  if (failed()) return done(null, output.target);
  const resolved = resolveExpanded(expanded.document, registry, expanded.paths);
  diagnostics.push(...resolved.diagnostics);
  const found = output.target === "email" ? emailSupport(resolved.root) : support(resolved.root, output.target);
  // A Document's page and a Canvas are a fixed size: content that can't fit is cut off.
  if (root === "Document" || root === "Canvas") found.push(...overflow(resolved.root));
  found.push(...pageBreakpoints(resolved.root));
  diagnostics.push(...inTemplate(resolved, found));
  if (failed()) return done(null, output.target);
  return done(resolved, output.target, pluginChecks(accepted.plugins, resolved));
}

/** Diagnostics found on the tree as laid out, at their places in the template (a Grid's children, a custom component's). */
export function inTemplate(resolved: ResolvedDocument, diagnostics: Diagnostic[]): Diagnostic[] {
  const { templatePath } = resolved;
  return templatePath ? diagnostics.map((diagnostic) => ({ ...diagnostic, path: templatePath(diagnostic.path) })) : diagnostics;
}

/**
 * A template's problems, without writing it: errors make it invalid, warnings and notes don't. A Document's are its
 * PDF's too, and a Canvas's its image's (what they can't show that its HTML can).
 */
export function validateTemplate(input: unknown, options: ComponentsOption & PluginsOption = {}): { valid: boolean; diagnostics: Diagnostic[] } {
  const { diagnostics, resolved } = prepareTemplate(input, options);
  const root = resolved?.root;
  const paged = root?.type === "Document" ? pagedSupport(root, "pdf") : root?.type === "Canvas" ? pagedSupport(root, "image") : [];
  const all = [...diagnostics, ...(resolved ? inTemplate(resolved, paged) : paged)];
  return { valid: !all.some((d) => d.severity === "error"), diagnostics: all };
}

/**
 * A template (Elements' internal tree, with the custom components it uses)
 * rendered to the output its root says: prepared (`prepareTemplate`), then
 * written. Throws an `ElementsError` listing the errors if there are any.
 */
export function renderTemplate(input: unknown, options: RenderOptions & ComponentsOption = {}): RenderResult {
  // Indenting rewrites the HTML after it's written, which would move every offset.
  if (options.blockMap && options.pretty) throw new ElementsError([{ code: "render/block-map-pretty", severity: "error", message: "blockMap gives offsets in the compact HTML; leave pretty off", path: "root" }]);
  const { resolved, target, diagnostics } = prepareTemplate(input, options);
  if (!resolved) throw new ElementsError(diagnostics);
  const text = renderText(resolved, options);
  const written = target === "email" ? renderEmail(resolved, options) : { ...renderPage(resolved, options), stylesheet: "", diagnostics: [] };
  // The plugins' checks on the written output, compact (what `pretty` would change isn't what an email client receives).
  const { plugins } = acceptPlugins(options.plugins);
  const outputChecks = pluginOutputChecks(plugins, { html: written.html, head: written.head, body: written.body, stylesheet: written.stylesheet }, resolved);
  const shown = (html: string) => (options.pretty ? prettyHtml(html) : html);
  const blocks = "blocks" in written ? written.blocks : undefined;
  return {
    html: shown(written.html),
    head: shown(written.head),
    body: shown(written.body),
    bodyStyle: written.bodyStyle,
    text,
    diagnostics: [...diagnostics, ...inTemplate(resolved, written.diagnostics), ...outputChecks],
    ...(blocks ? { blocks } : {}),
  };
}
