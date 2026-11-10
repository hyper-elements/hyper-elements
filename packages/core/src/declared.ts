/**
 * The diagnostics a style's, a prop's or a condition's support declaration gives for a value: what an output shows
 * otherwise than asked. Shared by the support pass over the laid-out tree (writers/shared/support.ts) and expansion's
 * check of what a condition takes but an output doesn't show (expand.ts).
 */
import { Diagnostics, type Severity } from "./diagnostics";
import type { Json } from "./model";
import type { Support, SupportByTarget, Target } from "./define";

const same = (a: Json | undefined, b: Json | undefined) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The diagnostics a declaration gives for a value at `at` (`key` names it in the message), on this node: nothing where
 * it's shown as asked.
 */
export function reportDeclared(
  d: Diagnostics,
  node: { type: string; id?: string; props: Record<string, Json> },
  at: string,
  key: string,
  value: Json,
  declared: SupportByTarget[Target] | undefined,
  target: Target
): void {
  if (!declared) return;
  for (const rule of ([] as Support[]).concat(declared)) {
    if (rule.level === "full") continue;
    if (rule.values && !rule.values.some((v) => same(v, value))) continue;
    if (rule.when && !rule.when(value, node)) continue;
    const asked = typeof value === "string" ? `${key}: "${value}"` : key;
    const output = target === "web" ? "a page" : target;
    const [code, severity, message]: [string, Severity, string] =
      rule.level === "none" ? [`${target}/unsupported`, "warning", `${asked} isn't possible in ${output}: ${rule.shows}`] : [`${target}/degraded`, "info", `${asked} on this ${node.type} in ${output}: ${rule.shows}`];
    // What Elements assumes, unchecked, is a note that says so.
    const [said, as] = rule.source === "assumed" ? (["info", `${message} (not checked)`] as const) : [severity, message];
    d.add(code, said, as, at, node.id, { fix: rule.fix });
  }
}
