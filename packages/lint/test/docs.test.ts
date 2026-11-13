/**
 * /docs/lint has a section per rule, written from `rules`: its anchor is the rule's id, so each finding's `see` link
 * lands on it. Rewrite them with UPDATE_LINT_DOCS=1.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rules, type Rule } from "../src/index";

const PAGE = join(__dirname, "../../../apps/website/src/content/docs/lint.md");
const START = /<!-- rules:start[^>]*-->\n/;
const END = "<!-- rules:end -->";

export function section(rule: Rule): string {
  const roots = rule.roots.join(" and ");
  const where = [
    roots === "Email and Page" ? "an Email and a Page" : roots ? `a ${roots}` : "",
    rule.html === "both" ? "HTML (an `Html` block's and `lintHtml()`'s)" : rule.html === "document" ? "a whole HTML document (`lintHtml()`'s)" : "",
  ].filter(Boolean);
  return `### \`${rule.id}\`\n\n${rule.summary}\n\n${rule.severity === "warning" ? "A warning" : "A note"} by default, on ${where.join(", and on ")}. **Fix:** ${rule.fix}${rule.htmlFix ? ` (in HTML, ${rule.htmlFix})` : ""}.\n`;
}

describe("/docs/lint", () => {
  it("has a section for each rule, written from the rules", () => {
    const page = readFileSync(PAGE, "utf8");
    const start = START.exec(page)!;
    const end = page.indexOf(END);
    const written = rules.map(section).join("\n");
    const want = `${page.slice(0, start.index + start[0].length)}\n${written}\n${page.slice(end)}`;
    if (process.env.UPDATE_LINT_DOCS) writeFileSync(PAGE, want);
    else expect(page).toBe(want);
  });
});
