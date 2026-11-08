/**
 * The preview files, opened in Chromium as a person or an agent opens them (file://): each client's draws the email in
 * a sandboxed frame, with each block's template path on its element, and says it's done (`data-email-client-ready`);
 * the email's own scripts, handlers and navigation never run, and nothing is fetched but its images (and fonts).
 */
import React from "react";
import { mkdtempSync, writeFileSync } from "node:fs";
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
async function open(filename: string, html: string): Promise<{ page: Page; ready: string | null; requests: string[]; errors: string[] }> {
  const file = join(dir, filename);
  writeFileSync(file, html);
  const page = await browser.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && !/Content Security Policy|status of 404/.test(message.text()) && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));
  // Every request that gets past the CSP: the made-up images answered with a 404, anything else stopped here.
  await page.route(/^https?:/, (route) => {
    requests.push(route.request().url());
    return route.request().url().startsWith("https://example.test/") ? route.fulfill({ status: 404, body: "" }) : route.abort();
  });
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-email-client-ready"), null, { timeout: 20000 });
  const ready = await page.evaluate(() => document.documentElement.getAttribute("data-email-client-ready"));
  return { page, ready, requests, errors };
}

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
    const { page, ready, errors } = await open(previews[0]!.filename, previews[0]!.html);
    try {
      const findings = await page.evaluate(() => JSON.parse(document.getElementById("email-client-findings")!.textContent!));
      expect([ready, findings.error]).toEqual(["ok", null]);
      expect(findings).toMatchObject({ version: 1, client, width: previews[0]!.width });
      const frame = page.frames().find((f) => f !== page.mainFrame())!;
      expect(await frame.evaluate(() => document.body.innerText)).toContain("Your order is on its way");
      const paths = await frame.evaluate(() => [...document.querySelectorAll("[data-el-path]")].map((el) => el.getAttribute("data-el-path")));
      expect(paths).toEqual(expect.arrayContaining(["root.children[0]", "root.children[0].children[0]", "root.children[0].children[1].children[1].children[0]"]));
      // The frame is as wide as the client shows the email, and as tall as what it shows.
      const box = await page.locator("#frames iframe").boundingBox();
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
        expect([client, requests.filter((url) => !url.startsWith("https://example.test/"))]).toEqual([client, []]);
      } finally {
        await page.close();
      }
    }
  });
});
