/**
 * Finding templates in folders: `_`, `.` and IGNORED folders are skipped, files without a default export aren't
 * templates, tests and stories aren't either. (Migrate's own walk, unchanged, is held by its tests.)
 */
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, email, lines, project, WINDOWS } from "./helpers";

describe("discovery", () => {
  it("skips `_`, `.` and IGNORED folders, tests, stories, declarations and modules without a default export", async () => {
    const files: Record<string, string> = {
      "emails/welcome.tsx": email("Welcome"),
      "emails/nested/receipt.tsx": email("Receipt"),
      "emails/_components/footer.tsx": email("Footer"),
      "emails/.drafts/draft.tsx": email("Draft"),
      "emails/welcome.test.tsx": email("Test"),
      "emails/welcome.stories.tsx": email("Story"),
      "emails/types.d.ts": "export type X = 1;\n",
      "emails/helpers.ts": `export const helper = 1;\n`,
    };
    for (const ignored of ["node_modules", ".git", ".next", "dist", "build", "out", ".turbo", "coverage"]) files[`emails/${ignored}/x.tsx`] = email(ignored);
    const dir = project(files);
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran).slice(0, -1).map((l) => l.file)).toEqual(["emails/nested/receipt.tsx", "emails/welcome.tsx"]);
  });

  it("loads a file given by name whatever its folder", async () => {
    const dir = project({ "emails/_components/footer.tsx": email("Footer") });
    const ran = await cli(dir, ["check", "emails/_components/footer.tsx", "--json"]);
    expect(ran.code).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ file: "emails/_components/footer.tsx", status: "ok" });
  });

  it.skipIf(WINDOWS)("doesn't follow a symbolic link to a folder, and says so", async () => {
    const dir = project({ "emails/a.tsx": email("A"), "shared/b.tsx": email("B") });
    symlinkSync(join(dir, "shared"), join(dir, "emails/linked"), "dir");
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(lines(ran).slice(0, -1).map((l) => l.file)).toEqual(["emails/a.tsx"]);
    expect(ran.stderr).toContain("emails/linked: a symbolic link to a folder, not followed");
  });

  it("refuses an HTML file (HTML input comes later)", async () => {
    const dir = project({ "email.html": "<html><body>Hi</body></html>" });
    const ran = await cli(dir, ["check", "email.html"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("HTML");
  });
});
