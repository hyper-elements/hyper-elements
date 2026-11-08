/**
 * Phone and hover styles written inside `style` (`style={{ mobile: { … }, hover: { … } }}`) are the same as the
 * `mobile={…}` and `hover={…}` props: every gallery and stress template, its blocks moved into `style`, renders the
 * same HTML and plain text, and gives the same diagnostics apart from where they point.
 */
import { renderTemplate, type Json } from "@unlayer-internal/elements-core";
import { describe, expect, it } from "vitest";
import { collectNodes, type JsonNode } from "./collect";
import { gallery } from "./examples/gallery";
import { stress } from "./examples/stress";
import { Button, Column, Document, Email, Heading, Page, Text, component, render, validate } from "./index";

const CONDITIONS = ["mobile", "hover"] as const;

/** The node with its condition props moved into its style, and its children's too. */
function intoStyle(node: JsonNode | string): JsonNode | string {
  if (typeof node === "string") return node;
  const { children, ...rest } = node;
  const out: Record<string, unknown> = { ...rest };
  const style = { ...((node.style as Record<string, Json> | undefined) ?? {}) };
  let moved = false;
  for (const name of CONDITIONS) {
    if (node[name] === undefined) continue;
    style[name] = node[name] as Json;
    delete out[name];
    moved = true;
  }
  if (moved) out.style = style;
  return { ...(out as JsonNode), children: children.map(intoStyle) };
}

const hasBlocks = (node: JsonNode | string): boolean => typeof node !== "string" && (CONDITIONS.some((name) => node[name] !== undefined) || node.children.some(hasBlocks));

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
      const asProps = renderTemplate({ root }, { components });
      const inStyle = renderTemplate({ root: intoStyle(root) }, { components });
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
