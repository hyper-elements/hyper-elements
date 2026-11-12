/**
 * `preview --serve`: the previews served on 127.0.0.1 until Ctrl-C (exit 0, no summary), each preview's `url` beside
 * its `path`. Only its own Host and Origin are answered, only under its random prefix, and only files in
 * out/clients/ (`..`, `%2e%2e`, backslashes and a symbolic link out are refused). And `--install-browser` runs
 * playwright-core's install (here against a download host of the test's own, which has nothing) and exits.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { connect } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BIN, cli, cliEnv, email, project, RUNTIME, until, WINDOWS, WITH_CLIENTS } from "./helpers";

interface Answer {
  status: number;
  body: string;
}

/** A GET with the headers given (Host included), and the path sent as written. */
function get(port: number, path: string, headers: Record<string, string> = {}, host = "127.0.0.1"): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = request({ host, port, path, method: "GET", headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode!, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** Whether something answers a TCP connection on `host`:`port`. */
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

describe("preview --serve", () => {
  it("serves the previews on 127.0.0.1 under a random prefix, its own Host and Origin only, until Ctrl-C", async () => {
    const dir = project({ "emails/a.tsx": email("Served") }, { modules: WITH_CLIENTS });
    writeFileSync(join(dir, "secret.txt"), "not for the browser");
    const child = spawn(RUNTIME === "bun" ? "bun" : process.execPath, [BIN, "preview", "emails", "--json", "--clients", "gmail"], { cwd: dir, env: cliEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    // The run without --serve, to compare: then the same run serving.
    await new Promise((resolve) => child.on("close", resolve));
    expect(stdout.trim().split("\n")).toHaveLength(2);

    const served = spawn(RUNTIME === "bun" ? "bun" : process.execPath, [BIN, "preview", "emails", "--json", "--clients", "gmail", "--serve"], { cwd: dir, env: cliEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    served.stdout.on("data", (d) => (out += d));
    served.stderr.on("data", (d) => (stderr += d));
    const exited = new Promise<number | null>((resolve) => served.on("close", (code) => resolve(code)));
    try {
      expect(await until(() => out.includes("\n"), 30_000), stderr).toBe(true);
      const lines = out.trim().split("\n").map((line) => JSON.parse(line));
      // One line per template, with each preview's url beside its path, and no summary.
      expect(lines).toHaveLength(1);
      const [line] = lines;
      expect(line.previews.map((p: any) => p.id)).toEqual(["gmail", "gmail.mac"]);
      const url = new URL(line.previews[0].url);
      expect(url.hostname).toBe("127.0.0.1");
      expect(url.pathname).toMatch(/^\/[0-9a-f]{32}\/a\/gmail\.html$/);
      expect(line.previews[0].path).toBe("out/clients/a/gmail.html");
      const port = Number(url.port);
      const prefix = url.pathname.split("/")[1];

      // The printed URLs open.
      for (const preview of line.previews) {
        const response = await fetch(preview.url);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
        expect(await response.text()).toContain("data-email-client-ready");
      }
      // localhost and [::1] by name are its own; another name isn't.
      expect((await get(port, `/${prefix}/a/gmail.html`, { Host: `localhost:${port}` })).status).toBe(200);
      expect((await get(port, `/${prefix}/a/gmail.html`, { Host: `[::1]:${port}` })).status).toBe(200);
      expect((await get(port, `/${prefix}/a/gmail.html`, { Host: "evil.example" })).status).toBe(403);
      expect((await get(port, `/${prefix}/a/gmail.html`, { Host: `evil.example:${port}` })).status).toBe(403);
      // Its own Origin, or none; not another.
      expect((await get(port, `/${prefix}/a/gmail.html`, { Origin: `http://127.0.0.1:${port}` })).status).toBe(200);
      expect((await get(port, `/${prefix}/a/gmail.html`, { Origin: "http://evil.example" })).status).toBe(403);
      expect((await get(port, `/${prefix}/a/gmail.html`, { Origin: "null" })).status).toBe(403);
      // Without the prefix, or with another: 404.
      expect((await get(port, "/a/gmail.html")).status).toBe(404);
      expect((await get(port, `/${"0".repeat(32)}/a/gmail.html`)).status).toBe(404);
      expect((await get(port, "/")).status).toBe(404);
      // Nothing outside out/clients/.
      if (!WINDOWS) symlinkSync(join(dir, "secret.txt"), join(dir, "out/clients/a/link.html"));
      for (const path of [
        `/${prefix}/../../secret.txt`,
        `/${prefix}/a/../../../secret.txt`,
        `/${prefix}/%2e%2e/%2e%2e/secret.txt`,
        `/${prefix}/%2E%2E%2F%2E%2E%2Fsecret.txt`,
        `/${prefix}/..%5c..%5csecret.txt`,
        `/${prefix}/a\\..\\..\\..\\secret.txt`,
        `/${prefix}/%2fetc%2fpasswd`,
        ...(WINDOWS ? [] : [`/${prefix}/a/link.html`]),
      ]) {
        const answer = await get(port, path);
        expect([path, answer.status]).toEqual([path, expect.any(Number)]);
        expect(answer.status, path).toBeGreaterThanOrEqual(400);
        expect(answer.body, path).not.toContain("not for the browser");
      }
      // Decoded once: %252e%252e is a name, not a step up.
      expect((await get(port, `/${prefix}/%252e%252e/secret.txt`)).status).toBe(404);
      // It listens on 127.0.0.1 alone: not on ::1, nor on this machine's other addresses.
      expect(await answers("127.0.0.1", port)).toBe(true);
      expect(await answers("::1", port)).toBe(false);
      for (const address of Object.values(networkInterfaces()).flat()) {
        if (address && !address.internal && address.family === "IPv4") expect(await answers(address.address, port), address.address).toBe(false);
      }
      // Ctrl-C ends it with exit 0 (Windows has no signals to send it: the process is ended).
      if (!WINDOWS) {
        served.kill("SIGINT");
        expect(await exited).toBe(0);
      }
      // Still no summary after Ctrl-C.
      expect(out.trim().split("\n")).toHaveLength(1);
    } finally {
      served.kill("SIGKILL");
    }
  });

  it("writes the URLs as text, and says where it's serving", async () => {
    const dir = project({ "emails/a.tsx": email() }, { modules: WITH_CLIENTS });
    const served = spawn(RUNTIME === "bun" ? "bun" : process.execPath, [BIN, "preview", "emails", "--clients", "outlook", "--serve"], { cwd: dir, env: cliEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    served.stdout.on("data", (d) => (out += d));
    const exited = new Promise<number | null>((resolve) => served.on("close", (code) => resolve(code)));
    try {
      expect(await until(() => out.includes("until Ctrl-C"), 30_000)).toBe(true);
      expect(out).toMatch(/outlook: http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}\/a\/outlook\.html\n/);
      expect(out).not.toMatch(/templates?: \d+ errors?/);
      if (!WINDOWS) {
        served.kill("SIGTERM");
        expect(await exited).toBe(0);
      }
    } finally {
      served.kill("SIGKILL");
    }
  });
});

describe("preview --install-browser", () => {
  it("runs playwright-core's install of Chromium and exits, with no template", async () => {
    // A download host of the test's own: it records what's asked and has nothing.
    const asked: string[] = [];
    const host = createServer((req, res) => {
      asked.push(req.url ?? "");
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => host.listen(0, "127.0.0.1", () => resolve()));
    const port = (host.address() as { port: number }).port;
    const browsers = mkdtempSync(join(tmpdir(), "hyper-elements-cli-install-"));
    try {
      const dir = project({});
      // On Linux, a distribution Playwright has no build for (Ubuntu 26.04 for 1.60) fails before asking: name one it
      // has, since what's tested is the CLI's install, not Playwright's platform list.
      const platform: Record<string, string> = process.platform === "linux" ? { PLAYWRIGHT_HOST_PLATFORM_OVERRIDE: `ubuntu24.04-${process.arch === "arm64" ? "arm64" : "x64"}` } : {};
      const ran = await cli(dir, ["preview", "--install-browser"], {
        env: { ...platform, PLAYWRIGHT_BROWSERS_PATH: browsers, PLAYWRIGHT_DOWNLOAD_HOST: `http://127.0.0.1:${port}`, PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: "5000" },
        timeout: 120_000,
      });
      // It asked for Chromium, got nothing, and said so: exit 2.
      expect(asked.some((path) => /chrom/i.test(path)), ran.stderr).toBe(true);
      expect(ran.code).toBe(2);
      expect(ran.stdout).toBe("");
      expect(ran.stderr).toContain("installing Playwright's Chromium failed");
      expect(readdirSync(dir).sort()).toEqual(["node_modules", "package.json"]);
    } finally {
      host.close();
    }
  });

  it("takes nothing else", async () => {
    const dir = project({ "emails/a.tsx": email() });
    const ran = await cli(dir, ["preview", "emails", "--install-browser"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("give it alone");
  });
});
