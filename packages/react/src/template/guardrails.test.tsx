/**
 * Templates' guardrails beyond fields (Phase 1b): slots (what their content may use and how it may be styled, checked
 * on the captured content before anything is read), blocks, rules over the result (lint's, core's, links and root
 * props, failing closed), stored slots and their captures, annotated templates, and a template that owns its spec.
 */
import { lint } from "@hyper-elements/lint";
import React, { useState } from "react";
import { describeElements } from "../inspect";
import {
  Button,
  Canvas,
  Column,
  component,
  Divider,
  Document,
  Email,
  Heading,
  Html,
  Image,
  Link,
  Page,
  prepare,
  prop,
  render,
  Row,
  Section,
  Table,
  TableCell,
  TableRow,
  Text,
  token,
  validate,
  Video,
  Social,
  captureFragment,
  defineTheme,
  type Diagnostic,
} from "../primitives/index";
import { field, open, readValuesFile, template, toValuesFile } from "./index";

const errors = (diagnostics: Diagnostic[]) => diagnostics.filter((d) => d.severity === "error").map((d) => [d.code, d.path]);
const codesOf = (diagnostics: Diagnostic[]) => diagnostics.filter((d) => d.severity === "error").map((d) => d.code);

const brand = defineTheme({ colors: { primary: "#7C5CFF", ink: "#0B1020" }, spacing: { md: 16 }, fontSizes: { lg: 24 } });

const ProductCard = component({
  type: "acme.ProductCard",
  label: "Product card",
  props: { sku: prop.text({ label: "SKU", required: true }), accent: prop.color({ label: "Accent" }) },
  render: ({ sku }) => (
    <Column>
      <Text>{`Product ${sku}`}</Text>
    </Column>
  ),
});

const BrandFooter = () => (
  <Section style={{ padding: 24 }}>
    <Text style={{ fontSize: 12 }}>
      Acme, 1 Main Street. <Link href="https://acme.com/unsubscribe?utm_source=newsletter">Unsubscribe</Link>
    </Text>
  </Section>
);

/** A newsletter with a fixed header and footer, and a body the filler writes. */
function newsletter(body: Parameters<typeof field.slot>[0], rules: Parameters<typeof template>[0]["rules"] = {}, extra: { root?: "Email" | "Page" } = {}) {
  const Root = extra.root === "Page" ? Page : Email;
  return template({
    id: "acme.Newsletter",
    version: "1.0.0",
    label: "Newsletter",
    root: extra.root ?? "Email",
    fields: {
      subject: prop.text({ label: "Subject", required: true, maxLength: 70 }),
      body: field.slot(body),
    },
    rules,
    example: {
      subject: "What's new",
      body: (
        <Column>
          <Text>Hello</Text>
        </Column>
      ),
    },
    render: (v) => (
      <Root width={600} theme={brand} title={v.subject} previewText="Three things shipped" lang="en">
        <Section style={{ padding: 24 }}>
          <Heading>Acme</Heading>
        </Section>
        <Section field="body" style={{ padding: 24 }}>
          {v.body}
        </Section>
        <BrandFooter />
      </Root>
    ),
  });
}

const allowed = [Row, Column, Heading, Text, Image, Button, Link, Divider, ProductCard];

describe("slots", () => {
  const N = newsletter({ label: "Body", required: true, allow: allowed, count: { Button: { min: 1, max: 2 } } });
  const body = (content: React.ReactNode) => N.check({ subject: "Hi", body: <>{content}</> });
  const ok = (
    <Column style={{ gap: token("spacing.md") }}>
      <Heading>Orbit is live</Heading>
      <Button href="https://acme.com/orbit">Try Orbit</Button>
    </Column>
  );

  it("takes content of the allowed components, and renders the snapshot it checked", async () => {
    const checked = body(ok);
    expect(errors(checked.diagnostics)).toEqual([]);
    const { html } = await render(checked.snapshots.default!);
    expect(html).toContain("Orbit is live");
    expect(html).toContain("Unsubscribe");
  });

  it("refuses a type it doesn't allow, and Html or a root even when listed", () => {
    expect(codesOf(body(<Column><Table><TableRow><TableCell>x</TableCell></TableRow></Table><Button href="https://acme.com">Go</Button></Column>).diagnostics)).toEqual(["template/slot-element"]);
    const withHtml = newsletter({ label: "Body", allow: [Column, Html, Button] });
    expect(codesOf(withHtml.check({ subject: "Hi", body: <Column><Html html="<b>x</b>" /></Column> }).diagnostics)).toEqual(["template/slot-element"]);
  });

  it("allows a component() by its definition: a look-alike with its name is refused, and its Html never renders", () => {
    const Fake = component({ type: "acme.ProductCard", label: "Fake", props: { sku: prop.text({ label: "SKU", required: true }) }, render: () => <Column><Html html="<script>pwn()</script>" /></Column> });
    const genuine = body(<Column><ProductCard sku="A1" /><Button href="https://acme.com">Go</Button></Column>);
    expect(errors(genuine.diagnostics)).toEqual([]);
    const fake = body(<Column><Fake sku="A1" /><Button href="https://acme.com">Go</Button></Column>);
    expect(codesOf(fake.diagnostics)).toEqual(["template/slot-element"]);
    expect(fake.diagnostics.find((d) => d.code === "template/slot-element")?.message).toContain("isn't the template's");
    expect(fake.snapshots).toEqual({});
  });

  it("doesn't check an allowed component()'s internals", () => {
    const Styled = component({ type: "acme.Styled", label: "Styled", props: {}, render: () => <Column style={{ backgroundColor: "#ff0000" }}><Text style={{ color: "#00ff00" }}>x</Text></Column> });
    const S = newsletter({ label: "Body", allow: [Column, Button, Styled] });
    expect(errors(S.check({ subject: "Hi", body: <Column><Styled /></Column> }).diagnostics)).toEqual([]);
  });

  describe('styles: "theme"', () => {
    it("refuses a literal in every brand-valued style and prop, in style, mobile and hover; a token(), a variant and apply pass", () => {
      const literals: Array<[React.ReactNode, string]> = [
        [<Text style={{ color: "#ff0000" }}>x</Text>, "style.color"],
        [<Text style={{ fontSize: 18 }}>x</Text>, "style.fontSize"],
        [<Text style={{ mobile: { fontSize: 14 } }}>x</Text>, "style.mobile.fontSize"],
        [<Button href="https://acme.com" style={{ hover: { backgroundColor: "#000000" } }}>Go</Button>, "style.hover.backgroundColor"],
        [<Column style={{ padding: 12 }} />, "style.padding"],
        [<Column style={{ gap: 8 }} />, "style.gap"],
        [<Divider style={{ borderTop: "1px solid #ff0000" }} />, "style.borderTop"],
        [<Column style={{ border: { width: 1, style: "solid" } } as never} />, "style.border"],
        // A side written as a string holds a literal color, as the whole border written as one does; so does no side at all.
        [<Column style={{ border: { bottom: "3px solid #ff0000" } }} />, "style.border"],
        [<Column style={{ border: { top: { width: 1, style: "solid", color: token("colors.primary") }, left: "1px dashed #00ff00" } } as never} />, "style.border"],
        [<Column style={{ border: "3px solid #ff0000" }} />, "style.border"],
        [<Column style={{ mobile: { border: { bottom: "3px solid #ff0000" } } }} />, "style.mobile.border"],
        [<ProductCard sku="A" accent="#ff0000" />, "props.accent"],
      ];
      for (const [node, key] of literals) {
        const found = body(<Column>{node}<Button href="https://acme.com">Go</Button></Column>).diagnostics.filter((d) => d.code === "template/slot-style");
        expect(found.map((d) => d.path.replace(/^root\.children\[1\]\.children\[0\]\.children\[0\]\./, "")), key).toEqual([key]);
      }
      const fine = (
        <Column style={{ gap: token("spacing.md"), padding: [token("spacing.md"), 0], textAlign: "center", border: { width: 1, style: "solid", color: token("colors.primary") } } as never}>
          <Text style={{ color: token("colors.ink"), fontWeight: 700, apply: [] as never }}>x</Text>
          <ProductCard sku="A" accent={token("colors.primary") as never} />
          <Button href="https://acme.com">Go</Button>
        </Column>
      );
      expect(errors(body(fine).diagnostics)).toEqual([]);
    });

    it("refuses tokens and theme on a slot node, which would change what a token means inside it", () => {
      const scoped = body(<Column tokens={{ colors: { primary: "#ff0000" } } as never}><Text style={{ color: token("colors.primary") }}>x</Text><Button href="https://acme.com">Go</Button></Column>);
      expect(codesOf(scoped.diagnostics)).toEqual(["template/slot-tokens"]);
    });
  });

  it('with styles: "none", any style but apply, and a brand-valued prop even as a token', () => {
    const None = newsletter({ label: "Body", allow: allowed, styles: "none" });
    const check = (content: React.ReactNode) => codesOf(None.check({ subject: "Hi", body: <>{content}</> }).diagnostics);
    expect(check(<Column style={{ textAlign: "center" }} />)).toEqual(["template/slot-style"]);
    expect(check(<Column><ProductCard sku="A" accent={token("colors.primary") as never} /></Column>)).toEqual(["template/slot-style"]);
    expect(check(<Column><Text style={{ apply: [] as never }}>x</Text></Column>)).toEqual([]);
  });

  it("refuses attrs on any node of the content, under every policy", () => {
    const Free = newsletter({ label: "Body", allow: allowed, styles: "free" });
    expect(codesOf(Free.check({ subject: "Hi", body: <Column><Button href="https://acme.com" attrs={{ hidden: "" }}>Go</Button></Column> }).diagnostics)).toEqual(["template/slot-attrs"]);
  });

  it("counts by type what's shown at some width, min and max", () => {
    expect(codesOf(body(<Column><Text>No button</Text></Column>).diagnostics)).toEqual(["template/slot-count"]);
    expect(codesOf(body(<Column>{[1, 2, 3].map((i) => <Button key={i} href="https://acme.com">Go</Button>)}</Column>).diagnostics)).toEqual(["template/slot-count"]);
    // A Button hidden at both widths isn't counted: one shown, one hidden, passes.
    const hidden = <Column><Button href="https://acme.com">Go</Button><Button href="https://acme.com" hidden={{ mobile: true, desktop: true }}>Hidden</Button><Button href="https://acme.com" hidden={{ mobile: true, desktop: true }}>Hidden</Button></Column>;
    expect(codesOf(body(hidden).diagnostics)).toEqual([]);
    // Nor is one inside something hidden at both widths, or shown at neither between it and what holds it.
    const inside = <Column><Text>Text</Text><Column hidden={{ mobile: true, desktop: true }}><Button href="https://acme.com">Go</Button></Column></Column>;
    expect(codesOf(body(inside).diagnostics)).toEqual(["template/slot-count"]);
    const between = <Column><Text>Text</Text><Column hidden={{ mobile: true }}><Button href="https://acme.com" hidden={{ desktop: true }}>Go</Button></Column></Column>;
    expect(codesOf(body(between).diagnostics)).toEqual(["template/slot-count"]);
    // One shown on phones only, inside something hidden on desktop, is shown.
    const phones = <Column><Text>Text</Text><Column hidden={{ desktop: true }}><Button href="https://acme.com">Go</Button></Column></Column>;
    expect(codesOf(body(phones).diagnostics)).toEqual([]);
  });

  it("is what its host may hold: a Section in a Section is children/not-allowed, as today", () => {
    const All = newsletter({ label: "Body", allow: "all", styles: "free" });
    expect(codesOf(All.check({ subject: "Hi", body: <Section><Text>x</Text></Section> }).diagnostics)).toContain("children/not-allowed");
  });

  it("reads a field inside the content as the content's own (template/slot-field), never as a binding", () => {
    const checked = body(<Column><Text field="subject">x</Text><Button href="https://acme.com">Go</Button></Column>);
    expect(errors(checked.diagnostics)).toEqual([]);
    expect(checked.diagnostics.map((d) => d.code)).toContain("template/slot-field");
  });

  it("keeps fixed parts out of its reach: a render that branches on the slot sees a mark", async () => {
    const Branchy = template({
      id: "acme.Branchy",
      version: "1.0.0",
      label: "Branchy",
      root: "Email",
      fields: { body: field.slot({ label: "Body", allow: [Column, Text] }) },
      example: { body: <Column><Text>x</Text></Column> },
      render: (v) => (
        <Email>
          <Section field="body">{v.body}</Section>
          {!v.body && <Section><Text>Fixed footer</Text></Section>}
        </Email>
      ),
    });
    const a = Branchy.check({ body: <Column><Text>One</Text></Column> });
    const b = Branchy.check({ body: <Column><Text>Two</Text></Column> });
    const fixed = (html: string) => html.includes("Fixed footer");
    expect(fixed((await render(a.snapshots.default!)).html)).toBe(fixed((await render(b.snapshots.default!)).html));
  });

  it("is placed once, in a node bound to it: twice, never or elsewhere is template/slot-host", () => {
    const placed = (body: (v: { body?: React.ReactElement }) => React.ReactNode) =>
      template({ id: "acme.Host", version: "1.0.0", label: "Host", root: "Email", fields: { body: field.slot({ label: "Body", allow: [Column, Text] }) }, example: {}, render: (v) => <Email>{body(v)}</Email> });
    const content = { body: <Column><Text>x</Text></Column> };
    expect(codesOf(placed((v) => <><Section field="body">{v.body}</Section><Section field="body">{v.body}</Section></>).check(content).diagnostics)).toEqual(["template/slot-host"]);
    expect(codesOf(placed(() => <Section><Text>none</Text></Section>).check(content).diagnostics)).toEqual(["template/slot-host"]);
    expect(codesOf(placed((v) => <Section>{v.body}</Section>).check(content).diagnostics)).toEqual(["template/slot-host"]);
  });

  it("runs its content once, and renders what was checked even when the content changes afterwards", async () => {
    let runs = 0;
    const Shifty = () => {
      useState(0);
      runs++;
      return runs === 1 ? <Button href="https://acme.com">Go</Button> : <Html html="<b>swapped</b>" />;
    };
    const checked = N.check({ subject: "Hi", body: <Column><Shifty /></Column> });
    expect(runs).toBe(1);
    const { html } = await render(checked.snapshots.default!);
    expect(runs).toBe(1);
    expect(html).not.toContain("swapped");
  });

  it("captures a getter once: a literal it gives first is checked and refused, whatever it gives later", () => {
    let reads = 0;
    const style = {
      get color() {
        reads++;
        return reads <= 1 ? "#ff0000" : token("colors.ink");
      },
    };
    expect(codesOf(body(<Column><Text style={style as never}>x</Text><Button href="https://acme.com">Go</Button></Column>).diagnostics)).toContain("template/slot-style");
  });

  describe('allow: "all"', () => {
    const typesOf = (root: "Email" | "Page" | "Document" | "Canvas") =>
      describeElements({ root })
        .elements.map((c) => c.type)
        .filter((t) => !["Email", "Page", "Document", "Canvas", "Html"].includes(t))
        .sort();

    it("resolves, for each root, to describeElements({ root })'s built-ins less the roots and Html", () => {
      const all = (root: "Email" | "Page" | "Document" | "Canvas") => {
        const Root = { Email, Page, Document, Canvas }[root] as React.FC<{ children?: React.ReactNode }>;
        const T = template({ id: "acme.All", version: "1.0.0", label: "All", root, fields: { body: field.slot({ label: "Body", allow: "all" }) }, example: {}, render: (v: { body?: React.ReactElement }) => <Root><Section field="body">{v.body}</Section></Root> } as never);
        return [...((T as unknown as { describe(): { fields: Array<{ path: string; allowed?: string[] }> } }).describe().fields.find((f) => f.path === "body")!.allowed ?? [])].sort();
      };
      for (const root of ["Email", "Page", "Document", "Canvas"] as const) expect(all(root), root).toEqual(typesOf(root));
      for (const type of ["DocumentPage", "PageBreak", "PageHeader", "PageFooter"]) {
        expect(typesOf("Document")).toContain(type);
        for (const root of ["Email", "Page", "Canvas"] as const) expect(typesOf(root)).not.toContain(type);
      }
      expect(typesOf("Canvas")).toContain("Svg");
      expect(typesOf("Email")).not.toContain("Svg");
      // A new built-in changes this on purpose.
      expect(typesOf("Email")).toMatchSnapshot();
    });

    it("refuses Html and an unlisted component(); allows the one listed beside it; deny takes built-ins out", () => {
      const All = newsletter({ label: "Body", allow: ["all", ProductCard], deny: [Table] });
      const check = (content: React.ReactNode) => codesOf(All.check({ subject: "Hi", body: <>{content}</> }).diagnostics);
      expect(check(<Column><Html html="x" /></Column>)).toEqual(["template/slot-element"]);
      expect(check(<Column><ProductCard sku="A" /><Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" /></Column>)).toEqual([]);
      expect(check(<Column><Table><TableRow><TableCell>x</TableCell></TableRow></Table></Column>)).toEqual(["template/slot-element"]);
      const Other = component({ type: "acme.Other", label: "Other", props: {}, render: () => <Column /> });
      expect(check(<Column><Other /></Column>)).toEqual(["template/slot-element"]);
    });

    it("refuses deny beside a list, a component() in deny, and two allowed components with one type", () => {
      expect(() => newsletter({ label: "Body", allow: [Column], deny: [Table] })).toThrow(/template\/slot-allow/);
      expect(() => newsletter({ label: "Body", allow: "all", deny: [ProductCard] })).toThrow(/template\/slot-allow/);
      const Twin = component({ type: "acme.ProductCard", label: "Twin", props: { sku: prop.text({ label: "SKU", required: true }) }, render: () => <Column /> });
      expect(() => newsletter({ label: "Body", allow: [ProductCard, Twin] })).toThrow(/template\/slot-allow/);
    });

    it("refuses a literal in every brand-valued style of a built-in under styles: \"theme\", as for a list", () => {
      const All = newsletter({ label: "Body", allow: "all" });
      expect(codesOf(All.check({ subject: "Hi", body: <Column><Table style={{ cellPadding: 8 } as never}><TableRow><TableCell>x</TableCell></TableRow></Table></Column> }).diagnostics)).toEqual(["template/slot-style"]);
    });
  });
});

describe("stored slots and captures", () => {
  const N = newsletter({ label: "Body", required: true, allow: allowed });
  const content = <Column><Text>Stored content</Text></Column>;

  it("checks a captured fragment, carried as JSON, as it checks the element, and renders what it checked", async () => {
    const fragment = JSON.parse(JSON.stringify(captureFragment(content)));
    const stored = N.check({ subject: "Hi", body: { fragment } });
    expect(errors(stored.diagnostics)).toEqual([]);
    expect((await render(stored.snapshots.default!)).html).toContain("Stored content");
    const viaFragments = N.check({ subject: "Hi", body: { module: "./body.tsx" } }, { fragments: { body: fragment } });
    expect(errors(viaFragments.diagnostics)).toEqual([]);
  });

  it("needs a module's capture (template/slot-unloaded), refuses one given twice, and runs the policies on a capture", () => {
    expect(codesOf(N.check({ subject: "Hi", body: { module: "./body.tsx" } }).diagnostics)).toEqual(["template/slot-unloaded"]);
    const fragment = JSON.parse(JSON.stringify(captureFragment(content)));
    expect(codesOf(N.check({ subject: "Hi", body: { fragment } }, { fragments: { body: fragment } }).diagnostics)).toEqual(["template/slot-twice"]);
    const html = JSON.parse(JSON.stringify(captureFragment(<Column><Html html="<b>x</b>" /></Column>)));
    expect(codesOf(N.check({ subject: "Hi", body: { fragment: html } }).diagnostics)).toEqual(["template/slot-element"]);
    // A capture that came from elsewhere binds custom types by name to the allowed definition, never its own.
    const card = JSON.parse(JSON.stringify(captureFragment(<Column><ProductCard sku="Z9" /></Column>)));
    expect(errors(N.check({ subject: "Hi", body: { fragment: card } }).diagnostics)).toEqual([]);
    expect(() => N.design({ subject: "Hi", body: { module: "./body.tsx" } } as never)).toThrow(/template\/slot-unloaded/);
  });

  it("writes a values file with a stored slot as it is, and a slot's JSX as its captured fragment", () => {
    const stored = toValuesFile(N, { subject: "Hi", body: { module: "./launch.body.tsx" } }, { module: "../templates/newsletter.tsx" });
    expect(stored.values.body).toEqual({ module: "./launch.body.tsx" });
    const fromJsx = toValuesFile(N, { subject: "Hi", body: content }, { module: "../templates/newsletter.tsx" });
    const fragment = (fromJsx.values.body as { fragment: { kind: string } }).fragment;
    expect(fragment.kind).toBe("hyper-elements.fragment");
    const back = readValuesFile(JSON.parse(JSON.stringify(fromJsx)), N);
    expect(back.diagnostics).toEqual([]);
    expect(errors(N.check(back.values).diagnostics)).toEqual([]);
  });
});

describe("blocks", () => {
  const B = template({
    id: "acme.Blocks",
    version: "1.0.0",
    label: "Blocks",
    root: "Email",
    fields: {
      body: prop.blocks(
        {
          hero: prop.object({ title: prop.text({ label: "Title", required: true }), image: field.image({ label: "Image", fit: "contain", aspect: { min: 1.5, max: 2 } }) }, { label: "Hero" }),
          quote: prop.object({ text: prop.text({ label: "Quote", required: true, maxLength: 120 }) }, { label: "Quote" }),
        },
        { label: "Body", required: true, min: 1, max: 4 }
      ),
    },
    example: { body: [{ type: "hero", title: "Hi" }] },
    render: (v) => (
      <Email>
        {v.body.map((block, i) =>
          block.type === "hero" ? (
            <Section key={i}>
              <Heading field={`body[${i}].title`}>{block.title}</Heading>
              {block.image && <Image field={`body[${i}].image`} src={block.image} alt="" style={{ width: 400 }} />}
            </Section>
          ) : (
            <Section key={i}>
              <Text field={`body[${i}].text`}>{block.text}</Text>
            </Section>
          )
        )}
      </Email>
    ),
  });

  it("reads each block by its type, and refuses an unknown or missing type, a non-object and an extra key", () => {
    expect(B.check({ body: [{ type: "quote", text: "Ship small." }, { type: "hero", title: "Two" }] }).valid).toBe(true);
    for (const [item, path] of [
      [{ type: "video" }, "values.body[0]"],
      [{ title: "No type" }, "values.body[0]"],
      ["text", "values.body[0]"],
      [{ type: "quote", text: "x", color: "red" }, "values.body[0].color"],
    ] as const) {
      expect(errors(B.check({ body: [item] }).diagnostics), JSON.stringify(item)).toEqual([[item === "text" || (typeof item === "object" && !("color" in item)) ? "template/value" : "template/unknown-field", path]]);
    }
    expect(errors(B.check({ body: [] }).diagnostics)).toEqual([["template/count", "values.body"]]);
  });

  it("keeps image rules inside a block, and update() changes one block", () => {
    const square = { type: "hero", title: "Sq", image: { src: "https://a.example/s.png", width: 500, height: 500 } };
    expect(errors(B.check({ body: [square] }).diagnostics)).toEqual([["template/asset-aspect", "values.body[0].image"]]);
    const values = B.check({ body: [{ type: "quote", text: "One" }, { type: "hero", title: "Two" }] }).values!;
    const later = B.update(values, { body: [values.body[0], { type: "hero", title: "Three" }] });
    expect(later.body[1]).toEqual({ type: "hero", title: "Three" });
    expect(B.describe().fields.find((f) => f.path === "body[].image")).toMatchObject({ block: "hero", kind: "image", fit: "contain" });
  });

  it("has a schema of a oneOf, one branch per type, and refuses a block type with a field named type", () => {
    const schema = B.describe().fields.find((f) => f.path === "body")!.schema as { items: { oneOf: Array<{ properties: { type: { const: string } }; required: string[] }> } };
    expect(schema.items.oneOf.map((branch) => [branch.properties.type.const, branch.required])).toEqual([
      ["hero", ["type", "title"]],
      ["quote", ["type", "text"]],
    ]);
    expect(() =>
      template({ id: "acme.Bad", version: "1.0.0", label: "Bad", root: "Email", fields: { body: prop.blocks({ hero: prop.object({ type: prop.text({ label: "Type" }) }, { label: "Hero" }) }, { label: "Body" }) }, example: {}, render: () => <Email /> })
    ).toThrow(/template\/block-type/);
  });
});

describe("rules", () => {
  const marketing = lint({ kind: "marketing" });
  const body = <Column><Text>Hello</Text><Button href="https://acme.com/go?utm_source=newsletter">Read the release notes</Button></Column>;

  it("raises a required lint finding to an error, with its code, path and fix, and passes a design without one", () => {
    const N = newsletter({ label: "Body", allow: allowed }, { plugins: { lint: marketing }, require: { lint: ["link-text"] } });
    const passing = N.check({ subject: "Hi", body });
    expect(passing.rules).toEqual([{ rule: "link-text", source: "lint", status: "passed", diagnostics: [] }]);
    const failing = N.check({ subject: "Hi", body: <Column><Button href="https://acme.com/go?utm_source=newsletter">Click here</Button></Column> });
    expect(failing.valid).toBe(false);
    const raised = failing.diagnostics.find((d) => d.code === "email/lint-link-text")!;
    expect(raised).toMatchObject({ severity: "error" });
    expect(raised.message).toContain("(required by acme.Newsletter)");
    expect(raised.fix).toBeDefined();
    expect(failing.rules[0].status).toBe("failed");
  });

  it("refuses a rule it can't run, when the template is defined", () => {
    const off = (rules: Parameters<typeof template>[0]["rules"], root?: "Page") => () => newsletter({ label: "Body", allow: allowed }, rules, root ? { root } : {});
    expect(off({ plugins: { lint: marketing }, require: { lint: ["nope"] } })).toThrow(/template\/rule-unavailable/);
    expect(off({ plugins: { lint: lint({ rules: { "link-text": "off" } }) }, require: { lint: ["link-text"] } })).toThrow(/template\/rule-unavailable/);
    expect(off({ plugins: { lint: lint() }, require: { lint: ["unsubscribe"] } })).toThrow(/template\/rule-unavailable/);
    expect(off({ require: { lint: ["link-text"] } })).toThrow(/template\/rule-unavailable/);
    const old = { name: "lint", api: 1, check: () => [] } as never;
    expect(off({ plugins: { lint: old }, require: { lint: ["link-text"] } })).toThrow(/template\/rule-unavailable/);
    expect(off({ require: { core: ["document/overflow"] } })).toThrow(/template\/rule-unavailable/);
    expect(off({ require: { core: ["canvas/overflow"] } }, "Page")).toThrow(/template\/rule-unavailable/);
    expect(off({ require: { core: ["no/such-code"] } })).toThrow(/template\/rule-unavailable/);
    expect(off({ plugins: { other: [Promise.resolve({}) as never] } })).toThrow(/template\/plugin/);
  });

  it("fails closed: a lint that throws leaves its rules not-run, an error, never passed", () => {
    const broken = Object.freeze({ ...marketing, check: () => { throw new Error("boom"); } }) as typeof marketing;
    const N = newsletter({ label: "Body", allow: allowed }, { plugins: { lint: broken }, require: { lint: ["link-text"] } });
    const checked = N.check({ subject: "Hi", body });
    expect(checked.valid).toBe(false);
    expect(checked.rules[0].status).toBe("not-run");
    expect(codesOf(checked.diagnostics)).toContain("template/rule-not-run");
  });

  it("leaves a measured rule not-run in check(), and a writer refuses the snapshot until it's decided", async () => {
    const Card = template({
      id: "acme.Card",
      version: "1.0.0",
      label: "Card",
      root: "Canvas",
      fields: { title: prop.text({ label: "Title", required: true }) },
      rules: { require: { core: ["image/overflow", "canvas/overflow"] } },
      example: { title: "Hi" },
      render: (v) => <Canvas width={600} height={315}><Heading>{v.title}</Heading></Canvas>,
    });
    const checked = Card.check(Card.example);
    expect(checked.valid).toBe(true);
    expect(checked.rules.map((r) => [r.rule, r.status])).toEqual([["image/overflow", "not-run"], ["canvas/overflow", "passed"]]);
    await expect(render(checked.snapshots.default!)).rejects.toThrow(/template\/rule-not-run/);
    expect(prepare(checked.snapshots.default!).diagnostics.map((d) => d.code)).toContain("template/rule-not-run");
    expect(validate(checked.snapshots.default!).valid).toBe(true);
  });

  describe("links", () => {
    const linked = (href: string, rules: Parameters<typeof template>[0]["rules"]) => {
      const T = template({
        id: "acme.Links",
        version: "1.0.0",
        label: "Links",
        root: "Email",
        fields: { href: prop.link({ label: "Link", required: true }) },
        rules,
        example: { href: "https://acme.com" },
        render: (v) => <Email><Text><Link href={v.href}>Go</Link></Text></Email>,
      });
      return codesOf(T.check({ href }).diagnostics);
    };
    const domains = { links: { domains: ["acme.com", "*.acme.com"], params: { utm_source: "newsletter" }, schemes: ["mailto"] } };

    it("checks hosts, parameters and schemes", () => {
      expect(linked("https://acme.com/a?utm_source=newsletter", domains)).toEqual([]);
      expect(linked("https://www.acme.com/a?utm_source=newsletter", domains)).toEqual([]);
      expect(linked("https://a.b.acme.com/a?utm_source=newsletter", domains)).toEqual([]);
      expect(linked("https://evil.com/?utm_source=newsletter", domains)).toEqual(["template/link-domain"]);
      expect(linked("https://acme.com.evil.com/?utm_source=newsletter", domains)).toEqual(["template/link-domain"]);
      expect(linked("https://evilacme.com/?utm_source=newsletter", domains)).toEqual(["template/link-domain"]);
      expect(linked("https://user@acme.com/?utm_source=newsletter", domains)).toEqual(["template/link-domain"]);
      expect(linked("https://acme.com/a", domains)).toEqual(["template/link-param"]);
      expect(linked("mailto:hi@acme.com", domains)).toEqual([]);
      expect(linked("tel:+15550100", domains)).toEqual(["template/link-scheme"]);
      expect(linked("/relative", domains)).toEqual(["template/link-relative"]);
      expect(linked("#top", domains)).toEqual(["template/link-relative"]);
      expect(linked("https://acme.com/{{tag}}", domains)).toEqual([]);
      expect(linked("https://acme.com/{{tag}}", { links: { ...domains.links, tags: "deny" } })).toEqual(["template/link-tag"]);
    });

    it("checks a tagged link's literal host, and leaves only a host that is a tag to the service", () => {
      const hosts = { links: { domains: ["acme.com", "*.acme.com"] } };
      const notes = (href: string) => {
        const T = template({ id: "acme.Tagged", version: "1.0.0", label: "Tagged", root: "Email", fields: { href: prop.link({ label: "Link", required: true }) }, rules: hosts, example: { href: "https://acme.com" }, render: (v) => <Email><Text><Link href={v.href}>Go</Link></Text></Email> });
        return T.check({ href }).diagnostics.filter((d) => d.code === "template/link-tag").map((d) => d.severity);
      };
      // A literal host is read as a browser reads it, whatever tag follows it.
      for (const href of [
        "https://evil.example/landing?id={{contact.id}}",
        "https://evil.example/{{path}}",
        "https://evil.example#{{anchor}}",
        "https://evil.example\\{{x}}",
        "https:evil.example/{{x}}",
        "HTTPS://Evil.Example:{{port}}/",
        "https://acme.com.evil.example/{{x}}",
        "  https://ev\til.example/?u=<%= id %>",
        "https://evil.example/?u={% id %}",
      ]) expect([href, linked(href, hosts)]).toEqual([href, ["template/link-domain"]]);
      expect(linked("https://{{user}}@acme.com/", hosts)).toEqual(["template/link-domain"]);
      expect(linked("http{{s}}://evil.example/", hosts)).toEqual(["template/link-domain"]);
      // Still allowed, and still listed for review.
      expect(linked("https://acme.com/landing?id={{contact.id}}", hosts)).toEqual([]);
      expect(linked("https://news.acme.com/{{path}}", hosts)).toEqual([]);
      expect(notes("https://acme.com/landing?id={{contact.id}}")).toEqual(["info"]);
      // A host that is a tag, or runs into one, can't be checked: a note, or refused with tags: "deny".
      for (const href of ["{{unsubscribe_url}}", "https://{{host}}/x", "https://acme.com{{rest}}", "https://www.{{brand}}.com/", "https:/{{x}}/acme.com", "{{base}}/path", "http{{rest}}"]) {
        expect([href, linked(href, hosts)]).toEqual([href, []]);
        expect([href, notes(href)]).toEqual([href, ["info"]]);
        expect([href, linked(href, { links: { ...hosts.links, tags: "deny" } })]).toEqual([href, ["template/link-tag"]]);
      }
      // A host that's written out but isn't one: refused, tag or not.
      for (const href of ["https://acme.com:99999/", "https://exa mple.com/{{x}}", "https://:{{port}}/", "https://[{{v6}}/", "https://[::1]/{{x}}"]) expect([href, linked(href, hosts)]).toEqual([href, ["template/link-domain"]]);
      // What's written of the rest is checked too.
      expect(linked("/path/{{id}}", hosts)).toEqual(["template/link-relative"]);
      expect(linked("tel:{{phone}}", hosts)).toEqual(["template/link-scheme"]);
      expect(linked("mailto:{{email}}", { links: { ...hosts.links, schemes: ["mailto"] } })).toEqual([]);
    });

    it("refuses an agent's tagged link off the brand's domains in a slot", () => {
      const N = newsletter({ label: "Body", allow: allowed }, { links: { domains: ["acme.com"] } });
      const checked = N.check({ subject: "Hi", body: <Column><Button href="https://evil.example/landing?id={{contact.id}}">Read more</Button></Column> });
      expect(checked.valid).toBe(false);
      expect(checked.diagnostics.find((d) => d.code === "template/link-domain")?.message).toMatch(/^evil\.example isn't one of acme\.Newsletter's domains/);
    });

    it("covers fixed parts, and a Menu's links after expansion", () => {
      const N = newsletter({ label: "Body", allow: allowed }, { links: { domains: ["example.com"] } });
      expect(codesOf(N.check({ subject: "Hi", body }).diagnostics).filter((c) => c === "template/link-domain").length).toBeGreaterThan(1);
    });
  });

  describe("images", () => {
    const pictured = (src: string, rules: Parameters<typeof template>[0]["rules"] = { images: { domains: ["cdn.acme.com", "*.acme-media.com"] } }) => {
      const T = template({
        id: "acme.Pictured",
        version: "1.0.0",
        label: "Pictured",
        root: "Email",
        fields: { src: prop.image({ label: "Image", required: true }) },
        rules,
        example: { src: "https://cdn.acme.com/a.png" },
        render: (v) => <Email><Image src={v.src} alt="A picture" /></Email>,
      });
      return T.check({ src }).diagnostics.filter((d) => d.severity === "error").map((d) => [d.code, d.path]);
    };
    const refused = [["template/image-domain", "root.children[0].props.src"]];

    it("checks every image's host", () => {
      expect(pictured("https://cdn.acme.com/a.png")).toEqual([]);
      expect(pictured("https://eu.acme-media.com/a.png")).toEqual([]);
      expect(pictured("https://cdn.acme.com/{{contact.id}}.png")).toEqual([]);
      expect(pictured("https://track.evil.example/pixel.gif")).toEqual(refused);
      expect(pictured("https://cdn.acme.com.evil.example/a.png")).toEqual(refused);
      expect(pictured("https://acme-media.com/a.png")).toEqual(refused);
      expect(pictured("https://user@cdn.acme.com/a.png")).toEqual(refused);
      expect(pictured("https://track.evil.example/pixel.gif?id={{contact.id}}")).toEqual(refused);
      // Where it loads from can't be checked, or it isn't from a host at all.
      expect(pictured("{{image_url}}")).toEqual(refused);
      expect(pictured("https://cdn.acme.com{{x}}/a.png")).toEqual(refused);
      expect(pictured("data:image/png;base64,iVBORw0KGgo=")).toEqual(refused);
      expect(pictured("/a.png")).toEqual(refused);
      expect(pictured("https://exa mple.com/a.png")).toEqual(refused);
      // No rule, no check: what templates without one held keeps passing.
      expect(pictured("https://track.evil.example/pixel.gif", {})).toEqual([]);
      expect(pictured("https://track.evil.example/pixel.gif", { links: { domains: ["acme.com"] } })).toEqual([]);
    });

    it("covers slots, fixed parts, a Video's thumbnail and a Social's icons, and is a rule in check() and describe()", () => {
      const rules = { images: { domains: ["cdn.acme.com"] } };
      const N = newsletter({ label: "Body", allow: allowed }, rules);
      const slot = N.check({ subject: "Hi", body: <Column><Image src={{ src: "https://track.evil.example/p.gif", width: 1, height: 1 }} alt="" /></Column> });
      expect(slot.valid).toBe(false);
      expect(slot.diagnostics.find((d) => d.code === "template/image-domain")?.message).toBe("An image from track.evil.example isn't from one of acme.Newsletter's image domains (cdn.acme.com) (required by acme.Newsletter)");
      expect(slot.rules.find((r) => r.rule === "images")).toMatchObject({ source: "template", status: "failed" });
      expect(N.check({ subject: "Hi", body: <Column><Image src="https://cdn.acme.com/a.png" alt="A" /></Column> }).rules.find((r) => r.rule === "images")?.status).toBe("passed");
      expect(N.describe().rules.images).toEqual({ domains: ["cdn.acme.com"] });
      expect(newsletter({ label: "Body", allow: allowed }).describe().rules.images).toBeUndefined();

      const fixed = (design: React.ReactElement) =>
        template({ id: "acme.Fixed", version: "1.0.0", label: "Fixed", root: "Email", fields: { title: prop.text({ label: "Title", required: true }) }, rules, example: { title: "x" }, render: () => design }).check({ title: "x" }).diagnostics.filter((d) => d.code === "template/image-domain").map((d) => d.path);
      expect(fixed(<Email><Image src="https://elsewhere.example/logo.png" alt="Logo" /></Email>)).toEqual(["root.children[0].props.src"]);
      expect(fixed(<Email><Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnail="https://elsewhere.example/t.png" title="Launch" /></Email>)).toEqual(["root.children[0].props.thumbnail"]);
      expect(fixed(<Email><Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Launch" /></Email>)).toEqual(["root.children[0].props.src"]);
      expect(fixed(<Email><Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnail="https://cdn.acme.com/t.png" title="Launch" /></Email>)).toEqual([]);
      expect(fixed(<Email><Social icons={[{ name: "LinkedIn", href: "https://linkedin.com/company/acme" }]} /></Email>).length).toBe(1);
    });

    it("is decided per format", () => {
      const Card = template({
        id: "acme.Card",
        version: "1.0.0",
        label: "Card",
        root: "Canvas",
        formats: { wide: { width: 600, height: 315 } },
        fields: { src: prop.image({ label: "Image", required: true }) },
        rules: { images: { domains: ["cdn.acme.com"] } },
        example: { src: "https://cdn.acme.com/a.png" },
        render: (v) => <Canvas width={600} height={315}><Image src={v.src} alt="A" style={{ width: 600 }} /></Canvas>,
      });
      expect(Card.check({ src: "https://evil.example/a.png" }, { format: "wide" }).rules).toEqual([expect.objectContaining({ rule: "images", format: "wide", status: "failed" })]);
    });

    it("checks its domains when the template is defined, and owns them", () => {
      const spec = (rules: unknown) => () => template({ id: "acme.Bad", version: "1.0.0", label: "Bad", root: "Email", fields: {}, rules: rules as never, example: {}, render: () => <Email><Text>x</Text></Email> });
      expect(spec("cdn.acme.com")).toThrow(/rules is \{ plugins, require, links, images, root \}/);
      expect(spec({ images: { domains: "cdn.acme.com" } })).toThrow(/rules\.images\.domains is a list of hosts/);
      expect(() => template({ id: "acme.Bad", version: "1.0.0", label: "Bad", root: "Email", fields: {}, rules: { images: { domains: ["https://cdn.acme.com"] } }, example: {}, render: () => <Email><Text>x</Text></Email> })).toThrow(/rules\.images\.domains\[0\]/);
      const rules = { images: { domains: ["cdn.acme.com"] } };
      const T = template({ id: "acme.OwnImages", version: "1.0.0", label: "Own", root: "Email", fields: { src: prop.image({ label: "Image", required: true }) }, rules, example: { src: "https://cdn.acme.com/a.png" }, render: (v) => <Email><Image src={v.src} alt="A" /></Email> });
      rules.images.domains.push("evil.example");
      expect(codesOf(T.check({ src: "https://evil.example/a.png" }).diagnostics)).toEqual(["template/image-domain"]);
    });
  });

  it("requires root props", () => {
    const T = template({
      id: "acme.Doc",
      version: "1.0.0",
      label: "Doc",
      root: "Document",
      fields: { title: prop.text({ label: "Title", required: true }) },
      rules: { root: { lang: true } },
      example: { title: "x" },
      render: (v) => <Document><Heading>{v.title}</Heading></Document>,
    });
    expect(errors(T.check(T.example).diagnostics)).toEqual([["template/root-prop", "root.props.lang"]]);
  });

  it("are described: each required lint rule's summary and fix, core codes with their stage", () => {
    const N = newsletter({ label: "Body", allow: allowed }, { plugins: { lint: marketing }, require: { lint: ["unsubscribe", "link-text"], core: ["layout/overflow"] }, links: { domains: ["acme.com"] } });
    const described = N.describe();
    expect(described.rules.lint.map((r) => r.id)).toEqual(["unsubscribe", "link-text"]);
    expect(described.rules.lint.every((r) => r.summary && r.fix)).toBe(true);
    expect(described.rules.core).toEqual([{ code: "layout/overflow", stage: "read" }]);
    expect(described.fields.find((f) => f.path === "body")).toMatchObject({ allow: expect.arrayContaining(["Column", "acme.ProductCard"]), styles: "theme" });
    expect(described.theme).toMatchObject({ tokens: expect.arrayContaining([expect.objectContaining({ path: "colors.primary" })]) });
  });
});

describe("annotated templates", () => {
  const title = open(prop.text({ label: "Title", required: true, maxLength: 70 }));
  const body = open(field.slot({ label: "Body", required: true, allow: "all", styles: "free" }));
  const Annotated = template({
    id: "acme.Annotated",
    version: "1.0.0",
    open: { title, body },
    design: (
      <Email width={600}>
        <Heading field={title}>What's new at Acme</Heading>
        <Section field={body}>
          <Text>Three things shipped this week.</Text>
        </Section>
      </Email>
    ),
  });
  const Equivalent = template({
    id: "acme.Annotated",
    version: "1.0.0",
    label: "acme.Annotated",
    root: "Email",
    fields: { title: prop.text({ label: "Title", required: true, maxLength: 70 }), body: field.slot({ label: "Body", required: true, allow: "all", styles: "free" }) },
    example: { title: "What's new at Acme", body: <><Text>Three things shipped this week.</Text></> },
    render: (v) => (
      <Email width={600}>
        <Heading field="title">{v.title}</Heading>
        <Section field="body">{v.body}</Section>
      </Email>
    ),
  });

  it("gives the same describe() and, from the same props, the same HTML as its fields and render equivalent", async () => {
    expect(Annotated.describe()).toEqual(Equivalent.describe());
    const props = { title: "Orbit", body: <Column><Text>Live</Text></Column> };
    const a = Annotated.check(props);
    const b = Equivalent.check(props);
    expect(errors(a.diagnostics)).toEqual([]);
    expect((await render(a.snapshots.default!)).html).toBe((await render(b.snapshots.default!)).html);
    expect(errors(Annotated.check(Annotated.example).diagnostics)).toEqual([]);
  });

  it("refuses a misplaced marker, with its code", () => {
    const define = (open_: Record<string, unknown>, design: React.ReactElement) => () => template({ id: "acme.Bad", version: "1.0.0", open: open_, design } as never);
    const count = open(prop.number({ label: "Count" }));
    const link = open(prop.link({ label: "Link" }));
    const image = open(field.image({ label: "Image" }));
    const t = open(prop.text({ label: "T" }));
    const slot = open(field.slot({ label: "S", allow: "all" }));
    expect(define({ count }, <Email><Text field={count as never}>1</Text></Email>)).toThrow(/template\/inline-kind/);
    expect(define({ t }, <Email><Heading field={t}><Text>x</Text></Heading></Email>)).toThrow(/template\/inline-content|template\/inline-target/);
    expect(define({ link }, <Email><Text field={link}>x</Text></Email>)).toThrow(/template\/inline-target/);
    expect(define({ image }, <Email><Heading field={image}>x</Heading></Email>)).toThrow(/template\/inline-target/);
    expect(define({ t }, <Email><Text field={t}>a</Text><Text field={t}>b</Text></Email>)).toThrow(/template\/inline-twice/);
    expect(define({ t }, <Email><Text>a</Text></Email>)).toThrow(/template\/inline-unplaced/);
    expect(define({}, <Email><Text field={t}>a</Text></Email>)).toThrow(/template\/inline-unlisted/);
    expect(define({ a: t, b: t }, <Email><Text field={t}>a</Text></Email>)).toThrow(/template\/inline-twice/);
    expect(define({ slot, t }, <Email><Section field={slot}><Text field={t}>a</Text></Section></Email>)).toThrow(/template\/inline-nested/);
    expect(() => template({ id: "acme.Bad", version: "1.0.0", open: { t }, design: <Email><Text field={t}>a</Text></Email>, render: () => <Email /> } as never)).toThrow(/template\/spec/);
  });

  it("finds markers in arrays, Fragments and conditional children, and gives a slot host's children as a Fragment example", () => {
    const a = open(prop.text({ label: "A" }));
    const b = open(prop.text({ label: "B" }));
    const s = open(field.slot({ label: "S", allow: "all", styles: "free" }));
    const T = template({
      id: "acme.Found",
      version: "1.0.0",
      open: { a, b, s },
      design: (
        <Email>
          {[<Text key="1" field={a}>one</Text>]}
          <>{true && <Text field={b}>two</Text>}</>
          <Section field={s}>
            <Text>x</Text>
            <Text>y</Text>
            <Text>z</Text>
          </Section>
        </Email>
      ),
    });
    expect(T.example).toMatchObject({ a: "one", b: "two" });
    expect(React.Children.count((T.example as { s: React.ReactElement<{ children: React.ReactNode }> }).s.props.children)).toBe(3);
  });

  it("copies the design: changing what the element given holds afterwards changes nothing", async () => {
    const t = open(prop.text({ label: "T", required: true }));
    const style = { color: "#123456" };
    const T = template({ id: "acme.Copied", version: "1.0.0", open: { t }, design: <Email><Heading field={t} style={style}>Original</Heading></Email> });
    style.color = "#ab1234";
    const { html } = await render(T.check(T.example).snapshots.default!);
    expect(html).toContain("#123456");
    expect(html).not.toContain("#ab1234");
  });

  it("says a marker in a component's own render is template/inline-hidden", async () => {
    const t = open(prop.text({ label: "T" }));
    const Hidden = component({ type: "acme.Hidden", label: "Hidden", props: {}, render: () => <Column><Text field={t as never}>x</Text></Column> });
    await expect(render(<Email><Hidden /></Email>)).rejects.toThrow(/template\/inline-hidden/);
  });
});

describe("a template owns its spec", () => {
  it("can't have its rules emptied, its domains widened, its kinds swapped or a definition replaced", () => {
    const rules = { require: { core: ["layout/overflow"] }, links: { domains: ["acme.com"] } };
    const T = template({ id: "acme.Own", version: "1.0.0", label: "Own", root: "Email", fields: { href: prop.link({ label: "Link", required: true }) }, rules, example: { href: "https://acme.com" }, render: (v) => <Email><Text><Link href={v.href}>x</Link></Text></Email> });
    rules.require.core.length = 0;
    rules.links.domains.push("evil.com");
    expect(codesOf(T.check({ href: "https://evil.com" }).diagnostics)).toEqual(["template/link-domain"]);
    expect(T.rules.require?.core).toEqual(["layout/overflow"]);
    const kind = prop.text({ label: "x" }).kind;
    expect(() => {
      (kind as { parse: unknown }).parse = () => ({ ok: true, value: "x" });
    }).toThrow();
    expect(() => {
      (ProductCard as { definition: unknown }).definition = {};
    }).toThrow();
    expect(() => {
      (ProductCard.definition as { expand: unknown }).expand = () => null;
    }).toThrow();
  });

  it("component() reads its spec once: changing it afterwards changes nothing rendered", async () => {
    const spec = { type: "acme.Once", label: "Once", props: {}, render: () => <Column><Text>Original</Text></Column> };
    const Once = component(spec);
    spec.render = () => <Column><Text>Changed</Text></Column>;
    expect((await render(<Email><Once /></Email>)).html).toContain("Original");
  });

  it("an enumOf()'s array changed afterwards changes nothing it accepts", () => {
    const values = ["a", "b"];
    const choice = prop.choice(values as unknown as readonly ["a", "b"], { label: "C" });
    values.push("c");
    expect(choice.kind.parse("c").ok).toBe(false);
  });
});

describe("values files with slots", () => {
  it("keeps a stored slot as it is, and reads it back", () => {
    const N = newsletter({ label: "Body", allow: allowed });
    const fragment = JSON.parse(JSON.stringify(captureFragment(<Column><Text>x</Text></Column>)));
    const back = readValuesFile({ version: 1, template: { module: "./n.tsx", id: "acme.Newsletter", version: "1.0.0" }, values: { subject: "Hi", body: { module: "./body.tsx" } } }, N);
    expect(back.values?.body).toEqual({ module: "./body.tsx" });
    const withFragment = readValuesFile({ version: 1, template: { module: "./n.tsx", id: "acme.Newsletter", version: "1.0.0" }, values: { subject: "Hi", body: { fragment } } }, N);
    expect(withFragment.diagnostics).toEqual([]);
  });
});
