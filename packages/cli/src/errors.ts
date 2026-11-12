/**
 * What a thrown error says, in one line, the same on Node and on Bun.
 */
import { realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, sep } from "node:path";

/** An error's message (Bun's resolve errors aren't Error instances, but have one). */
export function messageOf(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : String(error);
}

/**
 * The first line of an error's message. A module that isn't found is said the way CommonJS says it, `Cannot find
 * module './missing'`, whichever runtime and module type threw it: Node's ES modules name the resolved path and the
 * importer, Bun names the importer.
 */
export function errorLine(error: unknown): string {
  const text = messageOf(error);
  const line = text.split("\n")[0];
  const missing = /^Cannot find (?:module|package) '([^']+)'(?: imported from (.+)| from '(.+)')?$/.exec(line);
  if (!missing) return line;
  let specifier = missing[1];
  const importer = missing[2] ?? missing[3];
  if (importer && isAbsolute(specifier) && isAbsolute(importer)) {
    const path = relative(dirname(importer), specifier).split(sep).join("/");
    specifier = path.startsWith("../") ? path : `./${path}`;
  }
  return `Cannot find module '${specifier}'`;
}

/**
 * What a thrown error says, in one line, with a syntax error's place and reason: tsx (esbuild) throws "Transform
 * failed with 1 error:" and puts them on the next line (`/abs/emails/a.tsx:3:33: ERROR: Unexpected closing "Emal" tag
 * …`); Bun throws a BuildMessage (or an AggregateError of them) with a `position`. Either is said as
 * `emails/a.tsx:3:34: <reason>`, its path relative to `cwd` and its column counted from 1 (esbuild's from 0), with
 * "(and N more errors)" where there are more. Any other error is its first line, as errorLine() says it.
 */
export function errorText(error: unknown, cwd: string): string {
  const built = buildMessages(error);
  if (built.length) {
    const [first] = built;
    const place = first.file ? `${shown(cwd, first.file)}${first.line ? `:${first.line}${first.column ? `:${first.column}` : ""}` : ""}: ` : "";
    return `${place}${first.text}${more(built.length - 1)}`;
  }
  const text = messageOf(error);
  const failed = /^(?:Transform|Build) failed with (\d+) errors?:\n([^\n]+)/.exec(text);
  if (failed) {
    const count = Number(failed[1]);
    const detail = /^(.*?):(\d+):(\d+): (?:ERROR|error): (.*)$/.exec(failed[2]);
    if (detail) return `${shown(cwd, detail[1])}:${detail[2]}:${Number(detail[3]) + 1}: ${detail[4]}${more(count - 1)}`;
    return `${failed[2].replace(/^(?:ERROR|error): /, "")}${more(count - 1)}`;
  }
  return errorLine(error);
}

const more = (n: number) => (n > 0 ? ` (and ${n} more error${n === 1 ? "" : "s"})` : "");

/** Bun's build errors: a BuildMessage with a position, or an AggregateError of them. */
function buildMessages(error: unknown): Array<{ text: string; file?: string; line?: number; column?: number }> {
  const one = (value: unknown) => {
    const e = value as { name?: unknown; message?: unknown; position?: { file?: unknown; line?: unknown; column?: unknown } | null } | null;
    if (!e || e.name !== "BuildMessage" || typeof e.message !== "string") return null;
    const p = e.position ?? undefined;
    return {
      text: e.message.split("\n")[0],
      file: typeof p?.file === "string" && p.file ? p.file : undefined,
      line: typeof p?.line === "number" && p.line > 0 ? p.line : undefined,
      column: typeof p?.column === "number" && p.column > 0 ? p.column : undefined,
    };
  };
  const errors = (error as { errors?: unknown } | null)?.errors;
  const list = Array.isArray(errors) ? errors.map(one) : [one(error)];
  return list.every((m) => m !== null) ? (list as Array<NonNullable<ReturnType<typeof one>>>) : [];
}

/** A file as the run names it: relative to its folder (or to that folder's real path), else as it is. */
function shown(cwd: string, file: string): string {
  const candidates = [cwd];
  try {
    candidates.push(realpathSync(cwd));
  } catch {
    // (the folder as given)
  }
  for (const base of candidates) {
    const path = relative(base, file);
    if (path && !path.startsWith("..") && !isAbsolute(path)) return path.split(sep).join("/");
  }
  return file;
}

/** Whether `error` says `name` (or one of its entries) isn't installed. */
export function notFound(error: unknown, name: string): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const text = messageOf(error);
  const quoted = new RegExp(`['"]${name.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")}(/[^'"]*)?['"]`);
  return (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND" || /Cannot find (module|package)/.test(text)) && quoted.test(text);
}
