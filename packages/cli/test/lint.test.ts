/**
 * @hyper-elements/lint in the CLI: on by default in `check`, `render` and `dev` for an Email and a Page (and `check` of
 * an HTML email), with the project's copy where it has one and the CLI's own otherwise (a `cli/lint-copy` note); its
 * options from the nearest package.json, their shape checked before anything runs and their meaning by the copy that
 * runs; `--no-lint`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, lines, project, REPO, startDev, until } from "./helpers";

const LINT = join(REPO, "packages", "lint");
const OWN_VERSION = "0.1.0";

/** An Email with no lang (a lint warning) and a Page with nothing for lint to say. */
const EMAIL = `import { Email, Text } from "@hyper-elements/react";
export default function Welcome() {
  return <Email previewText="Your account is ready to use, welcome aboard"><Text>Welcome</Text></Email>;
}
`;
const PAGE = `import { Page, Text } from "@hyper-elements/react";
export default function Home() {
  return <Page lang="en" title="Home"><Text>Home</Text></Page>;
}
`;
const DOCUMENT = `import { Document, Text } from "@hyper-elements/react";
export default function Invoice() {
  return <Document><Text>Invoice</Text></Document>;
}
`;
const HTML = `<!DOCTYPE html>
<html>
<head><title>Welcome</title></head>
<body>
<p><a href="https://example.com/start">Click here</a></p>
</body>
</html>
`;

/** A copy of lint of another version, knowing only the rule `only-mine`: it reports `<root>/lint-only-mine` on each template. */
function fakeLint(dir: string, version = "0.0.1"): string {
  const folder = join(dir, "fake-lint");
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "package.json"),
    JSON.stringify({ name: "@hyper-elements/lint", version, type: "module", exports: { ".": "./index.js", "./html": "./html.js", "./package.json": "./package.json" } }),
  );
  const check = `(options) => {
  for (const id of Object.keys(options?.rules ?? {})) if (id !== "only-mine") throw new TypeError(\`[lint] There's no rule "\${id}"\`);
}`;
  writeFileSync(
    join(folder, "index.js"),
    `const check = ${check};
export function lint(options) {
  check(options);
  return { name: "lint", api: 1, check: ({ root }) => [{ code: \`\${root.type === "Email" ? "email" : "page"}/lint-only-mine\`, severity: "warning", message: "Found by the project's copy", path: "root" }] };
}
`,
  );
  writeFileSync(
    join(folder, "html.js"),
    `const check = ${check};
export function lintHtml(html, options) {
  check(options);
  return { diagnostics: [{ code: "lint/only-mine", severity: "warning", message: "Found by the project's copy", line: 1, column: 1 }] };
}
`,
  );
  return folder;
}

const codes = (line: any): string[] => line.diagnostics.map((d: any) => d.code);
const probed = (stderr: string) =>
  stderr
    .split("\n")
    .filter((l) => l.startsWith("[probe] "))
    .map((l) => JSON.parse(l.slice(8)));

describe("lint in check", () => {
  it("reports an Email's and a Page's findings, with the CLI's own copy noted, and exits 0 on warnings", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL, "emails/home.tsx": PAGE });
    const ran = await cli(dir, ["check", "emails", "--json"], { env: { HYPER_ELEMENTS_CLI_PROBE: "1" } });
    expect(ran.code, ran.stderr).toBe(0);
    const [home, welcome, summary] = lines(ran);
    expect(home.diagnostics).toEqual([
      { code: "cli/lint-copy", severity: "info", message: `@hyper-elements/lint isn't installed where this is: the CLI's own copy (${OWN_VERSION}) checked it`, path: "", fix: "npm i -D @hyper-elements/lint to choose its version" },
    ]);
    expect(welcome.diagnostics.find((d: any) => d.code === "email/lint-lang")).toEqual({
      code: "email/lint-lang",
      severity: "warning",
      message: "The Email has no lang, so screen readers guess its language",
      path: "root.props.lang",
      fix: 'give the root a lang ("en", "fr")',
      see: "https://www.hyperelements.dev/docs/lint#lang",
    });
    expect(codes(welcome)).toContain("cli/lint-copy");
    expect(summary).toMatchObject({ summary: { templates: 2, errors: 0, warnings: 1 }, exitCode: 0 });
    expect(probed(ran.stderr).map((p) => [p.lint, p.lintVersion])).toEqual([
      ["cli", OWN_VERSION],
      ["cli", OWN_VERSION],
    ]);
    // In text, with its docs link.
    const text = await cli(dir, ["check", "emails/welcome.tsx"]);
    expect(text.stdout).toMatch(/warning email\/lint-lang at root\.props\.lang: The Email has no lang.* See: https:\/\/www\.hyperelements\.dev\/docs\/lint#lang/);
  });

  it("fails on lint's warnings past --max-warnings, as on any", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL });
    expect((await cli(dir, ["check", "emails", "--max-warnings", "1"])).code).toBe(0);
    const ran = await cli(dir, ["check", "emails", "--max-warnings", "0", "--json"]);
    expect(ran.code).toBe(1);
    expect(lines(ran).at(-1)).toMatchObject({ summary: { warnings: 1 }, exitCode: 1 });
  });

  it("gives a Document and a Canvas nothing of lint's, and no note", async () => {
    const dir = project({ "docs/invoice.tsx": DOCUMENT });
    const ran = await cli(dir, ["check", "docs", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(codes(lines(ran)[0]).filter((code) => /lint/.test(code))).toEqual([]);
  });

  it("says nothing of lint's copy on a template with errors (core runs no plugin then)", async () => {
    const dir = project({ "emails/broken.tsx": `import { Email, Text } from "@hyper-elements/react";\n// @ts-expect-error\nexport default () => <Email><Text color="red">x</Text></Email>;\n` });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(1);
    expect(codes(lines(ran)[0])).toEqual(["prop/unknown"]);
  });

  it("--no-lint: none of lint's checks, and its options aren't read", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL }, { packageJson: { name: "fixture", type: "module", hyperElements: { lint: "strict" } } });
    const ran = await cli(dir, ["check", "emails", "--json", "--no-lint"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(codes(lines(ran)[0]).filter((code) => /lint/.test(code))).toEqual([]);
    expect((await cli(dir, ["preview", "emails", "--no-lint"])).stderr).toMatch(/--no-lint isn't an option of preview/);
  });
});

describe("lint's options", () => {
  it("come from the nearest package.json's hyperElements.lint", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL }, { packageJson: { name: "fixture", type: "module", hyperElements: { lint: { rules: { lang: "info" }, kind: "marketing" } } } });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(line.diagnostics.find((d: any) => d.code === "email/lint-lang").severity).toBe("info");
    expect(codes(line)).toContain("email/lint-unsubscribe");
  });

  it("of a shape lint can't take: exit 2 before any template runs", async () => {
    for (const lint of ["strict", { rules: ["lang"] }, { rules: { lang: false } }, { kind: 1 }]) {
      const dir = project({ "emails/welcome.tsx": EMAIL }, { packageJson: { name: "fixture", type: "module", hyperElements: { lint } } });
      const ran = await cli(dir, ["check", "emails", "--json"]);
      expect(ran.code, JSON.stringify(lint)).toBe(2);
      expect(ran.stdout).toBe("");
      expect(ran.stderr).toMatch(/^hyper-elements: package\.json's hyperElements\.lint/);
    }
  });

  it("that the CLI's copy doesn't know: exit 2, naming that copy and its version", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL }, { packageJson: { name: "fixture", type: "module", hyperElements: { lint: { rules: { "only-mine": "off" } } } } });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(2);
    expect(lines(ran)[0].error).toBe(`the CLI's @hyper-elements/lint ${OWN_VERSION}: there's no rule "only-mine": see https://www.hyperelements.dev/docs/lint for the rules`);
  });

  it("are the project's copy's to judge: a rule only it knows is taken, and one only the CLI's knows is refused", async () => {
    const fake = fakeLint(project({}, { modules: [] }));
    const linked = project({ "emails/welcome.tsx": EMAIL }, { modules: { react: "react", "react-dom": "react-dom", "@hyper-elements/react": "@hyper-elements/react", "@hyper-elements/lint": fake }, packageJson: { name: "fixture", type: "module", hyperElements: { lint: { rules: { "only-mine": "warning" } } } } });
    const ran = await cli(linked, ["check", "emails", "--json"], { env: { HYPER_ELEMENTS_CLI_PROBE: "1" } });
    expect(ran.code, ran.stderr).toBe(0);
    expect(codes(lines(ran)[0]).filter((code) => /lint/.test(code))).toEqual(["email/lint-only-mine"]);
    expect(probed(ran.stderr)[0]).toMatchObject({ lint: "project", lintVersion: "0.0.1" });

    const refusing = project({ "emails/welcome.tsx": EMAIL }, { modules: { react: "react", "react-dom": "react-dom", "@hyper-elements/react": "@hyper-elements/react", "@hyper-elements/lint": fake }, packageJson: { name: "fixture", type: "module", hyperElements: { lint: { rules: { contrast: "off" } } } } });
    const refused = await cli(refusing, ["check", "emails", "--json"]);
    expect(refused.code).toBe(2);
    expect(lines(refused)[0].error).toBe(`the project's @hyper-elements/lint 0.0.1: there's no rule "contrast"`);
  });

  it("use the project's own copy of this repository's lint where it has one, with no note", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL }, { modules: { react: "react", "react-dom": "react-dom", "@hyper-elements/react": "@hyper-elements/react", "@hyper-elements/lint": LINT } });
    const ran = await cli(dir, ["check", "emails", "--json"], { env: { HYPER_ELEMENTS_CLI_PROBE: "1" } });
    expect(ran.code, ran.stderr).toBe(0);
    expect(codes(lines(ran)[0])).toContain("email/lint-lang");
    expect(codes(lines(ran)[0])).not.toContain("cli/lint-copy");
    expect(probed(ran.stderr)[0]).toMatchObject({ lint: "project", lintVersion: OWN_VERSION });
  });
});

describe("a project's copy that can't be used", () => {
  /** A copy of lint that's there but broken: its main entry throws when loaded, or has no lint(). */
  const broken = (index: string) => {
    const folder = join(project({}, { modules: [] }), "broken-lint");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "package.json"), JSON.stringify({ name: "@hyper-elements/lint", version: "0.0.2", type: "module", exports: { ".": "./index.js", "./package.json": "./package.json" } }));
    writeFileSync(join(folder, "index.js"), index);
    return folder;
  };
  const linked = (lint: string, files: Record<string, string>) =>
    project(files, { modules: { react: "react", "react-dom": "react-dom", "@hyper-elements/react": "@hyper-elements/react", "@hyper-elements/lint": lint } });

  for (const [what, index, why] of [
    ["one that fails to load", `throw new Error("half installed");\n`, /half installed/],
    ["one with no lint()", "export const version = '0.0.2';\n", /it has no lint\(\)/],
  ] as const) {
    it(`${what}: the CLI's own checks the template, which renders, with a warning saying why`, async () => {
      const dir = linked(broken(index), { "emails/welcome.tsx": EMAIL });
      const ran = await cli(dir, ["render", "emails", "--json"]);
      expect(ran.code, ran.stderr).toBe(0);
      const [line] = lines(ran);
      expect(line.outputs).toEqual(["out/emails/welcome.html", "out/emails/welcome.txt"]);
      expect(codes(line)).toContain("email/lint-lang");
      const note = line.diagnostics.find((d: any) => d.code === "cli/lint-copy");
      expect(note).toMatchObject({ severity: "warning", message: expect.stringMatching(why) });
    });
  }

  it("on an HTML email, a copy with no ./html entry: the CLI's own, with a warning", async () => {
    const dir = project({ "mail/welcome.html": HTML }, { modules: { "@hyper-elements/lint": broken("export function lint() {}\n") } });
    const ran = await cli(dir, ["check", "mail/welcome.html", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(codes(line)).toContain("lint/link-text");
    expect(line.diagnostics.find((d: any) => d.code === "cli/lint-copy")).toMatchObject({ severity: "warning", message: expect.stringContaining("no ./html entry") });
  });
});

describe("lint in render", () => {
  it("reports lint's findings in render's lines, writing the files as before", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL });
    const ran = await cli(dir, ["render", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(line.outputs).toEqual(["out/emails/welcome.html", "out/emails/welcome.txt"]);
    expect(codes(line)).toEqual(expect.arrayContaining(["email/lint-lang", "cli/lint-copy"]));
    expect(codes(lines(await cli(dir, ["render", "emails", "--json", "--no-lint"]))[0]).filter((code) => /lint/.test(code))).toEqual([]);
  });
});

describe("lint on an HTML email", () => {
  it("runs lintHtml with the CLI's own copy where nothing is installed: each finding at its line, with its excerpt", async () => {
    const dir = project({ "mail/welcome.html": HTML }, { modules: [] });
    const ran = await cli(dir, ["check", "mail/welcome.html", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(line.diagnostics.filter((d: any) => /lint/.test(d.code))).toEqual([
      { code: "lint/lang", severity: "warning", message: "The email has no lang on its <html> or <body>, so screen readers guess its language", path: "html", line: 2, excerpt: "<html>", fix: 'give <html> a lang ("en", "fr")', see: "https://www.hyperelements.dev/docs/lint#lang" },
      { code: "lint/link-text", severity: "warning", message: 'The link says "Click here": a screen reader lists links by their words alone', path: "html", line: 5, excerpt: '<p><a href="https://example.com/start">Click here</a></p>', fix: 'say where it goes ("Confirm your email"), or give it an aria-label', see: "https://www.hyperelements.dev/docs/lint#link-text" },
      { code: "cli/lint-copy", severity: "info", message: `@hyper-elements/lint isn't installed where this is: the CLI's own copy (${OWN_VERSION}) checked it`, path: "", fix: "npm i -D @hyper-elements/lint to choose its version" },
    ]);
    const text = await cli(dir, ["check", "mail/welcome.html"]);
    expect(text.stdout).toContain("warning lint/link-text at mail/welcome.html:5: The link says \"Click here\"");
    expect(text.stdout).toContain('      <p><a href="https://example.com/start">Click here</a></p>');
    expect(lines(await cli(dir, ["check", "mail/welcome.html", "--json", "--no-lint"]))[0].diagnostics.filter((d: any) => /lint/.test(d.code))).toEqual([]);
  });

  it("with the project's copy where the file's folder has one, which judges the options", async () => {
    const base = project({}, { modules: [] });
    const fake = fakeLint(base);
    const dir = project({ "mail/welcome.html": HTML }, { modules: { "@hyper-elements/lint": fake }, packageJson: { name: "fixture", hyperElements: { lint: { rules: { "only-mine": "warning" } } } } });
    const ran = await cli(dir, ["check", "mail/welcome.html", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)[0].diagnostics.filter((d: any) => /lint/.test(d.code)).map((d: any) => d.code)).toEqual(["lint/only-mine"]);
    // The CLI's copy doesn't know only-mine: exit 2, naming it.
    const own = project({ "mail/welcome.html": HTML }, { modules: [], packageJson: { name: "fixture", hyperElements: { lint: { rules: { "only-mine": "warning" } } } } });
    const refused = await cli(own, ["check", "mail/welcome.html", "--json"]);
    expect(refused.code).toBe(2);
    expect(lines(refused)[0]).toMatchObject({ status: "error", error: `the CLI's @hyper-elements/lint ${OWN_VERSION}: there's no rule "only-mine": see https://www.hyperelements.dev/docs/lint for the rules` });
  });
});

describe("lint in dev", () => {
  it("a config of a shape lint can't take stops dev before it serves", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL }, { packageJson: { name: "fixture", type: "module", hyperElements: { lint: { rules: "all" } } } });
    const ran = await cli(dir, ["dev", "emails"]);
    expect(ran.code).toBe(2);
    expect(ran.stdout).not.toMatch(/Serving/);
    expect(ran.stderr).toMatch(/hyperElements\.lint\.rules is an object/);
  });

  it("shows lint's findings, and a rule the running copy doesn't know on the page and stderr, and keeps serving", async () => {
    const dir = project({ "emails/welcome.tsx": EMAIL, "emails/home.tsx": PAGE });
    const dev = await startDev(dir, ["emails"]);
    const state = await dev.state();
    const welcome = state.templates.find((t: any) => t.file === "emails/welcome.tsx");
    expect(welcome.diagnostics.map((d: any) => d.code)).toContain("email/lint-lang");
    expect(welcome.diagnostics.find((d: any) => d.code === "email/lint-lang").see).toBe("https://www.hyperelements.dev/docs/lint#lang");

    const unknown = project({ "emails/welcome.tsx": EMAIL }, { packageJson: { name: "fixture", type: "module", hyperElements: { lint: { rules: { "only-mine": "off" } } } } });
    const second = await startDev(unknown, ["emails"]);
    const shown = (await second.state()).templates[0];
    expect(shown).toMatchObject({ status: "error", error: expect.stringContaining(`the CLI's @hyper-elements/lint ${OWN_VERSION}: there's no rule "only-mine"`) });
    expect(await until(() => /there's no rule "only-mine"/.test(second.stderr()), 5_000)).toBe(true);
    expect(second.child.exitCode).toBe(null);
  });
});
