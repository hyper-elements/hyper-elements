/**
 * A value a message quotes (an alt, words, an href, a lang): a JSON string, cut to 80 characters, with every control,
 * format and line or paragraph separator character escaped, so what an author typed can't reach a terminal raw or
 * turn a message around.
 */
const MAX = 80;
// C0 and C1 controls, DEL, the line and paragraph separators, and the bidirectional controls.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;

export function quote(value: string): string {
  const chars = [...value];
  const cut = chars.length > MAX ? `${chars.slice(0, MAX - 1).join("")}…` : value;
  return JSON.stringify(cut).replace(UNSAFE, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
