/**
 * `dev`: a page on 127.0.0.1 showing each template, rendered again in fresh child processes when the project changes.
 * A change to an imported file (relative, through a path alias, in a workspace package's source, and in a workspace
 * package built to dist/ whose rebuild lands 500 ms after its source changes) is shown within a second of the last
 * change; two folders with different tsconfigs compile with their own; a template that loops is ended and reported
 * while the server keeps serving; and the server answers only its own Host and Origin (the event stream too), under
 * its prefix, with files from its own folder. Each with the CLI started on Node and on Bun (CLI_RUNTIME).
 */
import { readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { connect } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, devUntil, email, type Dev, leftovers, link, MODULES, project, startDev, wait, WINDOWS, write } from "./helpers";

/**
 * How soon after the last change the page must show it. What that times is process starts and module loading, which
 * the rest of the suite running beside it (every file, on both runtimes at once) slows several times over; so the
 * second is held by `pnpm test:timing` (vitest.timing.config.ts: these tests alone, one file at a time, as CI runs
 * them), and the suite holds a looser bound that still catches a render that waits on something.
 */
const TIMED = process.env.HYPER_ELEMENTS_CLI_TIMED === "1";
const WITHIN = TIMED ? (WINDOWS ? 3_000 : 1_000) : 5_000;
/**
 * Two groups rendering at once (a child each) on CI's shared Linux runners took 1.2 to 1.6 s where a developer's
 * machine takes 0.65 s: there the bound is the one Windows has. Elsewhere it's the second.
 */
const WITHIN_GROUPS = TIMED && process.env.CI ? 3_000 : WITHIN;

/** A timed test runs again where it failed: a machine's moment of load isn't what it measures. */
const RETRY = TIMED ? 2 : 0;

/** Every path a test changed (absolute), for what each render was for to be checked against. */
const changed = new Set<string>();

/** Writes files, and resolves with when (the last change). */
function change(dir: string, files: Record<string, string>): number {
  write(dir, files);
  for (const file of Object.keys(files)) changed.add(join(dir, file));
  return Date.now();
}

/**
 * Each render after the first was for a change the test made: none for a loader module the children wrote beside the
 * templates, or anything else the CLI wrote. (A late or repeated event may add a render; that isn't what's checked.)
 */
async function rendersWereForTheTest(dev: Dev, cwd: string): Promise<void> {
  const { history } = await dev.state();
  for (const { version, changed: paths } of history.filter((render: any) => render.version > 1)) {
    expect(paths.length, `render ${version} had no change\n${dev.stderr()}`).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path, `render ${version}`).not.toMatch(/(^|\/)\.hyper-elements-/);
      const absolute = resolve(cwd, path);
      expect([...changed].some((made) => made === absolute || made.startsWith(absolute + sep)), `render ${version} was for ${path}, which the test didn't change\n${dev.stderr()}`).toBe(true);
    }
  }
}

describe("dev re-renders what changed", () => {
  it("a relative import, an alias, a workspace package's source, and a workspace package rebuilt into dist/ 500 ms after its source", { retry: RETRY }, async () => {
    const dir = project(
      {
        "package.json": JSON.stringify({ name: "root", private: true }),
        "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
        // A package whose runtime is its source.
        "packages/ui/package.json": JSON.stringify({ name: "@acme/ui", type: "module", main: "./src/index.ts" }),
        "packages/ui/src/index.ts": `export const ui = "ui one";\n`,
        // A package whose runtime is what its build writes in dist/, its types a .d.ts beside it.
        "packages/built/package.json": JSON.stringify({ name: "@acme/built", type: "module", main: "./dist/index.js", types: "./dist/index.d.ts" }),
        "packages/built/src/index.ts": `export const built: string = "built one";\n`,
        "packages/built/dist/index.js": `export const built = "built one";\n`,
        "packages/built/dist/index.d.ts": `export declare const built: string;\n`,
        "apps/web/package.json": JSON.stringify({ name: "web", type: "module", dependencies: { "@acme/ui": "workspace:*", "@acme/built": "workspace:*" } }),
        "apps/web/tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
        "apps/web/src/word.ts": `export const word = "alias one";\n`,
        "apps/web/emails/parts/greeting.ts": `export const greeting = "relative one";\n`,
        "apps/web/emails/a.tsx": `import { Email, Text } from "@hyper-elements/react";
import { greeting } from "./parts/greeting";
import { word } from "@/word";
import { ui } from "@acme/ui";
import { built } from "@acme/built";
export default function A() { return <Email><Text>{[greeting, word, ui, built].join(", ")}</Text></Email>; }
`,
      },
      { packageJson: null, modules: [] },
    );
    const web = join(dir, "apps/web");
    for (const name of ["react", "react-dom", "@hyper-elements/react"]) link(web, name, MODULES[name]);
    link(web, "@acme/ui", join(dir, "packages/ui"));
    link(web, "@acme/built", join(dir, "packages/built"));

    const dev = await startDev(web, ["emails"]);
    const shows = (text: string) => (_: any, txt: string) => txt.includes(text);
    await devUntil(dev, shows("relative one, alias one, ui one, built one"), "emails/a.tsx");

    let at = change(web, { "emails/parts/greeting.ts": `export const greeting = "relative two";\n` });
    await devUntil(dev, shows("relative two, alias one"), "emails/a.tsx");
    expect(Date.now() - at, `a relative import\n${dev.stderr()}`).toBeLessThan(WITHIN);

    at = change(web, { "src/word.ts": `export const word = "alias two";\n` });
    await devUntil(dev, shows("relative two, alias two"), "emails/a.tsx");
    expect(Date.now() - at, `an aliased import\n${dev.stderr()}`).toBeLessThan(WITHIN);

    at = change(dir, { "packages/ui/src/index.ts": `export const ui = "ui two";\n` });
    await devUntil(dev, shows("alias two, ui two"), "emails/a.tsx");
    expect(Date.now() - at, `a workspace package's source\n${dev.stderr()}`).toBeLessThan(WITHIN);

    // Its source changes, and the build that follows lands 500 ms later: the page shows the build within a second of it.
    change(dir, { "packages/built/src/index.ts": `export const built: string = "built two";\n` });
    await wait(500);
    at = change(dir, { "packages/built/dist/index.js": `export const built = "built two";\n` });
    await devUntil(dev, shows("ui two, built two"), "emails/a.tsx");
    expect(Date.now() - at, `a workspace package rebuilt into dist/\n${dev.stderr()}`).toBeLessThan(WITHIN);

    // The page says what each render was for (relative to the folder dev runs in).
    const latest = await dev.state();
    expect(latest.history.at(-1)).toEqual({ version: latest.version, changed: latest.changed });
    expect(latest.history.some((render: any) => render.changed.includes("../../packages/built/dist/index.js")), dev.stderr()).toBe(true);
    expect(dev.stderr()).toMatch(/Rendered 1 template in \d+ ms, after a change to [^\n]*\.\.\/\.\.\/packages\/built\/dist\/index\.js/);

    // A build that clears dist/ and writes it again is seen too.
    rmSync(join(dir, "packages/built/dist"), { recursive: true });
    await wait(150);
    change(dir, { "packages/built/dist/index.js": `export const built = "built three";\n`, "packages/built/dist/index.d.ts": `export declare const built: string;\n` });
    await devUntil(dev, shows("built three"), "emails/a.tsx");

    // Quiet for a while: nothing the children wrote beside the templates (their loader modules) caused a render.
    await wait(600);
    await rendersWereForTheTest(dev, web);
    expect(leftovers(web)).toEqual([]);
  });

  it("two folders with different tsconfigs, each compiling with its own", { retry: RETRY }, async () => {
    const dir = project({
      "a/tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "react-jsx", baseUrl: ".", paths: { "@lib/*": ["./lib/*"] } } }),
      "a/lib/word.ts": `export const word = "A's alias";\n`,
      "a/emails/one.tsx": `import { Email, Text } from "@hyper-elements/react";
import { word } from "@lib/word";
export default function T() { return <Email><Text>one says {word}</Text></Email>; }
`,
      "b/tsconfig.json": JSON.stringify({ compilerOptions: { jsx: "react-jsx", baseUrl: ".", paths: { "@lib/*": ["./other/*"] } } }),
      "b/other/word.ts": `export const word = "B's alias";\n`,
      "b/emails/two.tsx": `import { Email, Text } from "@hyper-elements/react";
import { word } from "@lib/word";
export default function T() { return <Email><Text>two says {word}</Text></Email>; }
`,
    });
    const dev = await startDev(dir, ["a/emails", "b/emails"]);
    await devUntil(dev, (_, text) => text.includes("one says A's alias"), "a/emails/one.tsx");
    await devUntil(dev, (_, text) => text.includes("two says B's alias"), "b/emails/two.tsx");
    const at = change(dir, { "b/other/word.ts": `export const word = "B's alias, changed";\n` });
    await devUntil(dev, (_, text) => text.includes("two says B's alias, changed"), "b/emails/two.tsx");
    expect(Date.now() - at, dev.stderr()).toBeLessThan(WITHIN_GROUPS);
    await devUntil(dev, (_, text) => text.includes("one says A's alias"), "a/emails/one.tsx");
  });

  it("a template that loops is ended and reported, and the server keeps serving", async () => {
    // The loop in a package of its own, so its group's child is the one ended (a template in its group, rendered before
    // the loop, would be shown too, but on a busy machine may not be done in time either).
    const dir = project({
      "emails/a.tsx": email("Still here"),
      "slow/package.json": JSON.stringify({ name: "slow", private: true, type: "module" }),
      "slow/b.tsx": `import { Email, Text } from "@hyper-elements/react";
export default function Loop() { for (;;) {} return <Email><Text>never</Text></Email>; }
`,
    });
    const dev = await startDev(dir, ["emails", "slow", "--timeout", "5s"]);
    const state = await devUntil(dev, (t) => t.status === "error", "slow/b.tsx");
    const loop = state.templates.find((t: any) => t.file === "slow/b.tsx");
    expect(loop.diagnostics.map((d: any) => d.code)).toEqual(["cli/timeout"]);
    // The other template, in another group, is shown.
    const ok = state.templates.find((t: any) => t.file === "emails/a.tsx");
    expect(ok.status).toBe("ok");
    expect(await dev.text(ok.files.txt)).toContain("Still here");
    expect(dev.stderr()).toContain("cli/timeout");
    // Still serving: the page, and a render of the next change.
    const page = await fetch(dev.base);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>Hyper Elements dev</title>");
    write(dir, { "emails/a.tsx": email("Changed while one loops") });
    await devUntil(dev, (_, text) => text.includes("Changed while one loops"), "emails/a.tsx");
    // Fixed, it renders.
    write(dir, { "slow/b.tsx": email("Loop fixed") });
    await devUntil(dev, (t, text) => t.status === "ok" && text.includes("Loop fixed"), "slow/b.tsx");
    expect(dev.child.exitCode).toBe(null);
  });

  it("says what's wrong when the folder holds no template any more, and renders again once it does", async () => {
    const dir = project({ "emails/a.tsx": email("First") });
    const dev = await startDev(dir, ["emails"]);
    write(dir, { "emails/a.tsx": `export const notATemplate = 1;\n` });
    const end = Date.now() + 10_000;
    let state: any;
    while (Date.now() < end) {
      state = await dev.state();
      if (state.error) break;
      await wait(25);
    }
    expect(state.error, dev.stderr()).toContain("holds no template");
    write(dir, { "emails/a.tsx": email("Back") });
    await devUntil(dev, (_, text) => text.includes("Back"), "emails/a.tsx");
  });
});

interface Answer {
  status: number;
  body: string;
  type?: string;
}

/** A GET with these headers (Host included), the path sent as written; a stream is read to its first event, then closed. */
function get(port: number, path: string, headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method: "GET", headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      const done = () => resolve({ status: res.statusCode!, body, type: res.headers["content-type"] });
      const stream = res.headers["content-type"]?.startsWith("text/event-stream");
      const close = () => {
        done();
        req.destroy();
      };
      // A stream: read to its first event, or for a few seconds (a busy machine can be slow to send it).
      const timer = stream ? setTimeout(close, 5_000) : undefined;
      res.on("data", (d) => {
        body += d;
        if (stream && body.includes("\n\n")) {
          clearTimeout(timer);
          close();
        }
      });
      res.on("end", done);
    });
    req.on("error", reject);
    req.end();
  });
}

function answers(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

describe("dev's server", () => {
  it("answers only its own Host and Origin (the event stream too), under its prefix, with files from its own folder", async () => {
    const marker = `Served ${Math.random().toString(36).slice(2)}`;
    const dir = project({ "emails/a.tsx": email(marker) });
    writeFileSync(join(dir, "secret.txt"), "not for the browser");
    const dev = await startDev(dir, ["emails"]);
    const { port, prefix } = dev;
    const state = await devUntil(dev, (_, text) => text.includes(marker), "emails/a.tsx");
    const txt = state.templates[0].files.txt as string;

    // Its own: the page, the state, the event stream, a file.
    const page = await get(port, `/${prefix}/`);
    expect(page.status).toBe(200);
    expect(page.type).toBe("text/html; charset=utf-8");
    expect((await get(port, `/${prefix}/state.json`)).status).toBe(200);
    const stream = await get(port, `/${prefix}/events`);
    expect(stream.status).toBe(200);
    expect(stream.type).toBe("text/event-stream; charset=utf-8");
    expect(stream.body).toMatch(/^retry: 1000\ndata: \d+\n\n/);
    expect((await get(port, `/${prefix}/${txt}`)).body).toContain(marker);
    // localhost and [::1] by name, and its own Origin.
    expect((await get(port, `/${prefix}/state.json`, { Host: `localhost:${port}` })).status).toBe(200);
    expect((await get(port, `/${prefix}/state.json`, { Host: `[::1]:${port}` })).status).toBe(200);
    expect((await get(port, `/${prefix}/events`, { Origin: `http://127.0.0.1:${port}` })).status).toBe(200);

    // Another Host or Origin: 403, everywhere, the event stream included.
    for (const path of [`/${prefix}/`, `/${prefix}/state.json`, `/${prefix}/events`, `/${prefix}/${txt}`]) {
      for (const headers of <Array<Record<string, string>>>[{ Host: "evil.example" }, { Host: `evil.example:${port}` }, { Origin: "http://evil.example" }, { Origin: "null" }]) {
        const answer = await get(port, path, headers);
        expect([path, headers, answer.status]).toEqual([path, headers, 403]);
        expect(answer.body).not.toContain(marker);
        expect(answer.body).not.toContain("data:");
      }
    }
    // Without the prefix, or with another: 404.
    for (const path of ["/", "/state.json", "/events", `/${"0".repeat(32)}/state.json`, `/${prefix}`]) expect((await get(port, path)).status, path).toBe(404);

    // Nothing outside its folder: find it (a temporary folder holding this render), and put a link out in it.
    const folder = readdirSync(tmpdir())
      .filter((name) => name.startsWith("hyper-elements-dev-"))
      .map((name) => realpathSync(join(tmpdir(), name)))
      .find((candidate) => {
        try {
          return readFileSync(join(candidate, ...txt.split("/")), "utf8").includes(marker);
        } catch {
          return false;
        }
      });
    expect(folder).toBeDefined();
    if (!WINDOWS) symlinkSync(join(dir, "secret.txt"), join(folder!, "link.txt"));
    for (const path of [
      `/${prefix}/../secret.txt`,
      `/${prefix}/1/../../secret.txt`,
      `/${prefix}/%2e%2e/%2e%2e/secret.txt`,
      `/${prefix}/%2E%2E%2F%2E%2E%2Fsecret.txt`,
      `/${prefix}/..%5c..%5csecret.txt`,
      `/${prefix}/1\\..\\..\\secret.txt`,
      `/${prefix}/%2fetc%2fpasswd`,
      ...(WINDOWS ? [] : [`/${prefix}/link.txt`]),
    ]) {
      const answer = await get(port, path);
      expect(answer.status, path).toBeGreaterThanOrEqual(400);
      expect(answer.body, path).not.toContain("not for the browser");
    }
    expect((await get(port, `/${prefix}/%252e%252e/secret.txt`)).status).toBe(404);

    // It listens on 127.0.0.1 alone: not on ::1, nor on this machine's other addresses.
    expect(await answers("127.0.0.1", port)).toBe(true);
    expect(await answers("::1", port)).toBe(false);
    for (const address of Object.values(networkInterfaces()).flat()) {
      if (address && !address.internal && address.family === "IPv4") expect(await answers(address.address, port), address.address).toBe(false);
    }

    // Ctrl-C ends it with exit 0: its URL written, no summary, its folder removed, nothing left beside the templates.
    if (!WINDOWS) {
      dev.child.kill("SIGINT");
      expect(await dev.exited).toBe(0);
      expect(dev.stdout()).toBe(`Serving the templates at ${dev.base} until Ctrl-C\n`);
      expect(readdirSync(tmpdir())).not.toContain(folder!.split(/[\\/]/).pop());
      expect(leftovers(dir)).toEqual([]);
    }
  });

  it("serves an Email's and a Page's HTML as a sandbox of its own, and nothing it renders as the page", async () => {
    const dir = project({
      "emails/a.tsx": email("Sandboxed"),
      "pages/p.tsx": `import { Page, Text } from "@hyper-elements/react";
export default function P() { return <Page><Text>A page</Text></Page>; }
`,
    });
    const dev = await startDev(dir, ["emails", "pages"]);
    const state = await dev.state();
    const [mail, page] = state.templates;
    expect([mail.root, page.root]).toEqual(["Email", "Page"]);
    for (const url of [mail.files.html, page.files.html]) {
      const response = await fetch(dev.base + url);
      expect(response.headers.get("content-security-policy")).toBe("sandbox allow-scripts allow-popups");
    }
    // The page runs its own script only, and can't be framed.
    const policy = (await fetch(dev.base)).headers.get("content-security-policy")!;
    expect(policy).toMatch(/script-src 'sha256-[^']+'(;|$)/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("unsafe");
  });
});

describe("dev's arguments", () => {
  it("a missing file exits 2 before serving", async () => {
    const dir = project({});
    const ran = await cli(dir, ["dev", "nothing.tsx"]);
    expect(ran.code).toBe(2);
    expect(ran.stdout).toBe("");
    expect(ran.stderr).toContain("nothing.tsx doesn't exist");
  });

  it("takes no --out or --json", async () => {
    const dir = project({ "emails/a.tsx": email() });
    for (const option of ["--out", "--json", "--serve"]) {
      const ran = await cli(dir, ["dev", "emails", option, ...(option === "--out" ? ["x"] : [])]);
      expect(ran.code, option).toBe(2);
      expect(ran.stderr).toContain(`${option} isn't an option of dev`);
    }
  });
});
