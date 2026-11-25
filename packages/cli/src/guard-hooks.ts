/**
 * The load guard's ES module hooks, for Node without `module.registerHooks()` (Node 20 and 22 before 22.15): they run on
 * Node's hooks thread, registered with `module.register()` after tsx's, so `resolve` sees the file the runtime will
 * load (tsx's and Node's resolution done). What may load is `src/guard.ts`'s `decide()`, sent here as data.
 */
import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MessagePort } from "node:worker_threads";
import { decide, type GuardData } from "./guard-rules";

let data: GuardData | undefined;
const importers = new Map<string, string>();

export async function initialize(given: GuardData & { port: MessagePort }): Promise<void> {
  const { port, ...rest } = given;
  data = rest;
  port.postMessage("ready");
  port.close();
}

interface Context {
  parentURL?: string;
}
type Next = (specifier: string, context: Context) => Promise<{ url: string }>;

export async function resolve(specifier: string, context: Context, next: Next): Promise<{ url: string }> {
  const resolved = await next(specifier, context);
  if (!data || !resolved.url.startsWith("file:")) return resolved;
  let real: string;
  try {
    real = realpathSync(fileURLToPath(resolved.url));
  } catch {
    // Not there: the runtime's own error says so.
    return resolved;
  }
  // The loader modules the child writes are listed in a file it appends to before it imports each.
  const own = (path: string) => {
    try {
      return readFileSync(data!.allowFile, "utf8").split("\n").includes(path);
    } catch {
      return false;
    }
  };
  const parent = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : undefined;
  const refusal = decide(real, data, own, parent, importers);
  if (refusal) {
    // Said to the child too: an error thrown here reaches the importer as Node's, its message intact.
    try {
      appendFileSync(data.refusals, `${JSON.stringify(refusal)}\n`);
    } catch {
      // the error itself still stops the load
    }
    throw new Error(refusal.message);
  }
  if (parent) importers.set(real, realOr(parent));
  return resolved;
}

function realOr(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
