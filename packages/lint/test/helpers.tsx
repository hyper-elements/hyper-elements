import type { ReactElement } from "react";
import { render, validate, type Diagnostic, type PluginNode } from "@hyper-elements/react";
import { lint, type LintOptions } from "../src/index";
import { readTree, type Info, type Tree } from "../src/tree";

/** The laid-out tree a plugin is handed for a template. */
export function treeOf(template: ReactElement): PluginNode {
  let root: PluginNode | undefined;
  validate(template, { plugins: [{ name: "grab", api: 1, check: (input) => ((root = input.root), []) }] });
  if (!root) throw new Error("the template didn't validate far enough to be laid out");
  return root;
}

export function read(template: ReactElement): Tree {
  return readTree(treeOf(template))!;
}

/** The node that owns a run of text, by the run's first words. */
export function run(tree: Tree, words: string): Info {
  const found = tree.nodes.find((info) => info.node.children.some((c) => typeof c === "string" && c.trim() === words));
  if (!found) throw new Error(`no run ${JSON.stringify(words)}`);
  return found;
}

/** Lint's diagnostics on a template, through validate(). */
export function linted(template: ReactElement, options?: LintOptions): Diagnostic[] {
  return validate(template, { plugins: [lint(options)] }).diagnostics.filter((d) => /\/lint-/.test(d.code));
}

/** Lint's diagnostics on a template, through render(). */
export async function rendered(template: ReactElement, options?: LintOptions): Promise<{ html: string; diagnostics: Diagnostic[] }> {
  const { html, diagnostics } = await render(template, { plugins: [lint(options)] });
  return { html, diagnostics: diagnostics.filter((d) => /\/lint-/.test(d.code)) };
}

/** Codes, for short expectations. */
export const codes = (diagnostics: readonly Diagnostic[]) => diagnostics.map((d) => d.code);
