/**
 * `preview` without a browser: one file per preview, named by its `filename`, under the template's own folder in
 * out/clients/; the previews email-clients skips as `cli/preview-skipped`; exit 2 for a template whose project has no
 * email-clients; and `--findings` where no browser can be found (exit 2, the files still written). playwright-core
 * is imported by preview/browser.ts alone.
 */
import { mkdirSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, cli, email, exists, lines, noBrowserEnv, project, WINDOWS, WITH_CLIENTS } from "./helpers";

// Apple Mail on a Mac and an iPhone (email-clients on models 1.9.0), Outlook.com and Gmail on Windows and a Mac.
const DEFAULT_FILES = ["apple-mail.html", "apple-mail.iphone.html", "gmail.html", "gmail.mac.html", "outlook-com.html", "outlook-com.mac.html", "outlook.html"];

describe("preview", () => {
  it("writes one file per preview, named by its filename, in the template's own folder", async () => {
    const dir = project({ "emails/welcome.tsx": email("Welcome"), "emails/nested/receipt.tsx": email("Receipt") }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(readdirSync(join(dir, "out/clients/emails/welcome")).sort()).toEqual(DEFAULT_FILES);
    expect(readdirSync(join(dir, "out/clients/emails/nested/receipt")).sort()).toEqual(DEFAULT_FILES);
    const [receipt, welcome, summary] = lines(ran);
    expect(welcome).toMatchObject({ version: 1, command: "preview", file: "emails/welcome.tsx", input: "template", root: "Email", status: "ok" });
    expect(welcome.previews.map((p: any) => p.path).sort()).toEqual(DEFAULT_FILES.map((f) => `out/clients/emails/welcome/${f}`));
    expect(welcome.outputs.sort()).toEqual(DEFAULT_FILES.map((f) => `out/clients/emails/welcome/${f}`));
    for (const preview of welcome.previews) {
      expect(Object.keys(preview).sort()).toEqual(["client", "findings", "id", "path", "ready"]);
      expect(preview).toMatchObject({ ready: null, findings: null });
      expect(readFileSync(join(dir, preview.path), "utf8")).toContain("data-email-client-ready");
    }
    expect(welcome.previews.find((p: any) => p.id === "gmail.mac")).toMatchObject({ client: "gmail", path: "out/clients/emails/welcome/gmail.mac.html" });
    // No browser was asked for: no `browser` on the line.
    expect("browser" in welcome).toBe(false);
    expect(receipt.file).toBe("emails/nested/receipt.tsx");
    expect(summary).toMatchObject({ version: 1, summary: { templates: 2, errors: 0, skipped: 0 }, exitCode: 0 });
  });

  it("--dark writes Apple Mail's dark preview as a file of its own, and --fonts inline puts the fonts in each file", async () => {
    const dir = project({ "emails/a.tsx": email() }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails/a.tsx", "--dark", "--fonts", "inline", "--clients", "apple-mail,outlook"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(readdirSync(join(dir, "out/clients/emails/a")).sort()).toEqual(["apple-mail.dark.html", "apple-mail.html", "apple-mail.iphone.dark.html", "apple-mail.iphone.html", "outlook.html"]);
    expect(readFileSync(join(dir, "out/clients/emails/a/outlook.html"), "utf8")).not.toContain("cdn.jsdelivr.net");
    expect(ran.stdout).toContain("apple-mail.dark: out/clients/emails/a/apple-mail.dark.html");
  });

  it("--clients gmail,samsung-email --dark: the previews without a model are cli/preview-skipped notes", async () => {
    const dir = project({ "emails/a.tsx": email() }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--json", "--clients", "gmail,samsung-email", "--dark"]);
    expect(ran.code, ran.stderr).toBe(0);
    const [line] = lines(ran);
    const skipped = line.diagnostics.filter((d: any) => d.code === "cli/preview-skipped");
    expect(skipped.map((d: any) => [d.severity, d.clients])).toEqual([
      ["info", ["gmail"]],
      ["info", ["samsung-email"]],
    ]);
    expect(skipped[0].message).toMatch(/dark/);
    expect(skipped[1].message).toMatch(/no model/);
    expect(line.previews.map((p: any) => p.id)).toEqual(["gmail", "gmail.mac"]);
    const text = await cli(dir, ["preview", "emails", "--clients", "gmail,samsung-email", "--dark"]);
    expect(text.stdout).toContain("info cli/preview-skipped");
  });

  it("an email client it doesn't know is a usage error", async () => {
    const dir = project({ "emails/a.tsx": email() }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--json", "--clients", "hotmail-1999"]);
    expect(ran.code).toBe(2);
    expect(lines(ran)[0].error).toContain("hotmail-1999");
    expect(exists(join(dir, "out"))).toBe(false);
  });

  it("exits 2 for a template whose project hasn't email-clients, saying how to install it", async () => {
    const dir = project({ "emails/a.tsx": email() });
    const ran = await cli(dir, ["preview", "emails", "--json"]);
    expect(ran.code).toBe(2);
    const [line] = lines(ran);
    expect(line.status).toBe("error");
    expect(line.diagnostics).toEqual([expect.objectContaining({ code: "cli/email-clients-missing", severity: "error", fix: "npm i -D @hyper-elements/email-clients" })]);
    expect(exists(join(dir, "out"))).toBe(false);
  });

  it("skips a template whose root isn't an Email", async () => {
    const page = `import { Page, Text } from "@hyper-elements/react";\nexport default function T() { return <Page><Text>Hi</Text></Page>; }\n`;
    const dir = project({ "site/a.tsx": page }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "site", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)[0]).toMatchObject({ root: "Page", status: "skipped", diagnostics: [expect.objectContaining({ code: "cli/not-an-email" })] });
  });

  it("refuses two templates whose previews would share a folder, before writing anything", async () => {
    const dir = project({ "emails/Welcome.tsx": email(), "emails/welcome.jsx": email() }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toMatch(/would both write their previews in out\/clients\/emails\/welcome/i);
    expect(exists(join(dir, "out"))).toBe(false);
  });

  it("previews render's own output where it is: its previews go under <out>/clients/, which can't hold it", async () => {
    const dir = project({ "emails/a.tsx": email("Rendered") }, { modules: WITH_CLIENTS });
    expect((await cli(dir, ["render", "emails"])).code).toBe(0);
    const ran = await cli(dir, ["preview", "out/emails/a.html", "--clients", "gmail", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(lines(ran)[0].outputs).toEqual(["out/clients/out/emails/a/gmail.html", "out/clients/out/emails/a/gmail.mac.html"]);
    expect(readFileSync(join(dir, "out/emails/a.html"), "utf8")).toContain("Rendered");
  });

  it.skipIf(WINDOWS)("refuses a preview folder that leads, through a symbolic link, to the input's folder", async () => {
    const dir = project({ "mail/gmail.html": "<html><body><p>The email</p></body></html>" }, { modules: WITH_CLIENTS });
    mkdirSync(join(dir, "out/clients/mail"), { recursive: true });
    symlinkSync(join(dir, "mail"), join(dir, "out/clients/mail/gmail"), "dir");
    const ran = await cli(dir, ["preview", "mail/gmail.html", "--clients", "gmail"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("which holds mail/gmail.html");
    expect(readFileSync(join(dir, "mail/gmail.html"), "utf8")).toBe("<html><body><p>The email</p></body></html>");
    expect(readdirSync(join(dir, "mail"))).toEqual(["gmail.html"]);
  });

  it("--findings with no browser to be found: the files written, the checks reported, findings null, exit 2", async () => {
    // Rounded corners and a hover style: what some email clients don't show, so the checks have something to say.
    const button = `import { Button, Email } from "@hyper-elements/react";
export default function T() {
  return <Email><Button href="https://example.com" style={{ borderRadius: 8, hover: { backgroundColor: "#111827" } }}>Go</Button></Email>;
}
`;
    const dir = project({ "emails/a.tsx": button }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["preview", "emails", "--findings", "--json"], { env: noBrowserEnv() });
    expect(ran.code, ran.stderr).toBe(2);
    const [line, summary] = lines(ran);
    expect(line).toMatchObject({ status: "ok", browser: null, reason: "no-browser" });
    expect(line.previews).toHaveLength(DEFAULT_FILES.length);
    for (const preview of line.previews) {
      expect(preview).toMatchObject({ ready: null, findings: null });
      expect(exists(join(dir, preview.path))).toBe(true);
    }
    // The email client checks ran (in Node): they're the input's diagnostics.
    expect(line.diagnostics.some((d: any) => Array.isArray(d.clients))).toBe(true);
    expect(summary.exitCode).toBe(2);
    expect(ran.stderr).toContain("--install-browser");
    expect(ran.stderr).toContain("CHROME_PATH");
  });
});

/** An import or require of playwright-core (comments may name it). */
const IMPORTED = /["']playwright-core["']/;

describe("playwright-core", () => {
  it("is imported by preview/browser.ts alone, so render and check never load it", () => {
    const sources: string[] = [];
    const visit = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (/\.ts$/.test(entry.name) && IMPORTED.test(readFileSync(path, "utf8"))) sources.push(relative(CLI_ROOT, path).split(sep).join("/"));
      }
    };
    visit(join(CLI_ROOT, "src"));
    expect(sources).toEqual(["src/preview/browser.ts"]);
    // The built files: only dist/preview/browser.js names it; main.js loads that file only for a browser.
    for (const file of ["bin.js", "main.js", "child.js", "watchdog.js"]) expect(readFileSync(join(CLI_ROOT, "dist", file), "utf8"), file).not.toMatch(IMPORTED);
    expect(readFileSync(join(CLI_ROOT, "dist/preview/browser.js"), "utf8")).toMatch(IMPORTED);
  });
});
