/**
 * Preloaded into the CLI by its tests (`node --import`, `bun --preload`): writes every module the process loads to the
 * file MODULE_LOG names, one per line, so a test can say what a run never loaded. On Node, through a resolve hook (ES
 * modules) and Module._load (CommonJS); on Bun, from require.cache, which holds its ES modules too.
 */
import { appendFileSync } from "node:fs";
import Module, { register } from "node:module";

const log = process.env.MODULE_LOG;
if (typeof Bun !== "undefined") {
  process.on("exit", () => appendFileSync(log, `${Object.keys(require.cache).join("\n")}\n`));
} else {
  register(new URL("./hooks.mjs", import.meta.url), { data: { log } });
  const load = Module._load;
  Module._load = function (request, parent, isMain) {
    try {
      appendFileSync(log, `${Module._resolveFilename(request, parent, isMain)}\n`);
    } catch {
      // a built-in, or one that doesn't resolve: load() says so
    }
    return load.apply(this, arguments);
  };
}
