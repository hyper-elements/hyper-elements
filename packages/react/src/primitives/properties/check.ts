/**
 * `checkValue()`: whether what a field holds is a value its prop takes, as an editing app checks what its user typed
 * before it keeps it. Data, as the helpers are: it imports only the engine, so every editing app checks a field the
 * same way, with the same words.
 */
import type { Json, PropSpec } from "@hyper-elements/core";

/** What a field holds, checked: the prop's value (none, where the field is empty), or why the prop doesn't take it. */
export type CheckedValue = { readonly ok: true; readonly value: Json | undefined } | { readonly ok: false; readonly message: string };

/** Whether a prop lists the empty text among the values it may be (`prop.choice(["", "urgent"])`): there it's a value. */
export const listsEmpty = (spec: PropSpec): boolean => ((spec.kind.jsonSchema() as { enum?: unknown[] }).enum ?? []).includes("");

/** A number as it's written in decimal, with an exponent maybe: what a number's field holds. */
export const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

/**
 * Checks what a field holds (`held`, as its user left it) against the prop it edits (`spec`, an element's
 * `definition.props.price`): `{ ok: true, value }` with the prop's value to keep, or `{ ok: false, message }` with why it isn't
 * one (`"expected a number from 0, not -5"`), to show at the field while its user is still at it, keeping the value
 * the field had. An empty field is the prop not given, which one its element needs isn't, unless the empty text is
 * one of the values its prop lists. A number's field holds
 * its digits as text, which are the number when they're one as it's written in decimal ("12.5", "-3", "1e3"; not
 * "0x10"). A number that isn't one (`NaN`, as `Number("1e")` gives) isn't a number.
 *
 *     checkValue(Product.definition.props.price, "-5") // { ok: false, message: "expected a number from 0, not -5" }
 */
export function checkValue(spec: PropSpec, held: unknown): CheckedValue {
  if (held === undefined || held === null || (held === "" && !listsEmpty(spec))) return spec.required ? { ok: false, message: "is needed" } : { ok: true, value: undefined };
  if (typeof held === "number" && !Number.isFinite(held)) return { ok: false, message: "isn't a number" };
  const given = spec.kind.editor === "number" && typeof held === "string" && DECIMAL.test(held.trim()) ? Number(held) : held;
  const parsed = spec.kind.parse(given);
  return parsed.ok ? { ok: true, value: parsed.value as Json } : { ok: false, message: parsed.message };
}
