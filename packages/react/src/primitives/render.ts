import React from "react";
import {
  ElementsError,
  LAYOUT_VERSION,
  pagedSupport,
  prepareTemplate,
  renderTemplate,
  validateTemplate,
  type Diagnostic,
  type PluginsOption,
  type RenderOptions,
  type RenderResult,
  type ResolvedNode,
} from "@unlayer-internal/elements-core";
import { collectTemplate } from "./collect";
import { outlineOf } from "./outline";

function template(element: unknown, call: string) {
  if (!React.isValidElement(element)) {
    throw new TypeError(`[Elements] ${call}() takes a template as JSX (<Email>…</Email>, <Page>…</Page>), not ${element === null ? "null" : typeof element}`);
  }
  return collectTemplate(element);
}

/** Where the email client checks are: said once for an Email that doesn't pass email-clients' plugin (plan email-client-models, D7). */
const MORE_CHECKS: Diagnostic = {
  code: "email/more-checks",
  severity: "info",
  message: "Email client checks (what classic Outlook, Gmail, Apple Mail and other clients remove or change, from caniemail's tables and captures of the real clients) come from @hyper-elements/email-clients",
  path: "root",
  fix: "npm i @hyper-elements/email-clients, then validate(email, { plugins: [await emailClients()] })",
};

/**
 * React's notes about the call itself, last: `emailClients` passed (it moved to email-clients' plugin in 0.4; this note
 * goes in 0.5), and for an Email without errors, where its client checks are. `plugins: []` passed turns that one off.
 */
function callNotes(rootType: string | undefined, diagnostics: readonly Diagnostic[], options: { plugins?: unknown; emailClients?: unknown }): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (options.emailClients !== undefined) {
    out.push({
      code: "email/clients-moved",
      severity: "info",
      message: "emailClients isn't an option of @hyper-elements/react any more: the email client checks moved to @hyper-elements/email-clients",
      path: "root",
      fix: "npm i @hyper-elements/email-clients, then validate(email, { plugins: [await emailClients({ clients: [...] })] })",
    });
  }
  const plugins = Array.isArray(options.plugins) ? options.plugins : null;
  const passed = plugins?.some((p) => !!p && typeof p === "object" && (p as { name?: unknown }).name === "email-clients") ?? false;
  if (rootType === "Email" && !passed && !(plugins && plugins.length === 0) && !diagnostics.some((d) => d.severity === "error")) out.push(MORE_CHECKS);
  return out;
}

/**
 * A template rendered to the output its root says: `<Email>` to email HTML,
 * `<Page>` to web HTML (`<Document>` to print HTML or PDF and `<Canvas>` to an
 * image come with their writers). Resolves to `{ html, text, … }`;
 * rejects with an `ElementsError` listing the problems if the
 * template has errors (see `validate()`).
 */
export async function render(element: React.ReactElement, options: RenderOptions = {}): Promise<RenderResult> {
  const { document, diagnostics, components } = template(element, "render");
  if (!document || diagnostics.some((d) => d.severity === "error")) throw new ElementsError(diagnostics);
  const rendered = renderTemplate(document, { ...options, components });
  const all = [...diagnostics, ...rendered.diagnostics];
  return { ...rendered, diagnostics: [...all, ...callNotes(document.root.type, all, options)] };
}

/** `validate()`'s options: `plugins`, the packages that add checks (`[await emailClients()]`). */
export type ValidateOptions = PluginsOption;

export interface ValidationResult {
  /** No errors (there may be warnings and notes). */
  valid: boolean;
  /** Each problem: a code, how bad it is, what's wrong and what to do instead, and where (`root.children[2].style.margin`). */
  diagnostics: Diagnostic[];
}

/**
 * A template's problems, without rendering it or throwing: for editors, tests
 * and agents checking what they wrote. It goes as far as rendering does before
 * writing: custom components expanded (and their output checked), the output's
 * own checks, layout, and what the output can't do as asked (`email/…`).
 * Warnings and notes leave it valid. What needs the written output is left to
 * `render()` (a plugin's `checkOutput`). Email client checks come from a plugin:
 * `validate(email, { plugins: [await emailClients()] })` with
 * @hyper-elements/email-clients; without it, an Email gets one note saying so.
 */
export function validate(element: React.ReactElement, options: ValidateOptions = {}): ValidationResult {
  const { document, diagnostics, components } = template(element, "validate");
  const all = [...diagnostics, ...(document && !diagnostics.some((d) => d.severity === "error") ? validateTemplate(document, { components, plugins: options.plugins }).diagnostics : [])];
  const withNotes = [...all, ...callNotes(document?.root.type, all, options)];
  return { valid: !withNotes.some((d) => d.severity === "error"), diagnostics: withNotes };
}

/**
 * A template laid out, as text: each block on a line under what holds it, with its width on desktop and what it
 * shows (a heading's words, a link's URL, an image's alt text), and whether a Row stacks on phones. To check a
 * template's layout without reading its HTML. Throws an `ElementsError` listing the problems if it has errors.
 */
export function outline(element: React.ReactElement): string {
  const { document, diagnostics, components } = template(element, "outline");
  if (!document || diagnostics.some((d) => d.severity === "error")) throw new ElementsError(diagnostics);
  // Laying it out finds problems of its own (a composite's, an output's): those are the ones it throws.
  const prepared = prepareTemplate(document, { components });
  const root = prepared.resolved?.root;
  if (!root) throw new ElementsError([...diagnostics, ...prepared.diagnostics]);
  return outlineOf(root);
}

/**
 * A template laid out, for an entry that writes another output (`@hyper-elements/react/pdf`): its tree, every block's
 * width worked out, and what was found. What render() does before it writes HTML; `root` is null where there are
 * errors. The tree is the writers' input, not a format to store: it changes with Elements, and `layout` says which
 * format it's in (a writer refuses one it doesn't read).
 */
export function prepare(element: React.ReactElement): { root: ResolvedNode | null; diagnostics: Diagnostic[]; layout: number } {
  const { document, diagnostics, components } = template(element, "prepare");
  if (!document || diagnostics.some((d) => d.severity === "error")) return { root: null, diagnostics, layout: LAYOUT_VERSION };
  const prepared = prepareTemplate(document, { components });
  const root = prepared.resolved?.root ?? null;
  // A Document is prepared for its PDF and a Canvas for its image: what they can't show that the HTML can.
  const paged = root?.type === "Document" ? pagedSupport(root, "pdf") : root?.type === "Canvas" ? pagedSupport(root, "image") : [];
  return { root, diagnostics: [...diagnostics, ...prepared.diagnostics, ...paged], layout: LAYOUT_VERSION };
}

export type { RenderOptions, RenderResult, ResolvedNode };
