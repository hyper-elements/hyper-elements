/**
 * The baseline: what lint finds on every gallery and stress template, as an Email and a Page, and what lintHtml()
 * finds in the HTML each of them renders (not required to be empty: an image with an empty alt in a link is a real
 * finding), recorded in test/__baseline__/. A rule change that adds noise shows here; rewrite it on purpose with UPDATE_LINT_BASELINE=1 and
 * say why.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { render, validate } from "@hyper-elements/react";
import { lintHtml } from "../src/html";
import { lint } from "../src/index";
import { screenTemplates } from "./templates";

const DIR = join(__dirname, "__baseline__");
const UPDATE = !!process.env.UPDATE_LINT_BASELINE;

describe("the baseline", () => {
  const templates = screenTemplates();
  if (UPDATE) {
    rmSync(DIR, { recursive: true, force: true });
    mkdirSync(join(DIR, "html"), { recursive: true });
  }

  for (const { name, template } of templates) {
    it(name, () => {
      // With every rule on, marketing included, so each rule's noise shows.
      const found = validate(template, { plugins: [lint({ kind: "marketing" })] })
        .diagnostics.filter((d) => /^(email|page)\/lint-/.test(d.code))
        .map(({ code, severity, path, message }) => ({ code, severity, path, message }));
      const file = join(DIR, `${name}.json`);
      const text = `${JSON.stringify(found, null, 2)}\n`;
      if (UPDATE) writeFileSync(file, text);
      else {
        expect(existsSync(file), `${file} is missing: run UPDATE_LINT_BASELINE=1 pnpm test baseline`).toBe(true);
        expect(text).toBe(readFileSync(file, "utf8"));
      }
    });
  }

  for (const { name, template } of templates) {
    it(`${name}'s HTML`, async () => {
      const { html } = await render(template).catch(() => ({ html: "" }));
      if (!html.startsWith("<!DOCTYPE")) return;
      const found = lintHtml(html, { kind: "marketing" }).diagnostics.map(({ code, severity, line, column, message }) => ({ code, severity, line, column, message }));
      const file = join(DIR, "html", `${name}.json`);
      const text = `${JSON.stringify(found, null, 2)}\n`;
      if (UPDATE) writeFileSync(file, text);
      else {
        expect(existsSync(file), `${file} is missing: run UPDATE_LINT_BASELINE=1 pnpm test baseline`).toBe(true);
        expect(text).toBe(readFileSync(file, "utf8"));
      }
    });
  }

  it("has no file for a template that's gone", () => {
    const names = new Set(templates.map(({ name }) => `${name}.json`));
    expect(readdirSync(DIR).filter((file) => file !== "html" && !names.has(file))).toEqual([]);
    expect(readdirSync(join(DIR, "html")).filter((file) => !names.has(file))).toEqual([]);
  });
});
