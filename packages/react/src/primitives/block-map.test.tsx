/**
 * render()'s `blockMap`: where each block of a design is in its HTML, for tools that preview it. The HTML is the same
 * bytes with the option as without (over the migrated examples, the README's template and designs put together at
 * random, as an Email, a Page, a Document and a Canvas); every block written as an element has an entry, its offset just
 * after that element's tag name in the UTF-8 bytes; and what could move an offset (text that isn't ASCII, a merge tag's
 * own markup, an Html block's markup, the noncharacters the marks are made of) doesn't. A Document's header and footer,
 * written on every page, have an entry on each.
 */
import React from "react";
import { prepareTemplate, shownAnywhere, type ResolvedNode } from "@hyper-elements/core";
import * as primitives from "./index";
import { BLOCK_MAP_VERSION, Button, Canvas, Column, Document, Email, ElementsError, Heading, Html, Image, Layer, Link, List, ListItem, MergeTag, Page, PageBreak, PageFooter, PageHeader, PageNumber, render, Row, Section, Span, Text, type BlockMap } from "./index";
import { collectTemplate } from "./collect";
import Receipt from "./readme-example";
import * as examples from "./testing/codemod-examples";
import { generate, toElement, type Root } from "./testing/templates";

const SEEDS = Number(process.env.CONTENT_SEEDS ?? 60);

/** The migrated examples' templates, and the README's. */
const TEMPLATES: Array<[string, React.ReactElement]> = [
  ["readme", <Receipt key="readme" />],
  ...Object.values(examples).flatMap((module) => Object.entries(module as Record<string, React.FC>).map(([name, Template]) => [name, <Template key={name} />] as [string, React.ReactElement])),
];

/** What a block map says is wrong with `html`: an offset not just after a tag name, or out of order. */
function misplaced(html: string, blocks: BlockMap): string[] {
  const bytes = Buffer.from(html, "utf8");
  const out: string[] = [];
  let last = -1;
  for (const { path, offset } of blocks.entries) {
    const before = bytes.subarray(Math.max(0, offset - 32), offset).toString("latin1");
    const next = String.fromCharCode(bytes[offset] ?? 0);
    if (!/<[a-zA-Z][a-zA-Z0-9]*$/.test(before) || !/[\s/>]/.test(next)) out.push(`${path} at ${offset}: …${before.slice(-12)}|${next}`);
    if (offset < last) out.push(`${path} at ${offset}: before the entry above`);
    last = offset;
  }
  return out;
}

/** The nodes a design writes as elements of their own, at their places in the template (`templatePath`), each once. */
function writtenPaths(element: React.ReactElement): string[] {
  const { document, components } = collectTemplate(element);
  const { resolved } = prepareTemplate(document, { components });
  if (!resolved) throw new Error("the template has errors");
  const templatePath = resolved.templatePath ?? ((path: string) => path);
  const email = resolved.root.type === "Email";
  const out: string[] = [];
  const visit = (node: ResolvedNode) => {
    if (!shownAnywhere(node)) return;
    // A merge tag's markup is the template's, a line break holds nothing, and an empty item writes no element of its own.
    const empty = node.type === "ListItem" && node.children.length === 0 && !node.id && email;
    // A page break ends a Document's page, and a page number is its text: neither is an element of its own.
    if (!["MergeTag", "LineBreak", "PageBreak", "PageNumber"].includes(node.type) && !empty) out.push(templatePath(node.path));
    const children = node.children.filter((child): child is ResolvedNode => typeof child !== "string");
    // In an email, a Layer's Image is drawn as its background: part of the Layer, not an element of its own.
    for (const child of node.type === "Layer" && email ? children.slice(1) : children) visit(child);
  };
  visit(resolved.root);
  return out.sort();
}

async function both(element: React.ReactElement, options: Parameters<typeof render>[1] = {}) {
  const plain = await render(element, options);
  const mapped = await render(element, { ...options, blockMap: true });
  return { plain, mapped, blocks: mapped.blocks! };
}

describe("render(email, { blockMap: true })", () => {
  it("writes the same bytes as without it, over the examples and the README's template", async () => {
    expect(TEMPLATES.length).toBeGreaterThan(8);
    for (const [name, element] of TEMPLATES) {
      const { plain, mapped, blocks } = await both(element);
      const { blocks: _, ...rest } = mapped;
      expect([name, rest]).toEqual([name, plain]);
      expect([name, misplaced(mapped.html, blocks)]).toEqual([name, []]);
      expect([name, blocks.entries.map((e) => e.path).sort()]).toEqual([name, writtenPaths(element)]);
    }
  });

  it(`writes the same bytes over templates put together at random (${SEEDS}), with every block in the map`, async () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const element = toElement(generate(seed, "Email"), primitives, React.createElement) as React.ReactElement;
      const { plain, mapped, blocks } = await both(element);
      if (mapped.html !== plain.html || mapped.body !== plain.body || mapped.head !== plain.head) failures.push(`seed ${seed}: the HTML differs`);
      failures.push(...misplaced(mapped.html, blocks).map((m) => `seed ${seed}: ${m}`));
      const paths = blocks.entries.map((e) => e.path).sort();
      if (JSON.stringify(paths) !== JSON.stringify(writtenPaths(element))) failures.push(`seed ${seed}: the map's blocks aren't the blocks written`);
    }
    expect(failures).toEqual([]);
  });

  it("says its format, and each block's path and id", async () => {
    const { blocks } = await both(
      <Email width={600}>
        <Heading level={1} id="title">
          Hi
        </Heading>
        <Button href="https://example.test">Go</Button>
      </Email>
    );
    expect(BLOCK_MAP_VERSION).toBe(2);
    expect(blocks.version).toBe(BLOCK_MAP_VERSION);
    expect(blocks.unit).toBe("utf8");
    expect(blocks.entries.map(({ path, nodeId, type }) => [path, nodeId, type])).toEqual([
      ["root", undefined, "Email"],
      ["root.children[0]", "title", "Heading"],
      ["root.children[1]", undefined, "Button"],
    ]);
  });

  it("counts UTF-8 bytes, past text that isn't ASCII", async () => {
    const { mapped, blocks } = await both(
      <Email width={600} title="Ünïcödé 📬" previewText="日本語のプレビュー">
        <Text>
          Grüße, 你好 <Span style={{ fontWeight: 700 }}>👋🏽 мир</Span>
        </Text>
        <Button href="https://example.test/ü">Café</Button>
      </Email>
    );
    expect(misplaced(mapped.html, blocks)).toEqual([]);
    const button = blocks.entries.find((e) => e.path === "root.children[1]")!;
    // In characters it would be earlier: the bytes before it hold letters of 2, 3 and 4 bytes.
    expect(Buffer.from(mapped.html, "utf8").subarray(0, button.offset).toString("utf8").length).toBeLessThan(button.offset);
    expect(blocks.entries.map((e) => e.path)).toContain("root.children[0].children[1]");
  });

  it("takes offsets after a merge tag's own markup", async () => {
    const element = (
      <Email width={600}>
        <Text>
          Hi <MergeTag name="first_name" />, welcome
        </Text>
        <Button href="https://example.test">Go</Button>
      </Email>
    );
    const mergeTag = (name: string) => `<%= «${name}» %><span data-x="<b>">`;
    const { plain, mapped, blocks } = await both(element, { mergeTag });
    expect(mapped.html).toBe(plain.html);
    expect(mapped.html).toContain("<%= «first_name» %>");
    expect(misplaced(mapped.html, blocks)).toEqual([]);
    expect(blocks.entries.map((e) => e.path)).toEqual(["root", "root.children[0]", "root.children[1]"]);
  });

  it("maps an Html block to its own element, whatever its markup holds", async () => {
    const markup = '<!--[if mso]><table><tr><td><![endif]--><p class="x">a < b</p><!-- <div> --><!--[if mso]></td></tr></table><![endif]-->';
    const { plain, mapped, blocks } = await both(
      <Email width={600}>
        <Html html={markup} />
        <Text>After</Text>
      </Email>
    );
    expect(mapped.html).toBe(plain.html);
    expect(misplaced(mapped.html, blocks)).toEqual([]);
    const bytes = Buffer.from(mapped.html, "utf8");
    const [html, after] = [blocks.entries[1]!, blocks.entries[2]!];
    expect(bytes.subarray(html.offset - 4, html.offset).toString()).toBe("<div");
    expect(bytes.subarray(html.offset, after.offset).toString()).toContain(markup);
    expect(bytes.subarray(after.offset - 2, after.offset).toString()).toBe("<p");
  });

  it("maps a block only phones show, inside what Outlook skips, and a Row's columns", async () => {
    const { mapped, blocks } = await both(
      <Email width={600}>
        <Section hidden={{ desktop: true }}>
          <Text>Phones only</Text>
        </Section>
        <Row>
          <Column>
            <Image src={{ src: "https://example.test/a.png", width: 300, height: 200 }} alt="A" />
          </Column>
          <Column>
            <List>
              <ListItem>One</ListItem>
            </List>
          </Column>
        </Row>
        <Layer>
          <Image src={{ src: "https://example.test/bg.png", width: 600, height: 300 }} alt="Background" style={{ width: "100%" }} />
          <Link href="https://example.test">Over</Link>
        </Layer>
      </Email>
    );
    expect(misplaced(mapped.html, blocks)).toEqual([]);
    const bytes = Buffer.from(mapped.html, "utf8");
    const at = (path: string) => blocks.entries.find((e) => e.path === path)!.offset;
    expect(bytes.subarray(at("root.children[0]") - 30, at("root.children[0]")).toString()).toMatch(/<!--\[if !mso\]><!--><tr$/);
    expect(blocks.entries.map((e) => e.path)).toEqual(expect.arrayContaining(["root.children[1].children[0].children[0]", "root.children[1].children[1].children[0].children[0]", "root.children[2]", "root.children[2].children[1]"]));
    // The Layer's Image is its background, not an element.
    expect(blocks.entries.map((e) => e.path)).not.toContain("root.children[2].children[0]");
  });

  it("isn't misled by the noncharacters it marks with, in the template's text", async () => {
    // U+FDD0 to U+FDD3: a first pair, and one that reads as a mark of the first pair; the map takes another pair.
    const element = (
      <Email width={600} title={"﷐" + "0" + "﷑"}>
        <Text>{"Odd ﷐" + "1" + "﷑ ﷒ text"}</Text>
        <Button href="https://example.test">Go</Button>
      </Email>
    );
    const { plain, mapped, blocks } = await both(element);
    expect(mapped.html).toBe(plain.html);
    expect(misplaced(mapped.html, blocks)).toEqual([]);
    expect(blocks.entries.map((e) => e.path)).toEqual(["root", "root.children[0]", "root.children[1]"]);
  });

  it("rejects pretty, whose HTML is indented after the offsets are taken", async () => {
    const element = (
      <Email width={600}>
        <Text>Hi</Text>
      </Email>
    );
    const error = await render(element, { blockMap: true, pretty: true }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ElementsError);
    expect((error as ElementsError).diagnostics).toEqual([{ code: "render/block-map-pretty", severity: "error", message: "blockMap gives offsets in the compact HTML; leave pretty off", path: "root" }]);
  });

  it("gives no map without the option, whatever the root", async () => {
    const text = <Text>Hi</Text>;
    expect((await render(<Email width={600}>{text}</Email>)).blocks).toBeUndefined();
    expect((await render(<Page width={600}>{text}</Page>)).blocks).toBeUndefined();
    expect((await render(<Document>{text}</Document>)).blocks).toBeUndefined();
    expect((await render(<Canvas width={600} height={300}>{text}</Canvas>)).blocks).toBeUndefined();
  });
});

describe("render(page, { blockMap: true }): a Page, a Document's print HTML and a Canvas as HTML", () => {
  /** Each path once, sorted. */
  const unique = (blocks: BlockMap) => [...new Set(blocks.entries.map((e) => e.path))].sort();

  for (const root of ["Page", "Document", "Canvas"] as Root[]) {
    it(`writes the same bytes as without it over ${root}s put together at random (${SEEDS}), with every block in the map`, async () => {
      const failures: string[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const element = toElement(generate(seed, root), primitives, React.createElement) as React.ReactElement;
        const { plain, mapped, blocks } = await both(element);
        const { blocks: _, ...rest } = mapped;
        if (JSON.stringify(rest) !== JSON.stringify(plain)) failures.push(`seed ${seed}: the output differs`);
        failures.push(...misplaced(mapped.html, blocks).map((m) => `seed ${seed}: ${m}`));
        // A Document writes its header and footer on every page: there, each path is compared once.
        const [got, want] = root === "Document" ? [unique(blocks), [...new Set(writtenPaths(element))]] : [blocks.entries.map((e) => e.path).sort(), writtenPaths(element)];
        if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`seed ${seed}: the map's blocks aren't the blocks written (missing ${want.filter((p) => !got.includes(p)).join(", ") || "none"}; extra ${got.filter((p) => !want.includes(p)).join(", ") || "none"})`);
      }
      expect(failures).toEqual([]);
    });
  }

  it("maps a Page's blocks with their paths, ids and components, from the root", async () => {
    const { mapped, blocks } = await both(
      <Page width={600} title="Ünïcödé">
        <Section>
          <Heading level={1} id="title">
            Grüße 👋🏽
          </Heading>
          <Text>
            Hi <MergeTag name="first_name" />, <Link href="https://example.test">read on</Link>
          </Text>
        </Section>
        <Html html="<p>a < b</p><!-- <div> -->" />
        <Button href="https://example.test">Go</Button>
      </Page>
    );
    expect(misplaced(mapped.html, blocks)).toEqual([]);
    expect(blocks.version).toBe(BLOCK_MAP_VERSION);
    expect(blocks.entries.map(({ path, nodeId, type }) => [path, nodeId, type])).toEqual([
      ["root", undefined, "Page"],
      ["root.children[0]", undefined, "Section"],
      ["root.children[0].children[0]", "title", "Heading"],
      ["root.children[0].children[1]", undefined, "Text"],
      ["root.children[0].children[1].children[3]", undefined, "Link"],
      ["root.children[1]", undefined, "Html"],
      ["root.children[2]", undefined, "Button"],
    ]);
  });

  it("maps a Document's header and footer on every page", async () => {
    const { plain, mapped, blocks } = await both(
      <Document>
        <PageHeader>
          <Text>Acme</Text>
        </PageHeader>
        <Heading level={1}>Quote</Heading>
        <PageBreak />
        <Text>Terms</Text>
        <PageFooter>
          <Text>
            Page <PageNumber />
          </Text>
        </PageFooter>
      </Document>
    );
    expect(mapped.html).toBe(plain.html);
    expect(misplaced(mapped.html, blocks)).toEqual([]);
    const count = (path: string) => blocks.entries.filter((e) => e.path === path).length;
    // Two pages: the header (root.children[0]) and the footer (root.children[4]) on each, with what they hold.
    expect([count("root.children[0]"), count("root.children[0].children[0]"), count("root.children[4]"), count("root.children[4].children[0]")]).toEqual([2, 2, 2, 2]);
    expect([count("root"), count("root.children[1]"), count("root.children[3]")]).toEqual([1, 1, 1]);
    expect(blocks.entries.map((e) => e.path)).not.toContain("root.children[2]");
  });

  it("maps a Document's own pages, with the header and footer on each", async () => {
    const { plain, mapped, blocks } = await both(
      <Document>
        <PageHeader>
          <Text>Acme</Text>
        </PageHeader>
        <Document.Page>
          <Heading level={1}>Quote</Heading>
        </Document.Page>
        <Document.Page>
          <Text>Terms</Text>
        </Document.Page>
        <PageFooter>
          <Text>
            Page <PageNumber /> of <PageNumber total />
          </Text>
        </PageFooter>
      </Document>
    );
    expect(mapped.html).toBe(plain.html);
    expect(misplaced(mapped.html, blocks)).toEqual([]);
    const count = (path: string) => blocks.entries.filter((e) => e.path === path).length;
    // Each page once, as a DocumentPage, with what it holds; the header and footer on both.
    expect(blocks.entries.filter((e) => e.type === "DocumentPage").map((e) => e.path)).toEqual(["root.children[1]", "root.children[2]"]);
    expect([count("root.children[1].children[0]"), count("root.children[2].children[0]")]).toEqual([1, 1]);
    expect([count("root.children[0]"), count("root.children[0].children[0]"), count("root.children[3]"), count("root.children[3].children[0]")]).toEqual([2, 2, 2, 2]);
    expect(blocks.entries.map((e) => e.type)).not.toContain("PageNumber");
  });

  it("isn't misled by the noncharacters it marks with, in a Page's text", async () => {
    const element = (
      <Page width={600}>
        <Text>{"Odd ﷐" + "0" + "﷑ ﷒ text"}</Text>
      </Page>
    );
    const { plain, mapped, blocks } = await both(element);
    expect(mapped.html).toBe(plain.html);
    expect(blocks.entries.map((e) => e.path)).toEqual(["root", "root.children[0]"]);
  });
});
