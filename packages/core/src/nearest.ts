/** A value in a message: a string quoted, a function named as one, anything else as JSON. */
export const show = (input: unknown): string => {
  try {
    return typeof input === "string" ? JSON.stringify(input) : typeof input === "function" ? "a function" : (JSON.stringify(input) ?? String(input));
  } catch {
    return String(input);
  }
};

/** A component's type with its article: "An Image", "A Button". */
export const a = (type: string) => `${/^[AEIOU]/.test(type) ? "An" : "A"} ${type}`;

/** The name meant, where one is a typo away (a letter or two, or its case): "colour" is "color". */
export function nearest(key: string, names: Iterable<string>): string | undefined {
  const lower = key.toLowerCase();
  let best: { name: string; distance: number } | undefined;
  for (const name of names) {
    const distance = name.toLowerCase() === lower ? 0 : editDistance(lower, name.toLowerCase());
    if (distance <= (key.length > 4 ? 2 : 1) && (!best || distance < best.distance)) best = { name, distance };
  }
  return best?.name;
}

function editDistance(from: string, to: string): number {
  let row = Array.from({ length: to.length + 1 }, (_, i) => i);
  for (let i = 1; i <= from.length; i++) {
    const next = [i];
    for (let j = 1; j <= to.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (from[i - 1] === to[j - 1] ? 0 : 1));
    row = next;
  }
  return row[to.length];
}
