/** The plugin's `rules`: each rule as the options configure it, and `enabled` true exactly where `check` can report it. */
import type { ReactElement } from "react";
import { Column, Email, Html, Link, Page, Section, Text } from "@hyper-elements/react";
import { lint, rules, type LintOptions, type LintRuleDescriptor } from "../src/index";
import { codes, linted } from "./helpers";

const byId = (options?: LintOptions): Map<string, LintRuleDescriptor> => new Map(lint(options).rules.map((r) => [r.id, r]));
const enabled = (options?: LintOptions) => lint(options).rules.filter((r) => r.enabled).map((r) => r.id);

/** An Email with no unsubscribe link, and nothing else for lint to say. */
const receipt = (
  <Email width={600} lang="en" previewText="Your order has shipped and is on its way to you">
    <Text>Your order has shipped.</Text>
  </Email>
);

/** A template where many rules fire: faint, small text, a link that goes nowhere, merge syntax, and an Html block's role="button". */
const noisy = (Root: typeof Email | typeof Page): ReactElement => (
  <Root width={600}>
    <Section>
      <Column>
        <Text style={{ color: "#dddddd", fontSize: 11 }}>Hi {"{{first_name}}"}, your order has shipped.</Text>
        <Text>
          <Link href="#">click here</Link>
        </Text>
        <Html html={'<a href="https://example.test/pay" role="button">Pay your invoice</a>'} />
      </Column>
    </Section>
  </Root>
);

describe("lint().rules", () => {
  it("has one descriptor per rule, in the registry's order, with its summary and fix", () => {
    const described = lint().rules;
    expect(described.map((r) => r.id)).toEqual(rules.map((r) => r.id));
    for (const [i, rule] of rules.entries()) {
      expect(described[i]).toEqual({ id: rule.id, roots: expect.any(Array), enabled: expect.any(Boolean), summary: rule.summary, fix: rule.fix });
    }
  });

  it("is frozen, and so is each descriptor and its roots", () => {
    const plugin = lint();
    expect(Object.isFrozen(plugin.rules)).toBe(true);
    for (const r of plugin.rules) {
      expect(Object.isFrozen(r), r.id).toBe(true);
      expect(Object.isFrozen(r.roots), r.id).toBe(true);
    }
  });

  it("gives the roots each rule reports under: its own, and both for one that runs on an Html block's markup", () => {
    const rulesBy = byId();
    expect(rulesBy.get("contrast")!.roots).toEqual(["Email", "Page"]);
    expect(rulesBy.get("unsubscribe")!.roots).toEqual(["Email"]);
    expect(rulesBy.get("preview-text")!.roots).toEqual(["Email"]);
    expect(rulesBy.get("title")!.roots).toEqual(["Page"]);
    // An HTML rule with no template roots of its own, run on an Html block's markup in either root.
    expect(rules.find((r) => r.id === "role-button")!.roots).toEqual([]);
    expect(rulesBy.get("role-button")!.roots).toEqual(["Email", "Page"]);
  });

  it("enables every rule but unsubscribe by default", () => {
    expect(enabled()).toEqual(rules.map((r) => r.id).filter((id) => id !== "unsubscribe"));
  });

  it("disables a rule set to off, and only that one", () => {
    expect(byId({ rules: { contrast: "off" } }).get("contrast")!.enabled).toBe(false);
    expect(enabled({ rules: { contrast: "off" } })).toEqual(enabled().filter((id) => id !== "contrast"));
    expect(byId({ rules: { contrast: "info" } }).get("contrast")!.enabled).toBe(true);
    expect(enabled({ rules: Object.fromEntries(rules.map((r) => [r.id, "off"])), kind: "marketing" })).toEqual([]);
  });

  it("enables unsubscribe with kind marketing only, and not where it's off", () => {
    expect(byId().get("unsubscribe")!.enabled).toBe(false);
    expect(byId({ kind: "transactional" }).get("unsubscribe")!.enabled).toBe(false);
    expect(byId({ kind: "marketing" }).get("unsubscribe")!.enabled).toBe(true);
    expect(byId({ kind: "marketing", rules: { unsubscribe: "info" } }).get("unsubscribe")!.enabled).toBe(true);
    expect(byId({ kind: "marketing", rules: { unsubscribe: "off" } }).get("unsubscribe")!.enabled).toBe(false);
    // A severity alone doesn't turn it on without the kind.
    expect(byId({ rules: { unsubscribe: "warning" } }).get("unsubscribe")!.enabled).toBe(false);
  });

  it("enables unsubscribe exactly where it fires on an Email without an unsubscribe link", () => {
    const cases: Array<LintOptions | undefined> = [undefined, { kind: "transactional" }, { kind: "marketing" }, { kind: "marketing", rules: { unsubscribe: "off" } }, { rules: { unsubscribe: "warning" } }];
    for (const options of cases) {
      const fires = codes(linted(receipt, options)).includes("email/lint-unsubscribe");
      expect(fires, JSON.stringify(options)).toBe(byId(options).get("unsubscribe")!.enabled);
    }
    expect(codes(linted(receipt, { kind: "marketing" }))).toEqual(["email/lint-unsubscribe"]);
  });

  it("reports only enabled rules, under their roots, and every rule set off reports nothing", () => {
    for (const [Root, prefix] of [[Email, "email"], [Page, "page"]] as const) {
      for (const options of [undefined, { kind: "marketing" as const }, { rules: { contrast: "off", "role-button": "off", "merge-syntax": "off" } as const }]) {
        const described = byId(options);
        const found = codes(linted(noisy(Root), options));
        expect(found.length).toBeGreaterThan(3);
        for (const code of found) {
          const id = code.slice(`${prefix}/lint-`.length);
          expect(described.get(id)?.enabled, `${code} ${JSON.stringify(options)}`).toBe(true);
          expect(described.get(id)!.roots).toContain(Root === Email ? "Email" : "Page");
        }
        for (const id of ["contrast", "text-size", "link-text", "link-target", "merge-syntax", "role-button", "lang"]) {
          expect(found.includes(`${prefix}/lint-${id}`), `${id} ${JSON.stringify(options)}`).toBe(described.get(id)!.enabled);
        }
      }
      const allOff = { rules: Object.fromEntries(rules.map((r) => [r.id, "off" as const])), kind: "marketing" as const };
      expect(linted(noisy(Root), allOff)).toEqual([]);
    }
  });
});
