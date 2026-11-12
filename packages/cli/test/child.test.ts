/**
 * Templates run in child processes: what they write never reaches stdout, a crash or a hang fails what it should,
 * and every process in a child's group ends with it, however it ends (even when the CLI itself is killed).
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alive, BIN, cli, cliEnv, email, lines, ON_BUN, project, until, wait } from "./helpers";

/** Template code that starts a process (not detached) writing `marker` after `ms`. */
function startsProcess(marker: string, ms: number): string {
  const script = `setTimeout(() => require("fs").writeFileSync(${JSON.stringify(marker)}, "written"), ${ms})`;
  return `import { spawn } from "node:child_process";
spawn(process.execPath, ["-e", ${JSON.stringify(script)}], { stdio: "ignore" });
`;
}

/** Template code that runs `code` once the child has sent its first result to the parent. */
function afterResult(code: string): string {
  return `const send = process.send!.bind(process);
(process as any).send = (message: any, ...rest: any[]) => {
  const sent = send(message, ...rest);
  if (message?.type === "result") setImmediate(() => { ${code} });
  return sent;
};
`;
}

describe("what templates write", () => {
  it("never reaches stdout: fs.writeSync(1, …), console.log and a process the template starts", async () => {
    const dir = project({
      "emails/a.tsx": email(
        "A",
        `import { writeSync } from "node:fs";
import { spawnSync } from "node:child_process";
writeSync(1, "written to fd 1\\n");
process.stdout.write("written to process.stdout\\n");
spawnSync(process.execPath, ["-e", "console.log('from a grandchild')"], { stdio: "inherit" });`,
      ),
    });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(0);
    expect(lines(ran).map((l) => Object.keys(l)[0])).toEqual(["version", "version"]);
    for (const text of ["written to fd 1", "written to process.stdout", "from a grandchild"]) {
      expect(ran.stdout).not.toContain(text);
      expect(ran.stderr).toContain(text);
    }
  });
});

describe("a child that doesn't finish", () => {
  it("past --timeout fails its unfinished templates with cli/timeout", async () => {
    const dir = project({
      "emails/a.tsx": email("A"),
      "emails/b.tsx": `import { Email } from "@hyper-elements/react";\nexport default function B() { for (;;) {} return <Email />; }\n`,
    });
    const started = Date.now();
    const ran = await cli(dir, ["check", "emails", "--json", "--timeout", "2"]);
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(ran.code).toBe(1);
    const got = lines(ran);
    expect(got[0]).toMatchObject({ file: "emails/a.tsx", status: "ok" });
    expect(got[1]).toMatchObject({ file: "emails/b.tsx", status: "error", root: null, diagnostics: [{ code: "cli/timeout", severity: "error", path: "" }] });
    expect(got[1].error).toBeUndefined();
    expect(got[2].summary.late).toEqual([]);
  });

  it("a crash just after the last result is a late failure: exit 2", async () => {
    const dir = project({ "emails/a.tsx": email("A", afterResult("(process as any).reallyExit(4);")) });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    const got = lines(ran);
    expect(got[0]).toMatchObject({ status: "ok" });
    expect(got[1].summary.late).toEqual([{ kind: "child", group: { package: ".", tsconfig: null }, reason: "exit", detail: "exit 4" }]);
    expect(got[1].exitCode).toBe(2);
    expect(ran.code).toBe(2);
  });

  it("a hang just after the last result is a late failure: exit 2", async () => {
    const dir = project({ "emails/a.tsx": email("A", afterResult("for (;;) {}")) });
    const ran = await cli(dir, ["check", "emails", "--json", "--timeout", "2"]);
    const got = lines(ran);
    expect(got[0]).toMatchObject({ status: "ok" });
    expect(got[1].summary.late).toEqual([{ kind: "child", group: { package: ".", tsconfig: null }, reason: "timeout", detail: "2000 ms" }]);
    expect(ran.code).toBe(2);
  });
});

describe("a template that never finishes", () => {
  it("fails alone, whatever the order: the templates after it in its group run in a new child", async () => {
    const dir = project({
      "broken/loop.tsx": `for (;;) {}\nexport default function Loop() { return null; }\n`,
      "emails/a.tsx": email("A"),
      "emails/b.tsx": email("B"),
    });
    for (const order of [["broken/loop.tsx", "emails"], ["emails", "broken/loop.tsx"]]) {
      const ran = await cli(dir, ["check", ...order, "--timeout", "2", "--json"], { timeout: 60_000 });
      expect(ran.code, order.join(" ")).toBe(1);
      const results = Object.fromEntries(lines(ran).slice(0, -1).map((l) => [l.file, `${l.status}${l.diagnostics.some((d: any) => d.code === "cli/timeout") ? " cli/timeout" : ""}`]));
      expect(results, order.join(" ")).toEqual({ "broken/loop.tsx": "error cli/timeout", "emails/a.tsx": "ok", "emails/b.tsx": "ok" });
    }
  });
});

describe("the process tree", () => {
  it("a process a template starts doesn't write after the child is done", async () => {
    const dir = project({});
    const marker = join(dir, "late-write");
    const { write } = await import("./helpers");
    write(dir, { "emails/a.tsx": email("A", startsProcess(marker, 1500)) });
    const ran = await cli(dir, ["render", "emails"]);
    expect(ran.code).toBe(0);
    await wait(2500);
    expect(existsSync(marker)).toBe(false);
  });

  it("a child that crashes while a process it started runs: the run ends and reports it, and the process is ended first", async () => {
    const dir = project({});
    const pids = join(dir, "pids.json");
    const { write } = await import("./helpers");
    // (On Windows the child's gone before the run ends what it started: they're found in the process table.)
    write(dir, {
      "emails/a.tsx": `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const started = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
writeFileSync(${JSON.stringify(pids)}, JSON.stringify({ started: started.pid }));
(process as any).reallyExit(3);
export default function A() { return null; }
`,
    });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran)[0]).toMatchObject({ status: "error", error: "child exited with 3" });
    const { started } = JSON.parse(readFileSync(pids, "utf8"));
    expect(await until(() => !alive(started), 1_000)).toBe(true);
  });

  it("the CLI killed with SIGKILL while a template blocks its child: the watchdog ends the child and its processes", async () => {
    const dir = project({});
    const pids = join(dir, "pids.json");
    const { write } = await import("./helpers");
    write(dir, {
      "emails/a.tsx": `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
writeFileSync(${JSON.stringify(pids)}, JSON.stringify({ child: process.pid, grandchild: grandchild.pid }));
for (;;) {}
export default function A() { return null; }
`,
    });
    const parent = spawn(ON_BUN ? "bun" : process.execPath, [BIN, "check", "emails"], { cwd: dir, env: cliEnv(), stdio: "ignore" });
    expect(await until(() => existsSync(pids), 20_000)).toBe(true);
    await wait(200);
    const { child, grandchild } = JSON.parse(readFileSync(pids, "utf8"));
    expect(alive(child)).toBe(true);
    parent.kill("SIGKILL");
    // Within a second of the watchdog's next check.
    expect(await until(() => !alive(child) && !alive(grandchild), 2_000)).toBe(true);
  });
});
