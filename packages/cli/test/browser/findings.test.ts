/**
 * `preview --findings` against real browsers (needs Playwright's Chromium: `pnpm --filter @hyper-elements/react exec
 * playwright install chromium`): each of the ways the CLI finds one, what the drawn previews say (`ready`, the
 * findings), `--screenshots`, `--fonts inline` with nothing fetched, a preview that fails (exit 1) and one that's
 * incomplete (exit 0), and the same findings with the CLI started on Bun.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cli, lines, project, REPO, WITH_CLIENTS, type Ran } from "../helpers";

/** The fonts the models were measured with are on a Mac; elsewhere some aren't, and a preview says so (incomplete). */
const MAC = process.platform === "darwin";

/** An Email with no web fonts of its own and only a data: image: a drawn preview needs nothing from the network. */
const OFFLINE = `import { Button, Email, Heading, Image, Section, Text } from "@hyper-elements/react";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
export default function Order() {
  return (
    <Email width={600}>
      <Section style={{ backgroundColor: "#f3f4f6", padding: 24 }}>
        <Heading level={1}>Your order is on its way</Heading>
        <Text>It left our warehouse this morning.</Text>
        <Button href="https://example.test/orders/1" style={{ borderRadius: 8 }}>Track it</Button>
      </Section>
      <Image src={{ src: PNG, width: 1, height: 1 }} alt="" style={{ width: 600 }} />
    </Email>
  );
}
`;

/** An image that can't load (nothing listens on port 9 here): the preview is incomplete, not failed. */
const BROKEN_IMAGE = `import { Email, Image, Text } from "@hyper-elements/react";
export default function T() {
  return <Email><Text>Hello</Text><Image src={{ src: "http://127.0.0.1:9/missing.png", width: 600, height: 300 }} alt="Hero" /></Email>;
}
`;

/** No browser but Playwright's own: no CHROME_PATH, no channel. */
const PLAYWRIGHT_ONLY = { CHROME_PATH: "", HYPER_ELEMENTS_CLI_BROWSER_CHANNELS: "" };

const empty = mkdtempSync(join(tmpdir(), "hyper-elements-cli-no-browsers-"));
afterAll(() => rmSync(empty, { recursive: true, force: true }));

/** Missing things other than the machine's fonts. */
const notFonts = (missing: Array<{ kind: string }>) => missing.filter((m) => m.kind !== "font" && m.kind !== "substituted");

/** What every drawn preview should say: findings of its own client, its ready as the page says. */
function expectDrawn(ran: Ran, browser: RegExp): any {
  expect(ran.code, ran.stderr).toBe(0);
  const [line, summary] = lines(ran);
  expect(line.browser).toMatch(browser);
  expect(line.reason).toBeUndefined();
  expect(line.previews.length).toBeGreaterThan(0);
  for (const preview of line.previews) {
    expect(preview.findings, preview.id).toMatchObject({ client: preview.client, ready: preview.ready, error: null });
    expect(notFonts(preview.findings.missing), preview.id).toEqual([]);
    if (MAC) expect(preview.ready, preview.id).toBe("ok");
    else expect(preview.ready, preview.id).toBe(preview.findings.missing.length ? "incomplete" : "ok");
  }
  expect(summary.exitCode).toBe(0);
  return line;
}

let chromePath: string;
let hasChrome = false;
beforeAll(async () => {
  chromePath = chromium.executablePath();
  try {
    const chrome = await chromium.launch({ channel: "chrome" });
    await chrome.close();
    hasChrome = true;
  } catch {
    hasChrome = false;
  }
});

describe("preview --findings", () => {
  it("in Playwright's Chromium: findings for every preview, ready as the page says, the browser named", async () => {
    const dir = project({ "emails/order.tsx": OFFLINE }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--findings", "--fonts", "inline", "--dark", "--json"], { env: PLAYWRIGHT_ONLY, timeout: 120_000 });
    const line = expectDrawn(ran, /^chromium \d+\.[\d.]+, playwright$/);
    expect(line.previews.map((p: any) => p.id)).toEqual(["outlook", "outlook-com", "outlook-com.mac", "gmail", "gmail.mac", "apple-mail", "apple-mail.dark"]);
    // What the page wrote is what the CLI reports.
    const text = await cli(dir, ["preview", "emails", "--findings", "--fonts", "inline", "--clients", "gmail"], { env: PLAYWRIGHT_ONLY, timeout: 120_000 });
    expect(text.code, text.stderr).toBe(0);
    expect(text.stdout).toMatch(/✓ emails\/order\.tsx \(Email\), drawn in chromium [\d.]+, playwright\n/);
    expect(text.stdout).toMatch(/ {2}gmail: out\/clients\/order\/gmail\.html \((ok|incomplete)/);
  });

  it("with only a system browser named by CHROME_PATH", async () => {
    const dir = project({ "emails/order.tsx": OFFLINE }, { modules: WITH_CLIENTS });
    const system = MAC && existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : chromePath;
    const ran = await cli(dir, ["preview", "emails", "--findings", "--fonts", "inline", "--clients", "gmail,outlook", "--json"], {
      env: { CHROME_PATH: system, PLAYWRIGHT_BROWSERS_PATH: empty, HYPER_ELEMENTS_CLI_BROWSER_CHANNELS: "" },
      timeout: 120_000,
    });
    expectDrawn(ran, /^chromium \d+\.[\d.]+, CHROME_PATH$/);
  });

  it("with only an installed Chrome, by its channel", async ({ skip }) => {
    // GitHub's runners have Chrome; a machine without it skips this.
    if (!hasChrome) skip();
    const dir = project({ "emails/order.tsx": OFFLINE }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--findings", "--fonts", "inline", "--clients", "gmail", "--json"], { env: { CHROME_PATH: "", PLAYWRIGHT_BROWSERS_PATH: empty, HYPER_ELEMENTS_CLI_BROWSER_CHANNELS: "chrome" }, timeout: 120_000 });
    expectDrawn(ran, /^chrome \d+\.[\d.]+, channel$/);
  });

  it("--fonts inline draws with nothing from the network: no request leaves the machine", async () => {
    const dir = project({ "emails/order.tsx": OFFLINE }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--findings", "--fonts", "inline", "--json"], { env: { ...PLAYWRIGHT_ONLY, HYPER_ELEMENTS_CLI_PROBE: "1" }, timeout: 120_000 });
    expectDrawn(ran, /, playwright$/);
    const requests = ran.stderr
      .split("\n")
      .filter((l) => l.startsWith("[probe] "))
      .map((l) => JSON.parse(l.slice(8)))
      .filter((p) => "request" in p)
      .map((p) => p.request as string);
    // Each preview file was opened, and nothing but files and data was asked for.
    expect(requests.filter((url) => url.startsWith("file:")).length).toBeGreaterThanOrEqual(6);
    expect(requests.filter((url) => !/^(file|data|blob|about):/.test(url))).toEqual([]);
  });

  it("--screenshots writes one PNG per preview, beside it", async () => {
    const dir = project({ "emails/order.tsx": OFFLINE }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--screenshots", "--fonts", "inline", "--clients", "gmail,apple-mail", "--json"], { env: PLAYWRIGHT_ONLY, timeout: 120_000 });
    const line = expectDrawn(ran, /, playwright$/);
    expect(line.previews.map((p: any) => p.screenshot)).toEqual(["out/clients/order/gmail.png", "out/clients/order/gmail.mac.png", "out/clients/order/apple-mail.png"]);
    for (const preview of line.previews) {
      const png = readFileSync(join(dir, preview.screenshot));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.length).toBeGreaterThan(5_000);
      expect(line.outputs).toContain(preview.screenshot);
    }
  });

  it("a preview whose page fails (its models' WebAssembly refused) fails the run: exit 1", async () => {
    // The project's email-clients, with each preview's CSP refusing WebAssembly, as email-clients' own browser test does.
    const real = join(REPO, "packages/email-clients/dist/index.js");
    const dir = project({ "emails/order.tsx": OFFLINE }, { modules: ["react", "react-dom", "@hyper-elements/react"] });
    const pkg = join(dir, "node_modules/@hyper-elements/email-clients");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@hyper-elements/email-clients", version: "0.4.0", type: "module", exports: "./index.js" }));
    writeFileSync(
      join(pkg, "index.js"),
      `export * from ${JSON.stringify(real)};
import { renderInEmailClients as real } from ${JSON.stringify(real)};
export async function renderInEmailClients(element, options) {
  const result = await real(element, options);
  return { ...result, previews: result.previews.map((p) => ({ ...p, html: p.html.replace(" 'wasm-unsafe-eval'", "") })) };
}
`,
    );
    const ran = await cli(dir, ["preview", "emails", "--findings", "--fonts", "inline", "--clients", "gmail", "--json"], { env: PLAYWRIGHT_ONLY, timeout: 120_000 });
    expect(ran.code, ran.stderr).toBe(1);
    const [line, summary] = lines(ran);
    expect(line.status).toBe("error");
    expect(line.previews.map((p: any) => p.ready)).toEqual(["error", "error"]);
    expect(line.previews[0].findings.error).toMatch(/WebAssembly|wasm|Content Security Policy/i);
    expect(line.diagnostics.filter((d: any) => d.code === "cli/preview-failed")).toHaveLength(2);
    expect(summary).toMatchObject({ summary: { errors: 1 }, exitCode: 1 });
  });

  it("a preview that's incomplete (an image that doesn't load) doesn't fail the run", async () => {
    const dir = project({ "emails/hero.tsx": BROKEN_IMAGE }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--findings", "--fonts", "inline", "--clients", "gmail", "--json"], { env: PLAYWRIGHT_ONLY, timeout: 120_000 });
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    expect(line.status).toBe("ok");
    for (const preview of line.previews) {
      expect(preview.ready).toBe("incomplete");
      expect(preview.findings.missing).toContainEqual(expect.objectContaining({ kind: "image", src: "http://127.0.0.1:9/missing.png" }));
    }
  });
});

const hasBun = (() => {
  try {
    return !!execFileSync("bun", ["--version"]);
  } catch {
    return false;
  }
})();

describe.runIf(hasBun || (process.env.CI && process.platform !== "win32"))("preview --findings on Bun", () => {
  it("gives the same findings as on Node", async () => {
    const dir = project({ "emails/order.tsx": OFFLINE, "emails/hero.tsx": BROKEN_IMAGE }, { modules: WITH_CLIENTS });
    const args = ["preview", "emails", "--findings", "--fonts", "inline", "--dark", "--json"];
    const node = await cli(dir, args, { env: PLAYWRIGHT_ONLY, runtime: "node", timeout: 120_000 });
    const bun = await cli(dir, args, { env: PLAYWRIGHT_ONLY, runtime: "bun", timeout: 120_000 });
    expect(node.code, node.stderr).toBe(0);
    expect(bun.code, bun.stderr).toBe(0);
    expect(lines(bun)).toEqual(lines(node));
  });
});
