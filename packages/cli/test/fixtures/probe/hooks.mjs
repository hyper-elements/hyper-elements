/** modules.mjs's resolve hook (Node): each module the process resolves, written to the log. */
import { appendFileSync } from "node:fs";

let log;

export function initialize(data) {
  log = data.log;
}

export async function resolve(specifier, context, next) {
  const resolved = await next(specifier, context);
  appendFileSync(log, `${resolved.url}\n`);
  return resolved;
}
