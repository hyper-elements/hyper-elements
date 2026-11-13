/**
 * `email/lint-` and `page/lint-` are lint's: no other code in the repository writes a diagnostic starting with either,
 * in its source (a scan of code literals) or at run time (the codes core builds and the email client models return,
 * which no scan can see).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validate } from "@hyper-elements/react";
import { emailClients } from "@hyper-elements/email-clients";
import { screenTemplates } from "./templates";

const PACKAGES = join(__dirname, "../..");
const LITERAL = /["'`](email|page)\/lint-/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : files(path);
    return /\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("lint's code prefixes", () => {
  it("aren't in the source of core, email-clients or the CLI", () => {
    const found = ["internal/core/src", "email-clients/src", "cli/src"].flatMap((dir) =>
      files(join(PACKAGES, dir)).filter((file) => readFileSync(file, "utf8").split("\n").some((line) => LITERAL.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)))
    );
    expect(found).toEqual([]);
  });

  it("aren't in what core and the email client checks report on any gallery or stress template", async () => {
    const plugin = await emailClients();
    for (const { name, template } of screenTemplates()) {
      const codes = validate(template, { plugins: [plugin] }).diagnostics.map((d) => d.code);
      expect(codes.filter((code) => /^(email|page)\/lint-/.test(code)), name).toEqual([]);
    }
  });
});
