/**
 * What a thrown error says, in one line, the same on Node and on Bun.
 */
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

/** Whether `error` says `name` (or one of its entries) isn't installed. */
export function notFound(error: unknown, name: string): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const text = messageOf(error);
  const quoted = new RegExp(`['"]${name.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")}(/[^'"]*)?['"]`);
  return (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND" || /Cannot find (module|package)/.test(text)) && quoted.test(text);
}
