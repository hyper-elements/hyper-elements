/**
 * validate()'s notes on what Outlook.com removes from an Html block's <style> agree with Outlook.com's model, the one
 * the previews draw with: over sample rules (every selector part and at-rule the model's profile lists, states on a
 * type and on a class, attributes with and without a class, nested queries, and rules it keeps), validate() notes a
 * rule for Outlook.com exactly where the model removes one. Core's rules are generated from the model's data
 * (scripts/build-runtime.mjs); this holds the rest of them, written as code on both sides, to it.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";
import { Email, Html, validate } from "@hyper-elements/react";

const RENDERER = join(__dirname, "../../src/runtime/renderer");
const profile = JSON.parse(readFileSync(join(RENDERER, "clients/support.json"), "utf8")).profiles["outlook-com"] as { selectors: string[]; atRules: string[] };

/** A valid argument for a functional pseudo-class (an invalid rule never reaches the model: the browser drops it). */
const argument = (part: string) => (part.startsWith(":lang") ? "en" : part.startsWith(":nth") ? "2" : ".x");
/** A valid rule for each at-rule; another the model adds, as a block. */
const AT_RULES: Record<string, string> = {
  "font-face": "@font-face { font-family: Brand; src: url(https://example.test/b.woff2) }",
  import: "@import url(https://example.test/s.css);",
  keyframes: "@keyframes pulse { from { color: red } to { color: blue } }",
  supports: "@supports (color: red) { p { color: red } }",
};

const SAMPLES: string[] = [
  ...profile.selectors.map((part) => `p${part}${part.endsWith("(") ? `${argument(part)})` : ""} { color: red }`),
  ...profile.atRules.map((name) => AT_RULES[name] ?? `@${name} x { p { color: red } }`),
  ".promo:hover { color: red }",
  "a:hover { color: red }",
  "#cta:focus { outline: 0 }",
  "td a:visited, .promo { color: red }",
  ":first-child { margin: 0 }",
  "p::before { content: '' }",
  ".promo::after { content: '' }",
  ".promo[data-x] { color: red }",
  "[data-x] { color: red }",
  ".promo [data-x] { color: red }",
  "a[href^='https'] { color: red }",
  "@media screen { @media (max-width: 480px) { p { color: red } } }",
  "@media (max-width: 480px) { .promo { display: block } }",
  "@media (max-width: 480px) { .promo:hover { color: red } }",
  ".promo { color: #333 } td > p + p { margin: 0 } * { box-sizing: border-box }",
];

/** The <style> notes for Outlook.com in validate() (not the note on a <style> in the body, nor other CSS). */
function validateRemoves(css: string): boolean {
  const { diagnostics } = validate(
    <Email width={600}>
      <Html html={`<style>${css}</style><p class="promo">x</p>`} />
    </Email>,
    { emailClients: ["outlook-com"] }
  );
  return diagnostics.some((d) => d.code === "email/html-css" && d.message.includes("in a <style>"));
}

let browser: Browser;
let page: Page;
beforeAll(async () => {
  const harness = await build({ entryPoints: [join(RENDERER, "clients/outlook-com.js")], bundle: true, write: false, format: "iife", globalName: "model", platform: "browser" });
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.addScriptTag({ content: harness.outputFiles[0]!.text });
});
afterAll(async () => {
  await browser?.close();
});

it("notes a rule Outlook.com removes from a <style> exactly where its model removes one", async () => {
  // What the model counts when it removes a rule from a <style> (not the <style>s it can't read: none here).
  const RULES = /^(selectors Outlook\.com doesn't support|nested @media|@[\w-]+|at-rules Outlook\.com doesn't support)$/;
  const disagree: string[] = [];
  for (const css of SAMPLES) {
    const removed = await page.evaluate((css) => (globalThis as any).model.outlookCom(`<!DOCTYPE html><html><head></head><body><style>${css}</style><p class="promo">x</p></body></html>`, {}).removed as Record<string, number>, css);
    const model = Object.keys(removed).some((what) => RULES.test(what));
    if (model !== validateRemoves(css)) disagree.push(`${css}: the model ${model ? "removes" : "keeps"} it, validate() ${model ? "doesn't note it" : "notes it"} (${JSON.stringify(removed)})`);
  }
  expect(disagree).toEqual([]);
  expect(SAMPLES.length).toBeGreaterThan(25);
});
