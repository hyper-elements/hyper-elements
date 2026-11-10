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
import { Button, Column, Email, Heading, Html, Image, Row, Section, Span, Text } from "@hyper-elements/react";
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
 * The fonts the models were measured with are on a Mac: there every preview here draws "ok". Elsewhere (CI's Linux) some
 * aren't (Helvetica Neue, for Outlook's Aptos; Georgia), and the preview says so: "incomplete", with only fonts missing.
 */
const MAC = process.platform === "darwin";
const onlyFonts = (missing: Array<{ kind: string }>) => missing.filter((m) => m.kind !== "font" && m.kind !== "substituted");

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
    // A web font that loads (one of this package's own files), beside the made-up ones that 404.
    if (url === "https://example.test/brand-regular.woff2") return route.fulfill({ status: 200, contentType: "font/woff2", body: readFileSync(join(FONTS, "selawk.woff2")) });
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
      expect([findings.error, onlyFonts(findings.missing)]).toEqual([null, []]);
      if (MAC) expect([ready, findings.missing]).toEqual(["ok", []]);
      else expect(ready).toBe(findings.missing.length ? "incomplete" : "ok");
      expect(findings).toMatchObject({ version: 1, client, width: previews[0]!.width });
      const frame = page.frames().find((f) => f !== page.mainFrame())!;
      expect(await frame.evaluate(() => document.body.innerText)).toContain("Your order is on its way");
      const paths = await frame.evaluate(() => [...document.querySelectorAll("[data-el-path]")].map((el) => el.getAttribute("data-el-path")));
      expect(paths).toEqual(expect.arrayContaining(["root.children[0]", "root.children[0].children[0]", "root.children[0].children[1].children[1].children[0]"]));
      // The frame is as wide as the client shows the email, and as tall as what it shows.
      const box = await page.locator("#frames iframe:not([hidden])").boundingBox();
      expect(box!.width).toBe(previews[0]!.width);
      expect(box!.height).toBeGreaterThan(200);
      // Both frames keep their width side by side in a window narrower than the two (the client's and the baseline
      // were measured that way): a frame squeezed below the client's width would cross the email's breakpoints.
      await page.setViewportSize({ width: 1000, height: 720 });
      await page.evaluate(() => document.querySelectorAll("#frames iframe").forEach((f) => ((f as HTMLIFrameElement).hidden = false)));
      const widths = await page.locator("#frames iframe").evaluateAll((frames) => frames.map((f) => f.getBoundingClientRect().width));
      expect(widths.length).toBeGreaterThan(1);
      expect(widths.every((w) => w === previews[0]!.width)).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("compiles the models only because the CSP allows WebAssembly: without 'wasm-unsafe-eval', the preview says it failed", async () => {
    const { previews } = await renderInEmailClients(email, { emailClients: ["gmail"] });
    const refused = previews[0]!.html.replace(" 'wasm-unsafe-eval'", "");
    expect(refused).not.toBe(previews[0]!.html);
    const { page, ready, findings } = await open("no-wasm.html", refused);
    try {
      expect(ready).toBe("error");
      expect(findings.error).toMatch(/WebAssembly|wasm|Content Security Policy/i);
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
        expect([client, ready === "ok" || (!MAC && ready === "incomplete")]).toEqual([client, true]);
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
      // The inlined fonts all load; what's missing elsewhere is only the machine's own (Outlook's Aptos stand-in).
      expect([preview.id, findings.missing.filter((m) => ["Segoe UI", "Segoe UI Web (West European)", "Calibri", "Inter"].includes(m.family!))]).toEqual([preview.id, []]);
      if (MAC) expect([preview.id, ready, findings.missing]).toEqual([preview.id, "ok", []]);
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
      const img = document.querySelector('img[alt="Hero"]') as HTMLImageElement;
      return { width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height, gray: img.src.startsWith("data:image/svg+xml") && img.src.includes("d0d7de"), missing: img.getAttribute("data-email-client-missing") };
    });
    expect(box).toEqual({ width: 600, height: 300, gray: true, missing: "https://example.test/hero.png" });
    await page.close();
  });

  it("keeps the gray box in classic Outlook too, whose rules size images as Word does", async () => {
    const { previews } = await renderInEmailClients(email, { emailClients: ["outlook"] });
    const { page, findings } = await open("missing-image-outlook.html", previews[0]!.html, { images: "missing" });
    expect(findings.missing.filter((m) => m.kind === "image")).toEqual([{ kind: "image", src: "https://example.test/hero.png" }]);
    const frame = page.frames().find((f) => f.parentFrame() === page.mainFrame())!;
    expect(await frame.evaluate(() => (document.querySelector('img[alt="Hero"]') as HTMLImageElement).getBoundingClientRect().height)).toBe(300);
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
    // What drew instead was checked against the probe's widths: Arial everywhere (Liberation Sans has its widths), and
    // Georgia, which only the Mac has here (on Linux it's listed as missing).
    expect(findings.fonts).toEqual(expect.arrayContaining([{ family: "Arial", verified: "widths" }]));
    if (MAC) expect(findings.fonts).toEqual(expect.arrayContaining([{ family: "Georgia", verified: "widths" }]));
    else expect(findings.missing).toEqual(expect.arrayContaining([{ kind: "font", family: "Georgia" }]));
    await page.close();
  });

  it("finds a Heading classic Outlook draws on more lines, end to end: render()'s block map, the file, its findings", async () => {
    // Drawn in the email's web font as written; classic Outlook skips web fonts and draws Courier New, much wider.
    // Nothing here passes the blocks' types by hand: the findings read them from render()'s block map.
    const words = "Your order of fresh coffee beans ships tomorrow morning from our roastery".split(" ");
    const element = (
      <Email width={600} fonts={[{ family: "Brand", src: "https://example.test/brand-regular.woff2", format: "woff2", weight: 700, style: "normal" }]}>
        {[6, 7, 8, 9].map((n) => (
          <Heading key={n} level={2} style={{ fontFamily: "Brand, 'Courier New', monospace" }}>
            {words.slice(0, n).join(" ")}
          </Heading>
        ))}
        <Text style={{ fontFamily: "Brand, 'Courier New', monospace" }}>{words.join(" ")}</Text>
      </Email>
    );
    const { previews } = await renderInEmailClients(element, { emailClients: ["outlook"] });
    const { page, findings } = await open("more-lines.html", previews[0]!.html);
    const found = findings.diagnostics.filter((d) => d.code === "email/more-lines");
    expect(found.length).toBeGreaterThan(0);
    // Only Headings (and Buttons): the Text that also wraps more isn't one.
    expect(found.every((d) => /^root\.children\[[0-3]\]$/.test(d.path) && /^This Heading takes \d lines in classic Outlook, \d as written$/.test(d.message))).toBe(true);
    await page.close();
  });

  it("lists a web font face that fails with its own file, when another face of its family loads", async () => {
    const element = (
      <Email
        width={600}
        fonts={[
          { family: "Brand", src: "https://example.test/brand-regular.woff2", format: "woff2", weight: 400, style: "normal" },
          { family: "Brand", src: "https://example.test/brand-italic.woff2", format: "woff2", weight: 400, style: "italic" },
        ]}
        style={{ fontFamily: "Brand, Arial, sans-serif" }}
      >
        <Text>
          Brand words <Span style={{ fontStyle: "italic" }}>in italics</Span>
        </Text>
      </Email>
    );
    const { previews } = await renderInEmailClients(element, { emailClients: ["apple-mail"] });
    const { page, findings, requests } = await open("italic-font.html", previews[0]!.html);
    expect(requests).toEqual(expect.arrayContaining(["https://example.test/brand-regular.woff2", "https://example.test/brand-italic.woff2"]));
    expect(findings.missing.filter((m) => m.kind === "author-font")).toEqual([{ kind: "author-font", family: "Brand", src: "https://example.test/brand-italic.woff2" }]);
    await page.close();
  });

  it("checks the fonts classic Outlook draws with, after its rules, not the email's web fonts it never sees", async () => {
    const element = (
      <Email width={600} fonts={[{ family: "Brand", src: "https://example.test/brand.woff2", format: "woff2", weight: 400, style: "normal" }]} style={{ fontFamily: "Brand, Arial, sans-serif" }}>
        <Text>Brand words</Text>
      </Email>
    );
    const { previews } = await renderInEmailClients(element, { emailClients: ["outlook"] });
    const { page, findings } = await open("outlook-web-font.html", previews[0]!.html);
    expect(findings.missing.filter((m) => m.family === "Brand")).toEqual([]);
    expect(findings.fonts).toEqual(expect.arrayContaining([{ family: "Arial", verified: "widths" }]));
    await page.close();
  });

  it("doesn't list a web font whose rules Gmail removed as a missing system font: the removed rules say it", async () => {
    const element = (
      <Email width={600} fonts={[{ family: "Brand", src: "https://example.test/brand.woff2", format: "woff2", weight: 400, style: "normal" }]} style={{ fontFamily: "Brand, Arial, sans-serif" }}>
        <Text>Brand words</Text>
      </Email>
    );
    for (const client of ["gmail", "apple-mail"] as const) {
      const { previews } = await renderInEmailClients(element, { emailClients: [client] });
      const { page, findings } = await open(`web-font-${client}.html`, previews[0]!.html);
      expect([client, findings.missing.filter((m) => m.family === "Brand" && m.kind !== "author-font")]).toEqual([client, []]);
      // Gmail removed its rule, so what draws is Arial, checked as a system font.
      if (client === "gmail") expect(findings.removed).toEqual(expect.arrayContaining([{ what: "@font-face", count: 1 }]));
      expect(findings.fonts).toEqual(expect.arrayContaining([{ family: "Arial", verified: "widths" }]));
      await page.close();
    }
  });

  it("loads an image marked loading=lazy, and leaves a web font weight nothing uses unfetched", async () => {
    const element = (
      <Email
        width={600}
        fonts={[
          { family: "Brand", src: "https://example.test/brand-regular.woff2", format: "woff2", weight: 400, style: "normal" },
          { family: "Brand", src: "https://example.test/brand-bold.woff2", format: "woff2", weight: 700, style: "normal" },
        ]}
      >
        <Text style={{ fontFamily: "Arial" }}>No Brand here</Text>
        <Html html={'<div style="height:3000px"></div><img src="https://example.test/below.png" loading="lazy" width="10" height="10" alt="Below">'} />
      </Email>
    );
    const { previews } = await renderInEmailClients(element, { emailClients: ["apple-mail"] });
    const { page, findings, requests } = await open("lazy.html", previews[0]!.html);
    expect(findings.missing).toEqual([]);
    expect(requests).toContain("https://example.test/below.png");
    expect(requests.filter((url) => url.includes("brand"))).toEqual([]);
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
      expect([preview.id, size.map((d) => [d.severity, d.clients])]).toEqual([preview.id, [[preview.client === "gmail" ? "warning" : "info", [preview.client]]]]);
      expect(size[0]!.path).toMatch(/^root\.children\[\d+\]$/);
      expect(findings.removed.map((r) => r.what)).toContain("content past 102,400 bytes (clipped)");
      await page.close();
    }
  });
});

describe.runIf(process.platform === "linux")("on Linux, without the Mac's fonts", () => {
  it("draws classic Outlook incomplete for want of Helvetica Neue (its Aptos stand-in), and accepts Arial's metric twin", async () => {
    const { previews } = await renderInEmailClients(email, { emailClients: ["outlook", "gmail"], fonts: "inline" });
    const outlook = await open("linux-outlook.html", previews[0]!.html);
    expect(outlook.ready).toBe("incomplete");
    expect(outlook.findings.missing).toEqual(expect.arrayContaining([{ kind: "font", family: "Aptos Stand-in" }]));
    await outlook.page.close();
    // Gmail draws in Arial: Linux has none, and draws Liberation Sans, which has Arial's widths: the layout matches.
    const gmail = await open("linux-gmail.html", previews[1]!.html);
    expect(gmail.findings.fonts).toEqual(expect.arrayContaining([{ family: "Arial", verified: "widths" }]));
    await gmail.page.close();
  });
});
