/** The options `lint()` and `lintHtml()` take, checked when they're called: a mistake throws a `TypeError` there. */
import { ruleById, rules, type RuleSetting } from "./rules";

export interface LintOptions {
  /** A rule's severity, or `off`, by its id: `{ "text-size": "off", contrast: "info" }`. */
  rules?: Readonly<Record<string, RuleSetting>>;
  /** What the email is: `marketing` turns on `unsubscribe`. */
  kind?: "marketing" | "transactional";
}

/** Each rule's severity under the options, `off` for one that doesn't run. */
export type Settings = ReadonlyMap<string, RuleSetting>;

const SETTINGS: readonly string[] = ["off", "info", "warning"];
const KINDS: readonly string[] = ["marketing", "transactional"];
const show = (v: unknown): string => {
  if (v === null) return "null";
  if (Array.isArray(v)) return "an array";
  if (typeof v === "string") return JSON.stringify(v.length > 40 ? `${v.slice(0, 40)}…` : v);
  return typeof v;
};

/** The settings the options give, or a TypeError naming what's wrong. */
export function settingsOf(options: unknown, caller: string): { settings: Settings; kind: LintOptions["kind"] } {
  if (options !== undefined && (options === null || typeof options !== "object" || Array.isArray(options))) {
    throw new TypeError(`[lint] ${caller} takes an options object ({ rules, kind }), not ${show(options)}`);
  }
  const o = (options ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(o)) if (key !== "rules" && key !== "kind") throw new TypeError(`[lint] ${caller} has no option ${JSON.stringify(key)}: it takes rules and kind`);
  if (o.kind !== undefined && !KINDS.includes(o.kind as string)) throw new TypeError(`[lint] kind is "marketing" or "transactional", not ${show(o.kind)}`);
  const settings = new Map<string, RuleSetting>(rules.map((r) => [r.id, r.severity]));
  if (o.rules !== undefined) {
    if (o.rules === null || typeof o.rules !== "object" || Array.isArray(o.rules)) throw new TypeError(`[lint] rules takes an object of rule ids to "off", "info" or "warning", not ${show(o.rules)}`);
    for (const [id, value] of Object.entries(o.rules)) {
      if (!ruleById(id)) throw new TypeError(`[lint] There's no rule ${JSON.stringify(id)}: see https://www.hyperelements.dev/docs/lint for the rules`);
      if (!SETTINGS.includes(value as string)) throw new TypeError(`[lint] The rule "${id}" takes "off", "info" or "warning", not ${show(value)}`);
      settings.set(id, value as RuleSetting);
    }
  }
  return { settings, kind: o.kind as LintOptions["kind"] };
}
