/**
 * The `hyper-elements` command, once bin.ts has checked the runtime: parse the arguments, run, exit with the run's
 * code once stdout is flushed.
 */
import { createRequire } from "node:module";
import { parseArgs, UsageError, USAGE } from "./args";
import { onInterrupt, run, type RunState } from "./run";

function version(): string {
  return (createRequire(import.meta.url)("../package.json") as { version: string }).version;
}

const write = (stream: NodeJS.WriteStream, text: string) => new Promise<void>((resolve) => (text ? stream.write(text, () => resolve()) : resolve()));

export async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    await write(process.stdout, USAGE);
    return argv.length === 0 ? 2 : 0;
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    await write(process.stdout, `${version()}\n`);
    return 0;
  }
  const state: RunState = { folders: new Set() };
  const stop = onInterrupt(
    () => state.token,
    () => state.folders,
    (code) => process.exit(code),
  );
  try {
    const args = parseArgs(argv);
    return await run(args, { cwd: process.cwd(), stdout: (text) => write(process.stdout, text), stderr: (text) => void process.stderr.write(text) }, state);
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
