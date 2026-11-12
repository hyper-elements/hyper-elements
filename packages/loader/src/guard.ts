/**
 * Running a template's code: it can't end the process, and what it throws later is kept.
 */
import { syncBuiltinESMExports } from "node:module";

export interface Guard {
  /** The real `process.exit`, to end the run with. */
  exit: (code?: number) => never;
  /**
   * What template code threw outside anything that waited for it (a timer, a promise nobody awaited): each message's
   * first line, once each, in the order thrown.
   */
  late(): string[];
}

/**
 * Guards the process from the template code it runs: `process.exit` (and `import { exit } from "node:process"`)
 * throws instead, so a template that calls it fails rather than ending the run with its code, and what template code
 * throws outside a render (from a timer, or a promise it doesn't wait for) is collected instead of crashing the
 * process. The caller decides when to report what was collected.
 */
export function guard(): Guard {
  const exit = process.exit.bind(process) as (code?: number) => never;
  process.exit = ((code?: number | string | null) => {
    throw new Error(`a template called process.exit(${code ?? ""})`);
  }) as typeof process.exit;
  // `import { exit } from "node:process"` too.
  syncBuiltinESMExports();
  const thrown = new Set<string>();
  const late = (error: unknown) => void thrown.add((error instanceof Error ? error.message : String(error)).split("\n")[0]);
  process.on("uncaughtException", late);
  process.on("unhandledRejection", late);
  return { exit, late: () => [...thrown] };
}
