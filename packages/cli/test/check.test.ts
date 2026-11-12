/**
 * `check`: validate(), with email-clients' plugin where the project has it (--clients picks the clients), and with
 * --rendered the checks only the written HTML has. It writes nothing.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, email, lines, project } from "./helpers";

const WITH_CLIENTS = ["react", "react-dom", "@hyper-elements/react", "@hyper-elements/email-clients"];

/** An Email that uses what some email clients don't show: hover styles, rounded corners. */
const BACKGROUND = `import { Button, Email } from "@hyper-elements/react";
export default function T() {
  return <Email><Button href="https://example.com" style={{ borderRadius: 8, hover: { backgroundColor: "#111827" } }}>Go</Button></Email>;
}
`;

describe("check", () => {
  it("runs email-clients' checks where the project has it, and writes nothing", async () => {
    const dir = project({ "emails/a.tsx": BACKGROUND }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code, ran.stderr).toBe(0);
    const codes = lines(ran)[0].diagnostics.map((d: any) => d.code);
    expect(codes).not.toContain("email/more-checks");
    expect(lines(ran)[0].diagnostics.some((d: any) => Array.isArray(d.clients))).toBe(true);
    expect(readdirSync(dir).sort()).toEqual(["emails", "node_modules", "package.json"]);
  });

  it("says where the email client checks come from where the project hasn't email-clients", async () => {
    const dir = project({ "emails/a.tsx": BACKGROUND });
    const ran = await cli(dir, ["check", "emails", "--json"]);
    expect(ran.code).toBe(0);
    expect(lines(ran)[0].diagnostics.map((d: any) => d.code)).toContain("email/more-checks");
    const withClients = await cli(dir, ["check", "emails", "--json", "--clients", "gmail"]);
    expect(lines(withClients)[0].diagnostics.map((d: any) => d.code)).toContain("cli/email-clients");
  });

  it("--clients checks for those clients only, and an unknown one is a usage error", async () => {
    const dir = project({ "emails/a.tsx": BACKGROUND }, { modules: WITH_CLIENTS });
    const all = lines(await cli(dir, ["check", "emails", "--json"]))[0].diagnostics.flatMap((d: any) => d.clients ?? []);
    const gmail = lines(await cli(dir, ["check", "emails", "--json", "--clients", "gmail"]))[0].diagnostics.flatMap((d: any) => d.clients ?? []);
    expect(new Set(gmail)).toEqual(new Set(gmail.length ? ["gmail"] : []));
    expect(new Set(all).size).toBeGreaterThan(new Set(gmail).size);
    const unknown = await cli(dir, ["check", "emails", "--json", "--clients", "hotmail-1999"]);
    expect(unknown.code).toBe(2);
    expect(lines(unknown)[0].error).toContain("hotmail-1999");
  });

  it("--rendered adds the checks only the written HTML has (Gmail's size limit)", async () => {
    const long = `{Array.from({ length: 1500 }, (_, i) => <Text key={i}>Paragraph {i} of a very long email that Gmail would clip.</Text>)}`;
    const dir = project({ "emails/long.tsx": `import { Email, Text } from "@hyper-elements/react";\nexport default function T() { return <Email>${long}</Email>; }\n` }, { modules: WITH_CLIENTS });
    const plain = await cli(dir, ["check", "emails", "--json"]);
    expect(lines(plain)[0].diagnostics.map((d: any) => d.code)).not.toContain("email/size");
    const rendered = await cli(dir, ["check", "emails", "--json", "--rendered"]);
    expect(rendered.code).toBe(0);
    expect(lines(rendered)[0].diagnostics.map((d: any) => d.code)).toContain("email/size");
    expect(existsSync(join(dir, "out"))).toBe(false);
  });

  it("checks a Page too (the email client checks are for an Email)", async () => {
    const dir = project({ "pages/p.tsx": `import { Page, Text } from "@hyper-elements/react";\nexport default function P() { return <Page><Text>A page</Text></Page>; }\n`, "emails/a.tsx": email() }, { modules: WITH_CLIENTS });
    const ran = await cli(dir, ["check", "pages", "emails", "--json"]);
    expect(ran.code).toBe(0);
    expect(lines(ran).slice(0, 2).map((l) => [l.root, l.status])).toEqual([
      ["Page", "ok"],
      ["Email", "ok"],
    ]);
  });
});

describe("outline", () => {
  it("prints the template laid out, on stdout alone", async () => {
    const dir = project({ "emails/a.tsx": email("Outlined") });
    const ran = await cli(dir, ["outline", "emails/a.tsx"]);
    expect(ran.code, ran.stderr).toBe(0);
    expect(ran.stdout).toMatch(/^Email/);
    expect(ran.stdout).toContain("Outlined");
    expect(ran.stderr).toBe("");
  });

  it("prints a template's errors to stderr, and exits 1", async () => {
    const dir = project({ "emails/a.tsx": `import { Email, Text } from "@hyper-elements/react";\n// @ts-expect-error\nexport default () => <Email><Text color="red">x</Text></Email>;\n` });
    const ran = await cli(dir, ["outline", "emails/a.tsx"]);
    expect(ran.code).toBe(1);
    expect(ran.stdout).toBe("");
    expect(ran.stderr).toContain("error prop/unknown at root.children[0].props.color");
  });

  it("takes one template", async () => {
    const dir = project({ "emails/a.tsx": email(), "emails/b.tsx": email() });
    expect((await cli(dir, ["outline", "emails"])).code).toBe(2);
  });
});
