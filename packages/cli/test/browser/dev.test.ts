/**
 * `dev`'s page in Chromium (Playwright's: `pnpm --filter @hyper-elements/react exec playwright install chromium`), with
 * the CLI started on Node and on Bun: an Email and a Page are shown at desktop and 375px in sandboxed frames that can't
 * reach the page (a template's `Html` block script tries: the page's DOM, its state, its event stream, the top
 * window's location); a change is shown without a reload; a Canvas's image and the email client previews open.
 */
import { execFileSync } from "node:child_process";
import { chromium, type Browser, type Frame, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canvas, devUntil, project, startDev, withFixtures, WITH_CLIENTS, write } from "../helpers";

/** What a template's `Html` block script tries, written on its own body as `data-tried` (JSON) once it's done. */
const ATTEMPT = `<p id="trying">Trying</p><script>
(function () {
  var found = { origin: String(self.origin) };
  try { found.parentTitle = String(parent.document.title); } catch (e) { found.parentTitle = "blocked " + e.name; }
  try { parent.document.body.setAttribute("data-pwned", "1"); found.parentWrite = "wrote"; } catch (e) { found.parentWrite = "blocked " + e.name; }
  try { top.location.href = "about:blank#pwned"; found.topNavigation = "asked"; } catch (e) { found.topNavigation = "blocked " + e.name; }
  var base = "/" + location.pathname.split("/")[1] + "/";
  var stream = new Promise(function (resolve) {
    try {
      var events = new EventSource(base + "events");
      events.onmessage = function () { events.close(); resolve("read"); };
      events.onerror = function () { events.close(); resolve("refused"); };
    } catch (e) { resolve("blocked " + e.name); }
  });
  var state = fetch(base + "state.json").then(function (r) { return r.text().then(function (t) { return "read " + r.status + " " + t.slice(0, 40); }); }, function (e) { return "failed " + e.name; });
  Promise.all([state, stream]).then(function (results) {
    found.state = results[0];
    found.events = results[1];
    document.body.setAttribute("data-tried", JSON.stringify(found));
  });
})();
</script>`;

const tryingEmail = (text: string) => `import { Email, Html, Text } from "@hyper-elements/react";
export default function Trying() { return <Email><Text>${text}</Text><Html html={${JSON.stringify(ATTEMPT)}} /></Email>; }
`;
const tryingPage = `import { Html, Page, Text } from "@hyper-elements/react";
export default function Trying() { return <Page><Text>A page</Text><Html html={${JSON.stringify(ATTEMPT)}} /></Page>; }
`;

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

function hasBun(): boolean {
  try {
    return !!execFileSync("bun", ["--version"]);
  } catch {
    return false;
  }
}

/** What a frame's script found, once it's done. */
async function tried(frame: Frame): Promise<Record<string, string>> {
  const handle = await frame.waitForSelector("body[data-tried]", { timeout: 15_000 });
  return JSON.parse((await handle.getAttribute("data-tried"))!);
}

/** The page's frames of one kind, desktop or phone, once they've loaded. */
async function frames(page: Page): Promise<Frame[]> {
  await page.waitForSelector("iframe[data-frame='phone']");
  const found: Frame[] = [];
  for (const element of await page.$$("iframe[data-frame]")) {
    const frame = await element.contentFrame();
    if (frame) found.push(frame);
  }
  return found;
}

/** Whether the page's desktop frame comes to show `text`, within 30 s; a frame replaced while it's read is read again. */
async function framesShow(page: Page, text: string): Promise<boolean> {
  const end = Date.now() + 30_000;
  while (Date.now() < end) {
    try {
      const [desktop] = await frames(page);
      if (await desktop.evaluate((t) => document.body?.innerText.includes(t) ?? false, text)) return true;
    } catch {
      // Detached: the page drew a newer render.
    }
    await page.waitForTimeout(50);
  }
  return false;
}

const runtimes =hasBun() || process.env.CI ? (["node", "bun"] as const) : (["node"] as const);

describe.each(runtimes)("dev's page, with the CLI on %s", (runtime) => {
  it("shows an Email and a Page at desktop and 375px in frames that can't reach the page", async () => {
    const dir = project({ "emails/trying.tsx": tryingEmail("First"), "pages/trying.tsx": tryingPage }, { modules: WITH_CLIENTS });
    const dev = await startDev(dir, ["emails", "pages", "--clients", "gmail"], { runtime });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    try {
      await page.goto(dev.base);
      for (const file of ["emails/trying.tsx", "pages/trying.tsx"]) {
        if (file !== "emails/trying.tsx") await page.getByRole("button", { name: new RegExp(file.replace(/[./]/g, "\\$&")) }).click();
        await page.waitForFunction((f) => document.querySelector("main h2")?.textContent === f, file);
        const shown = await frames(page);
        expect(shown).toHaveLength(2);
        const widths = await page.$$eval("iframe[data-frame]", (list) => list.map((f) => [f.getAttribute("data-frame"), f.getAttribute("sandbox"), f.clientWidth]));
        expect(widths[0].slice(0, 2)).toEqual(["desktop", "allow-scripts allow-popups"]);
        expect(widths[1]).toEqual(["phone", "allow-scripts allow-popups", 375]);
        for (const frame of shown) {
          const found = await tried(frame);
          // An origin of its own, which reads nothing of the page's: not its DOM, its state or its event stream.
          expect(found.origin, file).toBe("null");
          expect(found.parentTitle, file).toBe("blocked SecurityError");
          expect(found.parentWrite, file).toBe("blocked SecurityError");
          expect(found.state, file).toMatch(/^failed /);
          expect(found.events, file).toBe("refused");
        }
      }
      // The page is as it was: not written to, not navigated.
      expect(await page.evaluate(() => document.body.hasAttribute("data-pwned"))).toBe(false);
      expect(page.url()).toBe(dev.base + "#pages%2Ftrying.tsx");

      // A change is shown without a reload (the event stream says so).
      await page.getByRole("button", { name: /emails\/trying\.tsx/ }).click();
      write(dir, { "emails/trying.tsx": tryingEmail("Second") });
      await devUntil(dev, (_, text) => text.includes("Second"), "emails/trying.tsx");
      // The frames shown then may be replaced again (another render): looked for until one shows it.
      expect(await framesShow(page, "Second")).toBe(true);
      expect(page.url()).toBe(dev.base + "#emails%2Ftrying.tsx");

      // An email client preview opens and draws (email-clients' own shell, which runs none of the email's scripts).
      const links = await page.$$eval("[data-previews] a", (list) => list.map((a) => [a.textContent, (a as HTMLAnchorElement).href]));
      expect(links.map(([id]) => id)).toEqual(["gmail", "gmail.mac"]);
      const preview = await browser.newPage();
      try {
        await preview.goto(links[0][1]!);
        await preview.waitForSelector("html[data-email-client-ready]", { timeout: 30_000 });
        expect(await preview.getAttribute("html", "data-email-client-ready")).not.toBe("error");
      } finally {
        await preview.close();
      }
    } finally {
      await page.close();
    }
  });

  it("shows a Canvas's image", async () => {
    const dir = withFixtures(project({ "cards/card.tsx": canvas(`[{ family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 }]`) }));
    const dev = await startDev(dir, ["cards"], { runtime });
    const page = await browser.newPage();
    try {
      await page.goto(dev.base);
      const image = await page.waitForSelector("img.canvas");
      await page.waitForFunction(() => (document.querySelector("img.canvas") as HTMLImageElement | null)?.naturalWidth === 300);
      expect(await image.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([300, 150]);
    } finally {
      await page.close();
    }
  });
});
