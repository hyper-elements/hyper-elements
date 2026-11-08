/**
 * Phone and hover styles written inside `style` (`style={{ mobile: { … }, hover: { … } }}`) are the same as the
 * `mobile={…}` and `hover={…}` props: every gallery and stress template, its blocks moved out of `style` into the
 * props, renders the same HTML and plain text, and gives the same diagnostics apart from where they point.
 */
import { renderTemplate, type Json } from "@unlayer-internal/elements-core";
import { describe, expect, it } from "vitest";
import { collectNodes, type JsonNode } from "./collect";
import { gallery } from "./examples/gallery";
import { stress } from "./examples/stress";
import { Button, Column, Document, Email, Heading, Page, Text, component, render, validate } from "./index";

const CONDITIONS = ["mobile", "hover"] as const;

/** The node with the condition blocks of its style moved into props, and its children's too. */
function intoProps(node: JsonNode | string): JsonNode | string {
  if (typeof node === "string") return node;
  const { children, ...rest } = node;
  const out: Record<string, unknown> = { ...rest };
  const style = { ...((node.style as Record<string, Json> | undefined) ?? {}) };
  for (const name of CONDITIONS) {
    if (style[name] === undefined) continue;
    out[name] = style[name];
    delete style[name];
  }
  if (node.style) out.style = style;
  return { ...(out as JsonNode), children: children.map(intoProps) };
}

const hasBlocks = (node: JsonNode | string): boolean =>
  typeof node !== "string" && (CONDITIONS.some((name) => (node.style as Record<string, unknown> | undefined)?.[name] !== undefined) || node.children.some(hasBlocks));

const templates = [
  ...Object.entries(gallery).map(([name, template]) => ({ name, template })),
  ...Object.entries(stress).flatMap(([name, entry]) =>
    entry.roots === "screen"
      ? [
          { name: `${name}, as an Email`, template: entry.template(Email) },
          { name: `${name}, as a Page`, template: entry.template(Page) },
        ]
      : [{ name, template: entry.template }]
  ),
];

describe("condition blocks inside style", () => {
  const withBlocks = templates.filter(({ template }) => {
    const { nodes } = collectNodes(template);
    return nodes.some(hasBlocks);
  });

  it("are tried on templates that have phone or hover styles", () => {
    expect(withBlocks.length).toBeGreaterThan(3);
  });

  for (const { name, template } of withBlocks) {
    it(`render ${name} the same as the props`, () => {
      const { nodes, components } = collectNodes(template);
      const root = nodes.find((node): node is JsonNode => typeof node !== "string")!;
      const inStyle = renderTemplate({ root }, { components });
      const asProps = renderTemplate({ root: intoProps(root) }, { components });
      expect(inStyle.html).toBe(asProps.html);
      expect(inStyle.text).toBe(asProps.text);
      const where = (path: string) => path.replace(/\.style\.(mobile|hover)/g, ".$1");
      expect(inStyle.diagnostics.map((d) => ({ ...d, path: where(d.path) }))).toEqual(asProps.diagnostics);
    });
  }
});

describe("reading condition blocks inside style", () => {
  it("names a problem in a block where it's written", () => {
    const { diagnostics } = validate(
      <Email>
        <Text style={{ mobile: { backgroundColor: "#000000" } as never }}>Hi</Text>
      </Email>
    );
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "mobile/not-allowed", path: "root.children[0].style.mobile.backgroundColor" }));
  });

  it("refuses the same condition given both ways", () => {
    const { valid, diagnostics } = validate(
      <Email>
        <Text style={{ mobile: { fontSize: 12 } }} mobile={{ lineHeight: 1.2 }}>
          Hi
        </Text>
      </Email>
    );
    expect(valid).toBe(false);
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "style/twice", severity: "error", path: "root.children[0].style.mobile" }));
  });

  it("takes a phone block in style and a hover prop on one node", async () => {
    const both = await render(
      <Email>
        <Button href="https://example.com" style={{ mobile: { width: "100%" } }} hover={{ backgroundColor: "#000000" }}>
          Go
        </Button>
      </Email>
    );
    const one = await render(
      <Email>
        <Button href="https://example.com" mobile={{ width: "100%" }} hover={{ backgroundColor: "#000000" }}>
          Go
        </Button>
      </Email>
    );
    expect(both.html).toBe(one.html);
  });

  it("refuses a block inside a block", () => {
    const { diagnostics } = validate(
      <Page>
        <Button href="https://example.com" style={{ mobile: { width: "100%", hover: { color: "#ffffff" } } as never }}>
          Go
        </Button>
      </Page>
    );
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "style/nested", severity: "error", path: "root.children[0].style.mobile.hover" }));
  });

  it("keeps phone styles an error in a Document, where it's written", () => {
    const { diagnostics } = validate(
      <Document>
        <Heading style={{ mobile: { fontSize: 20 } }}>Title</Heading>
      </Document>
    );
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "mobile/not-supported", severity: "error", path: "root.children[0].style.mobile" }));
  });

  it("takes no block on a template's own component, whose style is its place in a Row", () => {
    const Card = component({ type: "acme.Card", label: "Card", props: {}, render: () => <Column><Text>Card</Text></Column> });
    const { diagnostics } = validate(
      <Page>
        <Card style={{ mobile: { flex: 1 } } as never} />
      </Page>
    );
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "style/unknown", path: "root.children[0].style.mobile" }));
  });

  it("lets a template's own component use blocks in what it renders", () => {
    const Card = component({ type: "acme.Card", label: "Card", props: {}, render: () => <Column><Text style={{ mobile: { fontSize: 12 } }}>Card</Text></Column> });
    const { valid, diagnostics } = validate(
      <Page>
        <Card />
      </Page>
    );
    expect(valid).toBe(true);
    expect(diagnostics).toEqual([]);
  });
});

describe("the mobile={…} and hover={…} props", () => {
  const deprecations = (diagnostics: Array<{ code: string }>) => diagnostics.filter((d) => d.code.endsWith("/deprecated-prop"));

  it("are deprecated: one warning each, where they're written, in render() and validate()", async () => {
    const template = (
      <Email>
        <Button href="https://example.com" mobile={{ width: "100%" }} hover={{ backgroundColor: "#000000" }}>
          Go
        </Button>
      </Email>
    );
    const expected = [
      expect.objectContaining({ code: "mobile/deprecated-prop", severity: "warning", path: "root.children[0].mobile" }),
      expect.objectContaining({ code: "hover/deprecated-prop", severity: "warning", path: "root.children[0].hover" }),
    ];
    expect(deprecations(validate(template).diagnostics)).toEqual(expected);
    expect(deprecations((await render(template)).diagnostics)).toEqual(expected);
    expect(validate(template).valid).toBe(true);
  });

  it("say nothing for blocks in style", async () => {
    const template = (
      <Email>
        <Button href="https://example.com" style={{ mobile: { width: "100%" }, hover: { backgroundColor: "#000000" } }}>
          Go
        </Button>
      </Email>
    );
    expect(deprecations(validate(template).diagnostics)).toEqual([]);
    expect(deprecations((await render(template)).diagnostics)).toEqual([]);
  });

  it("are a warning inside a template's own component too, at its place, and the render goes on", async () => {
    const Inner = component({ type: "acme.Inner", label: "Inner", props: {}, render: () => <Text mobile={{ fontSize: 12 }}>Inner</Text> });
    const Outer = component({ type: "acme.Outer", label: "Outer", props: {}, render: () => <Column><Text hover={{} as never}>Outer</Text><Inner /></Column> });
    const template = (
      <Page>
        <Outer />
      </Page>
    );
    const expected = [
      expect.objectContaining({ code: "hover/deprecated-prop", path: "root.children[0](acme.Outer).children[0].hover" }),
      expect.objectContaining({ code: "mobile/deprecated-prop", path: "root.children[0](acme.Outer).children[1](acme.Inner).mobile" }),
    ];
    const checked = validate(template);
    expect(checked.valid).toBe(true);
    expect(deprecations(checked.diagnostics)).toEqual(expected);
    const rendered = await render(template);
    expect(deprecations(rendered.diagnostics)).toEqual(expected);
    expect(rendered.html).toContain("Inner");
  });
});
