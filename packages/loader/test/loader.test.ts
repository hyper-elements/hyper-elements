import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join, parse, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultExport, guard, projectConfig, projectTsconfig, templateComponent, walk, workspaceRoot } from "../src/index";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "template-loader-")));
  dirs.push(dir);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  return dir;
}

describe("walk", () => {
  it("lists source files, leaving out tests, stories, declarations, dot folders and IGNORED", async () => {
    const dir = project({
      "a.tsx": "", "b.mjs": "", "c.cjs": "", "d.test.tsx": "", "e.stories.tsx": "", "f.d.ts": "", "g.css": "",
      "nested/h.ts": "", "_shared/i.tsx": "", ".hidden/j.tsx": "", "node_modules/k.tsx": "", "dist/l.tsx": "", "out/m.tsx": "",
    });
    const files = (await walk(dir)).map((f) => relative(dir, f).split("\\").join("/")).sort();
    expect(files).toEqual(["_shared/i.tsx", "a.tsx", "b.mjs", "nested/h.ts"]);
  });

  it("with all, lists tests and CommonJS modules too", async () => {
    const dir = project({ "a.tsx": "", "c.cjs": "", "d.test.tsx": "", "e.cts": "", "f.d.ts": "" });
    const files = (await walk(dir, [], true)).map((f) => relative(dir, f)).sort();
    expect(files).toEqual(["a.tsx", "c.cjs", "d.test.tsx", "e.cts"]);
  });

  it("reports a symbolic link to a folder without following it", async () => {
    const dir = project({ "real/a.tsx": "", "emails/b.tsx": "" });
    symlinkSync(join(dir, "real"), join(dir, "emails", "linked"), "dir");
    const links: string[] = [];
    const files = await walk(join(dir, "emails"), links);
    expect(files.map((f) => relative(dir, f))).toEqual([join("emails", "b.tsx")]);
    expect(links).toEqual([join(dir, "emails", "linked")]);
  });

  it("skips the folders `skip` names, and only folders", async () => {
    const dir = project({ "_shared/a.tsx": "", "_b.tsx": "", "c/_d/e.tsx": "", "c/f.tsx": "" });
    const files = (await walk(dir, [], false, { skip: (name) => name.startsWith("_") })).map((f) => relative(dir, f).split("\\").join("/")).sort();
    expect(files).toEqual(["_b.tsx", "c/f.tsx"]);
  });
});

describe("defaultExport and templateComponent", () => {
  const memo = (type: unknown) => ({ $$typeof: Symbol.for("react.memo"), type });
  const forwardRef = (render: unknown) => ({ $$typeof: Symbol.for("react.forward_ref"), render });

  it("takes a CommonJS module's default through its exports", () => {
    const T = () => null;
    expect(defaultExport({ default: T })).toBe(T);
    expect(defaultExport({ default: { default: T, other: 1 } })).toBe(T);
  });

  it("reads PreviewProps on each wrapper, the outermost first", () => {
    const T = Object.assign(() => null, { PreviewProps: { name: "inner" } });
    expect(templateComponent(T)).toMatchObject({ component: T, props: { name: "inner" }, previewed: true });
    const memoed = Object.assign(memo(T), { PreviewProps: { name: "outer" } });
    expect(templateComponent(memoed)).toMatchObject({ component: T, exported: memoed, props: { name: "outer" } });
    const plain = () => null;
    expect(templateComponent(forwardRef(plain))).toMatchObject({ component: plain, props: {}, previewed: false });
    expect(templateComponent(memo(forwardRef(T)))).toMatchObject({ component: T, props: { name: "inner" } });
  });

  it("is undefined for a value that isn't a component, and throws on an element or an empty wrapper", () => {
    expect(templateComponent(undefined)).toBeUndefined();
    expect(templateComponent({ a: 1 })).toBeUndefined();
    expect(() => templateComponent({ $$typeof: Symbol.for("react.transitional.element"), type: "div" })).toThrow("unsupported React template wrapper");
    expect(() => templateComponent(memo(undefined))).toThrow("no renderable component");
  });
});

describe("projectTsconfig", () => {
  it("extends the project's config, its paths made absolute, with the automatic JSX runtime and the folders included", async () => {
    const dir = project({
      "package.json": "{}",
      "pnpm-workspace.yaml": "packages: ['app']\n",
      "app/tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
      "app/emails/welcome.tsx": "",
    });
    const file = join(dir, "app/emails/welcome.tsx");
    const config = await projectTsconfig(file, { cwd: dir, paths: { extra: ["/x/y.ts"] } });
    try {
      const written = JSON.parse(readFileSync(config.file, "utf8"));
      expect(config.base).toBe(join(dir, "app/tsconfig.json"));
      expect(written.extends).toBe(join(dir, "app/tsconfig.json"));
      expect(written.compilerOptions).toMatchObject({ allowJs: true, jsx: "react-jsx", jsxImportSource: "react" });
      expect(written.compilerOptions.paths).toEqual({ "@/*": [join(dir, "app/src/*")], extra: ["/x/y.ts"] });
      const slash = (p: string) => join(p, "**/*").split("\\").join("/");
      expect(written.include).toEqual([slash(dir), slash(join(dir, "app/emails")), slash(join(dir, "app"))]);
    } finally {
      config.remove();
    }
    expect(existsSync(config.file)).toBe(false);
  });

  it("takes the config from configFrom's folder, and the folders from the file's", async () => {
    const dir = project({
      "a/tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "~/*": ["./lib/*"] } } }),
      "a/welcome.tsx": "",
      "out/welcome.tsx": "",
    });
    const config = await projectTsconfig(join(dir, "out/welcome.tsx"), { cwd: dir, configFrom: join(dir, "a/welcome.tsx") });
    try {
      const written = JSON.parse(readFileSync(config.file, "utf8"));
      expect(written.extends).toBe(join(dir, "a/tsconfig.json"));
      expect(written.compilerOptions.paths).toEqual({ "~/*": [join(dir, "a/lib/*")] });
      expect(written.include).toContain(join(dir, "out", "**/*").split("\\").join("/"));
    } finally {
      config.remove();
    }
  });

  it("writes where it's told, with a header comment, and never over a file", async () => {
    const dir = project({ "welcome.tsx": "", "taken.json": "keep" });
    const config = await projectTsconfig(join(dir, "welcome.tsx"), { cwd: dir, file: join(dir, "mine.json"), header: "made by a test", include: [join(dir, "more")] });
    const text = readFileSync(config.file, "utf8");
    expect(text.split("\n")[0]).toBe("// made by a test");
    expect(JSON.parse(text.split("\n").slice(1).join("\n")).include).toContain(join(dir, "more", "**/*").split("\\").join("/"));
    await expect(projectTsconfig(join(dir, "welcome.tsx"), { cwd: dir, file: join(dir, "taken.json") })).rejects.toThrow(/EEXIST/);
    expect(readFileSync(join(dir, "taken.json"), "utf8")).toBe("keep");
  });

  it("finds the nearest config and workspace", () => {
    const dir = project({ "package.json": JSON.stringify({ workspaces: ["a"] }), "a/jsconfig.json": "{}", "a/b/c.tsx": "" });
    expect(projectConfig(join(dir, "a/b"))).toBe(join(dir, "a/jsconfig.json"));
    expect(workspaceRoot(join(dir, "a/b"))).toBe(dir);
  });
});

describe("guard", () => {
  // In a process of its own: it changes the process it's installed in.
  const run = (code: string) => {
    const dir = project({});
    const script = join(dir, "script.ts");
    const index = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    writeFileSync(script, `import { guard } from ${JSON.stringify(index)};\n${code}`);
    const tsx = fileURLToPath(new URL("../node_modules/.bin/tsx", import.meta.url));
    return execFileSync(existsSync(tsx) ? tsx : "tsx", [script], { encoding: "utf8" });
  };

  it("makes process.exit throw and collects late throws, once each", () => {
    const out = run(`
      import { exit } from "node:process";
      const g = guard();
      let threw = [];
      try { process.exit(3); } catch (e) { threw.push(e.message); }
      try { exit(4); } catch (e) { threw.push(e.message); }
      setTimeout(() => { throw new Error("late one\\nsecond line"); });
      setTimeout(() => { throw new Error("late one"); });
      Promise.reject(new Error("rejected"));
      setTimeout(() => setTimeout(() => { process.stdout.write(JSON.stringify({ threw, late: g.late() })); g.exit(0); }), 20);
    `);
    expect(JSON.parse(out)).toEqual({
      threw: ["a template called process.exit(3)", "a template called process.exit(4)"],
      late: ["rejected", "late one"],
    });
  });

  it("in this process too (what it installs is put back after): both exits throw, and late throws are kept by first line", async () => {
    const exit = process.exit;
    const listening = (event: "uncaughtException" | "unhandledRejection") => (process.listeners as (name: string) => Array<(error: unknown) => void>)(event);
    const before = { exception: listening("uncaughtException"), rejection: listening("unhandledRejection") };
    const guarded = guard();
    const added = {
      exception: listening("uncaughtException").filter((l) => !before.exception.includes(l)),
      rejection: listening("unhandledRejection").filter((l) => !before.rejection.includes(l)),
    };
    try {
      expect(() => process.exit(3)).toThrow("a template called process.exit(3)");
      const imported = await import("node:process");
      expect(() => imported.exit()).toThrow("a template called process.exit()");
      expect(typeof guarded.exit).toBe("function");
      expect(added.exception).toHaveLength(1);
      expect(added.rejection).toHaveLength(1);
      // As Node calls them: what was thrown, its message's first line once.
      added.exception[0](new Error("late\nat a stack line"));
      added.rejection[0]("a string");
      added.exception[0](new Error("late"));
      expect(guarded.late()).toEqual(["late", "a string"]);
    } finally {
      process.exit = exit;
      syncBuiltinESMExports();
      for (const l of added.exception) process.off("uncaughtException", l as NodeJS.UncaughtExceptionListener);
      for (const l of added.rejection) process.off("unhandledRejection", l as NodeJS.UnhandledRejectionListener);
    }
  });
});

describe("at the filesystem's root", () => {
  it("finds no tsconfig and no workspace", () => {
    const root = parse(tmpdir()).root;
    expect(projectConfig(root)).toBeUndefined();
    expect(workspaceRoot(root)).toBeUndefined();
  });
});
