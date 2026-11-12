/**
 * Any HTML email through `check` and `preview`: an `.html` file given by name, or `-` for stdin, given to
 * email-clients' renderInEmailClients(html). email-clients is the HTML file's project's where it's 0.4.3 or later, else
 * the CLI's own (`cli/email-clients-copy`). No React and no Elements are needed, or loaded. Where the models package
 * can't be used, each row of what email-clients does is the same for both commands.
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_EMAIL_CLIENTS } from "@hyper-elements/email-clients";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, cli, email, exists, FIXTURES, lines, ON_BUN, project, REPO, write } from "./helpers";

/** An email with what most email clients don't show: positioned, a flex box, a <style>. */
const HTML = `<!DOCTYPE html>
<html>
<head><style>.card { display: flex; position: absolute; }</style></head>
<body>
<div class="card">Welcome aboard</div>
</body>
</html>
`;

const DEFAULT_PREVIEWS = ["apple-mail.html", "gmail.html", "gmail.mac.html", "outlook-com.html", "outlook-com.mac.html", "outlook.html"];

/** A project with nothing installed: no node_modules at all. */
const bare = (files: Record<string, string>) => project(files, { modules: [] });

/** The clients a line's diagnostics name. */
const clientsOf = (line: any) => new Set<string>(line.diagnostics.flatMap((d: any) => d.clients ?? []));

const EMAIL_CLIENTS = join(REPO, "packages", "email-clients");
const MODELS = realpathSync(join(EMAIL_CLIENTS, "node_modules", "@hyper-elements", "email-client-models"));
/** The CLI's own email-clients: its dependency (^0.4.3, from npm), through its node_modules. */
const OWN_COPY = realpathSync(join(CLI_ROOT, "node_modules", "@hyper-elements", "email-clients"));

/**
 * This repository's email-clients copied into a project (a folder, not a link, so it resolves the models package
 * from the project), as `version`. Its models package: the real one, or a module of the test's own.
 */
function projectEmailClients(dir: string, version: string, models: string | null = null): void {
  const to = join(dir, "node_modules", "@hyper-elements", "email-clients");
  mkdirSync(to, { recursive: true });
  cpSync(join(EMAIL_CLIENTS, "dist"), join(to, "dist"), { recursive: true });
  cpSync(join(EMAIL_CLIENTS, "fonts"), join(to, "fonts"), { recursive: true });
  const manifest = JSON.parse(readFileSync(join(EMAIL_CLIENTS, "package.json"), "utf8"));
  writeFileSync(join(to, "package.json"), JSON.stringify({ ...manifest, version }, null, 2));
  const modelsFolder = join(dir, "node_modules", "@hyper-elements", "email-client-models");
  if (models === null) {
    cpSync(MODELS, modelsFolder, { recursive: true });
    return;
  }
  mkdirSync(modelsFolder, { recursive: true });
  writeFileSync(join(modelsFolder, "package.json"), JSON.stringify({ name: "@hyper-elements/email-client-models", version: "1.8.1", type: "module", exports: { ".": "./index.js" } }));
  writeFileSync(join(modelsFolder, "index.js"), models);
}

/** An email-clients from before HTML: loading it throws, so a run that uses it fails. */
function oldEmailClients(dir: string, version: string): void {
  write(dir, {
    "node_modules/@hyper-elements/email-clients/package.json": JSON.stringify({
      name: "@hyper-elements/email-clients",
      version,
      type: "module",
      exports: { ".": { import: "./dist/index.js", require: "./dist/index.cjs" } },
    }),
    "node_modules/@hyper-elements/email-clients/dist/index.js": `throw new Error("the project's email-clients ${version} was loaded");\n`,
    "node_modules/@hyper-elements/email-clients/dist/index.cjs": `throw new Error("the project's email-clients ${version} was loaded");\n`,
  });
}

/** Which copy of email-clients the run used, by input (HYPER_ELEMENTS_CLI_PROBE). */
function copiesUsed(stderr: string): Record<string, string> {
  const used: Record<string, string> = {};
  for (const line of stderr.split("\n")) {
    if (!line.startsWith("[probe] ")) continue;
    const said = JSON.parse(line.slice(8));
    if (said.emailClients) used[said.file] = realpathSync(said.emailClients);
  }
  return used;
}

const PROBE = { HYPER_ELEMENTS_CLI_PROBE: "1" };

describe("check on HTML", () => {
  it("checks an HTML file with nothing installed: the CLI's own email-clients, DEFAULT_EMAIL_CLIENTS' checks, nothing written", async () => {
    const dir = bare({ "mail/welcome.html": HTML });
    const before = readdirSync(dir).sort();
    const ran = await cli(dir, ["check", "mail/welcome.html", "--json"], { env: PROBE });
    expect(ran.code, ran.stderr).toBe(0);
    const [line, summary] = lines(ran);
    expect(line).toMatchObject({ version: 1, command: "check", file: "mail/welcome.html", input: "html", root: null, status: "ok", outputs: [] });
    expect("error" in line).toBe(false);
    // The clients the plugin checks a template for, Yahoo and AOL among them (they have no model to preview with).
    const clients = clientsOf(line);
    expect([...clients].every((client) => DEFAULT_EMAIL_CLIENTS.includes(client as never))).toBe(true);
    expect(clients.has("yahoo")).toBe(true);
    expect(clients.has("aol")).toBe(true);
    // Each diagnostic as email-clients gives it: path "html", its line and excerpt.
    const position = line.diagnostics.find((d: any) => d.message.includes("position: absolute"));
    expect(position).toMatchObject({ code: "email/html-css", path: "html", line: 3, excerpt: "<head><style>.card { display: flex; position: absolute; }</style></head>" });
    expect(line.diagnostics.find((d: any) => d.code === "cli/email-clients-copy")).toMatchObject({ severity: "info", message: expect.stringContaining("isn't installed where this file is") });
    expect(summary).toEqual({ version: 1, summary: { templates: 1, errors: 0, warnings: 0, skipped: 0, late: [] }, exitCode: 0 });
    // The CLI's own copy: its dependency, from npm.
    expect(copiesUsed(ran.stderr)["mail/welcome.html"]).toBe(OWN_COPY);
    expect(readdirSync(dir).sort()).toEqual(before);
    expect(readdirSync(join(dir, "mail"))).toEqual(["welcome.html"]);
  });

  it("--clients yahoo,gmail checks for those two: Yahoo has no model to preview with, and its checks still run", async () => {
    const dir = bare({ "mail/welcome.html": HTML });
    const ran = await cli(dir, ["check", "mail/welcome.html", "--json", "--clients", "yahoo,gmail"]);
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(clientsOf(line)).toEqual(new Set(["yahoo", "gmail"]));
    expect(line.diagnostics.map((d: any) => d.code)).not.toContain("cli/preview-skipped");
    expect(exists(join(dir, "out"))).toBe(false);
  });

  it("prints each diagnostic at file:line, with its excerpt", async () => {
    const dir = bare({ "mail/welcome.html": HTML });
    const ran = await cli(dir, ["check", "mail/welcome.html"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(ran.stdout).toContain("✓ mail/welcome.html (HTML)");
    expect(ran.stdout).toMatch(/info email\/html-css at mail\/welcome\.html:3: This email may have position: absolute/);
    expect(ran.stdout).toContain("      <head><style>.card { display: flex; position: absolute; }</style></head>");
    expect(ran.stdout).toContain("1 email: 0 errors, 0 warnings, 0 skipped");
  });

  it("reads stdin for -, named stdin", async () => {
    const dir = bare({});
    const ran = await cli(dir, ["check", "-", "--json"], { input: HTML });
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(line).toMatchObject({ file: "stdin", input: "html", root: null, status: "ok", outputs: [] });
    expect(line.diagnostics.find((d: any) => d.message.includes("position: absolute"))).toMatchObject({ line: 3 });
    const text = await cli(dir, ["check", "-"], { input: HTML });
    expect(text.stdout).toMatch(/at stdin:3: /);
    expect(readdirSync(dir).sort()).toEqual(["package.json"]);
  });

  it("an unknown email client is a usage error", async () => {
    const dir = bare({ "mail/welcome.html": HTML });
    const ran = await cli(dir, ["check", "mail/welcome.html", "--json", "--clients", "hotmail-1999"]);
    expect(ran.code).toBe(2);
    expect(lines(ran)[0]).toMatchObject({ status: "error", error: expect.stringContaining("hotmail-1999") });
  });

  it("a file that isn't a whole email (no <body>) is that input's error, with email-clients' message", async () => {
    const dir = bare({ "mail/part.html": "<html><head><title>Part</title></head></html>\n", "mail/welcome.html": HTML });
    const ran = await cli(dir, ["check", "mail/part.html", "mail/welcome.html", "--json"]);
    expect(ran.code).toBe(1);
    const [part, welcome, summary] = lines(ran);
    expect(part).toMatchObject({ file: "mail/part.html", input: "html", root: null, status: "error", error: expect.stringContaining("this has no <body> tag") });
    expect(welcome.status).toBe("ok");
    expect(summary).toMatchObject({ summary: { templates: 2, errors: 1 }, exitCode: 1 });
  });
});

describe("preview on HTML", () => {
  it("writes the previews of an HTML file with nothing installed, under out/clients/<its path>/<name>/", async () => {
    const dir = bare({ "mail/welcome.html": HTML });
    const ran = await cli(dir, ["preview", "mail/welcome.html", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(readdirSync(join(dir, "out/clients/mail/welcome")).sort()).toEqual(DEFAULT_PREVIEWS);
    const [line] = lines(ran);
    expect(line).toMatchObject({ command: "preview", file: "mail/welcome.html", input: "html", root: null, status: "ok" });
    expect(line.previews.map((p: any) => p.path).sort()).toEqual(DEFAULT_PREVIEWS.map((f) => `out/clients/mail/welcome/${f}`));
    expect(line.outputs.sort()).toEqual(DEFAULT_PREVIEWS.map((f) => `out/clients/mail/welcome/${f}`));
    // The email as given, as data inside each file.
    expect(readFileSync(join(dir, "out/clients/mail/welcome/gmail.html"), "utf8")).toContain("data-email-client-ready");
    expect(readFileSync(join(dir, "out/clients/mail/welcome/gmail.html"), "utf8")).toContain("Welcome aboard");
  });

  it("previews stdin under out/clients/stdin/", async () => {
    const dir = bare({});
    const ran = await cli(dir, ["preview", "-", "--json", "--clients", "gmail"], { input: HTML });
    expect(ran.code, ran.stderr).toBe(0);
    expect(readdirSync(join(dir, "out/clients/stdin")).sort()).toEqual(["gmail.html", "gmail.mac.html"]);
    expect(lines(ran)[0]).toMatchObject({ file: "stdin", input: "html", previews: [{ id: "gmail", path: "out/clients/stdin/gmail.html" }, { id: "gmail.mac", path: "out/clients/stdin/gmail.mac.html" }] });
  });

  it("--clients yahoo,gmail: no Yahoo preview (cli/preview-skipped), its checks still run", async () => {
    const dir = bare({ "mail/welcome.html": HTML });
    const ran = await cli(dir, ["preview", "mail/welcome.html", "--json", "--clients", "yahoo,gmail"]);
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(line.previews.map((p: any) => p.id)).toEqual(["gmail", "gmail.mac"]);
    expect(line.diagnostics.filter((d: any) => d.code === "cli/preview-skipped").map((d: any) => d.clients)).toEqual([["yahoo"]]);
    expect(line.diagnostics.some((d: any) => d.code === "email/html-css" && d.clients.includes("yahoo"))).toBe(true);
  });

  it("two HTML files with one name from different folders get a folder each, at their paths", async () => {
    const dir = bare({ "a/email.html": HTML, "b/email.html": HTML.replace("Welcome aboard", "Second") });
    const ran = await cli(dir, ["preview", "a/email.html", "b/email.html", "--clients", "gmail", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(readdirSync(join(dir, "out/clients/a/email")).sort()).toEqual(["gmail.html", "gmail.mac.html"]);
    expect(readFileSync(join(dir, "out/clients/b/email/gmail.html"), "utf8")).toContain("Second");
  });

  it("a preview that would be an input exits 2, with nothing written", async () => {
    // From --base o/clients/gmail, gmail.html's previews go to o/clients/gmail/: gmail.html would be written over it.
    const dir = bare({ "o/clients/gmail/gmail.html": HTML });
    const ran = await cli(dir, ["preview", "o/clients/gmail/gmail.html", "--out", "o", "--base", "o/clients/gmail", "--clients", "gmail"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("o/clients/gmail/gmail.html");
    expect(readFileSync(join(dir, "o/clients/gmail/gmail.html"), "utf8")).toBe(HTML);
    expect(readdirSync(join(dir, "o/clients/gmail"))).toEqual(["gmail.html"]);
  });
});

describe("which email-clients an HTML file uses", () => {
  for (const command of ["check", "preview"]) {
    it(`${command}: the project's own email-clients where it's 0.4.3 or later`, async () => {
      const dir = bare({ "mail/welcome.html": HTML });
      projectEmailClients(dir, "0.4.3");
      const ran = await cli(dir, [command, "mail/welcome.html", "--json", "--clients", "gmail"], { env: PROBE });
      expect(ran.code, ran.stderr).toBe(0);
      expect(copiesUsed(ran.stderr)["mail/welcome.html"]).toBe(realpathSync(join(dir, "node_modules/@hyper-elements/email-clients")));
      expect(lines(ran)[0].diagnostics.map((d: any) => d.code)).not.toContain("cli/email-clients-copy");
    });

    it(`${command}: the CLI's own where the project's is older, with a note naming its version`, async () => {
      const dir = bare({ "mail/welcome.html": HTML });
      oldEmailClients(dir, "0.4.2");
      const ran = await cli(dir, [command, "mail/welcome.html", "--json", "--clients", "gmail"], { env: PROBE });
      expect(ran.code, ran.stderr).toBe(0);
      expect(copiesUsed(ran.stderr)["mail/welcome.html"]).toBe(OWN_COPY);
      const [line] = lines(ran);
      expect(line.status).toBe("ok");
      expect(line.diagnostics.find((d: any) => d.code === "cli/email-clients-copy")).toMatchObject({
        severity: "info",
        message: expect.stringContaining("is 0.4.2"),
        fix: "npm i -D @hyper-elements/email-clients@^0.4.3",
      });
    });
  }
});

describe("render, outline and inspect on HTML", () => {
  for (const command of ["render", "outline", "inspect"]) {
    it(`${command} exits 2: it's already HTML`, async () => {
      const dir = bare({ "mail/welcome.html": HTML });
      const file = await cli(dir, [command, "mail/welcome.html"]);
      expect(file.code).toBe(2);
      expect(file.stderr).toContain("it's already HTML");
      const stdin = await cli(dir, [command, "-"], { input: HTML });
      expect(stdin.code).toBe(2);
      expect(stdin.stderr).toContain("check and preview take");
      expect(exists(join(dir, "out"))).toBe(false);
    });
  }
});

describe("HTML beside templates", () => {
  it("a folder's HTML files aren't picked up; an HTML file given by name is, beside a folder's templates", async () => {
    const dir = project({ "emails/welcome.tsx": email("Welcome"), "emails/welcome.html": HTML, "html/only.html": HTML });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran).slice(0, -1).map((l) => [l.file, l.input])).toEqual([["emails/welcome.tsx", "template"]]);
    const both = await cli(dir, ["check", "emails", "emails/welcome.html", "--json"]);
    expect(both.code, both.stderr).toBe(0);
    expect(lines(both).slice(0, -1).map((l) => [l.file, l.input, l.root])).toEqual([
      ["emails/welcome.tsx", "template", "Email"],
      ["emails/welcome.html", "html", null],
    ]);
    const html = await cli(dir, ["check", "html"]);
    expect(html.code).toBe(2);
    expect(html.stderr).toContain("A folder's HTML files aren't checked: give them by name");
  });
});

describe("no React", () => {
  for (const command of ["check", "preview"]) {
    it(`${command} on HTML loads no React, no Elements and no browser`, async () => {
      const dir = bare({ "mail/welcome.html": HTML });
      const log = join(dir, "modules.log");
      const probe = join(FIXTURES, "probe", "modules.mjs");
      const ran = await cli(dir, [command, "mail/welcome.html", "--clients", "gmail"], {
        env: { MODULE_LOG: log },
        runtimeArgs: ON_BUN ? ["--preload", probe] : ["--import", pathToFileURL(probe).href],
      });
      expect(ran.code, ran.stderr).toBe(0);
      const loaded = readFileSync(log, "utf8").split("\n").filter(Boolean);
      // What it did load: email-clients and its models.
      expect(loaded.some((m) => /email-clients[\\/]dist[\\/]index\.js$/.test(m))).toBe(true);
      expect(loaded.some((m) => m.includes("email-client-models"))).toBe(true);
      // React, React DOM, Elements (packages/react), playwright-core: none.
      expect(loaded.filter((m) => /[\\/](react|react-dom|react19|react-dom19|playwright-core)[\\/]/.test(m))).toEqual([]);
    });
  }
});

/** What a models package can't do, as a module standing in for it (the real one where the row needs it). */
const REAL = JSON.stringify(pathToFileURL(join(MODELS, "dist", "node.js")).href);
const ROWS: Record<string, string> = {
  import: `throw new Error("the models package can't be loaded here");\n`,
  webAssembly: `export * from ${REAL};\nexport const ready = () => Promise.reject(new Error("WebAssembly.compile(): refused"));\n`,
  protocol: `export * from ${REAL};\nexport const PROTOCOL = 99;\n`,
  old: `export * from ${REAL};\nexport function check() { throw new Error("check: the template has no root"); }\n`,
  throws: `export * from ${REAL};\nexport function check() { throw new Error("ran out of memory"); }\n`,
};

describe("when the models package can't be used (the same for check and preview)", () => {
  const run = async (command: string, row: string) => {
    const dir = bare({ "mail/welcome.html": HTML });
    projectEmailClients(dir, "0.4.3", ROWS[row]);
    const ran = await cli(dir, [command, "mail/welcome.html", "--json", "--clients", "gmail"]);
    const [line, summary] = lines(ran);
    const previews = exists(join(dir, "out/clients/mail/welcome")) ? readdirSync(join(dir, "out/clients/mail/welcome")).sort() : [];
    return { ran, line, summary, previews };
  };
  const captured = (line: any) => line.diagnostics.filter((d: any) => d.code === "email/captured-checks");
  /** The open checks ran: what caniemail's tables say of the email. */
  const openChecks = (line: any) => line.diagnostics.some((d: any) => d.code === "email/html-css");

  for (const command of ["check", "preview"]) {
    const made = command === "preview" ? ["gmail.html", "gmail.mac.html"] : [];

    it(`${command}: a models package that doesn't import fails the input (exit 1)`, async () => {
      const { ran, line, previews } = await run(command, "import");
      expect(ran.code).toBe(1);
      expect(line).toMatchObject({ status: "error", input: "html" });
      expect(typeof line.error).toBe("string");
      expect(previews).toEqual([]);
    });

    it(`${command}: WebAssembly that doesn't compile is an email/captured-checks warning, and the previews are made`, async () => {
      const { ran, line, previews } = await run(command, "webAssembly");
      expect(ran.code, ran.stderr).toBe(0);
      expect(line.status).toBe("ok");
      expect(captured(line)).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("WebAssembly.compile(): refused"), path: "html", line: null })]);
      expect(openChecks(line)).toBe(true);
      expect(previews).toEqual(made);
    });

    it(`${command}: a protocol email-clients doesn't read is email-clients/version-mismatch (exit 1)`, async () => {
      const { ran, line, previews } = await run(command, "protocol");
      expect(ran.code).toBe(1);
      expect(line.status).toBe("error");
      expect(line.diagnostics).toEqual([expect.objectContaining({ code: "email-clients/version-mismatch", severity: "error", message: expect.stringContaining("speaks 99") })]);
      expect(previews).toEqual([]);
    });

    it(`${command}: models before 1.8.0 (no HTML checks) are an info note, and the open checks run`, async () => {
      const { ran, line, previews } = await run(command, "old");
      expect(ran.code, ran.stderr).toBe(0);
      expect(captured(line)).toEqual([expect.objectContaining({ severity: "info", message: expect.stringContaining("1.8.0 and later check HTML too") })]);
      expect(openChecks(line)).toBe(true);
      expect(previews).toEqual(made);
    });

    it(`${command}: the models' check throwing on this email is an email/captured-checks warning`, async () => {
      const { ran, line, summary, previews } = await run(command, "throws");
      expect(ran.code, ran.stderr).toBe(0);
      expect(captured(line)).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("ran out of memory") })]);
      expect(openChecks(line)).toBe(true);
      expect(summary.summary.warnings).toBe(1);
      expect(previews).toEqual(made);
    });
  }
});
