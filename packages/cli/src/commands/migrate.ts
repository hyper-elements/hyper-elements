/**
 * `migrate …`: @hyper-elements/migrate, with the arguments given, unchanged, and its exit code. The project's, where
 * the current folder resolves one (its bin, run with Node: migrate's module hooks need it), else
 * `npx @hyper-elements/migrate`, which asks before it downloads.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { constants } from "node:os";
import { dirname, join } from "node:path";

const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

/** The signals passed on to migrate (SIGHUP: the terminal closed). */
const SIGNALS: NodeJS.Signals[] = process.platform === "win32" ? ["SIGINT", "SIGTERM"] : ["SIGINT", "SIGTERM", "SIGHUP"];

/** The project's migrate bin: `node_modules/@hyper-elements/migrate` in the current folder or one above it. */
export function projectMigrate(cwd: string): string | undefined {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const manifest = join(dir, "node_modules", "@hyper-elements", "migrate", "package.json");
    if (existsSync(manifest)) {
      try {
        const bin = (JSON.parse(readFileSync(manifest, "utf8")) as { bin?: string | Record<string, string> }).bin;
        const path = typeof bin === "string" ? bin : (bin?.["hyper-elements-migrate"] ?? Object.values(bin ?? {})[0]);
        if (path && existsSync(join(dirname(manifest), path))) return join(dirname(manifest), path);
      } catch {
        // not one that reads: keep looking
      }
    }
    if (dirname(dir) === dir) return undefined;
  }
}

export function runMigrate(argv: string[], cwd: string, stderr: (text: string) => void): Promise<number> {
  const bin = projectMigrate(cwd);
  const windows = process.platform === "win32";
  // Migrate runs on Node (it registers module hooks, which Bun doesn't run): under Bun, the `node` on PATH.
  const [command, args] = bin ? [bun ? "node" : process.execPath, [bin, ...argv]] : [windows ? "npx.cmd" : "npx", ["@hyper-elements/migrate", ...argv]];
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: windows && !bin });
    // A stop signal sent to this process (a CI timeout, an agent's harness) is passed on: migrate cleans up and ends,
    // and this process ends with its exit code. (Ctrl-C in a terminal reaches both: migrate stops on the first.)
    const forward = (signal: NodeJS.Signals) => {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    };
    for (const signal of SIGNALS) process.on(signal, forward);
    child.once("close", () => {
      for (const signal of SIGNALS) process.off(signal, forward);
    });
    child.on("error", (error) => {
      stderr(`hyper-elements: couldn't run ${bin ? `${command} ${bin}` : "npx @hyper-elements/migrate"}: ${error.message}\n`);
      resolve(2);
    });
    child.on("close", (code, signal) => resolve(code ?? (signal ? 128 + (constants.signals[signal] ?? 0) : 2)));
  });
}
