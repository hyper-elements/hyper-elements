/**
 * The email-testing skill (skills/email-testing/SKILL.md, at the repository's root) tells an agent which commands to run:
 * each must be one this CLI takes, and its table of clients the ones email-clients previews.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args";
import { DEFAULT_PREVIEW_CLIENTS, PREVIEW_CLIENTS } from "../../email-clients/src/clients";

// Line endings as Git checks them out on Windows (CRLF) read as LF.
const skill = readFileSync(join(__dirname, "../../../skills/email-testing/SKILL.md"), "utf8").replace(/\r\n/g, "\n");

/** Each command the skill gives, as the CLI's arguments: `npx @hyper-elements/cli …` and `npx -p … hyper-elements …`. */
function commands(): string[][] {
  const found: string[][] = [];
  for (const m of skill.matchAll(/npx (?:@hyper-elements\/cli|(?:-p \S+ )+hyper-elements) ([^`\n]+)/g)) {
    found.push(m[1].replace(/…/g, "").trim().split(/\s+/));
  }
  return found;
}

describe("the email-testing skill", () => {
  it("has the frontmatter a skill needs, its name its folder's", () => {
    const frontmatter = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(skill);
    expect(frontmatter?.[1]).toBe("email-testing");
    // A description is one YAML line: no ": " or " #" in it.
    expect(frontmatter?.[2]).not.toMatch(/: | #/);
  });

  it("gives only commands and options the CLI takes", () => {
    const all = commands();
    expect(all.length).toBeGreaterThanOrEqual(4);
    for (const argv of all) expect(() => parseArgs(argv), argv.join(" ")).not.toThrow();
    // Options named on their own in the text, outside a command.
    for (const option of new Set([...skill.matchAll(/`(--[a-z-]+)`/g)].map((m) => m[1]))) {
      const value: Record<string, string> = { "--clients": "outlook", "--props": "props.json" };
      expect(() => parseArgs(["preview", "email.html", option, ...(value[option] ? [value[option]] : [])]), option).not.toThrow();
    }
  });

  it("lists every client email-clients previews, and its default ones", () => {
    const table = [...skill.matchAll(/^\s*\| `([a-z-]+)` \|/gm)].map((m) => m[1]);
    expect(table.sort()).toEqual([...PREVIEW_CLIENTS].sort());
    expect(skill).toContain(`by default \`${DEFAULT_PREVIEW_CLIENTS.join(",")}\``);
  });
});
