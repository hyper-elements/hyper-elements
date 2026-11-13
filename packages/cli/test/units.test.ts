/**
 * The parts with no process of their own, in-process: who owns a leftover file, error lines, how destinations are
 * compared, the arguments, and how the browser that draws the previews is started (with playwright-core's launch
 * stood in for, so no browser is).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseArgs, UsageError } from "../src/args";
import { cacheFolder, decodeDataUri, osCache } from "../src/assets";
import { foldPath } from "../src/destinations";
import { errorLine } from "../src/errors";
import { hasDefaultExport } from "../src/inputs";
import { cleanFiles, formatToken, hostName, loaderModuleText, parseToken, stale, startTime } from "../src/loader-module";
import { orphansOf } from "../src/kill";
import { openBrowser } from "../src/preview/browser";
import { cli, email, lines, project, WINDOWS } from "./helpers";

/** playwright-core's launch, stood in for: each test says what a start gives. */
const { launch } = vi.hoisted(() => ({ launch: vi.fn() }));
vi.mock("playwright-core", () => ({ chromium: { launch } }));

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
    // (On Windows a backslash separates folders, so it can't be in a file's name, and a path starts with a drive.)
    const file = WINDOWS ? 'C:\\x\\we"ird na\nme #1%.tsx' : '/x/we"ird\\na\nme #1%.tsx';
    const esm = loaderModuleText(file, "TOKEN", "esm", false);
    expect(esm.split("\n")[0]).toBe("// TOKEN");
    expect(esm).toContain(
      WINDOWS ? `import * as template from "file:///C:/x/we%22ird%20na%0Ame%20%231%25.tsx";` : `import * as template from "file:///x/we%22ird%5Cna%0Ame%20%231%25.tsx";`
    );
    expect(esm).toContain(`import * as template from ${JSON.stringify(pathToFileURL(file).href)};`);
    expect(esm).toContain("export const load = (specifier: string) => import(specifier);");
    const cjs = loaderModuleText(file, "TOKEN", "cjs", false);
    expect(cjs).toContain(`import * as template from ${JSON.stringify(file)};`);
    expect(cjs).toContain("require(specifier)");
    // On Bun, always import().
    expect(loaderModuleText(file, "TOKEN", "cjs", true)).toContain("import(specifier)");
    expect(loaderModuleText("/x/a.jsx", "TOKEN", "esm", false)).toContain("(specifier) => import(specifier)");
  });
});

describe("a crashed child's processes on Windows", () => {
  it("are the ones its id started while it ran, and theirs: not a later process's that has its id", () => {
    // id, parent, started (ms). The child, 100, ran from 1,000 to 5,000.
    const table = [
      "4 0 0",
      "100 50 1000", // the child (its row, if it's still listed)
      "201 100 2000", // started by the child
      "202 201 6000", // started by that one, after the child ended
      "203 100 900", // 100's before the child (within a second: the clocks' grain)
      "300 100 8000", // the id 100 given to another process after the child ended: its child, not ours
      "301 300 9000",
      "400 7 2500", // unrelated
      "garbage line",
      "",
    ].join("\r\n");
    expect(orphansOf(table, 100, 1_000, 5_000).sort()).toEqual([201, 202, 203]);
    expect(orphansOf(table, 999, 1_000, 5_000)).toEqual([]);
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

  it("parses preview's, describe's and inspect's, and leaves migrate's arguments as they are", () => {
    expect(parseArgs(["preview", "emails", "--clients", "gmail,outlook", "--dark", "--fonts", "inline", "--serve", "--json"])).toMatchObject({
      command: "preview",
      positional: ["emails"],
      clients: ["gmail", "outlook"],
      dark: true,
      fonts: "inline",
      serve: true,
      findings: false,
    });
    // --screenshots draws the previews, as --findings does.
    expect(parseArgs(["preview", "a.tsx", "--screenshots"])).toMatchObject({ findings: true, screenshots: true });
    expect(parseArgs(["preview", "--install-browser"])).toMatchObject({ command: "preview", installBrowser: true, positional: [] });
    expect(parseArgs(["describe"])).toMatchObject({ command: "describe", positional: [] });
    expect(parseArgs(["describe", "Button", "--root", "Email", "--json"])).toMatchObject({ positional: ["Button"], root: "Email", json: true });
    expect(parseArgs(["inspect", "a.tsx", "--json", "--props", "p.json"])).toMatchObject({ command: "inspect", json: true, props: "p.json" });
    expect(parseArgs(["migrate", "emails", "--out", "x", "--json", "--bogus"])).toMatchObject({ command: "migrate", positional: ["emails", "--out", "x", "--json", "--bogus"] });
  });

  it("refuses what a command doesn't take", () => {
    for (const argv of [
      ["render", "a", "--rendered"],
      ["outline", "a", "--clients", "x"],
      ["check", "a", "--out", "x"],
      ["outline", "a", "b"],
      ["render", "a", "--json", "--stdout"],
      ["render", "a", "--timeout", "0"],
      ["check"],
      ["check", "a", "--findings"],
      ["render", "a", "--serve"],
      ["preview"],
      ["preview", "a", "--fonts", "cdn"],
      ["preview", "a", "--install-browser"],
      ["preview", "--install-browser", "--json"],
      ["describe", "Button", "Text"],
      ["describe", "--out", "x"],
      ["inspect"],
      ["inspect", "a", "--clients", "gmail"],
    ]) {
      expect(() => parseArgs(argv), argv.join(" ")).toThrow(UsageError);
    }
  });
});

describe("render's PDF and image options", () => {
  it("parses them", () => {
    expect(parseArgs(["render", "cards", "--format", "svg", "--scale", "2", "--html", "--public", "static", "--refresh"])).toMatchObject({ format: "svg", scale: 2, html: true, public: "static", refresh: true, offline: false });
    expect(parseArgs(["render", "cards", "--offline"])).toMatchObject({ format: "png", html: false, offline: true });
    expect(parseArgs(["render", "emails", "--clients", "gmail,outlook"])).toMatchObject({ clients: ["gmail", "outlook"] });
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

describe("the browser the previews are drawn in", () => {
  /** A failed start as playwright-core says it: what failed, then what the browser wrote as it ended. */
  const failed = (...wrote: string[]) => new Error(["browserType.launch: Target page, context or browser has been closed", "Browser logs:", ...wrote].join("\n"));
  // What Chromium writes as it ends: as root in a container, where the kernel gives it no user namespaces (a
  // seccomp profile, or AppArmor on Ubuntu) and where its setuid helper isn't set up; and playwright-core's own
  // heading over any of them.
  const AS_ROOT = "  - [pid=76][err] [1113/125427.241481:ERROR:content/browser/zygote_host/zygote_host_impl_linux.cc:101] Running as root without --no-sandbox is not supported. See https://crbug.com/638180.";
  const NO_NAMESPACES = "  - [pid=31][err] [1113/125456.540278:FATAL:content/browser/zygote_host/zygote_host_impl_linux.cc:128] No usable sandbox! If you are running on Ubuntu 23.10+ or another Linux distro that has disabled unprivileged user namespaces with AppArmor, see the documentation.";
  const HELPER = "  - [pid=12][err] [1113/125501.000000:FATAL:content/browser/zygote_host/zygote_host_impl_linux.cc:147] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now.";
  const HEADING = "Chromium sandboxing failed!";
  // A start that fails with no word of the sandbox: its command line has "sandbox" in a flag's name, which isn't one.
  const CRASHED = failed("", "Call log:", "  - <launching> /fixture/chromium --disable-features=IsolateSandboxedIframes --headless", "  - [pid=7][err] Received signal 11 SEGV_MAPERR 000000000000");
  const browser = { version: () => "148.0.7778.96", close: async () => undefined };
  /** Whether each start asked for the sandbox, in order. */
  const sandboxes = () => launch.mock.calls.map(([options]) => options.chromiumSandbox);

  beforeEach(() => {
    launch.mockReset();
    // One browser to start: Playwright's own Chromium.
    vi.stubEnv("CHROME_PATH", "");
    vi.stubEnv("HYPER_ELEMENTS_CLI_BROWSER_CHANNELS", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is started in Chromium's sandbox", async () => {
    launch.mockResolvedValue(browser);
    expect(await openBrowser()).toMatchObject({ name: "chromium 148.0.7778.96, playwright", sandboxed: true });
    expect(sandboxes()).toEqual([true]);
  });

  it.each([
    ["as root", failed(AS_ROOT)],
    ["with no user namespaces", failed(NO_NAMESPACES)],
    ["with a setuid helper that isn't set up", failed(HELPER)],
    ["under playwright-core's heading alone", failed(HEADING)],
  ])("is started without it at once where the failed start names the sandbox: %s", async (_, failure) => {
    launch.mockRejectedValueOnce(failure).mockResolvedValue(browser);
    expect(await openBrowser()).toMatchObject({ name: "chromium 148.0.7778.96, playwright, no sandbox", sandboxed: false });
    expect(sandboxes()).toEqual([true, false]);
  });

  it("is tried in the sandbox once more after a start that failed for another reason, and stays in it", async () => {
    launch.mockRejectedValueOnce(CRASHED).mockResolvedValue(browser);
    expect(await openBrowser()).toMatchObject({ name: "chromium 148.0.7778.96, playwright", sandboxed: true });
    expect(sandboxes()).toEqual([true, true]);
  });

  it("is started without it after two such starts: a sandbox that can't start and doesn't say so", async () => {
    launch.mockRejectedValueOnce(CRASHED).mockRejectedValueOnce(CRASHED).mockResolvedValue(browser);
    expect(await openBrowser()).toMatchObject({ name: "chromium 148.0.7778.96, playwright, no sandbox", sandboxed: false });
    expect(sandboxes()).toEqual([true, true, false]);
  });

  it.each([
    ["was too slow to start", new Error("browserType.launch: Timeout 30000ms exceeded.")],
    ["isn't there", new Error("browserType.launch: Executable doesn't exist at /fixture/chromium")],
  ])("is never started without it where it %s", async (_, failure) => {
    launch.mockRejectedValue(failure);
    expect(await openBrowser()).toMatchObject({ browser: null, tried: [expect.stringContaining("Playwright's Chromium: ")] });
    expect(sandboxes()).toEqual([true]);
  });
});
