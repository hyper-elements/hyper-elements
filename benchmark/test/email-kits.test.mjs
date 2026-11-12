// The email suite's Hyper Elements kits, without a model call: `he-cli` is `he` with the command line as its render
// tool, and both write the same email and give the harness the same diagnostics line.
//
//   node --test test/
//
// Needs `HYPER_ELEMENTS_PACKAGE=../packages/react node lib/setup.mjs` after `pnpm build` (the engine and the CLI).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { kitOf, makeRun } from "../lib/make-run.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = realpathSync(mkdtempSync(join(tmpdir(), "email-kits-")));
test.after(() => rm(root, { recursive: true, force: true }));
const reference = join(bench, "suites/skill/reference/event/src/template.tsx");

/** A run of the event brief with `kit`, its email `source` (a path or the text), and its render tool's two outputs. */
async function rendered(kit, source, rep) {
  const dir = await makeRun("email", kit, "event", rep, root, { isolated: true });
  mkdirSync(join(dir, "emails"), { recursive: true });
  if (source.includes("\n")) writeFileSync(join(dir, "emails/email.tsx"), source);
  else await cp(source, join(dir, "emails/email.tsx"));
  const text = spawnSync(process.execPath, ["tools/render.mjs"], { cwd: dir, encoding: "utf8", timeout: 120_000 });
  const json = spawnSync(process.execPath, ["tools/render.mjs", "--json"], { cwd: dir, encoding: "utf8", timeout: 120_000 });
  return { dir, text, json, last: JSON.parse(json.stdout.trim().split("\n").pop()) };
}

test("he-cli extends he, with its own render tool, and needs the CLI", async () => {
  const he = await kitOf("email", "he");
  const cli = await kitOf("email", "he-cli");
  assert.deepEqual(cli.sources, he.sources);
  assert.deepEqual(cli.docs, he.docs);
  assert.equal(cli.diagnostics, "tools/render.mjs");
  assert.deepEqual(cli.needs, ["@hyper-elements/cli", "tsx"]);
  assert.deepEqual(cli.dirs.map((d) => d.split("/").pop()), ["he", "he-cli"]);
  const dir = await makeRun("email", "he-cli", "event", 0, root, { checker: false });
  assert.match(readFileSync(join(dir, "tools/render.mjs"), "utf8"), /npx", \["--no", "hyper-elements"/);
  assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /node tools\/render\.mjs/);
});

test("he and he-cli write the same email and the same diagnostics line", async () => {
  const he = await rendered("he", reference, 1);
  const cli = await rendered("he-cli", reference, 1);
  for (const r of [he, cli]) {
    assert.equal(r.text.status, 0, r.text.stderr);
    assert.equal(r.json.status, 0, r.json.stderr);
    assert.match(r.text.stdout, /Rendered out\/email\.html/);
  }
  assert.equal(readFileSync(join(cli.dir, "out/email.html"), "utf8"), readFileSync(join(he.dir, "out/email.html"), "utf8"));
  assert.deepEqual(cli.last, he.last);
  assert.equal(cli.last.ok, true);
});

test("he-cli fails a template with errors, with the same diagnostics as he", async () => {
  const broken = `import { Email, Text } from "@hyper-elements/react";\n\nexport default function Broken() {\n  return (\n    <Email backgroundColor="#fff">\n      <Text style={{ marginBottom: 16 }}>Hi</Text>\n    </Email>\n  );\n}\n`;
  const he = await rendered("he", broken, 2);
  const cli = await rendered("he-cli", broken, 2);
  assert.equal(cli.text.status, 1);
  assert.equal(cli.json.status, 1);
  assert.match(cli.text.stderr, /error prop\/unknown at root\.props\.backgroundColor/);
  assert.deepEqual(cli.last, he.last);
  assert.deepEqual(cli.last.diagnostics.map((d) => d.code), ["prop/unknown", "style/unknown"]);
});

test("he-cli fails a module whose default export isn't a template, which the CLI skips", async () => {
  const named = `import { Email, Text } from "@hyper-elements/react";\n\nexport function Named() {\n  return <Email><Text>Hi</Text></Email>;\n}\n`;
  const cli = await rendered("he-cli", named, 3);
  assert.equal(cli.text.status, 1);
  assert.match(cli.text.stderr, /default export must be a component that renders an <Email>/);
  assert.equal(cli.last.ok, false);
  assert.deepEqual(cli.last.diagnostics.map((d) => d.code), ["cli/not-a-template"]);
});
