/**
 * What an output can't do as a template asks, from the components'
 * definitions: each style and prop says, for each output it renders to, how
 * that output shows it (`support`), and so does each condition (conditions.ts)
 * and each style inside one. One pass reads it for every output, for what the
 * author set (not a component's own defaults): `none` is a warning
 * (`<output>/unsupported`), `partial` a note (`<output>/degraded`), `outlook`
 * a note (`email/outlook-degraded`). Each output adds what no single style or
 * prop says (email: `email/support.ts`).
 */
import { blockOf, CONDITIONS, shownAnywhere } from "../../conditions";
import { Diagnostics, type Diagnostic } from "../../diagnostics";
import type { Json } from "../../model";
import type { ResolvedNode } from "../../resolve";
import type { Target } from "../../define";
import { reportDeclared } from "../../declared";

const isNode = (child: ResolvedNode | string): child is ResolvedNode => typeof child !== "string";
const same = (a: Json | undefined, b: Json | undefined) => JSON.stringify(a) === JSON.stringify(b);

export function support(root: ResolvedNode, target: Target): Diagnostic[] {
  const d = new Diagnostics();
  const visit = (node: ResolvedNode) => {
    const { definition } = node;
    const byProp = definition.defaultStyleBy ? (definition.defaultStyleBy.values[String(node.props[definition.defaultStyleBy.prop])] as Record<string, Json> | undefined) : undefined;
    for (const [key, value] of Object.entries(node.style)) {
      const fallback = byProp?.[key] ?? (definition.defaultStyle as Record<string, Json> | undefined)?.[key];
      if (same(value, fallback)) continue;
      reportDeclared(d, node, `${node.path}.style.${key}`, key, value, definition.style[key]?.support?.[target], target);
    }
    for (const [key, value] of Object.entries(node.props)) {
      if (same(value, definition.props[key]?.default as Json | undefined)) continue;
      reportDeclared(d, node, `${node.path}.props.${key}`, key, value, definition.props[key]?.support?.[target], target);
    }
    for (const condition of CONDITIONS) {
      const block = blockOf(node, condition);
      if (!block || (condition.hiddenKey && node.hidden?.[condition.hiddenKey])) continue;
      const own = condition.support[target];
      // The block itself, once: what this output does with it.
      reportDeclared(d, node, `${node.path}.${condition.name}`, condition.name, block, own, target);
      // Where it doesn't apply at all, what's in it doesn't either.
      if (!own || own.level === "none") continue;
      for (const [key, value] of Object.entries(block)) {
        const rules = condition.styles?.[key]?.[target] ?? definition.style[key]?.support?.[target];
        reportDeclared(d, node, `${node.path}.${condition.name}.${key}`, key, value, rules, target, condition.outlookApplies);
      }
    }
    for (const child of node.children) if (isNode(child) && shownAnywhere(child)) visit(child);
  };
  visit(root);
  return d.list;
}
