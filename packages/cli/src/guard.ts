/**
 * The load guard, installed by a template child before anything else it loads (Decision 31): every module the runtime
 * resolves (a static import, a dynamic `import()`, a `require()`) is checked at the file it will load, after tsx's and
 * the runtime's own resolution, and refused before it runs unless `guard-rules.ts` allows it.
 *
 * - Node with `module.registerHooks()` (22.15 and later): one in-thread hook, which sees `require()` too.
 * - Node before it: an ES module hook on the hooks thread (`module.register()`, `guard-hooks.ts`), registered after
 *   tsx's, and a wrapper over CommonJS resolution (`Module._resolveFilename`).
 * - Bun: its runtime plugins don't see bare imports (a package's own resolution), so it can't guard every load; a
 *   template child that needs the guard refuses its inputs there instead of running them unguarded.
 *
 * A refusal throws where the load is, and is recorded too: a template that catches the error still fails.
 */
import { appendFileSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MessageChannel } from "node:worker_threads";
import { decide, type GuardData, type Refusal } from "./guard-rules";
import type { TrustList } from "./protocol";

export interface InstalledGuard {
  /** A loader module this child wrote, by its real path: listed before it's imported. */
  allow(path: string): void;
  /** The refusals so far. */
  refusals(): Refusal[];
}

/** The marker a refusal's message starts with, for the child to tell it from another load error. */
export const UNTRUSTED = /\[hyper-elements cli\/template-untrusted\] ([^\n]*)/;

const realOr = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** The CLI's own package and its dependencies' folders (by real path: a workspace link leads outside node_modules). */
function cliFolders(cliFolder: string): string[] {
  const root = dirname(realOr(cliFolder));
  const out = [root];
  const require = createRequire(join(root, "package.json"));
  let manifest: { dependencies?: Record<string, string> } = {};
  try {
    manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch {
    // only the CLI's own folder, then
  }
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    try {
      out.push(realOr(dirname(require.resolve(`${name}/package.json`))));
    } catch {
      // not exported or not there: what it loads is checked as any file is
    }
  }
  return out;
}

export async function installGuard(list: TrustList, files: { allowFile: string; refusals: string }, cliFolder: string): Promise<InstalledGuard | "unsupported"> {
  if (typeof (process.versions as Record<string, string | undefined>).bun === "string") return "unsupported";
  const data: GuardData = { files: list.files, folders: [...list.packages, ...cliFolders(cliFolder)], ...files };
  writeFileSync(files.allowFile, "");
  writeFileSync(files.refusals, "");
  const allowed = new Set<string>();
  const own = (path: string) => allowed.has(path);
  const importers = new Map<string, string>();
  const refused: Refusal[] = [];
  const check = (url: string, parent: string | undefined): void => {
    if (!url.startsWith("file:") && !url.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(url)) return;
    const real = realOr(url.startsWith("file:") ? fileURLToPath(url) : url);
    const from = parent ? realOr(parent.startsWith("file:") ? fileURLToPath(parent) : parent) : undefined;
    const refusal = decide(real, data, own, from, importers);
    if (refusal) {
      refused.push(refusal);
      throw new Error(refusal.message);
    }
    if (from) importers.set(real, from);
  };

  const hooks = (Module as unknown as { registerHooks?: (hooks: object) => unknown }).registerHooks;
  if (typeof hooks === "function") {
    hooks({
      resolve(specifier: string, context: { parentURL?: string }, next: (specifier: string, context: object) => { url: string }) {
        const resolved = next(specifier, context);
        check(resolved.url, context.parentURL);
        return resolved;
      },
    });
    return {
      allow: (path) => allowed.add(realOr(path)),
      refusals: () => [...refused],
    };
  }

  // The hooks thread: it reports ready once it has the list, before anything is imported through it.
  const { port1, port2 } = new MessageChannel();
  const ready = new Promise<void>((resolve) => port1.once("message", () => resolve()));
  (Module as unknown as { register(url: URL, options: object): void }).register(new URL("./guard-hooks.js", import.meta.url), { data: { ...data, port: port2 }, transferList: [port2] });
  await ready;
  port1.close();
  // CommonJS: Node 20's ES module hooks don't see require().
  const internal = Module as unknown as { _resolveFilename(request: string, parent: { filename?: string } | undefined, ...rest: unknown[]): string };
  const resolveFilename = internal._resolveFilename;
  internal._resolveFilename = function (request, parent, ...rest) {
    const file = resolveFilename.call(this, request, parent, ...rest);
    if (!Module.isBuiltin(file)) check(file, parent?.filename);
    return file;
  };
  return {
    allow: (path) => {
      const real = realOr(path);
      allowed.add(real);
      appendFileSync(files.allowFile, `${real}\n`);
    },
    refusals: () => {
      const fromThread = readFileSync(files.refusals, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Refusal);
      return [...refused, ...fromThread];
    },
  };
}
