/**
 * `describe`, `inspect` and `migrate`: describe's --json is describeElements()'s (or describeElement()'s) result as
 * it is, from the project's Elements (one from before those names is given in the same shape); inspect's --json holds inspect()'s; migrate runs the project's migrate (else
 * npx's) with the arguments unchanged, and exits with its code.
 */
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { describeElement, describeElements, inspect } from "../../react/src/inspect/index";
import { alive, BIN, cli, cliEnv, email, lines, project, REPO, RUNTIME, until, WINDOWS } from "./helpers";

describe("describe", () => {
  it("--json is describeElements()'s result as it is, with its own version, and no summary", async () => {
    const dir = project({});
    const ran = await cli(dir, ["describe", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)).toEqual([JSON.parse(JSON.stringify(describeElements()))]);
    expect(lines(ran)[0].version).toBe(2);
  });

  it("gives an Elements from before describeElements() in the same shape: its list as `elements`", async () => {
    // Its /inspect has describeComponents() and describeComponent() alone, as 0.4.5's does.
    const dir = project({}, { modules: ["react", "react-dom"] });
    const own = join(dir, "node_modules", "@hyper-elements", "react");
    mkdirSync(own, { recursive: true });
    const real = join(REPO, "packages", "react");
    const { version } = JSON.parse(readFileSync(join(real, "package.json"), "utf8")) as { version: string };
    writeFileSync(join(own, "package.json"), JSON.stringify({ name: "@hyper-elements/react", version, type: "module", exports: { ".": "./index.js", "./inspect": "./inspect.js", "./package.json": "./package.json" } }));
    writeFileSync(join(own, "index.js"), "export {};\n");
    const built = pathToFileURL(join(real, "dist", "inspect.js")).href;
    writeFileSync(join(own, "inspect.js"), `export { describeComponents, describeComponent, inspect } from ${JSON.stringify(built)};\n`);
    const ran = await cli(dir, ["describe", "--root", "Email", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)).toEqual([JSON.parse(JSON.stringify(describeElements({ root: "Email" })))]);
    expect(Object.keys(lines(ran)[0])).toEqual(Object.keys(describeElements({ root: "Email" })));
    const button = await cli(dir, ["describe", "Button", "--json"]);
    expect(lines(button)).toEqual([JSON.parse(JSON.stringify(describeElement("Button")))]);
    const text = await cli(dir, ["describe", "--root", "Email"]);
    expect(text.stdout).toMatch(/^Roots: Email\n\n(.|\n)*Button \(/);
  });

  it("--root narrows it, and an element is describeElement()'s", async () => {
    const dir = project({});
    const email = await cli(dir, ["describe", "--root", "Email", "--json"]);
    expect(lines(email)).toEqual([JSON.parse(JSON.stringify(describeElements({ root: "Email" })))]);
    const button = await cli(dir, ["describe", "Button", "--root", "Email", "--json"]);
    expect(button.code, button.stderr).toBe(0);
    expect(lines(button)).toEqual([JSON.parse(JSON.stringify(describeElement("Button", { root: "Email" })))]);
    const text = await cli(dir, ["describe", "Button"]);
    expect(text.code).toBe(0);
    expect(text.stdout).toMatch(/^Button \(.*Email.*\): /);
    expect(text.stdout).toContain("href (link, required)");
    const all = await cli(dir, ["describe", "--root", "Email"]);
    expect(all.stdout).toMatch(/^Roots: Email\n/);
  });

  it("exits 2 for an element or a root there isn't, and where no Elements resolves", async () => {
    const dir = project({});
    const unknown = await cli(dir, ["describe", "Carousel", "--json"]);
    expect(unknown.code).toBe(2);
    expect(unknown.stdout).toBe("");
    expect(unknown.stderr).toMatch(/no element "Carousel"/);
    const root = await cli(dir, ["describe", "--root", "Slide"]);
    expect(root.code).toBe(2);
    expect(root.stderr).toMatch(/--root takes Email, Page, Document, Canvas/);
    const none = project({}, { modules: [] });
    const missing = await cli(none, ["describe", "--json"]);
    expect(missing.code).toBe(2);
    expect(missing.stdout).toBe("");
    expect(missing.stderr).toContain("cli/elements-missing");
  });

  it("loads Elements through a loader module in the current folder, and leaves none", async () => {
    const dir = project({}, { packageJson: { name: "fixture", type: "commonjs" } });
    const ran = await cli(dir, ["describe", "Text", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)[0].type).toBe("Text");
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(dir).filter((name) => name.startsWith(".hyper-elements-"))).toEqual([]);
  });
});

describe("inspect", () => {
  it("--json: one line per template with inspect()'s result as it is, then the summary", async () => {
    const bad = `import { Email, Text } from "@hyper-elements/react";\nexport default function T() { return <Email><Text style={{ color: 12 as any }}>Hi</Text></Email>; }\n`;
    const dir = project({ "emails/a.tsx": email("Hello"), "emails/b.tsx": bad });
    const ran = await cli(dir, ["inspect", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(1);
    const [a, b, summary] = lines(ran);
    const { Email, Text } = await import("../../react/src/primitives/index");
    const expected = inspect(createElement(Email, null, createElement(Text, null, "Hello")));
    expect(a).toEqual({ version: 1, command: "inspect", file: "emails/a.tsx", status: "ok", inspection: JSON.parse(JSON.stringify(expected)) });
    expect(b).toMatchObject({ version: 1, command: "inspect", file: "emails/b.tsx", status: "error", inspection: { valid: false, root: "Email" } });
    expect(Object.keys(b).sort()).toEqual(["command", "file", "inspection", "status", "version"]);
    expect(summary).toMatchObject({ version: 1, summary: { templates: 2, errors: 1 }, exitCode: 1 });
  });

  it("a template that doesn't load has no inspection, and says why", async () => {
    const dir = project({ "emails/a.tsx": `import "./missing";\nexport default function T() { return null; }\n` });
    const ran = await cli(dir, ["inspect", "emails/a.tsx", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran)[0]).toMatchObject({ command: "inspect", status: "error", inspection: null, error: "Cannot find module './missing'" });
  });

  it("text lists each element at its path", async () => {
    const dir = project({ "emails/a.tsx": email("Hello") });
    const ran = await cli(dir, ["inspect", "emails/a.tsx"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(ran.stdout).toContain("✓ emails/a.tsx (Email)\n  root Email\n  root.children[0] Text");
  });
});

/** A migrate package of a project's own: its bin prints the arguments it got and exits with the code it's given. */
const FAKE_MIGRATE = `#!/usr/bin/env node
process.stdout.write(JSON.stringify({ migrate: process.argv.slice(2) }) + "\\n");
process.exit(Number(process.env.FAKE_MIGRATE_EXIT ?? 0));
`;

describe("migrate", () => {
  it("runs the project's @hyper-elements/migrate with the arguments unchanged, and exits with its code", async () => {
    const dir = project({
      "node_modules/@hyper-elements/migrate/package.json": JSON.stringify({ name: "@hyper-elements/migrate", version: "0.0.0", bin: { "hyper-elements-migrate": "./dist/bin.js" } }),
      "node_modules/@hyper-elements/migrate/dist/bin.js": FAKE_MIGRATE,
    });
    const args = ["emails/", "--out", "converted", "--json", "--help", "two words"];
    const ran = await cli(dir, ["migrate", ...args]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(JSON.parse(ran.stdout)).toEqual({ migrate: args });
    const failed = await cli(dir, ["migrate", "--strict"], { env: { FAKE_MIGRATE_EXIT: "2" } });
    expect(failed.code).toBe(2);
    expect(JSON.parse(failed.stdout)).toEqual({ migrate: ["--strict"] });
    const three = await cli(dir, ["migrate"], { env: { FAKE_MIGRATE_EXIT: "3" } });
    expect(three.code).toBe(3);
  });

  it.skipIf(WINDOWS)("passes a SIGTERM sent to the CLI on to migrate, and exits as migrate does", async () => {
    // A migrate of the test's own: it says it's running, waits, and on SIGTERM says so and ends as the signal would.
    const dir = project({
      "node_modules/@hyper-elements/migrate/package.json": JSON.stringify({ name: "@hyper-elements/migrate", version: "0.0.0", type: "commonjs", bin: { "hyper-elements-migrate": "./dist/bin.js" } }),
      "node_modules/@hyper-elements/migrate/dist/bin.js": `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
process.on("SIGTERM", () => { writeFileSync("stopped", "SIGTERM"); process.exit(143); });
writeFileSync("running", String(process.pid));
setInterval(() => {}, 1000);
`,
    });
    const run = spawn(RUNTIME === "bun" ? "bun" : process.execPath, [BIN, "migrate", "emails"], { cwd: dir, env: cliEnv(), stdio: "ignore" });
    const closed = new Promise<number | null>((resolve) => run.on("close", (code) => resolve(code)));
    expect(await until(() => existsSync(join(dir, "running")), 20_000)).toBe(true);
    const migrate = Number(readFileSync(join(dir, "running"), "utf8"));
    run.kill("SIGTERM");
    expect(await closed).toBe(143);
    expect(readFileSync(join(dir, "stopped"), "utf8")).toBe("SIGTERM");
    expect(await until(() => !alive(migrate), 2_000)).toBe(true);
  });

  it.skipIf(WINDOWS)("runs npx @hyper-elements/migrate where the project has none", async () => {
    const dir = project({});
    // An npx of the test's own on PATH: what it was asked to run.
    const bin = join(dir, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "npx"), `#!/bin/sh\necho "npx $*"\nexit 4\n`);
    chmodSync(join(bin, "npx"), 0o755);
    const ran = await cli(dir, ["migrate", "emails", "--write"], { env: { PATH: `${bin}:${process.env.PATH}` } });
    expect(ran.stdout).toBe("npx @hyper-elements/migrate emails --write\n");
    expect(ran.code).toBe(4);
  });
});
