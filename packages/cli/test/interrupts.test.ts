/**
 * Interrupts and leftovers: SIGINT and SIGTERM end the run (130, 143) with nothing of it left; what a run killed with
 * SIGKILL left, the next run removes; a template's file name can't break its loader module.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BIN, cli, cliEnv, email, leftovers, lines, ON_BUN, project, tsconfigsOf, until, wait, WINDOWS } from "./helpers";

/** A template that keeps its child busy while it loads (its loader module is there meanwhile). */
const BUSY = `import { Email, Text } from "@hyper-elements/react";
const end = Date.now() + 30_000;
while (Date.now() < end) {}
export default function Busy() { return <Email><Text>busy</Text></Email>; }
`;

function start(dir: string, args: string[]) {
  const child = spawn(ON_BUN ? "bun" : process.execPath, [BIN, ...args], { cwd: dir, env: cliEnv(), stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.on("data", (d) => (stdout += d));
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => child.on("close", (code, signal) => resolve({ code, signal })));
  return { child, closed, stdout: () => stdout };
}

describe.skipIf(WINDOWS)("interrupts", () => {
  for (const [signal, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    it(`${signal} mid-run exits ${code}, without a summary, leaving no loader module, tsconfig or temporary output`, async () => {
      const dir = project({ "emails/a.tsx": email("A"), "emails/b.tsx": BUSY });
      const run = start(dir, ["render", "emails", "--json"]);
      expect(await until(() => leftovers(dir).length > 0, 20_000)).toBe(true);
      run.child.kill(signal);
      const ended = await run.closed;
      expect(ended.code).toBe(code);
      expect(run.stdout()).toBe("");
      expect(leftovers(dir)).toEqual([]);
      expect(tsconfigsOf(run.child.pid!)).toEqual([]);
      if (existsSync(join(dir, "out"))) expect(readdirSync(join(dir, "out")).filter((n) => n.endsWith(".tmp"))).toEqual([]);
    });
  }

  it("after the CLI is killed with SIGKILL, the next run removes what it left", async () => {
    // Killed once its template blocks the child: a child that isn't blocked removes its own files when the CLI's gone.
    const dir = project({});
    const blocking = join(dir, "blocking");
    const { write } = await import("./helpers");
    write(dir, { "emails/a.tsx": `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(blocking)}, "");\n${BUSY}` });
    const run = start(dir, ["check", "emails"]);
    expect(await until(() => existsSync(blocking) && leftovers(dir).length > 0, 20_000)).toBe(true);
    run.child.kill("SIGKILL");
    await run.closed;
    // Its child is ended by its watchdog, which leaves its files.
    await wait(1500);
    // (Its tsconfig, in the temporary folder, may already be gone: any run removes those a dead run left.)
    expect(leftovers(dir).length).toBe(1);
    write(dir, { "emails/a.tsx": email("Now quick") });
    const ran = await cli(dir, ["check", "emails"]);
    expect(ran.code).toBe(0);
    expect(leftovers(dir)).toEqual([]);
    expect(tsconfigsOf(run.child.pid!)).toEqual([]);
  });

  // A backslash in an ES module's file name can't be imported on Node or Bun at all (Node refuses a file URL with
  // an encoded backslash): it's tested where the loader module names the file by its path, CommonJS on Node.
  const cases: Array<[string, string, boolean]> = [
    ["an ES module", 'we"ird\na #name%.tsx', true],
    ["a CommonJS module, on Node", 'we"ird\\na\nme.tsx', !ON_BUN],
  ];
  for (const [what, name, runs] of cases) {
    it.runIf(runs)(`loads ${what} whose file name holds a quote, a line break${name.includes("\\") ? ", a backslash" : ""} and more`, async () => {
      const dir = project({ [`emails/${name}`]: email("Odd name") }, { packageJson: { name: "fixture", type: name.includes("\\") ? "commonjs" : "module" } });
      const ran = await cli(dir, ["check", "emails", "--json"]);
      expect(ran.code, ran.stdout + ran.stderr).toBe(0);
      expect(lines(ran)[0]).toMatchObject({ file: `emails/${name}`, status: "ok", root: "Email" });
      expect(leftovers(dir)).toEqual([]);
    });
  }
});
