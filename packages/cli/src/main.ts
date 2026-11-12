/**
 * The `hyper-elements` command, once bin.ts has checked the runtime: parse the arguments, run, exit with the run's
 * code once stdout is flushed.
 */
import { createRequire } from "node:module";
import { parseArgs, UsageError, USAGE } from "./args";
import { runDescribe } from "./commands/describe";
import { runDev } from "./commands/dev";
import { runMigrate } from "./commands/migrate";
import { onInterrupt, run, type Io, type RunState } from "./run";

function version(): string {
  return (createRequire(import.meta.url)("../package.json") as { version: string }).version;
}

const write = (stream: NodeJS.WriteStream, data: string | Uint8Array) => new Promise<void>((resolve) => (data.length ? stream.write(data, () => resolve()) : resolve()));

export async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    await write(process.stdout, USAGE);
    return argv.length === 0 ? 2 : 0;
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    await write(process.stdout, `${version()}\n`);
    return 0;
  }
  if (argv[0] === "migrate") {
    // Migrate's own: its arguments, its interrupts (Ctrl-C reaches it too) and its exit code.
    const ignore = () => undefined;
    process.on("SIGINT", ignore);
    process.on("SIGTERM", ignore);
    return runMigrate(argv.slice(1), process.cwd(), (text) => void process.stderr.write(text));
  }
  const state: RunState = { folders: new Set() };
  const stop = onInterrupt(
    () => state.token,
    () => state.folders,
    // A served preview ends with Ctrl-C: that's how it's stopped, not an interrupted run.
    (code) => process.exit(state.serving ? 0 : code),
  );
  try {
    const args = parseArgs(argv);
    const io: Io = { cwd: process.cwd(), stdout: (data) => write(process.stdout, data), stderr: (text) => void process.stderr.write(text) };
    if (args.installBrowser) {
      const { installBrowser } = await import("./preview/browser.js");
      const code = await installBrowser();
      if (code !== 0) process.stderr.write(`hyper-elements: installing Playwright's Chromium failed (exit ${code})\n`);
      return code === 0 ? 0 : 2;
    }
    if (args.command === "describe") return await runDescribe(args, io, state);
    if (args.command === "dev") return await runDev(args, io, state);
    return await run(args, io, state);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`hyper-elements: ${error.message}\n`);
      if (!(error.message.includes("--help"))) process.stderr.write("Run hyper-elements --help to see the commands and options.\n");
    } else {
      process.stderr.write(`hyper-elements: the run stopped: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    }
    return 2;
  } finally {
    stop();
  }
}

const code = await main(process.argv.slice(2));
process.stdout.write("", () => process.stderr.write("", () => process.exit(code)));
