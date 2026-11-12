/**
 * The parts with no process of their own, in-process: who owns a leftover file, error lines, how destinations are
 * compared, and the arguments.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, UsageError } from "../src/args";
import { cacheFolder, decodeDataUri, osCache } from "../src/assets";
import { foldPath } from "../src/destinations";
import { errorLine } from "../src/errors";
import { commonFolder, hasDefaultExport } from "../src/inputs";
import { cleanFiles, formatToken, hostName, loaderModuleText, parseToken, stale, startTime } from "../src/loader-module";
import { cli, email, lines, project } from "./helpers";

/** A process id that isn't running: one that just ended. */
function deadPid(): number {
  const child = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  return Number(child.stdout);
}

const token = (host: string, pid: number, start: string) => formatToken({ host, pid, start, random: "0123456789abcdef" });

describe("ownership of leftover files", () => {
  const me = { host: hostName(), pid: process.pid, start: startTime(process.pid) ?? "-", random: "x" };

  it("never deletes a file without a token, another host's, or a running process's", () => {
    expect(stale(undefined)).toBe(false);
    expect(stale({ ...me, host: "another-host" })).toBe(false);
    expect(stale(me)).toBe(false);
    expect(stale({ ...me, start: "-" })).toBe(false);
  });

  it("deletes one of this host whose process isn't running, or is another process with its id", () => {
    expect(stale({ ...me, pid: deadPid() })).toBe(true);
    // The id reused by a process started at another time.
    expect(stale({ ...me, start: "another-start" }, me.host, () => true, () => "this-start")).toBe(true);
  });

  it("cleans only stale files, and reports one it can't delete", () => {
    const dir = project({});
    const files = {
      none: join(dir, ".hyper-elements-1-1.tsx"),
      otherHost: join(dir, ".hyper-elements-2-1.tsx"),
      running: join(dir, ".hyper-elements-3-1.tsx"),
      stale: join(dir, ".hyper-elements-4-1.tsx"),
      locked: join(dir, ".hyper-elements-5-1.tsx"),
      notOurs: join(dir, "welcome.tsx"),
    };
    const dead = deadPid();
    writeFileSync(files.none, "export {};\n");
    writeFileSync(files.otherHost, `// ${token("another-host", dead, "-")}\n`);
    writeFileSync(files.running, `// ${token(me.host, process.pid, me.start)}\n`);
    writeFileSync(files.stale, `// ${token(me.host, dead, "-")}\n`);
    writeFileSync(files.locked, `// ${token(me.host, dead, "-")}\n`);
    writeFileSync(files.notOurs, `// ${token(me.host, dead, "-")}\n`);
    const problems = cleanFiles([dir], (owner) => stale(owner), (path) => {
      if (path === files.locked) throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
      rmSync(path);
    });
    expect(existsSync(files.none)).toBe(true);
    expect(existsSync(files.otherHost)).toBe(true);
    expect(existsSync(files.running)).toBe(true);
    expect(existsSync(files.stale)).toBe(false);
    expect(existsSync(files.notOurs)).toBe(true);
    expect(problems).toEqual([{ file: files.locked, folder: dir, message: "EBUSY: resource busy or locked" }]);
  });

  it.runIf(process.platform === "darwin")("a locked leftover gives the run a cli/cleanup warning (macOS: an immutable file)", async () => {
    const dir = project({ "emails/a.tsx": email() });
    const locked = join(dir, "emails/.hyper-elements-9-1.tsx");
    writeFileSync(locked, `// ${token(hostName(), deadPid(), "-")}\n`);
    execFileSync("chflags", ["uchg", locked]);
    try {
      const ran = await cli(dir, ["check", "emails", "--json"]);
      expect(ran.code).toBe(0);
      const warning = lines(ran)[0].diagnostics.find((d: any) => d.code === "cli/cleanup");
      expect(warning).toMatchObject({ severity: "warning", path: "" });
      expect(warning.message).toContain("emails/.hyper-elements-9-1.tsx");
    } finally {
      execFileSync("chflags", ["nouchg", locked]);
    }
  });

  it("reads back the tokens it writes", () => {
    const text = `// ${token("host", 42, "Thu_Nov_12")}`;
    expect(parseToken(text)).toEqual({ host: "host", pid: 42, start: "Thu_Nov_12", random: "0123456789abcdef" });
    expect(parseToken("// something else")).toBeUndefined();
    expect(startTime(process.pid)).toBe(startTime(process.pid));
  });
});

describe("the loader module's text", () => {
  it("names the template as a JSON string: a file URL for an ES module, the path for CommonJS on Node", () => {
    const file = '/x/we"ird\\na\nme #1%.tsx';
    const esm = loaderModuleText(file, "TOKEN", "esm", false);
    expect(esm.split("\n")[0]).toBe("// TOKEN");
    expect(esm).toContain(`import * as template from "file:///x/we%22ird%5Cna%0Ame%20%231%25.tsx";`);
    expect(esm).toContain("export const load = (specifier: string) => import(specifier);");
    const cjs = loaderModuleText(file, "TOKEN", "cjs", false);
    expect(cjs).toContain(`import * as template from ${JSON.stringify(file)};`);
    expect(cjs).toContain("require(specifier)");
    // On Bun, always import().
    expect(loaderModuleText(file, "TOKEN", "cjs", true)).toContain("import(specifier)");
    expect(loaderModuleText("/x/a.jsx", "TOKEN", "esm", false)).toContain("(specifier) => import(specifier)");
  });
});

describe("errorLine", () => {
  it("says a missing module the same way whatever threw it", () => {
    expect(errorLine(new Error("Cannot find module './missing'\nRequire stack:\n- /x/b.tsx"))).toBe("Cannot find module './missing'");
    expect(errorLine(new Error("Cannot find module '/x/emails/missing' imported from /x/emails/b.tsx"))).toBe("Cannot find module './missing'");
    expect(errorLine(new Error("Cannot find module '/x/lib/missing' imported from /x/emails/b.tsx"))).toBe("Cannot find module '../lib/missing'");
    expect(errorLine({ message: "Cannot find module './missing' from '/x/emails/b.tsx'" })).toBe("Cannot find module './missing'");
    expect(errorLine(new Error("Cannot find package 'left-pad' imported from /x/b.tsx"))).toBe("Cannot find module 'left-pad'");
    expect(errorLine("thrown string\nsecond")).toBe("thrown string");
  });
});

describe("destinations and inputs", () => {
  it("folds paths as Windows and macOS compare them", () => {
    expect(foldPath("/Out/Welcome.HTML")).toBe(foldPath("/out/welcome.html"));
    expect(foldPath("/out/café.html")).toBe(foldPath("/out/café.html"));
    expect(foldPath("/out/a. /b.html")).toBe(foldPath("/out/a/b.html"));
  });

  it("finds the folder holding every input", () => {
    expect(commonFolder(["/r/packages/emails", "/r/apps/web/emails"])).toBe("/r");
    expect(commonFolder(["/r/emails"])).toBe("/r/emails");
    expect(commonFolder(["/r/emails", "/r/emails2"])).toBe("/r");
  });

  it("finds default exports with TypeScript's parser", async () => {
    expect(await hasDefaultExport("a.tsx", "export default function A() {}")).toBe(true);
    expect(await hasDefaultExport("a.ts", "const A = 1; export { A as default };")).toBe(true);
    expect(await hasDefaultExport("a.js", "module.exports = function A() {};")).toBe(true);
    expect(await hasDefaultExport("a.ts", "export const a = 'default';")).toBe(false);
    expect(await hasDefaultExport("a.ts", "// export default nothing\nexport const b = 1;")).toBe(false);
  });
});

describe("arguments", () => {
  it("parses each command's options", () => {
    expect(parseArgs(["render", "emails", "--out=build", "--pretty", "--timeout", "500ms"])).toMatchObject({ command: "render", positional: ["emails"], out: "build", pretty: true, timeout: 500 });
    expect(parseArgs(["check", "a.tsx", "--clients", "gmail, outlook", "--max-warnings", "3", "--rendered"])).toMatchObject({ clients: ["gmail", "outlook"], maxWarnings: 3, rendered: true, timeout: 60_000 });
  });

  it("refuses what a command doesn't take", () => {
    for (const argv of [["render", "a", "--clients", "x"], ["check", "a", "--out", "x"], ["outline", "a", "b"], ["render", "a", "--json", "--stdout"], ["render", "a", "--timeout", "0"], ["check"]]) {
      expect(() => parseArgs(argv), argv.join(" ")).toThrow(UsageError);
    }
  });
});

describe("render's PDF and image options", () => {
  it("parses them", () => {
    expect(parseArgs(["render", "cards", "--format", "svg", "--scale", "2", "--html", "--public", "static", "--refresh"])).toMatchObject({ format: "svg", scale: 2, html: true, public: "static", refresh: true, offline: false });
    expect(parseArgs(["render", "cards", "--offline"])).toMatchObject({ format: "png", html: false, offline: true });
  });

  it("refuses what they don't take", () => {
    for (const argv of [["render", "a", "--format", "jpg"], ["render", "a", "--scale", "0"], ["render", "a", "--scale", "two"], ["render", "a", "--refresh", "--offline"], ["check", "a", "--html"], ["check", "a", "--offline"]]) {
      expect(() => parseArgs(argv), argv.join(" ")).toThrow(UsageError);
    }
  });
});

describe("the asset cache's folder", () => {
  it("is in the nearest node_modules above the template", () => {
    const dir = project({ "a/b/card.tsx": "" });
    expect(cacheFolder(join(dir, "a/b/card.tsx"))).toBe(join(dir, "node_modules/.cache/hyper-elements"));
  });

  it("is the OS's cache folder where there's none", () => {
    const env = { XDG_CACHE_HOME: "/x", LOCALAPPDATA: "C:\\Local" };
    expect(osCache(env, "linux")).toBe("/x");
    expect(osCache({}, "linux")).toBe(join(homedir(), ".cache"));
    expect(osCache(env, "darwin")).toBe(join(homedir(), "Library", "Caches"));
    expect(osCache(env, "win32")).toBe("C:\\Local");
  });

  it("decodes data: URIs, base64 or percent-encoded", () => {
    expect(Buffer.from(decodeDataUri("data:font/ttf;base64,AAEC")!)).toEqual(Buffer.from([0, 1, 2]));
    expect(Buffer.from(decodeDataUri("data:image/svg+xml,%3Csvg%3E")!).toString()).toBe("<svg>");
    expect(decodeDataUri("https://example.com/a.ttf")).toBeUndefined();
  });
});

