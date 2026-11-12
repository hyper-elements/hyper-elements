/**
 * The packed CLI, as a project gets it: @hyper-elements/cli and @hyper-elements/react installed from their tarballs
 * into an app of a pnpm workspace (a copy of fixture/ in the temporary folder), then `render` and `check --json` on
 * the app's templates with npx (Node) and with bunx --bun (Bun). A template says which runtime rendered it
 * (process.versions.bun is set only under Bun); plain bunx follows the bin's Node shebang, so it runs Node.
 *
 *   CLI_TARBALL=/tmp/hyper-elements-cli-0.1.0.tgz REACT_TARBALL=/tmp/hyper-elements-react-0.4.0.tgz node verify.mjs
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const cliTarball = resolve(process.env.CLI_TARBALL ?? "");
const reactTarball = resolve(process.env.REACT_TARBALL ?? "");
if (!process.env.CLI_TARBALL || !process.env.REACT_TARBALL) {
  console.error("Set CLI_TARBALL and REACT_TARBALL to the packed packages (pnpm pack).");
  process.exit(2);
}

// The packed manifest names no private package: the template loader is bundled in.
const manifest = execFileSync("tar", ["-xOzf", cliTarball, "package/package.json"], { encoding: "utf8" });
assert.doesNotMatch(manifest, /@unlayer-internal\//, "the packed CLI's package.json names a private @unlayer-internal package");
assert.equal(JSON.parse(manifest).bin["hyper-elements"], "./dist/bin.js");

const root = realpathSync(mkdtempSync(join(tmpdir(), "cli-integration-")));
const web = join(root, "apps/web");
try {
  cpSync(join(here, "fixture"), root, { recursive: true });
  const pkg = JSON.parse(readFileSync(join(web, "package.json"), "utf8"));
  pkg.dependencies["@hyper-elements/react"] = `file:${reactTarball}`;
  pkg.devDependencies = { "@hyper-elements/cli": `file:${cliTarball}` };
  writeFileSync(join(web, "package.json"), JSON.stringify(pkg, null, 2));
  execFileSync("pnpm", ["install", "--no-frozen-lockfile"], { cwd: root, stdio: "inherit" });

  /** Runs a command in the app, returning its exit code and output. */
  const run = (command, args) => {
    const env = { ...process.env };
    delete env.NODE_PATH;
    const ran = spawnSync(command, args, { cwd: web, encoding: "utf8", env });
    if (ran.error) throw ran.error;
    return { code: ran.status, stdout: ran.stdout, stderr: ran.stderr };
  };
  const text = (out, name) => readFileSync(join(web, out, `${name}.txt`), "utf8");
  const html = (out, name) => readFileSync(join(web, out, `${name}.html`), "utf8");

  const runners = [
    { name: "npx", command: "npx", prefix: ["--no-install", "hyper-elements"], runtime: "node", out: "out-npx" },
    { name: "bunx --bun", command: "bunx", prefix: ["--bun", "hyper-elements"], runtime: "bun", out: "out-bun" },
    { name: "bunx (the bin's Node shebang)", command: "bunx", prefix: ["hyper-elements"], runtime: "node", out: "out-bunx" },
  ];
  for (const runner of runners) {
    const rendered = run(runner.command, [...runner.prefix, "render", "emails", "--out", runner.out]);
    assert.equal(rendered.code, 0, `${runner.name} render: ${rendered.stdout}${rendered.stderr}`);
    assert.match(text(runner.out, "welcome"), new RegExp(`Rendered on ${runner.runtime}\\.`), `${runner.name} ran on ${runner.runtime}`);
    assert.match(html(runner.out, "launch"), /Acme is live/);

    const checked = run(runner.command, [...runner.prefix, "check", "emails", "--json"]);
    assert.equal(checked.code, 0, `${runner.name} check: ${checked.stdout}${checked.stderr}`);
    const lines = checked.stdout.trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(
      lines.slice(0, -1).map((line) => [line.file, line.root, line.status]),
      [
        ["emails/launch.tsx", "Page", "ok"],
        ["emails/welcome.tsx", "Email", "ok"],
      ],
    );
    assert.deepEqual(lines.at(-1), { version: 1, summary: { templates: 2, errors: 0, warnings: 0, skipped: 0, late: [] }, exitCode: 0 });
    console.log(`✓ ${runner.name}: render and check --json, on ${runner.runtime}`);
  }
  // The same page from both runtimes.
  assert.equal(html("out-bun", "launch"), html("out-npx", "launch"));
  console.log("✓ the packed CLI renders and checks an app's templates on Node and on Bun");
} finally {
  rmSync(root, { recursive: true, force: true });
}
