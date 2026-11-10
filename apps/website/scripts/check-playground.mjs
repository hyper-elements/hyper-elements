// The playground's browser gate. Run after `pnpm --filter @hyper-elements/website build`:
//
//   pnpm --filter @hyper-elements/website check:playground
//
// It serves dist/ and opens /playground in Chromium (Playwright's, the one packages/react's browser gates use; other
// engines with PLAYGROUND_BROWSER=firefox or webkit, where they're installed). Nothing leaves this machine: every
// request to another host is refused, so it runs offline.
//
// What it holds the page to, each with a control that shows the check can fail:
//
//   1. It loads, and the first starter renders under each root: what a visitor sees, and the real files (a PDF by its
//      signature, a PNG by decoding it).
//   2. A broken template shows its diagnostics, on the lines they're about; the fixed one shows none.
//      2b. What the compiler here would let through is stopped: a closing tag that isn't its opening tag's, a name
//          the package doesn't export. Right code in every shape, and every starter, still compiles.
//      2c. Leaving a view while its file is being drawn leaves no "drawing" notice over the next view.
//      2d. A link's or an agent's code isn't kept as the visitor's draft until they change it.
//   3. Code a link carries can't reach the page's origin: no request arrives, no storage, no parent. The same
//      attempts from a worker with no sandbox around it do get through (so "blocked" is the sandbox's doing).
//   4. Markup a template writes doesn't run in the preview, and can't navigate it. The same markup in a page of its
//      own does run.
//   5. A loop that never ends is stopped, and the page answers while it runs.
//   6. Every frame on the page is sandboxed as playground/README.md says, the email client previews among them.
//      6b. An email client's preview file the code rewrote (it can take over its worker's postMessage) runs no script
//          but the package's two: the previews still draw, and a script and a handler written into them don't run.
//          The same markup in a page of its own does run.
//      6c. An SVG the code rewrote doesn't run on the site's origin: the page shows it from a data: URL, whose
//          document has an origin of its own. The same file from a blob the page makes has the site's origin.
//   7. A link carries the code back, and the agent paths answer (the window API, the tools, WebMCP registration).
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(site, "dist");
assert(existsSync(join(dist, "playground/index.html")), "Build the site first: pnpm --filter @hyper-elements/website build");

// ─── The built files ───────────────────────────────────────────────────────

const html = readFileSync(join(dist, "playground/index.html"), "utf8");
assert.match(html, /<a href="\/playground" aria-current="page">Playground<\/a>/, "The header links the playground, and marks it as the page shown");
assert.match(readFileSync(join(dist, "index.html"), "utf8"), /<a href="\/playground">Playground<\/a>/, "The header links the playground from the home page");
assert.match(readFileSync(join(dist, "llms.txt"), "utf8"), /\[Playground\]\(https:\/\/www\.hyperelements\.dev\/playground\)/, "llms.txt names the playground");
assert.match(readFileSync(join(dist, "sitemap-0.xml"), "utf8"), /\/playground<\/loc>/, "The sitemap has the playground");
for (const file of ["runtime/runner.js", "runtime/core.js", "runtime/pdf.js", "runtime/image.js", "runtime/clients.js", "runtime/resvg.wasm", "fonts/LiberationSans-Regular.ttf", "starters.json", "guide.txt"]) {
  assert(statSync(join(dist, "playground", file)).size > 1000, `dist/playground/${file} is written`);
}
// The scripts an email client's preview may run: two sha256 hashes, each the one the clients bundle writes into a file.
const previewScripts = JSON.parse(readFileSync(join(dist, "playground/runtime/preview-scripts.json"), "utf8"));
assert.deepEqual(Object.keys(previewScripts).sort(), ["models", "runtime"]);
for (const hash of Object.values(previewScripts)) {
  assert.match(hash, /^[A-Za-z0-9+/]{43}=$/);
  assert(readFileSync(join(dist, "playground/runtime/clients.js"), "utf8").includes(hash), `The clients bundle writes previews with the script ${hash}`);
}
// The page itself carries no engine: it's fetched into the sandbox.
assert(statSync(join(dist, "playground/index.html")).size < 120_000, "The page is light: the engine isn't in it");

// ─── A server for dist/, and a file only this origin should be able to read ─

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".wasm": "application/wasm", ".ttf": "font/ttf", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".pdf": "application/pdf", ".xml": "application/xml" };
// Who asked for it. The page and what runs on its origin ask from the same origin; a sandboxed frame, or a worker in
// one, has an origin of its own, so its request would be from another site. Counted apart, so a control's own
// requests (some still on their way when the next check starts) are never taken for the sandbox's.
const secret = { own: 0, foreign: [] };
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (path === "/secret.txt") {
    // Readable from anywhere, so the only thing keeping the sandbox from it is the sandbox.
    const site = request.headers["sec-fetch-site"];
    if (site ? site === "same-origin" : request.headers.origin !== "null") secret.own++;
    else secret.foreign.push(`${request.method} sec-fetch-site: ${site}, sec-fetch-dest: ${request.headers["sec-fetch-dest"]}, origin: ${request.headers.origin}`);
    response.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
    return response.end("only the site should read this");
  }
  let file = join(dist, path);
  if (!file.startsWith(dist)) return response.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) return response.writeHead(404).end();
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  response.end(await readFile(file));
});
await new Promise((ready) => server.listen(0, "localhost", ready));
const origin = `http://localhost:${server.address().port}`;

const engine = process.env.PLAYGROUND_BROWSER ?? "chromium";
const playwright = createRequire(join(site, "../../packages/react/package.json"))("playwright");
const browser = await playwright[engine].launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Offline: nothing but this server answers.
await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.continue() : route.abort()));

const errors = [];
async function open(hash = "", { webmcp = false, keep = false } = {}) {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  // Each check starts from the first starter, not from the code the last one left in this browser (`keep`: from
  // what the last page left, as a visitor coming back does).
  if (!keep) {
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem("playground-check-started")) localStorage.removeItem("hyper-elements-playground");
        sessionStorage.setItem("playground-check-started", "1");
      } catch {
        // A sandboxed frame: it has no storage.
      }
    });
  }
  if (webmcp) {
    await page.addInitScript(() => {
      window.__registered = [];
      Object.defineProperty(Document.prototype, "modelContext", { configurable: true, get: () => ({ registerTool: (tool) => (window.__registered.push(tool.name), Promise.resolve()) }) });
    });
  }
  await page.goto(`${origin}/playground${hash}`);
  await rendered(page);
  return page;
}
const rendered = (page) => page.waitForFunction(() => ["ok", "error"].includes(document.documentElement.dataset.renderStatus), null, { timeout: 60_000 });
const api = (page, call, ...args) => page.evaluate(([call, args]) => window.hyperElementsPlayground[call](...args), [call, args]);
/** The frame the preview shows (the other one is the buffer the next render loads in). */
const shown = (page) => page.frameLocator('.pg-preview-frame[data-buffer="front"]');
const encode = (code) => Buffer.from(code, "utf8").toString("base64url");
const step = (name) => console.log(`  ✓ ${name}`);

const HEADLINE = "Come and see how a pot is made.";

try {
  // ─── 1. The first starter, under each root ───────────────────────────────
  {
    const page = await open();
    assert.equal(await page.locator("[data-status-text]").innerText().then((text) => /^Rendered in \d+ ms/.test(text)), true, "The status says it rendered");
    await shown(page).getByText(HEADLINE).waitFor();
    assert.equal(await api(page, "getResult").then((r) => [r.ok, r.root]).then(String), "true,Email");
    assert((await api(page, "getResult")).diagnostics.some((d) => d.clients?.includes("outlook")), "An Email's diagnostics name the email clients they're about");
    await page.locator('[data-view-tab="text"]').click();
    assert.match(await page.locator('[data-source="text"]').innerText(), /COME AND SEE HOW A POT IS MADE|Come and see how a pot is made/i, "The plain text is shown");
    await page.locator('[data-view-tab="preview"]').click();

    for (const root of ["Page", "Document", "Canvas", "Email"]) {
      await page.locator(`[data-root="${root}"]`).click();
      await page.waitForFunction((root) => window.hyperElementsPlayground.getResult().root === root, root);
      const result = await api(page, "getResult");
      assert.equal(result.ok, true, `${root}: ${JSON.stringify(result.error ?? result.diagnostics.filter((d) => d.severity === "error"))}`);
      assert(new RegExp(`<${root}[\\s>]`).test(await api(page, "getCode")), `${root}: the code's root is rewritten`);
      assert.equal(await page.locator(`[data-root="${root}"]`).getAttribute("aria-checked"), "true");
      if (root === "Canvas") {
        // The PNG the sandbox drew, decoded by the browser at the Canvas's size.
        const image = page.locator('[data-file="png"] img');
        await image.waitFor({ timeout: 60_000 });
        await page.waitForFunction(() => document.querySelector('[data-file="png"] img')?.naturalWidth > 0);
        assert.deepEqual(await image.evaluate((img) => [img.naturalWidth, img.naturalHeight]), [1200, 630], "The PNG is the Canvas's size");
      } else {
        await shown(page).getByText(HEADLINE).waitFor();
      }
    }
    assert.match(await api(page, "getCode"), /previewText="Throwing at noon/, "An Email's own props come back with it");

    // The files themselves, as an agent asks for them.
    const pdf = await api(page, "render", await api(page, "getCode"), { root: "Document", include: ["pdf"] });
    assert.equal(Buffer.from(pdf.pdf ?? "", "base64").subarray(0, 5).toString(), "%PDF-", `A Document's PDF: ${JSON.stringify(pdf.error)}`);
    const image = await api(page, "render", await api(page, "getCode"), { root: "Canvas", include: ["png", "svg"] });
    assert.equal(Buffer.from(image.png ?? "", "base64").subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `A Canvas's PNG: ${JSON.stringify(image.error)}`);
    assert.match(Buffer.from(image.svg ?? "", "base64").toString(), /^<svg[\s>]/, "A Canvas's SVG");
    // Control: a PDF isn't a Canvas's output, and the page says so rather than answering with one.
    const wrong = await api(page, "render", await api(page, "getCode"), { root: "Email", include: ["pdf"] });
    assert.equal(wrong.pdf, undefined);
    await page.close();
    step("the first starter renders as an Email, a Page, a Document (with its PDF) and a Canvas (with its PNG and SVG)");
  }

  // ─── 2. A broken template shows its diagnostics ──────────────────────────
  {
    const page = await open("#starter=fix-the-diagnostics");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.renderStatus), "error");
    const rows = page.locator("[data-diagnostics] .pg-diag");
    assert.equal(await rows.count(), 5, "Its five mistakes are five diagnostics");
    const row = rows.filter({ hasText: 'An Email has no prop "backgroundColor"' });
    assert.match(await row.innerText(), /it's a style, style=\{\{ backgroundColor: … \}\}/, "The diagnostic says what to write instead");
    assert.match(await row.innerText(), /line 7/, "and the line it's on");
    assert((await page.locator(".cm-lint-marker-error").count()) >= 3, "The editor marks the lines");
    await row.click();
    assert.match(await page.locator(".cm-activeLine").innerText(), /<Email backgroundColor=/, "A click on it goes to its line");
    // Control: with the mistakes fixed there are no errors, so the list isn't one that always shows them.
    const fixed = (await api(page, "getCode"))
      .replace('<Email backgroundColor="#f1f2f6">', '<Email style={{ backgroundColor: "#f1f2f6" }}>')
      .replace('altText="Orbit"', 'alt="Orbit"')
      .replace("fontSize: 30, marginBottom: 8", "fontSize: 30")
      .replace("<b>Invite your team</b>", "Invite your team")
      .replace('hover={{ backgroundColor: "#5a4bf0" }} style={{ backgroundColor: "#6d5efc", borderRadius: 10 }}', 'style={{ backgroundColor: "#6d5efc", borderRadius: 10, hover: { backgroundColor: "#5a4bf0" } }}');
    const result = await api(page, "setCode", fixed);
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics.filter((d) => d.severity === "error")));
    assert.equal(await page.locator('[data-diagnostics] .pg-diag[data-severity="error"]').count(), 0);
    await shown(page).getByText("Welcome to Orbit").waitFor();
    // A syntax error is said with its line, and the last render that worked stays up.
    await api(page, "setCode", fixed.replace("<Column style={{", "<Column style={"));
    assert.match(await page.locator("[data-diagnostics] .pg-problem").innerText(), /Syntax error · line \d+/i);
    await shown(page).getByText("Welcome to Orbit").waitFor();
    await page.close();
    step("a broken template shows each diagnostic with its fix and its line; the fixed one shows none");
  }

  // ─── 2b. What the compiler here lets through, a project's own wouldn't ───
  {
    const page = await open();
    // A closing tag that isn't its opening tag's. (Sucrase, which compiles the code here, doesn't compare them: code
    // that rendered here would then fail in tsc or esbuild.)
    const closed = await api(page, "render", "export default function A() {\n  return (\n    <Email>\n      <Text>Hi</Txt>\n    </Email>\n  );\n}");
    assert.deepEqual([closed.ok, closed.error?.kind, closed.error?.line], [false, "syntax", 4], JSON.stringify(closed.error ?? "it rendered"));
    assert.match(closed.error.message, /<\/Txt>.*<Text>/, "It names both tags");
    const bare = await api(page, "render", "<Email><Text>x</Txt></Email>");
    assert.deepEqual([bare.ok, bare.error?.kind, bare.error?.line], [false, "syntax", 1], JSON.stringify(bare.error ?? "it rendered"));
    const part = await api(page, "render", "export default <Document><Document.Page><Text>x</Text></Document.Pag></Document>;");
    assert.deepEqual([part.ok, part.error?.kind], [false, "syntax"], "A part's tag (Document.Page) is compared whole");
    // Control: JSX that is right, in every shape it takes, isn't refused (tags in attributes and expressions,
    // fragments, parts, self-closing tags, a generic arrow function and a comparison beside them).
    const fine = await api(
      page,
      "render",
      `const pick = <T,>(items: T[]) => items[0];\nconst few = 1 < 2 && 3 > 2;\nexport default function A() {\n  return (\n    <Document>\n      <Document.Page>\n        <>\n          <Text>{few ? <Span style={{ fontWeight: 700 }}>Bold</Span> : null} and {pick(["plain"])}</Text>\n          <Divider />\n        </>\n      </Document.Page>\n    </Document>\n  );\n}`,
    );
    assert.equal(fine.ok, true, JSON.stringify(fine.error ?? fine.diagnostics));
    // And every starter still compiles (the one with mistakes on purpose has Elements' errors, not a syntax error).
    const starters = await page.evaluate(() => fetch("/playground/starters.json").then((response) => response.json()));
    assert(starters.length >= 20);
    for (const starter of starters) {
      const result = await api(page, "render", starter.source, { include: [] });
      assert.notEqual(result.error?.kind, "syntax", `${starter.id}: ${result.error?.message}`);
      assert.equal(result.ok, starter.id !== "fix-the-diagnostics", `${starter.id}: ${JSON.stringify(result.error)}`);
    }

    // A name the package doesn't export: said by name, with the nearest one it has, on the line that uses it.
    const misspelled = await api(page, "render", 'import { Email, Txt } from "@hyper-elements/react";\n\nexport default function A() {\n  return <Email><Txt>Hi</Txt></Email>;\n}');
    assert.deepEqual([misspelled.ok, misspelled.error?.kind, misspelled.error?.line], [false, "import", 4], JSON.stringify(misspelled.error ?? "it rendered"));
    assert.match(misspelled.error.message, /"Txt" isn't exported by @hyper-elements\/react.*"Text"/, misspelled.error.message);
    const noDefault = await api(page, "render", 'import Elements from "@hyper-elements/react";\nexport default <Elements.Email />;');
    assert.deepEqual([noDefault.ok, noDefault.error?.kind], [false, "import"], JSON.stringify(noDefault.error ?? "it rendered"));
    // Control: a type imported beside the components, and the whole package under one name, are fine.
    const typed = await api(page, "render", 'import { Email, Text, ButtonProps } from "@hyper-elements/react";\nimport * as E from "@hyper-elements/react";\nconst style: ButtonProps["style"] = { fontSize: 14 };\nexport default <Email><Text style={style}>Hi</Text><E.Divider /></Email>;');
    assert.equal(typed.ok, true, JSON.stringify(typed.error ?? typed.diagnostics));
    await page.close();
    step("a closing tag that doesn't match and a name the package doesn't export are errors, with their lines (right code isn't refused)");
  }

  // ─── 2c. Leaving a view while its file is being drawn ────────────────────
  {
    const page = await open();
    // A Canvas's PNG is asked for, and before it's drawn the visitor is on an Email: the stage must not go on saying
    // it's drawing.
    await page.evaluate(() => {
      void window.hyperElementsPlayground.loadStarter("morning-pages-quote");
    });
    await page.waitForFunction(() => document.querySelector('[data-root="Canvas"]')?.getAttribute("aria-checked") === "true");
    await api(page, "loadStarter", "four-outputs");
    await shown(page).getByText(HEADLINE).waitFor();
    await page.waitForTimeout(4000);
    assert.equal(await page.locator("[data-veil]").getAttribute("data-on"), null, `The stage still says "${await page.locator("[data-veil-title]").innerText()}"`);
    // The same for an Email's client previews, left for its preview.
    await api(page, "setView", "clients");
    await page.waitForTimeout(150);
    await api(page, "setView", "preview");
    await page.waitForTimeout(600);
    assert.equal(await page.locator("[data-veil]").getAttribute("data-on"), null, `The stage still says "${await page.locator("[data-veil-title]").innerText()}"`);
    // Control: a file that is wanted is still drawn after all that.
    await api(page, "loadStarter", "morning-pages-quote");
    await page.locator('[data-file="png"] img').waitFor({ timeout: 60_000 });
    await page.close();
    step("leaving a view while its file is being drawn leaves no \"drawing\" over the next one");
  }

  // ─── 2d. A link's code isn't the visitor's draft ─────────────────────────
  {
    const mine = "<Email><Text>My own draft</Text></Email>";
    const theirs = "<Email><Text>A stranger's code</Text></Email>";
    const page = await open();
    // The visitor writes something: it's kept for their next visit.
    await page.locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText(mine);
    await shown(page).getByText("My own draft").waitFor();
    await page.waitForTimeout(700);
    // Then they open a link someone sent, and only look.
    const link = await open(`#code=${encode(theirs)}`, { keep: true });
    await shown(link).getByText("A stranger's code").waitFor();
    await link.waitForTimeout(700);
    await link.close();
    const back = await open("", { keep: true });
    assert.equal(await api(back, "getCode"), mine, "A link that was only opened leaves the visitor's own draft as it was");
    assert.equal(await back.locator("[data-origin]").isHidden(), true);
    await back.close();
    // An agent's code is the same: shown, not kept as theirs.
    await api(page, "setCode", theirs);
    await page.waitForTimeout(700);
    const again = await open("", { keep: true });
    assert.equal(await api(again, "getCode"), mine, "Code an agent put in the editor isn't kept as the visitor's draft");
    await again.close();
    // Once they change a link's code it's kept, and still said to be a link's.
    const edited = await open(`#code=${encode(theirs)}`, { keep: true });
    await shown(edited).getByText("A stranger's code").waitFor();
    await edited.locator(".cm-content").click();
    await edited.keyboard.press("ControlOrMeta+a");
    await edited.keyboard.insertText(`${theirs}\n// changed`);
    await edited.waitForTimeout(900);
    await edited.close();
    const kept = await open("", { keep: true });
    assert.equal(await api(kept, "getCode"), `${theirs}\n// changed`);
    assert.match(await kept.locator("[data-origin]").innerText(), /Code from a link/, "A link's code that was changed and kept is still said to be a link's");
    await kept.close();
    await page.close();
    step("a link's or an agent's code isn't kept as the visitor's draft until they change it, and then it still says where it came from");
  }

  // ─── 3. Code from a link can't reach the page's origin ───────────────────
  {
    // What a stranger's link might try, from inside the worker it runs in. It answers through the worker's own
    // postMessage, which it takes over: the code shares the worker's globals, and that still gets it nowhere.
    const attempts = `
const secret = ${JSON.stringify(`${origin}/secret.txt`)};
const tries = {};
const attempt = (name, run) => { try { tries[name] = "REACHED " + String(run()).slice(0, 60); } catch (error) { tries[name] = "blocked"; } };
attempt("xhr", () => { const x = new XMLHttpRequest(); x.open("GET", secret, false); x.send(); return x.responseText; });
attempt("fetch", () => { fetch(secret); return "sent"; });
attempt("importScripts", () => { importScripts(secret); return "loaded"; });
attempt("worker", () => { new Worker(URL.createObjectURL(new Blob(["fetch(" + JSON.stringify(secret) + ")"]))); return "started"; });
attempt("beacon", () => { if (!navigator.sendBeacon(secret)) throw 0; return "sent"; });
attempt("websocket", () => { new WebSocket(secret.replace("http", "ws")); return "opened"; });
attempt("localStorage", () => localStorage.getItem("playground-check"));
attempt("document", () => document.cookie);
attempt("parent", () => parent.location.href);
attempt("origin", () => { if (self.origin === "null") throw 0; return self.origin; });
`;
    const hostile = `${attempts}console.log("PROBE " + JSON.stringify(tries));\nexport default <Email><Text>A stranger's template</Text></Email>;\n`;
    const page = await open(`#code=${encode(hostile)}`);
    await page.evaluate(() => (localStorage.setItem("playground-check", "the page's own"), (document.cookie = "playground-check=1")));
    await shown(page).getByText("A stranger's template").waitFor();
    assert.match(await page.locator("[data-origin]").innerText(), /Code from a link/, "The page says the code came from a link");
    await page.locator('[data-check="console"]').click();
    const probe = JSON.parse((await page.locator("[data-console]").innerText()).split("PROBE ")[1]);
    for (const [name, outcome] of Object.entries(probe)) assert.equal(outcome, "blocked", `The sandbox reached "${name}": ${outcome}`);
    assert.equal(Object.keys(probe).length, 10);
    await page.waitForTimeout(500);
    assert.deepEqual(secret.foreign, [], "No request from the sandbox reached the server");
    // The frame the worker lives in: its own origin, closed to the page's.
    const sandbox = await page.locator("iframe[data-playground-sandbox]").elementHandle().then((handle) => handle.contentFrame());
    assert(sandbox);
    assert.deepEqual(
      await sandbox.evaluate(() => {
        const closed = (run) => {
          try {
            run();
            return false;
          } catch {
            return true;
          }
        };
        return [self.origin, closed(() => parent.document.title), closed(() => localStorage.length), closed(() => parent.localStorage.length)];
      }),
      ["null", true, true, true],
      "The sandbox's frame has an origin of its own",
    );
    // Control: the same attempts in a worker with no sandbox around it (one this page makes on its own origin) do get
    // through: the request arrives and the origin is the site's. So "blocked" above is the sandbox's doing.
    const loose = await page.evaluate(
      (source) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(URL.createObjectURL(new Blob([`${source}\npostMessage(tries);`], { type: "text/javascript" })));
          worker.onmessage = (event) => resolve(event.data);
          worker.onerror = (event) => reject(new Error(event.message));
        }),
      attempts,
    );
    assert.equal(loose.xhr, "REACHED only the site should read this", "The control worker reads the file");
    assert.equal(loose.fetch, "REACHED sent");
    assert.equal(loose.origin, `REACHED ${origin}`, "The control worker has the site's origin");
    assert(secret.own > 0, "The listener counts the control's requests");
    // And a request from a frame with an origin of its own is told apart: the listener would have seen the sandbox's.
    await page.evaluate(
      (url) =>
        new Promise((resolve) => {
          const frame = document.createElement("iframe");
          frame.setAttribute("sandbox", "allow-scripts");
          frame.srcdoc = `<script>fetch(${JSON.stringify(url)}).finally(() => parent.postMessage("asked", "*"))</` + `script>`;
          addEventListener("message", (event) => event.data === "asked" && resolve());
          document.body.append(frame);
        }),
      `${origin}/secret.txt`,
    );
    assert.equal(secret.foreign.length, 1, "The control frame's request is counted as another site's");
    secret.foreign.length = 0;
    await page.close();
    step("code from a link reaches no network, no storage and no parent (the same attempts, unsandboxed, do get through)");
  }

  // ─── 4. Markup a template writes doesn't run in the preview ──────────────
  {
    const markup = `<p id="mark">as written</p><script>document.getElementById("mark").textContent = "A SCRIPT RAN";</` + `script><img src="x" onerror="document.getElementById('mark').textContent = 'A HANDLER RAN'"><meta http-equiv="refresh" content="0;url=${origin}/secret.txt"><base href="${origin}/secret.txt/">`;
    const code = `export default <Email><Html html={${JSON.stringify(markup)}} /><Text>After the markup</Text></Email>;`;
    const page = await open(`#code=${encode(code)}`);
    await shown(page).getByText("After the markup").waitFor();
    await page.waitForTimeout(1200);
    assert.equal(await shown(page).locator("#mark").innerText(), "as written", "Neither its script nor its handler ran");
    assert.equal(await shown(page).locator("meta[http-equiv=refresh], base").count(), 0, "What could navigate the frame is taken out");
    assert.equal(await shown(page).getByText("After the markup").count(), 1, "The frame still shows the template: it wasn't navigated");
    assert.deepEqual(secret.foreign, [], "The preview asked for nothing it was told to");
    // Its HTML is what the engine wrote: the script is in it (an Html block is written as given).
    assert.match((await api(page, "getResult")).html, /A SCRIPT RAN/);
    // Control: the same markup, in a page of its own, does run.
    const loose = await context.newPage();
    await loose.setContent(`<!doctype html><body>${markup.replace(/<meta[^>]*>|<base[^>]*>/g, "")}</body>`);
    await loose.waitForFunction(() => document.getElementById("mark").textContent !== "as written");
    assert.match(await loose.locator("#mark").innerText(), /RAN/);
    await loose.close();
    // A link the template writes is shown by the page, not followed by the frame.
    await api(page, "setCode", `export default <Email><Button href="https://example.com/offer">Take the offer</Button></Email>;`);
    await shown(page).getByText("Take the offer").click();
    await page.locator("[data-linkbar-href]").getByText("https://example.com/offer").waitFor();
    assert.equal(await page.locator("[data-linkbar-open]").getAttribute("href"), "https://example.com/offer");
    assert(page.url().startsWith(origin), "The page stayed where it was");
    await api(page, "setCode", `export default <Email><Html html={'<a href="javascript:alert(1)">A script link</a>'} /></Email>;`);
    await shown(page).getByText("A script link").click();
    await page.locator("[data-linkbar-href]").getByText("javascript:alert(1)").waitFor();
    assert.equal(await page.locator("[data-linkbar-open]").isHidden(), true, "The page opens web and mail addresses only");
    assert.equal(await page.locator("[data-linkbar-open]").getAttribute("href"), null);
    await page.close();
    step("a template's own script, handler, refresh and base do nothing in the preview (they run in a page of their own)");
  }

  // ─── 5. A loop that never ends ───────────────────────────────────────────
  {
    const page = await open();
    const started = Date.now();
    const stuck = api(page, "setCode", "while (true) {}\nexport default <Email />;");
    await page.waitForTimeout(1500);
    const asked = Date.now();
    assert.equal(await page.evaluate(() => 6 * 7), 42);
    assert(Date.now() - asked < 1000, "The page answers while the loop runs");
    const result = await stuck;
    assert.equal(result.error?.kind, "timeout", JSON.stringify(result.error));
    assert(Date.now() - started < 15_000, "The loop is stopped within seconds");
    assert.match(await page.locator("[data-status-text]").innerText(), /Stopped after 8 seconds/);
    assert.equal((await api(page, "setCode", "<Email><Text>Still here</Text></Email>")).ok, true, "The next render works");
    await shown(page).getByText("Still here").waitFor();
    await page.close();
    step("a loop that never ends is stopped, the page answers meanwhile, and the next render works");
  }

  // ─── 6. Every frame is sandboxed as the README says ──────────────────────
  {
    const page = await open("#view=clients");
    await page.locator("[data-clients-stage] iframe").first().waitFor({ timeout: 60_000 });
    const frames = await page.evaluate(() => [...document.querySelectorAll("iframe")].map((frame) => ({ sandbox: frame.getAttribute("sandbox"), src: (frame.getAttribute("src") ?? "").slice(0, 40), srcdoc: frame.hasAttribute("srcdoc"), allow: frame.getAttribute("allow"), where: frame.className || [...frame.parentElement.attributes].map((a) => a.name).join(" ") })));
    assert(frames.length >= 6, "The sandbox, the preview's two frames and the email clients' are on the page");
    for (const frame of frames) {
      assert.notEqual(frame.sandbox, null, `A frame without a sandbox: ${frame.where}`);
      assert.equal(frame.allow, null, `A frame with permissions: ${frame.where}`);
      assert(!/allow-(top-navigation|popups|forms|modals|downloads)/.test(frame.sandbox), `A frame that can leave its box: ${frame.where} (${frame.sandbox})`);
      // Same-origin with scripts is the page's own keys. Only a data: document may have both: its origin is never the page's.
      if (/allow-same-origin/.test(frame.sandbox)) {
        assert(frame.src.startsWith("data:text/html") && !frame.srcdoc, `allow-same-origin on a frame that isn't a data: document: ${frame.where}`);
      } else {
        assert.equal(frame.sandbox, "allow-scripts", `${frame.where}: ${frame.sandbox}`);
      }
    }
    const previews = page.frames().filter((frame) => frame.url().startsWith("data:text/html"));
    assert(previews.length >= 4, "An email client's preview for each client");
    for (const frame of previews) {
      assert.deepEqual(
        await frame.evaluate(() => {
          const closed = (run) => {
            try {
              run();
              return false;
            } catch {
              return true;
            }
          };
          return [self.origin, closed(() => parent.document.title), closed(() => parent.localStorage.length), closed(() => (top.location = "https://example.com/"))];
        }),
        ["null", true, true, true],
        "An email client's preview has an origin of its own, and can't navigate the page",
      );
    }
    assert(page.url().startsWith(origin));
    await page.waitForFunction(() => true);
    const drawn = await Promise.all(previews.map((frame) => frame.waitForFunction(() => document.documentElement.hasAttribute("data-email-client-ready"), null, { timeout: 30_000 }).then(() => frame.evaluate(() => document.documentElement.getAttribute("data-email-client-ready")))));
    assert(drawn.every((ready) => ready === "ok" || ready === "incomplete"), `The previews draw: ${drawn}`);
    await page.close();
    step(`every frame is sandboxed, and the ${previews.length} email client previews are closed to the page`);
  }

  // ─── 6b. A preview file the code rewrote runs only the package's scripts ─
  {
    // The template takes over its worker's postMessage and rewrites each preview file the worker answers with: the
    // file's own policy taken out, and a script and a handler written in ahead of the package's two scripts.
    const forged = `<script>document.documentElement.dataset.forged = "script"</` + `script><img src="x" onerror="document.documentElement.dataset.forged = 'handler'">`;
    const code = `const forged = ${JSON.stringify(forged)};
const real = globalThis.postMessage.bind(globalThis);
globalThis.postMessage = (message, transfer) => {
  for (const preview of message?.result?.previews ?? []) preview.html = preview.html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "").replace("<body>", "<body>" + forged);
  return real(message, transfer);
};
export default <Email><Text>A rewritten preview</Text></Email>;
`;
    const page = await open(`#code=${encode(code)}&view=clients`);
    await page.locator("[data-clients-stage] iframe").first().waitFor({ timeout: 60_000 });
    // Each preview's frame, once it has loaded its file.
    let previews = [];
    for (let wait = 0; wait < 100 && previews.length < 4; wait++) {
      await page.waitForTimeout(100);
      previews = page.frames().filter((frame) => frame.url().startsWith("data:text/html"));
    }
    assert(previews.length >= 4, `An email client's preview for each client: ${previews.length}`);
    for (const frame of previews) {
      assert.match(await frame.content(), /dataset\.forged = "script"/, "The preview is the file the code rewrote");
      await frame.waitForFunction(() => document.documentElement.hasAttribute("data-email-client-ready"), null, { timeout: 30_000 });
      const [ready, forgedRan] = await frame.evaluate(() => [document.documentElement.getAttribute("data-email-client-ready"), document.documentElement.dataset.forged ?? null]);
      assert(ready === "ok" || ready === "incomplete", `The package's own scripts still draw the preview: ${ready}`);
      assert.equal(forgedRan, null, "Neither the script nor the handler written into the preview ran");
    }
    // Control: the same markup in a page of its own runs, so "didn't run" above is the preview's policy's doing.
    const loose = await context.newPage();
    await loose.setContent(`<!doctype html><html><body>${forged}</body></html>`);
    await loose.waitForFunction(() => document.documentElement.dataset.forged);
    await loose.close();
    await page.close();
    step(`an email client's preview file the code rewrote runs only the package's two scripts (the markup runs in a page of its own)`);
  }

  // ─── 6c. An SVG the code rewrote doesn't run on the site's origin ────────
  {
    // The template rewrites the SVG its worker answers with: one whose script says where it ran.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><text x="10" y="60">A rewritten SVG</text><script>parent.postMessage({ ran: String(self.origin), storage: (() => { try { localStorage.length; return "read"; } catch { return "closed"; } })() }, "*")</` + `script></svg>`;
    const code = `const svg = ${JSON.stringify(svg)};
const real = globalThis.postMessage.bind(globalThis);
globalThis.postMessage = (message, transfer) => {
  const result = message?.result;
  if (result?.kind === "image" && result.bytes && new TextDecoder().decode(result.bytes.subarray(0, 4)) === "<svg") {
    result.bytes = new TextEncoder().encode(svg);
    return real(message, [result.bytes.buffer]);
  }
  return real(message, transfer);
};
export default <Canvas width={400} height={120}><Text>A Canvas</Text></Canvas>;
`;
    const page = await open(`#code=${encode(code)}&view=svg`);
    const image = page.locator('[data-file="svg"] img');
    await image.waitFor({ timeout: 60_000 });
    const src = await image.getAttribute("src");
    assert(src.startsWith("data:image/svg+xml"), `The SVG is shown from a data: URL, not ${src.slice(0, 30)}`);
    assert.match(Buffer.from(src.slice(src.indexOf(",") + 1), "base64").toString(), /A rewritten SVG/, "The SVG shown is the one the code rewrote");
    // The SVG as a document of its own, as "Open image in new tab" shows it, with no sandbox around it.
    const opened = (url) =>
      page.evaluate(
        (url) =>
          new Promise((resolve) => {
            const frame = document.createElement("iframe");
            const listen = (event) => event.source === frame.contentWindow && event.data?.ran && done(event.data);
            const done = (outcome) => {
              removeEventListener("message", listen);
              frame.remove();
              resolve(outcome);
            };
            addEventListener("message", listen);
            setTimeout(() => done({ ran: "nothing ran" }), 3000);
            frame.src = url;
            document.body.append(frame);
          }),
        url,
      );
    const fromData = await opened(src);
    assert.notEqual(fromData.ran, origin, "The SVG's script doesn't have the site's origin");
    assert.notEqual(fromData.storage, "read", "The SVG's script can't read the site's storage");
    // Control: the same file from a blob this page makes (how the page showed an SVG before) has the site's origin.
    const blob = await page.evaluate((src) => fetch(src).then((response) => response.blob()).then((file) => URL.createObjectURL(new Blob([file], { type: "image/svg+xml" }))), src);
    assert.deepEqual(await opened(blob), { ran: origin, storage: "read" }, "The same SVG from the page's blob runs on the site");
    await page.close();
    step("an SVG the code rewrote is shown from a data: URL, and on its own it doesn't run on the site (from the page's blob, it would)");
  }

  // ─── 7. Links and agent paths ────────────────────────────────────────────
  {
    const page = await open("", { webmcp: true });
    const code = `// A template with "quotes", <tags> and ünïcödé\nexport default <Page><Heading level={1}>Shared by a link</Heading></Page>;\n`;
    await api(page, "setCode", code);
    const link = await api(page, "getShareUrl");
    assert.match(link, /#(z|code)=/);
    const other = await context.newPage();
    await other.goto(link);
    await rendered(other);
    assert.equal(await api(other, "getCode"), code, "A link carries the code back as it was");
    await shown(other).getByText("Shared by a link").waitFor();
    await other.close();

    assert.deepEqual(await page.evaluate(() => window.hyperElementsPlayground.tools.map((tool) => tool.name)), ["render_hyper_elements", "show_hyper_elements_preview", "get_hyper_elements_reference", "get_playground_code"]);
    assert.deepEqual(await page.evaluate(() => window.__registered), ["render_hyper_elements", "show_hyper_elements_preview", "get_hyper_elements_reference", "get_playground_code"], "The tools are registered with WebMCP where the browser has it");
    const tool = (name, input) => page.evaluate(([name, input]) => window.hyperElementsPlayground.tools.find((tool) => tool.name === name).execute(input), [name, input]);
    const made = await tool("render_hyper_elements", { code: '<Email><Text style={{ marginTop: 8 }}>Hi</Text></Email>' });
    assert.equal(made.ok, false);
    assert.match(made.diagnostics[0].message, /use the parent's gap/, "A tool's answer says what to fix");
    assert.equal(await api(page, "getCode"), code, "render_hyper_elements leaves the editor alone");
    const good = await tool("render_hyper_elements", { code: "<Email><Text>Hi</Text></Email>", root: "Page", include: ["html", "outline"] });
    assert.deepEqual([good.ok, good.root, /^Page /.test(good.outline), /<html/.test(good.html)], [true, "Page", true, true]);
    const showing = await tool("show_hyper_elements_preview", { code: "<Email><Text>Shown by a tool</Text></Email>", device: "phone" });
    assert.match(showing.shareUrl, /#(z|code)=.*device=phone/);
    await shown(page).getByText("Shown by a tool").waitFor();
    assert.match((await tool("get_hyper_elements_reference", {})).guide, /## Components/);
    assert.equal((await tool("get_playground_code", {})).code, "<Email><Text>Shown by a tool</Text></Email>");
    assert.match(await page.evaluate(() => window.hyperElementsPlayground.help()), /hyperElementsPlayground\.render\(code, options\)/);
    await page.close();
    step("a link carries the code back; the window API, the four tools and their WebMCP registration answer");
  }

  assert.deepEqual(secret.foreign, [], "Over the whole run, no sandboxed frame or worker reached the server's file");
  assert.deepEqual(errors, [], "The page threw");
  console.log(`PLAYGROUND_OK (${engine}): the playground renders every root, shows what's wrong, and keeps a stranger's code in its box`);
} catch (error) {
  console.error(`PLAYGROUND_FAIL (${engine}): ${error?.stack ?? error}`);
  if (errors.length) console.error(`Page errors:\n${errors.join("\n")}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
