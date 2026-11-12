/**
 * The packed CLI, as a project gets it: @hyper-elements/cli and @hyper-elements/react installed from their tarballs
 * into an app of a pnpm workspace (a copy of fixture/ in the temporary folder), then `render` and `check --json` on
 * the app's templates with npx (Node) and with bunx --bun (Bun). A template says which runtime rendered it
 * (process.versions.bun is set only under Bun); plain bunx follows the bin's Node shebang, so it runs Node.
 *
 * Then any HTML email with nothing installed: `npx --package <the packed CLI> hyper-elements check` in a folder with no
 * node_modules, which installs the CLI and its email-clients (from npm) into npx's own cache, and no React or Elements.
 * playwright-core is an optional peer, so it isn't installed either: `preview --findings` and `--install-browser` say
 * how to install it, and exit 2.
 *
 *   CLI_TARBALL=/tmp/hyper-elements-cli-0.1.0.tgz REACT_TARBALL=/tmp/hyper-elements-react-0.4.0.tgz node verify.mjs
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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
  const text = (out, name) => readFileSync(join(web, out, "emails", `${name}.txt`), "utf8");
  const html = (out, name) => readFileSync(join(web, out, "emails", `${name}.html`), "utf8");

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

// Any HTML email, with nothing installed: a folder with no node_modules (none above it either), npx with the packed CLI
// and its own npm cache, so what it installed can be listed.
const bare = realpathSync(mkdtempSync(join(tmpdir(), "cli-integration-html-")));
try {
  const folder = join(bare, "mail");
  mkdirSync(folder);
  const email = `<!DOCTYPE html>\n<html>\n<head><style>.card { position: absolute; }</style></head>\n<body>\n<div class="card">Welcome</div>\n</body>\n</html>\n`;
  writeFileSync(join(folder, "welcome.html"), email);
  const cache = join(bare, "npm-cache");
  const env = { ...process.env, npm_config_cache: cache, npm_config_update_notifier: "false" };
  delete env.NODE_PATH;
  const npx = (args, input) => {
    const ran = spawnSync("npx", ["--yes", `--package=${cliTarball}`, "hyper-elements", ...args], { cwd: folder, encoding: "utf8", env, input });
    if (ran.error) throw ran.error;
    return { code: ran.status, stdout: ran.stdout, stderr: ran.stderr };
  };

  const checked = npx(["check", "welcome.html", "--json"]);
  assert.equal(checked.code, 0, `npx check welcome.html: ${checked.stdout}${checked.stderr}`);
  const [line, summary] = checked.stdout.trim().split("\n").map((text) => JSON.parse(text));
  assert.equal(line.file, "welcome.html");
  assert.equal(line.input, "html");
  assert.equal(line.root, null);
  assert.equal(line.status, "ok");
  assert.deepEqual(line.outputs, []);
  const position = line.diagnostics.find((d) => d.message.includes("position: absolute"));
  assert.ok(position, `no position: absolute diagnostic in ${checked.stdout}`);
  assert.equal(position.path, "html");
  assert.equal(position.line, 3);
  assert.ok(line.diagnostics.some((d) => d.code === "cli/email-clients-copy"), "the CLI's own email-clients wasn't said to be used");
  assert.equal(summary.exitCode, 0);
  assert.deepEqual(readdirSync(folder), ["welcome.html"], "check wrote something");

  const stdin = npx(["check", "-", "--json"], email);
  assert.equal(stdin.code, 0, `npx check -: ${stdin.stdout}${stdin.stderr}`);
  assert.equal(JSON.parse(stdin.stdout.split("\n")[0]).file, "stdin");

  const previewed = npx(["preview", "welcome.html", "--clients", "gmail"]);
  assert.equal(previewed.code, 0, `npx preview welcome.html: ${previewed.stdout}${previewed.stderr}`);
  assert.deepEqual(readdirSync(join(folder, "out/clients/welcome")).sort(), ["gmail.html", "gmail.mac.html"]);

  // No playwright-core: the files are written, the line says why nothing was drawn, and stderr says how to install it.
  const findings = npx(["preview", "welcome.html", "--clients", "gmail", "--findings", "--json"]);
  assert.equal(findings.code, 2, `npx preview --findings: ${findings.stdout}${findings.stderr}`);
  const drawn = JSON.parse(findings.stdout.split("\n")[0]);
  assert.equal(drawn.browser, null);
  assert.equal(drawn.reason, "no-playwright-core");
  assert.deepEqual(drawn.previews.map((preview) => preview.findings), [null, null]);
  assert.match(findings.stderr, /playwright-core, which isn't installed/);
  assert.match(findings.stderr, /npm install -D playwright-core/);
  const install = npx(["preview", "--install-browser"]);
  assert.equal(install.code, 2, `npx preview --install-browser: ${install.stdout}${install.stderr}`);
  assert.match(install.stderr, /playwright-core, which isn't installed/);

  // What npx installed: the CLI, email-clients and its models, and no React, React DOM or Elements.
  const installs = readdirSync(join(cache, "_npx")).map((hash) => join(cache, "_npx", hash, "node_modules"));
  assert.ok(installs.some((modules) => existsSync(join(modules, "@hyper-elements/cli/package.json"))), "npx didn't install the CLI where it was looked for");
  const found = [];
  const visit = (modules) => {
    if (!existsSync(modules)) return;
    for (const name of readdirSync(modules)) {
      if (name.startsWith("@")) {
        for (const scoped of readdirSync(join(modules, name))) visit2(join(modules, name, scoped), `${name}/${scoped}`);
      } else visit2(join(modules, name), name);
    }
  };
  const visit2 = (folder, name) => {
    found.push(name);
    visit(join(folder, "node_modules"));
  };
  for (const modules of installs) visit(modules);
  for (const name of ["react", "react-dom", "@hyper-elements/react", "playwright-core"]) assert.ok(!found.includes(name), `npx installed ${name} for an HTML email: ${found.join(", ")}`);
  for (const name of ["@hyper-elements/email-clients", "@hyper-elements/email-client-models"]) assert.ok(found.includes(name), `npx didn't install ${name}`);
  console.log(`✓ npx checks and previews an HTML email with nothing installed, and installs no React or playwright-core (${found.length} packages)`);
} finally {
  rmSync(bare, { recursive: true, force: true });
}
