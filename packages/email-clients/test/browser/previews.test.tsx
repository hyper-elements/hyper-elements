/**
 * The preview files, opened in Chromium as a person or an agent opens them (file://): each client's draws the email in
 * a sandboxed frame, with each block's template path on its element, and says it's done (`data-email-client-ready`);
 * the email's own scripts, handlers and navigation never run, and nothing is fetched but its images (and fonts).
 */
import React from "react";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { Button, Column, Email, Heading, Html, Image, Row, Section, Text } from "@hyper-elements/react";
import { PREVIEW_CLIENTS, renderInEmailClients } from "../../src/index";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

const dir = mkdtempSync(join(tmpdir(), "email-client-previews-"));

/**
 * A preview file opened in a page, once its runtime says it's done: what reached the network (a request the CSP blocks
 * never does), and its errors (but the CSP's reports and the made-up images' 404s).
 */
async function open(filename: string, html: string, options: { images?: "missing"; fonts?: "unreachable" } = {}): Promise<{ page: Page; ready: string | null; requests: string[]; errors: string[]; findings: Findings }> {
  const file = join(dir, filename);
  writeFileSync(file, html);
  const page = await browser.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && !/Content Security Policy|status of 404/.test(message.text()) && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));
  // Every request that gets past the CSP: the fonts from this package's fonts/ (as jsDelivr will serve them), the
  // made-up images as a PNG (or a 404), anything else stopped here.
  await page.route(/^https?:/, (route) => {
    const url = route.request().url();
    requests.push(url);
    const font = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@hyper-elements\/email-clients@[^/]+\/fonts\/([\w.-]+\.woff2)$/.exec(url);
    if (font && options.fonts !== "unreachable") return route.fulfill({ status: 200, contentType: "font/woff2", body: readFileSync(join(FONTS, font[1]!)) });
    if (url.startsWith("https://example.test/")) return options.images === "missing" || !url.endsWith(".png") ? route.fulfill({ status: 404, body: "" }) : route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return route.abort();
  });
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-email-client-ready"), null, { timeout: 20000 });
  const ready = await page.evaluate(() => document.documentElement.getAttribute("data-email-client-ready"));
  const findings = await page.evaluate(() => JSON.parse(document.getElementById("email-client-findings")!.textContent!));
  return { page, ready, requests, errors, findings };
}

interface Findings {
  ready: string;
  error: string | null;
  missing: Array<{ kind: string; family?: string; src?: string }>;
  fonts: Array<{ family: string; verified: string }>;
  removed: Array<{ what: string; count: number }>;
  diagnostics: Array<{ code: string; severity: string; path: string; clients: string[]; message: string; fix: string }>;
  [key: string]: unknown;
}

const FONTS = join(__dirname, "../../fonts");
/** A 1×1 PNG. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const email = (
  <Email width={600}>
    <Section style={{ backgroundColor: "#f3f4f6", padding: 24 }}>
      <Heading level={1}>Your order is on its way</Heading>
      <Row style={{ gap: 16 }}>
        <Column>
          <Text>Order #10482 ships tomorrow, packed with care.</Text>
        </Column>
        <Column>
          <Button href="https://example.test/orders/10482">Track it</Button>
        </Column>
      </Row>
    </Section>
    <Image src={{ src: "https://example.test/hero.png", width: 600, height: 300 }} alt="Hero" />
  </Email>
);

describe("a preview file in Chromium", () => {
  it.each([...PREVIEW_CLIENTS])("draws the email as %s does, each block marked with its path", async (client) => {
    const { previews } = await renderInEmailClients(email, { emailClients: [client] });
    const { page, ready, errors, findings } = await open(previews[0]!.filename, previews[0]!.html);
    try {
      expect([ready, findings.error, findings.missing]).toEqual(["ok", null, []]);
      expect(findings).toMatchObject({ version: 1, client, width: previews[0]!.width });
      const frame = page.frames().find((f) => f !== page.mainFrame())!;
      expect(await frame.evaluate(() => document.body.innerText)).toContain("Your order is on its way");
      const paths = await frame.evaluate(() => [...document.querySelectorAll("[data-el-path]")].map((el) => el.getAttribute("data-el-path")));
      expect(paths).toEqual(expect.arrayContaining(["root.children[0]", "root.children[0].children[0]", "root.children[0].children[1].children[1].children[0]"]));
      // The frame is as wide as the client shows the email, and as tall as what it shows.
      const box = await page.locator("#frames iframe:not([hidden])").boundingBox();
      expect(box!.width).toBe(previews[0]!.width);
      expect(box!.height).toBeGreaterThan(200);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("runs none of the email's scripts, handlers or navigation, and fetches only its images", async () => {
    const hostile = [
      "<script>parent.document.title='pwned-script'</script>",
      '<img src="https://example.test/x.png" onerror="parent.document.title=\'pwned-handler\'">',
      '<a href="javascript:parent.document.title=\'pwned-link\'" id="evil">x</a>',
      '<meta http-equiv="refresh" content="0;url=https://evil.example/">',
      '<form action="https://evil.example/"><input name="q"></form>',
      '<link rel="stylesheet" href="https://evil.example/s.css">',
      '<iframe src="https://evil.example/frame"></iframe>',
      "<!--[if !mso]><!--><script>parent.document.title='pwned-comment'</script><!--<![endif]-->",
      "</script><script>document.title='pwned-shell'</script>",
    ].join("");
    const element = (
      <Email width={600}>
        <Text>Before</Text>
        <Html html={hostile} />
      </Email>
    );
    for (const client of PREVIEW_CLIENTS) {
      const { previews } = await renderInEmailClients(element, { emailClients: [client] });
      const { page, ready, requests } = await open(`hostile-${client}.html`, previews[0]!.html);
      try {
        await page.waitForTimeout(300);
        const frame = page.frames().find((f) => f.parentFrame() === page.mainFrame())!;
        await frame.locator("#evil").click({ timeout: 2000 }).catch(() => undefined);
        await page.waitForTimeout(200);
        expect([client, ready]).toEqual([client, "ok"]);
        expect([client, await page.title()]).toEqual([client, expect.not.stringContaining("pwned")]);
        expect([client, page.url()]).toEqual([client, expect.stringMatching(/^file:/)]);
        // Only its image, and the preview's own stand-in fonts.
        expect([client, requests.filter((url) => !url.startsWith("https://example.test/") && !url.startsWith("https://cdn.jsdelivr.net/npm/@hyper-elements/email-clients@"))]).toEqual([client, []]);
      } finally {
        await page.close();
      }
    }
  });
});

describe("what a preview lists, and when it's incomplete", () => {
  it("draws offline with the fonts inlined, and says so when the fonts it loads by URL can't load", async () => {
    const inline = await renderInEmailClients(email, { emailClients: ["outlook", "outlook-com"], fonts: "inline" });
    for (const preview of inline.previews) {
      expect(preview.html).toContain("data:font/woff2;base64,");
      const { page, ready, requests, findings } = await open(`inline-${preview.filename}`, preview.html);
      expect([preview.id, ready, findings.missing]).toEqual([preview.id, "ok", []]);
      expect(requests.filter((url) => url.includes("jsdelivr"))).toEqual([]);
      await page.close();
    }
    const url = await renderInEmailClients(email, { emailClients: ["outlook"] });
    const { page, ready, findings } = await open("unreachable-outlook.html", url.previews[0]!.html, { fonts: "unreachable" });
    expect(ready).toBe("incomplete");
    expect(findings.missing).toEqual(expect.arrayContaining([{ kind: "font", family: "Segoe UI" }, { kind: "font", family: "Calibri" }]));
    await page.close();
  });

  it("draws an image that doesn't load as a gray box of its size, and lists it", async () => {
    const { previews } = await renderInEmailClients(email, { emailClients: ["gmail"] });
    const { page, ready, findings } = await open("missing-image.html", previews[0]!.html, { images: "missing" });
    expect(ready).toBe("incomplete");
    expect(findings.missing).toEqual([{ kind: "image", src: "https://example.test/hero.png" }]);
    const frame = page.frames().find((f) => f.parentFrame() === page.mainFrame())!;
    const box = await frame.evaluate(() => {
      const el = document.querySelector('[role="img"][aria-label="Hero"]') as HTMLElement;
      return { width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, background: getComputedStyle(el).backgroundColor };
    });
    expect(box).toEqual({ width: 600, height: 300, background: "rgb(208, 215, 222)" });
    await page.close();
  });

  it("lists the email's own web font that fails, and a system font that isn't there", async () => {
    const element = (
      <Email width={600} fonts={[{ family: "Brand", src: "https://example.test/brand.woff2", format: "woff2", weight: 400, style: "normal" }]} style={{ fontFamily: "Brand, Arial, sans-serif" }}>
        <Text>Brand words</Text>
        <Text style={{ fontFamily: "'Zzz No Such Font', Georgia, serif" }}>Missing words</Text>
      </Email>
    );
    const { previews } = await renderInEmailClients(element, { emailClients: ["apple-mail"] });
    const { page, ready, findings } = await open("missing-fonts.html", previews[0]!.html);
    expect(ready).toBe("incomplete");
    expect(findings.missing).toEqual(expect.arrayContaining([{ kind: "font", family: "Zzz No Such Font" }, { kind: "author-font", family: "Brand", src: "https://example.test/brand.woff2" }]));
    // What drew instead was checked against the probe's widths.
    expect(findings.fonts).toEqual(expect.arrayContaining([{ family: "Arial", verified: "widths" }, { family: "Georgia", verified: "widths" }]));
    await page.close();
  });

  it("finds where Gmail clips a long email: a warning on the web, a note in the apps", async () => {
    const words = "Every word of this paragraph is here to make the email long enough for Gmail to clip it. ".repeat(12);
    const long = (
      <Email width={600}>
        {Array.from({ length: 110 }, (_, i) => (
          <Text key={i} id={`p${i}`}>
            {words}
          </Text>
        ))}
      </Email>
    );
    const { previews } = await renderInEmailClients(long, { emailClients: ["gmail", "gmail-app"] });
    for (const preview of previews) {
      const { page, findings } = await open(`clip-${preview.filename}`, preview.html);
      const size = findings.diagnostics.filter((d) => d.code === "email/size");
      expect([preview.id, size.map((d) => [d.severity, d.clients])]).toEqual([preview.id, [[preview.id === "gmail" ? "warning" : "info", [preview.id]]]]);
      expect(size[0]!.path).toMatch(/^root\.children\[\d+\]$/);
      expect(findings.removed.map((r) => r.what)).toContain("content past 102,400 bytes (clipped)");
      await page.close();
    }
  });
});

describe("the drawn findings (src/runtime/findings.ts), on documents made for them", () => {
  let harness: string;
  beforeAll(async () => {
    const { build } = await import("esbuild");
    const out = await build({ entryPoints: [join(__dirname, "../../src/runtime/findings.ts")], bundle: true, write: false, format: "iife", globalName: "findings", platform: "browser" });
    harness = out.outputFiles[0]!.text;
  });

  /** Two same-origin documents in a page: the client's and the baseline, from their bodies. */
  async function pair(client: string, baseline: string): Promise<Page> {
    const page = await browser.newPage();
    await page.setContent(`<iframe id="client" style="width:600px;height:400px"></iframe><iframe id="baseline" style="width:600px;height:400px"></iframe>`);
    await page.evaluate(([c, b]) => {
      for (const [id, body] of [["client", c], ["baseline", b]] as const) {
        const doc = (document.getElementById(id) as HTMLIFrameElement).contentDocument!;
        doc.open();
        doc.write(`<!DOCTYPE html><html><body style="margin:0;font:20px/24px Arial">${body}</body></html>`);
        doc.close();
      }
    }, [client, baseline]);
    await page.addScriptTag({ content: harness });
    return page;
  }

  it("notes a Heading Outlook draws on more lines, only where each of its breaks missed by 2px or more", async () => {
    const heading = '<div data-el-path="root.children[0]"><h1 style="margin:0;width:%W%px">A heading that wraps in Outlook</h1></div>';
    const page = await pair(heading.replace("%W%", "200"), heading.replace("%W%", "600"));
    const run = (margins: Array<number | null>) =>
      page.evaluate((margins) => {
        const client = (document.getElementById("client") as HTMLIFrameElement).contentDocument!;
        const baseline = (document.getElementById("baseline") as HTMLIFrameElement).contentDocument!;
        const h1 = client.querySelector("h1")!;
        const breaks = margins.map((margin) => ({ block: h1, word: "wraps", margin }));
        return (globalThis as any).findings.moreLines(client, baseline, breaks);
      }, margins);
    expect(await run([-5, -2])).toEqual([{ code: "email/more-lines", severity: "info", message: expect.stringMatching(/^This Heading takes \d lines in classic Outlook, \d as written$/), path: "root.children[0]", clients: ["outlook"], fix: "shorten the text, or widen its column" }]);
    // A break that missed by less than 2px could go either way; one the browser made isn't Outlook's rule.
    expect(await run([-5, -1.5])).toEqual([]);
    expect(await run([null])).toEqual([]);
    expect(await run([])).toEqual([]);
    await page.close();
  });

  it("warns of text that reads as written and not in Apple Mail's dark mode", async () => {
    const text = (color: string, background: string) => `<div data-el-path="root.children[0]" style="background:${background}"><p style="color:${color}">Words</p></div><div data-el-path="root.children[1]"><p style="color:#111">Fine</p></div>`;
    const page = await pair(text("#333333", "#222222"), text("#333333", "#ffffff"));
    const found = await page.evaluate(() => {
      const [client, baseline] = ["client", "baseline"].map((id) => (document.getElementById(id) as HTMLIFrameElement).contentDocument!);
      return (globalThis as any).findings.darkContrast(client, baseline);
    });
    expect(found).toEqual([{ code: "email/dark-contrast", severity: "warning", message: expect.stringMatching(/^This text's contrast with its background is 1\.\d:1 in Apple Mail's dark mode \(12\.\d:1 as written\)$/), path: "root.children[0]", clients: ["apple-mail"], fix: "set the text's and its background's colours so both modes read" }]);
    await page.close();
  });
});
