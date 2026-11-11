// The root switch: a template's root decides its output, so switching the output rewrites the root's tag in the code
// (`<Email>` to `<Page>`), with the import that names it. Props only one root takes move out with it and come back
// when it does (`previewText` leaves with Email), and a Canvas gets a size.
import type { RootName } from "../../playground/protocol";

export const ROOTS: readonly RootName[] = ["Email", "Page", "Document", "Canvas"];

/** The props a root takes that not every root does. */
const OWN: Record<RootName, readonly string[]> = {
  Email: ["width", "previewText"],
  Page: ["width", "description", "breakpoints"],
  Document: ["size", "orientation", "margin"],
  Canvas: ["width", "height"],
};
const ALL_OWN = new Set(Object.values(OWN).flat());
const CANVAS_SIZE = { width: "width={1200}", height: "height={630}" };

/** Each root's own props as they were written, kept while another root is shown. */
export type Stash = Partial<Record<RootName, Record<string, string>>>;

const blank = (text: string) => text.replace(/[^\n]/g, " ");
/** The code with its comments and strings blanked, each character where it was: what's left is code. */
function codeOnly(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (match, offset: number) => {
    // A `//` inside a URL in JSX text isn't a comment: only after white space, a bracket or a semicolon.
    if (match.startsWith("//") && offset > 0 && !/[\s;{}()\[\],]/.test(code[offset - 1])) return match;
    return match[0] === '"' || match[0] === "'" ? match[0] + blank(match.slice(1, -1)) + match[0] : blank(match);
  });
}

const TAG = /<(\/?)(Email|Page|Document|Canvas)(?=[\s/>])/g;

/** The roots the code's JSX names, in the order they appear. */
export function rootsIn(code: string): RootName[] {
  const found: RootName[] = [];
  for (const match of codeOnly(code).matchAll(TAG)) if (!found.includes(match[2] as RootName)) found.push(match[2] as RootName);
  return found;
}

interface Attribute {
  name: string;
  start: number;
  end: number;
}

/** A root's opening tag from just after its name: its attributes, and where the tag ends. */
function attributes(code: string, from: number): { attributes: Attribute[]; end: number } | undefined {
  const found: Attribute[] = [];
  let i = from;
  const skipValue = (): boolean => {
    const quote = code[i];
    if (quote === '"' || quote === "'") {
      const close = code.indexOf(quote, i + 1);
      if (close === -1) return false;
      i = close + 1;
      return true;
    }
    if (quote !== "{") return false;
    // An expression: to its matching brace, past the strings and templates in it.
    let depth = 0;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '"' || c === "'" || c === "`") {
        for (i++; i < code.length && code[i] !== c; i++) if (code[i] === "\\") i++;
      } else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        i++;
        return true;
      }
    }
    return false;
  };
  while (i < code.length) {
    while (/\s/.test(code[i] ?? "")) i++;
    if (code[i] === ">" || (code[i] === "/" && code[i + 1] === ">")) return { attributes: found, end: i };
    const start = i;
    if (code[i] === "{") {
      // A spread: kept as it is.
      if (!skipValue()) return undefined;
      continue;
    }
    const name = /^[A-Za-z_$][\w$:.-]*/.exec(code.slice(i, i + 80))?.[0];
    if (!name) return undefined;
    i += name.length;
    let afterName = i;
    while (/\s/.test(code[afterName] ?? "")) afterName++;
    if (code[afterName] === "=") {
      i = afterName + 1;
      while (/\s/.test(code[i] ?? "")) i++;
      if (!skipValue()) return undefined;
    }
    found.push({ name, start, end: i });
  }
  return undefined;
}

export interface Switched {
  code: string;
  /** The offset of the new root's first tag, to show the change in the editor. */
  at?: number;
}

/**
 * `code` with its root's tags renamed to `to`. Unchanged where its JSX names no root, or more than one (a file that
 * exports several templates picks its own).
 */
export function switchRoot(code: string, to: RootName, stash: Stash = {}): Switched {
  const roots = rootsIn(code);
  if (roots.length !== 1 || roots[0] === to) return { code };
  const from = roots[0];
  const clean = codeOnly(code);
  const edits: Array<{ start: number; end: number; text: string }> = [];
  let at: number | undefined;
  let first = true;
  for (const match of clean.matchAll(TAG)) {
    const nameStart = match.index + 1 + match[1].length;
    const nameEnd = nameStart + match[2].length;
    edits.push({ start: nameStart, end: nameEnd, text: to });
    if (match[1] || !first) continue;
    first = false;
    at = match.index;
    // The first opening tag is the root's: its own props move out, the new root's come back.
    const parsed = attributes(code, nameEnd);
    if (!parsed) continue;
    const kept = new Set<string>();
    const stashed: Record<string, string> = {};
    for (const attribute of parsed.attributes) {
      if (!ALL_OWN.has(attribute.name)) continue;
      stashed[attribute.name] = code.slice(attribute.start, attribute.end);
      // A width means the same in an Email and a Page; a Canvas's is its own.
      const stays = OWN[to].includes(attribute.name) && from !== "Canvas" && to !== "Canvas";
      if (stays) kept.add(attribute.name);
      else {
        // Out with the white space before it, so the tag reads as if it was never there.
        let start = attribute.start;
        while (start > nameEnd && /[ \t]/.test(code[start - 1])) start--;
        if (code[start - 1] === "\n" && /^[ \t]*$/.test(code.slice(start, attribute.start))) start--;
        edits.push({ start, end: attribute.end, text: "" });
      }
    }
    stash[from] = stashed;
    const back = OWN[to].filter((name) => !kept.has(name)).flatMap((name) => stash[to]?.[name] ?? (to === "Canvas" ? CANVAS_SIZE[name as keyof typeof CANVAS_SIZE] : []) ?? []);
    if (back.length) edits.push({ start: nameEnd, end: nameEnd, text: ` ${back.join(" ")}` });
  }
  // The import that names the root.
  for (const match of clean.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'][^"']*["']/g)) {
    const list = match[1];
    const listStart = match.index + match[0].indexOf("{") + 1;
    const source = code.slice(match.index, match.index + match[0].length);
    if (!/["']@hyper-elements\/react["']/.test(source)) continue;
    const name = new RegExp(`(^|[\\s,])(${from})(?=[\\s,]|$)`).exec(list);
    if (!name) continue;
    const start = listStart + name.index + name[1].length;
    const has = new RegExp(`(^|[\\s,])${to}(?=[\\s,]|$)`).test(list);
    if (!has) edits.push({ start, end: start + from.length, text: to });
    else {
      // Already imported: the old name goes, with its comma.
      const after = /^\s*,\s*/.exec(code.slice(start + from.length))?.[0].length ?? 0;
      edits.push({ start, end: start + from.length + after, text: "" });
    }
  }
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = code;
  for (const edit of edits) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return { code: out, at };
}
