/** A template's own elements in the builder: as custom tools' blocks in a design, read back, and registered in a builder. */
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as primitives from "../primitives";
import { Button, Column, defineElement, defineProperty, defineTheme, Document, Email, Heading, Image, Layer, Page, PageBreak, PageNumber, prop, render, Row, Section, Text, token, type RootName } from "../primitives/index";
import { fromDesign, registerTools, toDesign, toolName, type Builder, type EditorWidget } from "./index";

type Values = Record<string, any>;
type Content = { type: string; slug?: string; values: Values };
const blocks = (design: any): Content[] => design.body.rows.flatMap((row: any) => row.columns.flatMap((column: any) => column.contents));

const ProductCard = defineElement({
  type: "acme.ProductCard",
  label: "Product",
  props: {
    name: prop.text({ label: "Product title", default: "Product title" }),
    price: prop.number({ label: "Price", min: 0, default: 7.99 }),
    quantity: prop.number({ label: "Quantity", min: 1, max: 99, integer: true, default: 1 }),
    href: prop.link({ label: "Button link", default: "https://example.com" }),
    buttonColor: prop.color({ label: "Button color", default: "#007bff" }),
    photo: prop.image({ label: "Photo" }),
    badge: prop.choice(["none", "new", "sale"], { label: "Badge", default: "none" }),
    featured: prop.boolean({ label: "Featured", default: false }),
    font: prop.fontFamily({ label: "Font" }),
    gap: prop.length({ label: "Gap", default: 8 }),
  },
  render: (p) => (
    <Column style={{ padding: 16, gap: p.gap, ...(p.font ? { fontFamily: p.font } : {}), ...(p.featured ? { backgroundColor: "#fffbeb" } : {}) }}>
      {p.photo ? <Image src={p.photo} alt={p.name} /> : null}
      <Heading level={3}>{p.name}</Heading>
      <Text>
        {p.badge === "none" ? "" : `${p.badge} · `}
        {p.quantity} × ${p.price.toFixed(2)}
      </Text>
      <Button href={p.href} style={{ backgroundColor: p.buttonColor }}>
        Buy now
      </Button>
    </Column>
  ),
});
const Footer = defineElement({ type: "acme.LegalFooter", label: "Legal footer", props: {}, render: () => <Text style={{ fontSize: 12 }}>Acme Inc., 1 Market St.</Text> });
const Hero = defineElement({ type: "acme.Hero", label: "Hero", placement: "section", props: { title: prop.text({ label: "Title", required: true }) }, render: ({ title }) => <Section><Heading>{title}</Heading></Section> });
// One prop of each kind whose field isn't the kind's own in the builder.
const Kinds = defineElement({
  type: "acme.Kinds",
  label: "Kinds",
  props: {
    ratio: prop.number({ label: "Ratio", min: 0, max: 1, default: 0.5 }),
    offset: prop.number({ label: "Offset", integer: true, default: 0 }),
    width: prop.length({ label: "Width", units: ["px", "%"], default: "50%" }),
    gap: prop.length({ label: "Gap", min: 4, default: 8 }),
    weight: prop.fontWeight({ label: "Weight", default: 400 }),
  },
  render: (p) => <Text style={{ fontWeight: p.weight }}>{`${p.ratio} ${p.offset} ${p.width} ${p.gap}`}</Text>,
});
// A prop its element needs, with what a block dragged in starts with.
const Banner = defineElement({ type: "acme.Banner", label: "Banner", props: { title: prop.text({ label: "Title", required: true, default: "Welcome" }) }, render: (p) => <Text>{p.title}</Text> });

const email = (
  <Email width={600}>
    <Heading level={1}>November picks</Heading>
    <ProductCard
      id="hero-product"
      name="Morning Mug"
      price={24}
      quantity={2}
      href={{ href: "https://example.com/mug", target: "_blank" }}
      buttonColor="#0f766e"
      photo={{ src: "https://example.com/mug.png", width: 1200, height: 800 }}
      badge="new"
      featured
      font="Georgia, serif"
      gap={12}
    />
    <Footer />
  </Email>
);

describe("toolName", () => {
  it("is an element's type in the builder's words", () => {
    expect(toolName("acme.ProductCard")).toBe("acme_product_card");
    expect(toolName("my-shop.Hero2")).toBe("my_shop_hero2");
    expect(toolName("acme.CTA")).toBe("acme_cta");
  });

  it("takes the element itself, and refuses what's neither it nor its type", () => {
    expect(toolName(ProductCard)).toBe("acme_product_card");
    for (const other of [undefined, {}, 5]) expect(() => toolName(other as never)).toThrow("toolName takes a template's own element (made with defineElement()) or its type");
  });
});

describe("toDesign with customTools", () => {
  it("writes each of the template's own elements as an HTML block without it, as before", () => {
    expect(blocks(toDesign(email).design).map((content) => content.type)).toEqual(["heading", "html", "html"]);
  });

  it("writes each as its custom tool's block, its props the block's values as the builder's editors store them", () => {
    const { design, report } = toDesign(email, { customTools: true });
    const [, product, footer] = blocks(design);
    expect(report.join("\n")).not.toContain("HTML block");
    expect(product.type).toBe("custom");
    expect(product.slug).toBe("acme_product_card");
    expect(product.values).toMatchObject({
      name: "Morning Mug",
      // A number that isn't whole is kept as the builder's text field keeps one.
      price: "24",
      quantity: 2,
      href: { name: "web", values: { href: "https://example.com/mug", target: "_blank" } },
      buttonColor: "#0f766e",
      photo: { url: "https://example.com/mug.png", width: 1200, height: 800 },
      badge: "new",
      featured: true,
      font: { label: "Georgia", value: "Georgia, serif" },
      gap: 12,
      containerPadding: "0px",
      _meta: { htmlID: "hero-product", htmlClassNames: "u_content_custom_acme_product_card" },
    });
    expect(footer).toMatchObject({ type: "custom", slug: "acme_legal_footer", values: { _meta: { htmlID: "u_content_custom_acme_legal_footer_1", htmlClassNames: "u_content_custom_acme_legal_footer" } } });
    expect(design.counters).toMatchObject({ u_content_custom_acme_legal_footer: 1 });
  });

  it("writes a prop that isn't given as its default, so its field shows what's drawn", () => {
    const [product] = blocks(toDesign(<Email><ProductCard name="Mug" /></Email>, { customTools: true }).design);
    expect(product.values).toMatchObject({ name: "Mug", price: "7.99", quantity: 1, href: { name: "web", values: { href: "https://example.com", target: "_self" } }, buttonColor: "#007bff", badge: "none", featured: false, gap: 8 });
    // No default to show.
    expect(Object.keys(product.values).filter((key) => ["photo", "font"].includes(key))).toEqual([]);
  });

  it("reads a default back as the prop not given, as a template wouldn't write it", () => {
    const { design } = toDesign(<Email><ProductCard name="Mug" buttonColor="#007bff" /></Email>, { customTools: true });
    expect(fromDesign(design, { elements: [ProductCard] }).code).toContain('<ProductCard name="Mug" />');
  });

  it("keeps a prop its element needs where it's given its default: a template has to give it", async () => {
    const banner = <Email><Banner title="Welcome" /></Email>;
    const back = fromDesign(toDesign(banner, { customTools: true }).design, { elements: [Banner] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<Banner title="Welcome" />');
    expect((await render(back.element)).html).toBe((await render(banner)).html);
  });

  it("refuses two elements that are one tool in the builder, as registerTools() does", () => {
    const Upper = defineElement({ type: "review.FAQ", label: "FAQ", props: {}, render: () => <Text>Upper</Text> });
    const Lower = defineElement({ type: "review.Faq", label: "Faq", props: {}, render: () => <Text>Lower</Text> });
    expect(() => toDesign(<Email><Upper /><Lower /></Email>, { customTools: true })).toThrow("are one tool in the builder (review_faq): rename one");
    // Without customTools, both are HTML blocks, as before.
    expect(blocks(toDesign(<Email><Upper /><Lower /></Email>).design).map((content) => content.type)).toEqual(["html", "html"]);
  });

  it("keeps an element placed where a Section goes as an HTML block, and says so", () => {
    const { design, report } = toDesign(<Email><Hero title="Launch" /></Email>, { customTools: true });
    expect(blocks(design).map((content) => content.type)).toEqual(["html"]);
    expect(report.join("\n")).toContain("HTML block");
  });

  it("writes a Document's own element as its tool's block, which the builder draws in a document as in a page", () => {
    const document = <Document><Footer /></Document>;
    const { design, report } = toDesign(document, { customTools: true });
    expect(blocks(design).map((content) => content.slug)).toEqual(["acme_legal_footer"]);
    expect(report).toEqual([]);
    // It comes back as the element still.
    const back = fromDesign(design, { displayMode: "document", elements: [Footer] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain("<LegalFooter />");
    // One its tool can't draw on its own, at the room it has, is an HTML block, and said, as in an email.
    const Themed = defineElement({ type: "acme.Themed", label: "Themed", props: {}, render: () => <Text style={{ color: token("colors.primary") }}>Hi</Text> });
    const theme = defineTheme({ colors: { primary: "#0a7" } });
    const themed = toDesign(<Document theme={theme}><Themed /></Document>, { customTools: true });
    expect(blocks(themed.design).map((content) => content.type)).toEqual(["html"]);
    expect(themed.report.join("\n")).toContain("its custom tool draws a acme.Themed on its own");
  });

  it("writes a prop given a theme's token as the value it has there: the builder keeps no theme", () => {
    const theme = defineTheme({ colors: { primary: "#0f766e" } });
    const Tag = defineElement({ type: "acme.Tag", label: "Tag", props: { color: prop.color({ label: "Color", default: "#000000" }) }, render: (p) => <Text style={{ color: p.color }}>tag</Text> });
    const { design, report } = toDesign(
      <Email theme={theme}>
        <Tag color={token("colors.primary")} />
        <Section tokens={{ colors: { primary: "#b91c1c" } }}>
          <Tag color={token("colors.primary")} />
        </Section>
      </Email>,
      { customTools: true }
    );
    expect(blocks(design).map((content) => content.values.color)).toEqual(["#0f766e", "#b91c1c"]);
    expect(report.join("\n")).toContain("the builder keeps no theme");
  });

  it("keeps an element its tool can't draw on its own, one with a theme's token in its render, as an HTML block drawn with the theme, and says why", () => {
    const theme = defineTheme({ colors: { primary: "#0f766e" } });
    const Note = defineElement({ type: "acme.Note", label: "Note", props: { text: prop.text({ label: "Text", default: "Note" }) }, render: (p) => <Text style={{ color: token("colors.primary") }}>{p.text}</Text> });
    const { design, report } = toDesign(
      <Email theme={theme}>
        <Note text="Hello" />
        <ProductCard name="Mug" />
      </Email>,
      { customTools: true }
    );
    const [note, product] = blocks(design);
    expect(note.type).toBe("html");
    expect(note.values.html).toContain("Hello");
    expect(note.values.html).toContain("#0f766e");
    // One its tool draws is still its tool's block.
    expect(product.type).toBe("custom");
    expect(report).toContainEqual(expect.stringMatching(/^root\.children\[0\]: its custom tool draws a acme\.Note on its own, at the room its column leaves it and without the template's theme, and can't draw it so \(There's no token "colors\.primary".*\): it's an HTML block of its own markup in the builder/));
    // Dragged in from the panel, its tool says the same in the canvas and the builder's audit, and its export fails.
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Note]);
    expect(tools[0].renderer.Viewer.render({ text: "Hello" })).toContain("Note: There's no token &#34;colors.primary&#34;");
    expect(() => tools[0].renderer.exporters.email({ text: "Hello" })).toThrow(`[Elements] Note (acme.Note) can't be drawn: There's no token "colors.primary"`);
    expect(tools[0].validator({ values: { text: "Hello" } })).toEqual([expect.objectContaining({ severity: "ERROR", description: expect.stringContaining('no token "colors.primary"') })]);
  });

  it("writes an element its tool draws at the room its block has as its tool's block, whatever it would be at another width", () => {
    // In an email, a Layer's Image is as wide as the Layer: this one draws in a column of 300px, and in no wider one.
    const Banner = defineElement({
      type: "acme.PhotoBanner",
      label: "Photo banner",
      props: {},
      render: () => (
        <Layer style={{ height: 100 }}>
          <Image src={{ src: "https://example.com/banner.png", width: 300, height: 100 }} style={{ width: 300 }} alt="" />
          <Text>Banner</Text>
        </Layer>
      ),
    });
    const { design, report } = toDesign(
      <Email width={600}>
        <Row>
          <Column>
            <Banner />
          </Column>
          <Column>
            <Text>Beside it</Text>
          </Column>
        </Row>
      </Email>,
      { customTools: true }
    );
    expect(blocks(design).map((content) => content.type)).toEqual(["custom", "paragraph"]);
    expect(report.join("\n")).not.toContain("can't draw it so");
    // Its values are all it takes: the builder's audit has nothing to say of it, whatever width it's drawn at.
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Banner]);
    expect(tools[0].validator({ values: {}, defaultErrors: [] })).toEqual([]);
    // And its block, as written, is drawn in its column.
    expect(tools[0].renderer.Viewer.render(blocks(design)[0].values, { contentWidth: "600px" }, { rowCells: [1, 1], columnIndex: 0 })).toContain("banner.png");
    // In a column of 300px the template's own, which the builder draws as wide as its row, its tool can't draw it: it's
    // an HTML block, drawn as the template draws it, and said, not a block the builder would export as nothing.
    const narrowed = toDesign(
      <Email width={600}>
        <Column style={{ width: 300 }}>
          <Banner />
        </Column>
      </Email>,
      { customTools: true }
    );
    expect(blocks(narrowed.design).map((content) => content.type)).toEqual(["html"]);
    expect(blocks(narrowed.design)[0].values.html).toContain("banner.png");
    expect(narrowed.report.join("\n")).toMatch(/its custom tool draws a acme\.PhotoBanner on its own, at the room its column leaves it and without the template's theme, and can't draw it so \(In an email, a Layer's Image is as wide as the Layer.*\): it's an HTML block/);
  });

  it("says in the builder's audit what stops a block from being drawn at any room: what its render does with its values", () => {
    const Headline = defineElement({
      type: "acme.Headline",
      label: "Headline",
      props: { title: prop.text({ label: "Title" }), subtitle: prop.text({ label: "Subtitle" }) },
      render: (p) => {
        if (!p.title && !p.subtitle) throw new Error("give it a title or a subtitle");
        return <Text>{p.title ?? p.subtitle}</Text>;
      },
    });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Headline]);
    expect(() => tools[0].renderer.exporters.email({})).toThrow("give it a title or a subtitle");
    expect(tools[0].validator({ values: {}, defaultErrors: [] })).toEqual([expect.objectContaining({ severity: "ERROR", description: expect.stringContaining("give it a title or a subtitle") })]);
    expect(tools[0].validator({ values: { title: "Hello" }, defaultErrors: [] })).toEqual([]);
  });

  it("is hidden where the element is", () => {
    const [product] = blocks(toDesign(<Email><ProductCard name="Mug" hidden={{ mobile: true }} /></Email>, { customTools: true }).design);
    expect(product.values._override).toEqual({ mobile: { hideMobile: true } });
  });
});

describe("fromDesign with elements", () => {
  it("reads each custom tool's block back as its element, and renders what the template did", async () => {
    const { design } = toDesign(email, { customTools: true });
    const back = fromDesign(design, { elements: [ProductCard, Footer] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<ProductCard id="hero-product" name="Morning Mug" price={24} quantity={2}');
    expect(back.code).toContain("<LegalFooter />");
    expect((await render(back.element)).html).toBe((await render(email)).html);
  });

  it("writes each in the code by the name its type ends with, or with its namespace where that's another's: the code runs with them imported", async () => {
    const card = (type: string) => defineElement({ type, label: type, props: { title: prop.text({ label: "Title", default: "Hi" }) }, render: (p) => <Text>{`${type}: ${p.title}`}</Text> });
    // Two named Card, one in a namespace JavaScript can't write and one in a word it keeps; one named as a built-in the
    // code imports, and one as the template's own element.
    const [MyShopCard, NewCard, Callout, AcmeText, AcmeTemplate] = ["my-shop.Card", "new.Card", "acme.Callout", "acme.Text", "acme.Template"].map(card);
    const template = (
      <Email>
        <MyShopCard title="One" />
        <NewCard title="Two" />
        <Callout title="Three" />
        <AcmeText title="Four" />
        <AcmeTemplate title="Five" />
        <Text>Plain</Text>
      </Email>
    );
    const { design } = toDesign(template, { customTools: true });
    const back = fromDesign(design, { elements: [MyShopCard, NewCard, Callout, AcmeText, AcmeTemplate] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain(
      "// Custom elements, to import from where they're defined: Callout (acme.Callout), AcmeTemplate (acme.Template), AcmeText (acme.Text), MyShopCard (my-shop.Card), NewCard (new.Card)."
    );
    expect(back.code).toContain('<MyShopCard title="One" />');
    expect(back.code).toContain('<Callout title="Three" />');
    // Run as a module, with the elements imported by those names: it's the template.
    const code = `import { Callout, AcmeTemplate, AcmeText, MyShopCard, NewCard } from "./elements";\n${back.code}`;
    const js = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const modules: Record<string, unknown> = { "@hyper-elements/react": primitives, "react/jsx-runtime": jsxRuntime, "./elements": { Callout, AcmeTemplate, AcmeText, MyShopCard, NewCard } };
    const module = { exports: {} as { default: () => React.ReactElement } };
    new Function("require", "module", "exports", js)((name: string) => modules[name], module, module.exports);
    expect((await render(module.exports.default())).html).toBe((await render(template)).html);
  });

  it("reads a design made of the same blocks again as the same design", () => {
    const { design } = toDesign(email, { customTools: true });
    const again = toDesign(fromDesign(design, { elements: [ProductCard, Footer] }).element, { customTools: true }).design;
    expect(again).toEqual(design);
  });

  it("leaves out a custom tool's block that's none of the elements given, and says which", () => {
    const { design } = toDesign(email, { customTools: true });
    const { element, report } = fromDesign(design, { elements: [Footer] });
    expect(report.join("\n")).toContain('rows[0].columns[0].contents[1]: the custom tool "acme_product_card" of the builder\'s is none of the elements given');
    expect(fromDesign(design).report.filter((line) => line.includes("custom tool"))).toHaveLength(2);
    expect(element.props.children).toHaveLength(2);
  });

  it("reads what the builder's editors store: a counter's digits, a dropdown's text, a link and an image as theirs", async () => {
    const Pack = defineElement({
      type: "acme.Pack",
      label: "Pack",
      props: { size: prop.choice([6, 12, 24], { label: "Size", default: 6 }), count: prop.number({ label: "Count", default: 1 }), href: prop.link({ label: "Link" }), photo: prop.image({ label: "Photo" }) },
      render: (p) => <Text>{`${p.count} × ${p.size}`}</Text>,
    });
    const { design } = toDesign(<Email><Pack /></Email>, { customTools: true });
    blocks(design)[0].values = { ...blocks(design)[0].values, size: "12", count: "3", href: { name: "web", values: { href: "https://example.com/p", target: "_self" } }, photo: { url: "https://example.com/p.png" } };
    const back = fromDesign(design, { elements: [Pack] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<Pack size={12} count={3} href="https://example.com/p" photo="https://example.com/p.png" />');
    expect((await render(back.element)).text).toContain("3 × 12");
  });

  it("reads the values the builder itself stored for an image, a font and two dropdowns", async () => {
    const Card = defineElement({
      type: "probe.Card",
      label: "Probe",
      props: {
        title: prop.text({ label: "Title", default: "Probe" }),
        photo: prop.image({ label: "Photo" }),
        font: prop.fontFamily({ label: "Font" }),
        size: prop.choice(["small", "medium", "large"], { label: "Size", default: "medium" }),
        packs: prop.choice([6, 12, 24], { label: "Pack", default: 6 }),
      },
      render: (p) => <Text style={p.font ? { fontFamily: p.font } : {}}>{`${p.title}: pack of ${p.packs}, size ${p.size}`}</Text>,
    });
    const { design } = toDesign(<Email><Card /></Email>, { customTools: true });
    // As saved by the builder after its image editor was given a URL (it measures the file), a font was picked in its
    // font editor, and a value in each dropdown.
    Object.assign(blocks(design)[0].values, {
      photo: { url: "https://hyperelements.dev/img/orbit-app.png", width: 1200, height: 700 },
      font: { label: "Georgia", value: "georgia,palatino", url: "", defaultFont: true, weights: null },
      size: "large",
      packs: "24",
    });
    const back = fromDesign(design, { elements: [Card] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<Card photo={{ src: "https://hyperelements.dev/img/orbit-app.png", width: 1200, height: 700 }} font="georgia,palatino" size="large" packs={24} />');
    expect((await render(back.element)).text).toContain("Probe: pack of 24, size large");
  });

  it("leaves out a block with a value its prop doesn't take, and says where and which: the builder's export of it fails too", () => {
    const { design } = toDesign(email, { customTools: true });
    Object.assign(blocks(design)[1].values, { buttonColor: "greenish", quantity: 500, href: { name: "web", values: { href: "javascript:alert(1)" } }, extra: "<script>" });
    const { code, report } = fromDesign(design, { elements: [ProductCard, Footer] });
    const said = report.filter((line) => line.startsWith("rows[0].columns[0].contents[1]: "));
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('its buttonColor "greenish"');
    expect(said[0]).toContain("its quantity 500");
    expect(said[0]).toMatch(/, which a acme\.ProductCard doesn't take: left out$/);
    expect(code).not.toContain("greenish");
    expect(code).not.toContain("javascript:");
    expect(code).not.toContain("script");
    // Not drawn with its props' defaults instead: the block is left out, and the rest is read.
    expect(code).not.toContain("Morning Mug");
    expect(code).toContain("<LegalFooter");
  });

  it("says what the builder keeps on a block that an element has no place for: a display condition, an anchor, a prop's value on phones", () => {
    const { design } = toDesign(email, { customTools: true });
    Object.assign(blocks(design)[1].values, {
      displayCondition: { type: "custom", label: "Members", before: "{% if member %}", after: "{% endif %}" },
      anchor: "mug",
      // Its space on phones is read, as the space of any block is; a prop has one value.
      _override: { mobile: { containerPadding: "4px", name: "Mug" } },
    });
    const { code, report } = fromDesign(design, { elements: [ProductCard, Footer] });
    expect(report).toEqual([
      "rows[0].columns[0].contents[1]: its display condition, which the builder's exporters keep for the email service to apply, isn't read: it's shown to everyone",
      "rows[0].columns[0].contents[1]: its anchor isn't read: links to it go nowhere",
      'rows[0].columns[0].contents[1]: its name on phones "Mug" isn\'t read: left out',
    ]);
    // The block is still its element, with its own values.
    expect(code).toContain('name="Morning Mug"');
    expect(code).toContain("mobile: { padding: 4 }");
  });

  it("reads a required text left empty, as a block dragged in starts, as none: not drawn, exported or read back blank", async () => {
    const Named = defineElement({ type: "acme.Named", label: "Named", props: { name: prop.text({ label: "Name", required: true }) }, render: (p) => <Text>{p.name}</Text> });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Named]);
    // What a block dragged in from the panel starts with.
    expect(tools[0].options.acme_named.options.name.defaultValue).toBe("");
    const dropped = { name: "" };
    expect(tools[0].renderer.Viewer.render(dropped)).toContain("Named:");
    expect(() => tools[0].renderer.exporters.email(dropped)).toThrow("[Elements] Named (acme.Named) can't be drawn");
    expect(tools[0].validator({ values: dropped, defaultErrors: [] })).toEqual([expect.objectContaining({ severity: "ERROR", description: "it has no name, which it needs" })]);
    const read = fromDesign({ body: { rows: [{ cells: [1], columns: [{ contents: [{ type: "custom", slug: "acme_named", values: dropped }] }] }] } }, { elements: [Named] });
    expect(read.report).toEqual(['rows[0].columns[0].contents[0]: the custom tool "acme_named" has no name, which a acme.Named needs: left out']);
    // Filled, it's drawn.
    expect(tools[0].renderer.exporters.email({ name: "Ada" })).toContain("Ada");
    // Where the empty text is one of the values a required prop lists, it's that value: drawn, exported and read back.
    const Promo = defineElement({ type: "acme.Promo", label: "Promo", props: { badge: prop.choice(["", "urgent"], { label: "Badge", required: true, default: "" }) }, render: (p) => <Text>{`[${p.badge}]`}</Text> });
    const promo = fakeBuilder();
    registerTools(promo.builder, [Promo]);
    expect(promo.tools[0].renderer.exporters.email({ badge: "" })).toContain("[]");
    expect(promo.tools[0].validator({ values: { badge: "" }, defaultErrors: [] })).toEqual([]);
    const back = fromDesign({ body: { rows: [{ cells: [1], columns: [{ contents: [{ type: "custom", slug: "acme_promo", values: { badge: "" } }] }] }] } }, { elements: [Promo] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<Promo badge="" />');
  });

  it("refuses a link its field holds that Elements can't draw, rather than draw the prop's default in its place", async () => {
    const Cta = defineElement({ type: "acme.Cta", label: "Call to action", props: { href: prop.link({ label: "Link", default: "https://example.com/original" }) }, render: (p) => <Button href={p.href}>Go</Button> });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Cta]);
    const values = { href: { name: "web", values: { href: "https://example.com/changed", target: "popup" } } };
    const canvas = tools[0].renderer.Viewer.render(values);
    expect(canvas).toContain("Call to action: its href");
    expect(canvas).not.toContain("example.com/original");
    expect(() => tools[0].renderer.exporters.email(values)).toThrow("a link Elements draws is a URL, opened in the same tab or a new one");
    expect(tools[0].validator({ values, defaultErrors: [] })).toEqual([expect.objectContaining({ severity: "ERROR" })]);
    const read = fromDesign({ body: { rows: [{ cells: [1], columns: [{ contents: [{ type: "custom", slug: "acme_cta", values }] }] }] } }, { elements: [Cta] });
    expect(read.code).not.toContain("example.com/original");
    expect(read.report).toEqual([expect.stringContaining("which a acme.Cta doesn't take: left out")]);
    // An emptied link is still a link to nothing, and one it draws is drawn.
    expect(tools[0].renderer.exporters.email({ href: { name: "web", values: { href: "https://example.com/changed", target: "_blank" } } })).toContain("example.com/changed");
  });

  it("writes a template's own element's props as they are: its data, with none of a style's shorthand or a link's repair", async () => {
    const Panel = defineElement({
      type: "acme.Panel",
      label: "Panel",
      props: {
        insets: prop.object({ top: prop.number({ label: "Top" }), right: prop.number({ label: "Right" }), bottom: prop.number({ label: "Bottom" }), left: prop.number({ label: "Left" }) }, { label: "Insets" }),
        offers: prop.list(prop.object({ title: prop.text({ label: "Title" }), href: prop.text({ label: "Link", enum: ["", "/offers"] }) }, { label: "Offer" }), { label: "Offers", required: true }),
      },
      render: (p) => <Text>{`${p.insets?.top ?? 0} ${p.offers.map((offer) => `${offer.title}:${offer.href}`).join(",")}`}</Text>,
    });
    const values = { insets: { top: 10, right: 10, bottom: 10, left: 10 }, offers: [{ title: "No current offer", href: "" }] };
    const read = fromDesign({ body: { rows: [{ cells: [1], columns: [{ contents: [{ type: "custom", slug: "acme_panel", values }] }] }] } }, { elements: [Panel] });
    expect(read.report).toEqual([]);
    expect(read.code).toContain("insets={{ top: 10, right: 10, bottom: 10, left: 10 }}");
    expect(read.code).toContain('offers={[{ title: "No current offer", href: "" }]}');
    expect((await render(read.element)).html).toContain("10 No current offer:</p>");
  });

  it("leaves out a block with no value for a prop its element needs, and says so: the rest still renders", async () => {
    const Photo = defineElement({ type: "acme.Photo", label: "Photo", props: { photo: prop.image({ label: "Photo", required: true }) }, render: (p) => <Image src={p.photo} alt="" /> });
    const Count = defineElement({ type: "acme.Count", label: "Count", props: { n: prop.number({ label: "Count", required: true, min: 1 }) }, render: (p) => <Text>{p.n}</Text> });
    const { design } = toDesign(<Email><Heading>Hello</Heading></Email>);
    // As dragged in from the panel and not filled yet, with its counter emptied, and with a number its prop doesn't take.
    design.body.rows[0].columns[0].contents.push({ type: "custom", slug: "acme_photo", values: {} }, { type: "custom", slug: "acme_count", values: { n: "" } }, { type: "custom", slug: "acme_count", values: { n: 0 } });
    const back = fromDesign(design, { elements: [Photo, Count] });
    expect(back.report).toHaveLength(3);
    expect(back.report).toContain('rows[0].columns[0].contents[1]: the custom tool "acme_photo" has no photo, which a acme.Photo needs: left out');
    expect(back.report).toContain('rows[0].columns[0].contents[2]: the custom tool "acme_count" has no n, which a acme.Count needs: left out');
    expect(back.report.filter((line) => line.startsWith("rows[0].columns[0].contents[3]: "))).toEqual([expect.stringMatching(/the custom tool "acme_count" has its n 0 \(.+\), which a acme\.Count doesn't take: left out$/)]);
    expect(back.code).not.toContain("acme.");
    expect((await render(back.element)).html).toContain(">Hello</h");
  });

  it("leaves out a block of an element placed where a Section goes, and says so", async () => {
    const { design } = toDesign(<Email><Heading>Hello</Heading></Email>);
    design.body.rows[0].columns[0].contents.push({ type: "custom", slug: "acme_hero", values: { title: "Launch" } });
    const back = fromDesign(design, { elements: [Hero] });
    expect(back.report).toEqual(['rows[0].columns[0].contents[1]: the custom tool "acme_hero" is a acme.Hero\'s, which goes where a Section does, not in a column: left out']);
    expect(back.code).not.toContain("acme.Hero");
    expect((await render(back.element)).html).toContain(">Hello</h");
  });

  it("keeps an image's width where its height isn't known", async () => {
    const Photo = defineElement({ type: "acme.Photo", label: "Photo", props: { photo: prop.image({ label: "Photo", required: true }) }, render: (p) => <Image src={p.photo} alt="" /> });
    const narrow = <Email><Photo photo={{ src: "https://example.com/p.png", width: 120 }} /></Email>;
    const { design } = toDesign(narrow, { customTools: true });
    expect(blocks(design)[0].values.photo).toEqual({ url: "https://example.com/p.png", width: 120 });
    const back = fromDesign(design, { elements: [Photo] });
    expect(back.report).toEqual([]);
    expect((await render(back.element)).html).toBe((await render(narrow)).html);
  });

  it("reads a link its user emptied, where the prop has one by default, as a link to nothing: not its default again", async () => {
    const { design } = toDesign(<Email><ProductCard name="Mug" /></Email>, { customTools: true });
    blocks(design)[0].values.href = { name: "web", values: { href: "", target: "_blank" } };
    const back = fromDesign(design, { elements: [ProductCard] });
    expect(back.report).toEqual([]);
    expect((await render(back.element)).html).not.toContain("https://example.com");
    // A template's own link to nothing stays one.
    const none = <Email><ProductCard name="Mug" href={{ href: "" }} /></Email>;
    expect((await render(fromDesign(toDesign(none, { customTools: true }).design, { elements: [ProductCard] }).element)).html).toBe((await render(none)).html);
    expect((await render(none)).html).not.toContain("https://example.com");
  });

  it("reads what each kind's field keeps: a number that isn't whole and a length with a unit as text, a font weight as a dropdown's", async () => {
    const { design } = toDesign(<Email><Kinds /></Email>, { customTools: true });
    expect(blocks(design)[0].values).toMatchObject({ ratio: "0.5", offset: 0, width: "50%", gap: 8, weight: "400" });
    Object.assign(blocks(design)[0].values, { ratio: "0.25", offset: "-3", width: "120", gap: "16", weight: "700" });
    const back = fromDesign(design, { elements: [Kinds] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain("<Kinds ratio={0.25} offset={-3} width={120} gap={16} weight={700} />");
    expect((await render(back.element)).text).toContain("0.25 -3 120 16");
  });

  it("leaves out a block whose element can't render the values it has together, and says why, as the builder's canvas, audit and export do", () => {
    const Stock = defineElement({
      type: "acme.Stock",
      label: "Stock",
      props: { available: prop.number({ label: "Available", integer: true, min: 0, default: 10 }), reserved: prop.number({ label: "Reserved", integer: true, min: 0, default: 0 }) },
      render: (p) => {
        if (p.reserved > p.available) throw new Error(`reserved (${p.reserved}) is more than available (${p.available})`);
        return <Text>{`${p.available - p.reserved} left`}</Text>;
      },
    });
    const { design } = toDesign(<Email><Stock available={10} reserved={2} /><Text>After</Text></Email>, { customTools: true });
    const content = blocks(design).find((one) => one.type === "custom")!;
    content.values.reserved = 12;
    const back = fromDesign(design, { elements: [Stock] });
    expect(back.report.join("\n")).toContain(`the custom tool "acme_stock" can't be drawn with its values (`);
    expect(back.report.join("\n")).toContain("reserved (12) is more than available (10)");
    expect(back.code).not.toContain("<Stock");
    expect(back.code).toContain("After");
  });

  it("checks a block under the root the design is read as: a prop a Page takes alone keeps its block in a page", () => {
    const Card = defineElement({ type: "acme.Card", label: "Card", props: { caption: prop.text({ label: "Caption", roots: ["Page", "Document"] }) }, render: (p) => <Text>{p.caption ?? "Card"}</Text> });
    const { design } = toDesign(<Page><Card caption="Hello" /></Page>, { customTools: true });
    const back = fromDesign(design, { displayMode: "web", elements: [Card] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain(`<Card caption="Hello" />`);
  });

  it("writes and reads a Document's own element (its roots) as its tool's block in a document, and leaves it out where the design is read as another root", () => {
    const Line = defineElement({ type: "acme.InvoiceLine", label: "Invoice line", roots: ["Document"], props: { item: prop.text({ label: "Item", default: "Mug" }) }, render: (p) => <Text>{p.item}</Text> });
    const { design, report } = toDesign(<Document><Line item="Cup" /></Document>, { customTools: true });
    expect(report).toEqual([]);
    expect(blocks(design).map((content) => content.slug)).toEqual(["acme_invoice_line"]);
    const back = fromDesign(design, { displayMode: "document", elements: [Line] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain(`<InvoiceLine item="Cup" />`);
    const email = fromDesign(design, { displayMode: "email", elements: [Line] });
    expect(email.report.join("\n")).toContain(`the custom tool "acme_invoice_line" can't be drawn with its values (A acme.InvoiceLine goes in a Document, not in an Email): left out`);
    expect(email.code).not.toContain("<InvoiceLine");
  });

  it("leaves out a block whose element draws what can't be where the block is placed: a page break in its padding's Column", async () => {
    const Chapter = defineElement({ type: "acme.Chapter", label: "Chapter", props: { title: prop.text({ label: "Title", default: "One" }), newPage: prop.boolean({ label: "New page", default: false }) }, render: (p) => (p.newPage ? <PageBreak /> : <Heading>{p.title}</Heading>) });
    const { design } = toDesign(<Document><Chapter title="One" /><Text>After</Text></Document>, { customTools: true });
    const content = blocks(design).find((one) => one.type === "custom")!;
    // Given padding in the builder: in the template it's in a Column, where no page break goes.
    content.values.newPage = true;
    content.values.containerPadding = "10px";
    const back = fromDesign(design, { displayMode: "document", elements: [Chapter] });
    expect(back.report.join("\n")).toContain(`the custom tool "acme_chapter" can't be drawn with its values (`);
    expect(back.code).not.toContain("<Chapter");
    // What's left renders.
    expect((await render(back.element)).html).toContain("After");
  });

  it("reads a saved number as it's written in decimal, as its field does: \"0x10\" isn't one", () => {
    const Count = defineElement({ type: "acme.Count", label: "Count", props: { price: prop.number({ label: "Price", min: 0, default: 1.5 }) }, render: (p) => <Text>{String(p.price)}</Text> });
    const { design } = toDesign(<Email><Count price={2.5} /></Email>, { customTools: true });
    blocks(design)[0].values.price = "0x10";
    const back = fromDesign(design, { elements: [Count] });
    expect(back.report.join("\n")).toContain(`its price "0x10"`);
    expect(back.code).not.toContain("<Count");
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Count]);
    expect(() => tools[0].renderer.exporters.email({ price: "0x10" })).toThrow(`its price "0x10" isn't one it takes`);
  });

  it("refuses two elements that are one tool", () => {
    const One = defineElement({ type: "x.Y1Zed", label: "One", props: {}, render: () => <Text>1</Text> });
    const Two = defineElement({ type: "x-y1.Zed", label: "Two", props: {}, render: () => <Text>2</Text> });
    expect(() => fromDesign({ body: { rows: [] } }, { elements: [One, Two] })).toThrow("x.Y1Zed and x-y1.Zed are one tool in the builder (x_y1_zed)");
  });
});

/** A builder that keeps what's registered in it, and calls a viewer's render as it is. */
function fakeBuilder() {
  const tools: Values[] = [];
  const editors: Values[] = [];
  const builder: Builder = { registerTool: (tool) => void tools.push(tool), createViewer: (viewer) => viewer, registerPropertyEditor: (editor) => void editors.push(editor), createWidget: (widget) => widget };
  return { builder, tools, editors };
}

describe("registerTools", () => {
  it("registers each element as a custom tool: its name, its label, a property for each prop the builder edits", () => {
    const { builder, tools } = fakeBuilder();
    expect(registerTools(builder, [ProductCard, Footer], { icons: { "acme.ProductCard": "fa-tag" } })).toEqual(["acme_product_card", "acme_legal_footer"]);
    const [product, footer] = tools;
    expect(product).toMatchObject({ name: "acme_product_card", label: "Product", icon: "fa-tag", supportedDisplayModes: ["web", "email", "document"], values: {} });
    expect(footer).toMatchObject({ name: "acme_legal_footer", label: "Legal footer", icon: "fa-cube", options: {} });
    const properties = product.options.acme_product_card.options;
    expect(product.options.acme_product_card.title).toBe("Product");
    expect(properties).toEqual({
      // A text: registerTools()'s own text field, registered for it.
      name: { label: "Product title", defaultValue: "Product title", widget: "elements_text__acme_product_card__name" },
      // A number that isn't whole: that text field too, keeping text.
      price: { label: "Price", defaultValue: "7.99", widget: "elements_text__acme_product_card__price" },
      // A whole number is the counter's, between the prop's own limits.
      quantity: { label: "Quantity", defaultValue: 1, widget: "counter", data: { minValue: 1, maxValue: 99 } },
      href: { label: "Button link", defaultValue: { name: "web", values: { href: "https://example.com", target: "_self" } }, widget: "link" },
      buttonColor: { label: "Button color", defaultValue: "#007bff", widget: "color_picker" },
      // No default: no value to start with, which the builder's editor shows as unset.
      photo: { label: "Photo", widget: "image" },
      badge: { label: "Badge", defaultValue: "none", widget: "dropdown", data: { options: [{ label: "none", value: "none" }, { label: "new", value: "new" }, { label: "sale", value: "sale" }] } },
      featured: { label: "Featured", defaultValue: false, widget: "toggle" },
      font: { label: "Font", widget: "font_family" },
      // A length in px is the counter's too.
      gap: { label: "Gap", defaultValue: 8, widget: "counter", data: { minValue: 0 } },
    });
  });

  it("has a field for every kind, each with what its editor takes from the prop", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Kinds]);
    expect(tools[0].options.acme_kinds.options).toEqual({
      ratio: { label: "Ratio", defaultValue: "0.5", widget: "elements_text__acme_kinds__ratio" },
      // No floor of its own: the counter's is zero, so it's given one far below.
      offset: { label: "Offset", defaultValue: 0, widget: "counter", data: { minValue: -1e9 } },
      width: { label: "Width", defaultValue: "50%", widget: "elements_text__acme_kinds__width" },
      gap: { label: "Gap", defaultValue: 8, widget: "counter", data: { minValue: 4 } },
      weight: { label: "Weight", defaultValue: "400", widget: "dropdown", data: { options: [100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => ({ label: String(weight), value: String(weight) })) } },
    });
  });

  it("has a field for each of prop's helpers: one added later fails here till it's given one", () => {
    // One prop of each helper. A helper this doesn't know is new: give it a field in editorOf(), then a line here.
    const made: Record<string, () => unknown> = {
      text: () => prop.text({ label: "Text" }),
      number: () => prop.number({ label: "Number" }),
      length: () => prop.length({ label: "Length" }),
      color: () => prop.color({ label: "Color" }),
      image: () => prop.image({ label: "Image" }),
      link: () => prop.link({ label: "Link" }),
      boolean: () => prop.boolean({ label: "Boolean" }),
      fontFamily: () => prop.fontFamily({ label: "Font" }),
      fontWeight: () => prop.fontWeight({ label: "Weight" }),
      date: () => prop.date({ label: "Date" }),
      choice: () => prop.choice(["a", "b"], { label: "Choice" }),
      list: () => prop.list(prop.text({ label: "Item" }), { label: "List" }),
      object: () => prop.object({ name: prop.text({ label: "Name" }) }, { label: "Object" }),
      blocks: () => prop.blocks({ note: prop.object({ text: prop.text({ label: "Text" }) }, { label: "Note" }) }, { label: "Blocks" }),
    };
    expect(Object.keys(prop).filter((helper) => !made[helper])).toEqual([]);
    const Every = defineElement({ type: "acme.Every", label: "Every", props: Object.fromEntries(Object.entries(made).map(([helper, make]) => [helper, make()])) as any, render: () => <Text>Every</Text> });
    const { builder, tools, editors } = fakeBuilder();
    registerTools(builder, [Every]);
    expect(Object.keys(tools[0].options.acme_every.options).sort()).toEqual(Object.keys(made).sort());
    // Each field registerTools() draws itself gives the builder's AI its value's schema.
    expect(editors.filter((editor) => !editor.Widget.schema).map((editor) => editor.name)).toEqual([]);
  });

  it("edits a prop with the builder's editor for its kind, given what its kind gives it and nothing else", () => {
    const Order = defineElement({
      type: "acme.Order",
      label: "Order",
      props: {
        steps: prop.number({ label: "Steps", min: 0, max: 100, integer: true, default: 10 }),
        side: prop.choice(["left", "center", "right"], { label: "Side", default: "left" }),
        due: prop.text({ label: "Due" }),
        accent: prop.color({ label: "Accent", default: "#ff0000" }),
        ink: prop.color({ label: "Ink", transparency: false, default: "#000000" }),
      },
      render: (p) => <Text>{`${p.steps} ${p.side} ${p.due ?? ""}`}</Text>,
    });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Order]);
    const properties = tools[0].options.acme_order.options;
    // The counter's limits are the prop's, and nothing widens them.
    expect(properties.steps).toEqual({ label: "Steps", defaultValue: 10, widget: "counter", data: { minValue: 0, maxValue: 100 } });
    // A choice is the builder's dropdown, with its values, and a text registerTools()'s own text field.
    expect(properties.side).toEqual({ label: "Side", defaultValue: "left", widget: "dropdown", data: { options: ["left", "center", "right"].map((value) => ({ label: value, value })) } });
    expect(properties.due).toEqual({ label: "Due", defaultValue: "", widget: "elements_text__acme_order__due" });
    // A color that can't be see-through tells the builder's picker so: it has no opacity to set there.
    expect(properties.accent).toEqual({ label: "Accent", defaultValue: "#ff0000", widget: "color_picker" });
    expect(properties.ink).toEqual({ label: "Ink", defaultValue: "#000000", widget: "color_picker", data: { allowTransparent: false } });
    // The builder's own controls are its kinds': none is given in editors, which are for properties of your own.
    expect(() => registerTools(builder, [Order], { editors: { counter: { render: () => "" } } })).toThrow(
      "[Elements] registerTools: editors has counter, which is the property of no prop of the elements given (none of their props is a property of your own)"
    );
  });

  it("registers a property's control given as it's written, for each prop that's the property, with the prop's value as the prop has it", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number, options: { symbol: prop.text({ enum: ["$", "€", "£"], default: "$" }) } });
    const Price = defineElement({ type: "acme.Price", label: "Price", props: { price: currency({ label: "Price", min: 0, default: 7.5, symbol: "€" }) }, render: (p) => <Text>{p.price.toFixed(2)}</Text> });
    const { builder, tools, editors } = fakeBuilder();
    const given: unknown[] = [];
    registerTools(builder, [Price], {
      editors: {
        [currency.name]: {
          render: (value, _update, options) => `<label>${options.label}</label><input value="${given.push([value, options]) && value}">`,
          mount: (_node, _value, update) => update(9.25),
        },
      },
    });
    expect(tools[0].options.acme_price.options.price).toEqual({ label: "Price", defaultValue: "7.5", widget: "acme_currency__acme_price__price", data: { label: "Price", symbol: "€" } });
    expect(editors.map((editor) => editor.name)).toEqual(["acme_currency__acme_price__price"]);
    // The builder's AI fills it by what the builder keeps, which for a number that isn't whole is text.
    expect(editors[0].Widget.schema).toEqual({ type: "string" });
    // The builder keeps a number that isn't whole as text: the editor is given the number, and what it gives back is kept as text again.
    const kept: unknown[] = [];
    expect(editors[0].Widget.render("7.5", (value: unknown) => kept.push(value))).toMatch(/^<label>Price<\/label><input value="7\.5"><div data-elements-field-error /);
    expect(given).toEqual([[7.5, { label: "Price", symbol: "€" }]]);
    editors[0].Widget.mount(null, "7.5", (value: unknown) => kept.push(value));
    expect(kept).toEqual(["9.25"]);
    // And the block is drawn from what's kept.
    expect(tools[0].renderer.Viewer.render({ price: "9.25" })).toContain(">9.25</p>");
  });

  it("gives the builder's AI the schema of what's kept for a property's control: the prop's own where it keeps the value as it is", () => {
    const stars = defineProperty({ name: "acme.stars", base: prop.number, options: {} });
    const Rating = defineElement({ type: "acme.Rating", label: "Rating", props: { stars: stars({ label: "Stars", min: 1, max: 5, integer: true, default: 5 }) }, render: (p) => <Text>{String(p.stars)}</Text> });
    const { builder, editors } = fakeBuilder();
    registerTools(builder, [Rating], { editors: { [stars.name]: { render: () => "" } } });
    expect(editors[0].Widget.schema).toEqual(Rating.definition.props.stars.kind.jsonSchema());
    // A choice the builder keeps as its text: the choices, as text.
    const plan = defineProperty({ name: "acme.plan", base: prop.text, options: {} });
    const Plan = defineElement({ type: "acme.Plan", label: "Plan", props: { plan: plan({ label: "Plan", enum: ["monthly", "annual"], default: "monthly" }) }, render: (p) => <Text>{p.plan}</Text> });
    const other = fakeBuilder();
    registerTools(other.builder, [Plan], { editors: { [plan.name]: { render: () => "" } } });
    expect(other.editors[0].Widget.schema).toEqual({ type: "string", enum: ["monthly", "annual"] });
  });

  it("gives a property a template defines its control: the prop's own value, and the property's options as the prop has them", () => {
    const currency = defineProperty({
      name: "acme.currency",
      base: prop.number,
      options: { symbol: prop.text({ enum: ["$", "€", "£"], default: "€" }), decimals: prop.number({ integer: true, min: 0, default: 2 }), note: prop.text({}) },
    });
    const Price = defineElement({
      type: "acme.Price",
      label: "Price",
      props: {
        price: currency({ label: "Price", min: 0, default: 7.5, symbol: "$" }),
        was: currency({ label: "Was", min: 0, default: 9 }),
      },
      render: (p) => <Text>{p.price.toFixed(2)}</Text>,
    });
    const { builder, tools, editors } = fakeBuilder();
    const given: unknown[] = [];
    // Typed as the property's: the value a number, an option with a default always there, one with none maybe.
    const field: EditorWidget<typeof currency> = {
      render: (value, _update, { label, symbol, decimals, note }) => {
        expectTypeOf(value).toEqualTypeOf<number | undefined>();
        expectTypeOf(symbol).toEqualTypeOf<"$" | "€" | "£">();
        expectTypeOf(decimals).toEqualTypeOf<number>();
        expectTypeOf(note).toEqualTypeOf<string | undefined>();
        return `<label>${label}</label>${symbol}<input value="${given.push([value, symbol, decimals]) && (value ?? 0).toFixed(decimals)}">`;
      },
      mount: (_node, _value, update) => update(9.25),
    };
    registerTools(builder, [Price], { editors: { [currency.name]: field } });
    const properties = tools[0].options.acme_price.options;
    // Each prop's own options over the property's defaults, and the defaults where the prop gives none.
    expect(properties.price).toEqual({ label: "Price", defaultValue: "7.5", widget: "acme_currency__acme_price__price", data: { label: "Price", symbol: "$", decimals: 2 } });
    expect(properties.was).toEqual({ label: "Was", defaultValue: "9", widget: "acme_currency__acme_price__was", data: { label: "Was", symbol: "€", decimals: 2 } });
    const kept: unknown[] = [];
    expect(editors[0].Widget.render("7.5", (value: unknown) => kept.push(value))).toMatch(/^<label>Price<\/label>\$<input value="7\.50"><div data-elements-field-error /);
    expect(given).toEqual([[7.5, "$", 2]]);
    editors[0].Widget.mount(null, "7.5", (value: unknown) => kept.push(value));
    expect(kept).toEqual(["9.25"]);
    // The design keeps the value as its kind's editor does, whatever edits it.
    const [block] = blocks(toDesign(<Email><Price price={12.5} /></Email>, { customTools: true }).design);
    expect(block.values).toMatchObject({ price: "12.5", was: "9" });
    expect(fromDesign({ body: { rows: [{ cells: [1], columns: [{ contents: [block] }] }] } }, { elements: [Price] }).code).toContain("<Price price={12.5} />");
  });

  it("edits a prop with its kind's editor where its property's control isn't given, with none of the property's options", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number, options: { symbol: prop.text({ default: "€" }) } });
    const Stock = defineElement({ type: "acme.Stock", label: "Stock", props: { units: currency({ label: "Units", min: 1, integer: true, default: 3, symbol: "$" }) }, render: (p) => <Text>{p.units}</Text> });
    const { builder, tools, editors } = fakeBuilder();
    registerTools(builder, [Stock]);
    expect(tools[0].options.acme_stock.options.units).toEqual({ label: "Units", defaultValue: 3, widget: "counter", data: { minValue: 1 } });
    // One registered in the builder already, by the property's name: its options as the prop has them, the value as the builder keeps it.
    registerTools(builder, [Stock], { editors: { "acme.currency": true } });
    expect(tools[1].options.acme_stock.options.units).toEqual({ label: "Units", defaultValue: 3, widget: "acme.currency", data: { label: "Units", symbol: "$" } });
    expect(editors).toEqual([]);
  });

  it("refuses an editor given as it's written in a builder that can't register one", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number });
    const Price = defineElement({ type: "acme.Price", label: "Price", props: { price: currency({ label: "Price", default: 1 }) }, render: (p) => <Text>{p.price}</Text> });
    const bare = { registerTool: () => {}, createViewer: (viewer: unknown) => viewer } as unknown as Builder;
    expect(() => registerTools(bare, [Price], { editors: { "acme.currency": { render: () => "" } } })).toThrow("editors gives acme.currency as it's written, which takes a builder with registerPropertyEditor() and createWidget()");
    expect(() => registerTools(bare, [Price], { editors: { "acme.currency": true } })).not.toThrow();
    // A text is edited with a field of registerTools()' own, which such a builder can't register either.
    expect(() => registerTools(bare, [Banner])).toThrow("[Elements] registerTools: acme.Banner's title is edited with a text field of its own, which takes a builder with registerPropertyEditor() and createWidget()");
  });

  it("refuses an editor given for no prop of the elements given: a name mistyped would leave its prop with its kind's editor, without a word", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number });
    const Price = defineElement({ type: "acme.Price", label: "Price", props: { price: currency({ label: "Price", default: 1 }), due: prop.text({ label: "Due" }) }, render: (p) => <Text>{p.price}</Text> });
    const { builder, tools } = fakeBuilder();
    expect(() => registerTools(builder, [Price], { editors: { "acme.curency": { render: () => "" } } })).toThrow(
      "[Elements] registerTools: editors has acme.curency, which is the property of no prop of the elements given (their props are acme.currency)"
    );
    expect(() => registerTools(builder, [Price], { editors: { "acme.curency": true } })).toThrow("editors has acme.curency");
    expect(() => registerTools(builder, [Footer], { editors: { "acme.currency": true } })).toThrow("editors has acme.currency, which is the property of no prop of the elements given (none of their props is a property of your own)");
    // Nothing is registered where one is refused.
    expect(tools).toEqual([]);
    expect(() => registerTools(builder, [Price, Footer], { editors: { "acme.currency": true } })).not.toThrow();
  });

  it("draws the element from the tool's values, as an Email's markup in the canvas and for email, a Page's for web", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [ProductCard]);
    const { Viewer, exporters } = tools[0].renderer;
    const values = { name: "Linen Throw", price: "89", quantity: "2", buttonColor: "#0f766e", href: { url: "https://example.com/throw", target: "_blank" }, containerPadding: "10px" };
    const canvas = Viewer.render(values, { contentWidth: "600px" }, { columnIndex: 0, rowCells: [1] });
    expect(canvas).toContain("Linen Throw");
    expect(canvas).toContain("2 × $89.00");
    expect(canvas).toContain('href="https://example.com/throw"');
    expect(canvas).toContain("#0f766e");
    expect(canvas).toContain("<table");
    expect(exporters.email(values)).toBe(canvas);
    const web = exporters.web(values);
    expect(web).toContain("Linen Throw");
    expect(web).not.toContain("<table");
  });

  it("draws the ids inside the element as its block's id makes them, so a link to one finds it", async () => {
    const Faq = defineElement({
      type: "acme.Faq",
      label: "FAQ",
      props: { question: prop.text({ label: "Question", default: "How long is delivery?" }) },
      render: (p) => (
        <Column>
          <Button href="#faq-answer">{p.question}</Button>
          <Text id="answer">Two days.</Text>
        </Column>
      ),
    });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Faq]);
    const { Viewer, exporters } = tools[0].renderer;
    const template = <Email><Faq id="faq" /></Email>;
    const [block] = blocks(toDesign(template, { customTools: true }).design);
    expect(block.values._meta.htmlID).toBe("faq");
    const ids = (html: string) => [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    // As the template draws them, in the canvas and in what the builder exports.
    expect(ids((await render(template)).html)).toEqual(["faq-answer"]);
    expect(ids(Viewer.render(block.values))).toEqual(["faq-answer"]);
    expect(ids(exporters.email(block.values))).toEqual(["faq-answer"]);
    expect(ids(exporters.web(block.values))).toEqual(["faq-answer"]);
    // A block the builder numbered itself has no id of its author's, as fromDesign() reads it: none inside it either.
    const numbered = { ...block.values, _meta: { htmlID: "u_content_custom_acme_faq_2", htmlClassNames: "u_content_custom_acme_faq" } };
    expect(ids(exporters.email(numbered))).toEqual([]);
    // One its author gave that a template doesn't take is left out, as fromDesign() leaves it out: the block is drawn.
    const dotted = { ...block.values, _meta: { htmlID: "faq.answer", htmlClassNames: "u_content_custom_acme_faq" } };
    expect(fromDesign({ body: { rows: [{ cells: [1], columns: [{ contents: [{ ...block, values: dotted }] }] }] } }, { elements: [Faq] }).code).toContain("<Faq />");
    for (const drawn of [exporters.email(dotted), exporters.web(dotted), Viewer.render(dotted)]) {
      expect(drawn).toContain("How long is delivery?");
      expect(ids(drawn)).toEqual([]);
    }
  });

  it("draws a Page's markup in the canvas of a builder in web mode", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [ProductCard], { displayMode: "web" });
    expect(tools[0].renderer.Viewer.render({ name: "Mug" })).not.toContain("<table");
  });

  it("draws a block in a document as a page's, in the canvas and in what the builder exports and prints", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [ProductCard], { displayMode: "document" });
    const [tool] = tools;
    const values = { name: "Mug", price: "7.99" };
    const drawn = tool.renderer.Viewer.render(values);
    expect(drawn).toContain("Mug");
    expect(drawn).not.toContain("<table");
    // A page's markup, with none of a Document's own page size or margins: the builder's are the document's.
    expect(tool.renderer.exporters.document(values)).toBe(tool.renderer.exporters.web(values));
    expect(tool.renderer.exporters.document(values)).not.toContain("@page");
  });

  it("offers a tool in the display modes of the roots its element goes in, and refuses one that goes only in a Canvas", () => {
    const modes = (roots?: readonly RootName[]) => {
      const Moded = defineElement({ type: "acme.Moded", label: "Moded", props: {}, ...(roots ? { roots } : {}), render: () => <Text>m</Text> });
      const { builder, tools } = fakeBuilder();
      registerTools(builder, [Moded]);
      return tools[0].supportedDisplayModes;
    };
    expect(modes()).toEqual(["web", "email", "document"]);
    expect(modes(["Email"])).toEqual(["email"]);
    expect(modes(["Page", "Email"])).toEqual(["web", "email"]);
    expect(modes(["Document", "Canvas"])).toEqual(["document"]);
    const Social = defineElement({ type: "acme.SocialCard", label: "Social card", roots: ["Canvas"], props: {}, render: () => <Text>s</Text> });
    expect(() => registerTools(fakeBuilder().builder, [Social])).toThrow("registerTools: acme.SocialCard goes only in a Canvas, which the builder has no display mode for: it can't be a tool");
  });

  it("draws a Document's own element in a document, its roots and its props' checked as a Document's: in the canvas, the export and the audit", () => {
    const Line = defineElement({
      type: "acme.InvoiceLine",
      label: "Invoice line",
      roots: ["Document"],
      props: { item: prop.text({ label: "Item", default: "Mug" }), note: prop.text({ label: "Note", roots: ["Document"] }) },
      render: (p) => <Text>{p.note ? `${p.item}: ${p.note}` : p.item}</Text>,
    });
    // Inside another Document-only element, it's checked as a Document's too.
    const Lines = defineElement({ type: "acme.InvoiceLines", label: "Invoice lines", roots: ["Document"], props: {}, render: () => <Column><Line item="Cup" note="Red" /></Column> });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Line, Lines], { displayMode: "document" });
    const [line, lines] = tools;
    expect(line.supportedDisplayModes).toEqual(["document"]);
    const values = { item: "Mug", note: "Blue" };
    expect(line.renderer.Viewer.render(values)).toContain("Mug: Blue");
    expect(line.renderer.exporters.document(values)).toContain("Mug: Blue");
    expect(line.renderer.exporters.document(values)).not.toContain("@page");
    expect(line.validator({ values })).toEqual([]);
    expect(lines.renderer.Viewer.render({})).toContain("Cup: Red");
    expect(lines.validator({ values: {} })).toEqual([]);
  });

  it("checks a block in a document as a Document's alone: an element for pages alone isn't drawn there, as fromDesign() wouldn't read it", () => {
    const PageOnly = defineElement({ type: "acme.PageOnly", label: "Page only", roots: ["Page"], props: {}, render: () => <Text>p</Text> });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [PageOnly], { displayMode: "document" });
    const [tool] = tools;
    expect(tool.renderer.Viewer.render({})).toContain("A acme.PageOnly goes in a Page, not in a Document");
    expect(() => tool.renderer.exporters.document({})).toThrow("A acme.PageOnly goes in a Page, not in a Document");
    expect(tool.validator({ values: {} })).toMatchObject([{ id: "HYPER_ELEMENTS_TOOL_VALUES", description: "A acme.PageOnly goes in a Page, not in a Document" }]);
    // In a page, it's drawn.
    expect(tool.renderer.exporters.web({})).toContain(">p<");
    // A built-in's roots are its own root's still: a page number has no page to be the number of where a block is drawn as a page's.
    const Numbered = defineElement({ type: "acme.Numbered", label: "Numbered", roots: ["Document"], props: {}, render: () => <Text>Page <PageNumber /></Text> });
    const numbered = fakeBuilder();
    registerTools(numbered.builder, [Numbered], { displayMode: "document" });
    expect(numbered.tools[0].renderer.Viewer.render({})).toContain("A PageNumber is a page's number in a Document; this Page has no pages");
  });

  it("says a prop given where its roots don't take it, in a page's canvas", () => {
    const Card = defineElement({ type: "acme.Card", label: "Card", props: { note: prop.text({ label: "Note", roots: ["Document"] }) }, render: (p) => <Text>{p.note ?? "card"}</Text> });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Card], { displayMode: "web" });
    expect(tools[0].renderer.Viewer.render({ note: "x" })).toContain(`A acme.Card's &#34;note&#34; is for a Document, not a Page`);
    expect(tools[0].renderer.Viewer.render({})).toContain("card");
  });

  it("draws at its column's share of the content width", () => {
    const { builder, tools } = fakeBuilder();
    const Wide = defineElement({ type: "acme.Wide", label: "Wide", props: { photo: prop.image({ label: "Photo", required: true }) }, render: (p) => <Image src={p.photo} alt="" /> });
    registerTools(builder, [Wide]);
    const values = { photo: { url: "https://example.com/wide.png", width: 1200, height: 600 }, containerPadding: "0px" };
    const full = tools[0].renderer.Viewer.render(values, { contentWidth: "600px" }, { columnIndex: 0, rowCells: [1] });
    const half = tools[0].renderer.Viewer.render(values, { contentWidth: "600px" }, { columnIndex: 1, rowCells: [1, 1] });
    expect(full).toContain('width="600"');
    expect(half).toContain('width="300"');
  });

  it("draws in a column with less room than a root can be at the room it has, not wider", () => {
    const { builder, tools } = fakeBuilder();
    // A photo, which fills its room, over a Row, whose columns are one under the other where they don't fit in it.
    const Pair = defineElement({
      type: "acme.Pair",
      label: "Pair",
      props: {},
      render: () => (
        <Column>
          <Image src={{ src: "https://example.com/wide.png", width: 1200, height: 600 }} alt="" />
          <Row><Column><Text>Left</Text></Column><Column><Text>Right</Text></Column></Row>
        </Column>
      ),
    });
    registerTools(builder, [Pair]);
    const { Viewer, exporters } = tools[0].renderer;
    const widths = (html: string) => [...new Set(html.match(/max-width:\d+px/g))];
    // One of three columns of a 600px email, with the 10px the builder puts around a block: 180px.
    const third = Viewer.render({ containerPadding: "10px" }, { contentWidth: "600px" }, { columnIndex: 0, rowCells: [1, 1, 1] });
    expect(third).toContain('width="180"');
    expect(widths(third)).toEqual(["max-width:200px", "max-width:180px", "max-width:90px"]);
    expect(exporters.email({ containerPadding: "10px" }, 0, 0, [1, 1, 1], { contentWidth: "600px" })).toBe(third);
    // One of four, with nothing around it: 150px. And of three in the builder's own 500px, a share that isn't whole.
    expect(Viewer.render({ containerPadding: "0px" }, { contentWidth: "600px" }, { columnIndex: 3, rowCells: [1, 1, 1, 1] })).toContain('width="150"');
    expect(Viewer.render({ containerPadding: "10px" }, { contentWidth: "500px" }, { columnIndex: 1, rowCells: [1, 1, 1] })).toContain('width="146"');
    // A page's, the same.
    expect(exporters.web({ containerPadding: "10px" }, 0, 0, [1, 1, 1], { contentWidth: "600px" })).toContain('width="180"');
  });

  it("draws a block at the width its column leaves it: less the column's own padding and border, where the builder gives them", () => {
    const { builder, tools } = fakeBuilder();
    const Pair = defineElement({ type: "acme.Pair", label: "Pair", props: {}, render: () => <Row><Column><Text>Left</Text></Column><Column><Text>Right</Text></Column></Row> });
    registerTools(builder, [Pair]);
    const { Viewer, exporters } = tools[0].renderer;
    // A Row's gap and a Column's padding and border are the builder's columns' own.
    const template = (
      <Email width={600}>
        <Row style={{ gap: 18 }}>
          <Column style={{ padding: 16, border: { width: 1, style: "solid", color: "#cccccc" } }}><Pair /></Column>
          <Column><Pair /></Column>
        </Row>
      </Email>
    );
    const outer = (html: string) => Number(/max-width:(\d+)px/.exec(html)?.[1]);
    // What the template itself gives each: as the same design's HTML blocks are drawn.
    const drawn = toDesign(template).design.body.rows[0].columns.map((column: any) => outer(column.contents[0].values.html));
    expect(drawn).toEqual([274, 274]);
    const { design } = toDesign(template, { customTools: true });
    const row = design.body.rows[0] as any;
    expect(row.columns.map((column: any) => [column.values.padding, column.values.border.borderLeftWidth])).toEqual([["16px 25px 16px 16px", "1px"], ["0px 0px 0px 9px", undefined]]);
    // What the builder exports is given its column's values (its last argument).
    const exported = row.columns.map((column: any, index: number) =>
      exporters.email(column.contents[0].values, 0, index, row.cells, design.body.values, row.values, {}, { index: 0, columnIndex: index, columnValues: column.values, rowCells: row.cells, rowValues: row.values, bodyValues: design.body.values })
    );
    expect(exported.map(outer)).toEqual(drawn);
    // Its Row's columns are half of that each, so they fit side by side.
    expect(exported[1]).toContain("max-width:137px");
    expect(exported[1]).not.toContain("max-width:150px");
    // A canvas is drawn the same from its column's values, where a builder gives it them.
    const canvas = row.columns.map((column: any, index: number) => Viewer.render(column.contents[0].values, design.body.values, { columnIndex: index, rowCells: row.cells, columnValues: column.values }));
    expect(canvas).toEqual(exported);
  });

  it("starts a block's phone styles where the email's do, whatever its column's width", async () => {
    const { builder, tools } = fakeBuilder();
    const Note = defineElement({ type: "acme.Note", label: "Note", props: {}, render: () => <Column><Text style={{ fontSize: 20, mobile: { fontSize: 14 } }}>Note</Text><Text hidden={{ desktop: true }}>On a phone</Text></Column> });
    registerTools(builder, [Note]);
    const { Viewer, exporters } = tools[0].renderer;
    const queries = (html: string) => [...new Set(html.match(/@media \([^)]*\)/g))];
    // The template's own, for its phone styles and for what it hides: an email is on a phone below its width and a margin.
    const template = queries((await render(<Email width={600}><Note /></Email>)).html);
    expect(template).toEqual(["@media (max-width: 620px)"]);
    const half = Viewer.render({}, { contentWidth: "600px" }, { columnIndex: 1, rowCells: [1, 1] });
    expect(queries(Viewer.render({}, { contentWidth: "600px" }, { columnIndex: 0, rowCells: [1] }))).toEqual(template);
    expect(queries(half)).toEqual(template);
    expect(queries(exporters.email({}, 0, 0, [1, 2], { contentWidth: "600px" }))).toEqual(template);
    // Its width is still its column's.
    expect(half).toContain("max-width:280px");
    // Another email's are its own.
    expect(queries(Viewer.render({}, { contentWidth: "700px" }, { columnIndex: 0, rowCells: [1, 1] }))).toEqual(["@media (max-width: 720px)"]);
  });

  it("draws a block dragged in with a prop its element needs at its default", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Banner]);
    const start = { title: tools[0].options.acme_banner.options.title.defaultValue };
    expect(start).toEqual({ title: "Welcome" });
    expect(tools[0].renderer.Viewer.render(start)).toContain(">Welcome</p>");
    expect(tools[0].renderer.exporters.email(start)).toContain(">Welcome</p>");
  });

  it("registers no tool for an element placed where a Section goes, which is no block in a column", () => {
    const { builder, tools } = fakeBuilder();
    expect(registerTools(builder, [Hero, Footer])).toEqual(["acme_legal_footer"]);
    expect(tools.map((tool) => tool.name)).toEqual(["acme_legal_footer"]);
  });

  it("draws no block saved with a value its prop doesn't take: the canvas says which, its export fails saying which, and its audit has the error", async () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [ProductCard]);
    const [tool] = tools;
    // A price below its min, in the text field a number that isn't whole has; a color that isn't one.
    const values = { name: "Mug", price: "-5", buttonColor: "greenish" };
    const canvas = tool.renderer.Viewer.render(values);
    expect(canvas).toContain("Product: its price &#34;-5&#34; isn't one it takes (");
    expect(canvas).toContain("its buttonColor &#34;greenish&#34; isn't one it takes (");
    // Not drawn with the props' defaults instead.
    expect(canvas).not.toContain("#007bff");
    expect(canvas).not.toContain("$7.99");
    // Its export fails, saying which block and which value: not an export that looks whole without the block.
    expect(() => tool.renderer.exporters.email(values)).toThrow(`[Elements] Product (acme.ProductCard) can't be drawn: its price "-5" isn't one it takes (`);
    expect(() => tool.renderer.exporters.web(values)).toThrow(`its buttonColor "greenish" isn't one it takes (`);
    const builtIn = { id: "BUILT_IN", severity: "WARNING" };
    expect(await tool.validator({ values, defaultErrors: [builtIn] })).toEqual([
      { id: "HYPER_ELEMENTS_TOOL_VALUES", icon: "fa-exclamation-triangle", severity: "ERROR", title: "Product can't be drawn", description: expect.stringContaining('its price "-5" isn\'t one it takes (') },
      builtIn,
    ]);
    // A value it takes is drawn, and has no error.
    expect(tool.renderer.Viewer.render({ ...values, price: "129.50", buttonColor: "#16a34a" })).toContain("$129.5");
    expect(await tool.validator({ values: { ...values, price: "129.50", buttonColor: "#16a34a" }, defaultErrors: [builtIn] })).toEqual([builtIn]);
  });

  it("gives a tool a text as it's typed, whatever the builder's safeHtml: \"A<B\" is drawn, exported and read back as A<B, and \"A&lt;B\" typed so is the six characters it is", async () => {
    const { builder, tools, editors } = fakeBuilder();
    const Short = defineElement({ type: "acme.Short", label: "Short", props: { text: prop.text({ label: "Text", maxLength: 3, default: "ABC" }), note: prop.text({ label: "Note" }) }, render: (p) => <Text>{`${p.text}|${p.note ?? ""}`}</Text> });
    registerTools(builder, [Short]);
    const [tool] = tools;
    // Each text is edited with registerTools()'s own field, which the builder gives no renderValue: what a tool is
    // given is what the design keeps, with safeHtml on or off (the builder's own text field gives it as HTML when on).
    expect(tool.options.acme_short.options.text.widget).toBe("elements_text__acme_short__text");
    expect(editors.map((editor) => editor.name)).toEqual(["elements_text__acme_short__text", "elements_text__acme_short__note"]);
    expect(editors.every((editor) => !("renderValue" in editor))).toBe(true);
    const design = (values: Values) => ({ body: { rows: [{ cells: [1], columns: [{ contents: [{ type: "custom", slug: "acme_short", values }] }] }] } });
    // "A<B": three characters, drawn and exported as text (escaped once), checked as three, read back as typed.
    const typed = { text: "A<B", note: "Tom & Jerry" };
    expect(tool.renderer.Viewer.render(typed)).toContain(">A&lt;B|Tom &amp; Jerry</");
    expect(tool.renderer.exporters.email(typed)).toContain(">A&lt;B|Tom &amp; Jerry</");
    expect(tool.validator({ values: typed, defaultErrors: [] })).toEqual([]);
    const read = fromDesign(design(typed), { elements: [Short] });
    expect(read.report).toEqual([]);
    expect((await render(read.element)).html).toContain("A&lt;B|Tom &amp; Jerry");
    // "A&lt;B" typed so: six characters, which a text of three doesn't take. It isn't read as "A<B": the canvas
    // says so, its export fails, its audit has the error, and fromDesign() leaves the block out, saying which.
    const literal = { text: "A&lt;B" };
    expect(tool.renderer.Viewer.render(literal)).toContain("Short: its text &#34;A&#38;lt;B&#34; isn't one it takes (is longer than 3 characters)");
    // The export's error is plain text, which the builder writes as HTML: its "&" as JSON writes it escaped.
    expect(() => tool.renderer.exporters.email(literal)).toThrow(`its text "A\\u0026lt;B" isn't one it takes (is longer than 3 characters)`);
    expect(tool.validator({ values: literal, defaultErrors: [] })).toEqual([expect.objectContaining({ severity: "ERROR", description: expect.stringContaining("longer than 3") })]);
    expect(fromDesign(design(literal), { elements: [Short] }).report).toEqual([`rows[0].columns[0].contents[0]: the custom tool "acme_short" has its text "A&lt;B" (is longer than 3 characters), which a acme.Short doesn't take: left out`]);
    // Where a text takes it, "A&lt;B" is drawn as the six characters typed, not as "A<B".
    expect(tool.renderer.Viewer.render({ note: "A&lt;B" })).toContain("|A&amp;lt;B</");
  });

  it("runs a validator given in tools after its own, its errors following", async () => {
    const { builder, tools } = fakeBuilder();
    const mine = { id: "MINE", icon: "fa-tag", severity: "WARNING", title: "Check the price", description: "Is it on sale?" };
    registerTools(builder, [ProductCard], { tools: { "acme.ProductCard": { validator: async ({ defaultErrors }: { defaultErrors: unknown[] }) => [...defaultErrors, mine] } } });
    const errors = await tools[0].validator({ values: { quantity: 500 }, defaultErrors: [{ id: "BUILT_IN" }] });
    expect(errors.map((error: Values) => error.id)).toEqual(["HYPER_ELEMENTS_TOOL_VALUES", "BUILT_IN", "MINE"]);
  });

  it("says in the canvas what stops a block from being drawn, and its export fails", () => {
    const { builder, tools } = fakeBuilder();
    const Named = defineElement({ type: "acme.Named", label: "Named", props: { name: prop.text({ label: "Name", required: true }) }, render: (p) => <Text>{p.name}</Text> });
    registerTools(builder, [Named]);
    const { Viewer, exporters } = tools[0].renderer;
    const canvas = Viewer.render({});
    expect(canvas).toContain("Named:");
    expect(canvas).toContain("name");
    expect(() => exporters.email({})).toThrow(/^\[Elements\] Named \(acme\.Named\) can't be drawn: .*name/);
    expect(() => exporters.web({})).toThrow(/^\[Elements\] Named \(acme\.Named\) can't be drawn/);
    expect(tools[0].validator({ values: {} })).toEqual([expect.objectContaining({ severity: "ERROR", title: "Named can't be drawn", description: expect.stringContaining("name") })]);
  });

  it("writes a value as text, never as markup", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [ProductCard]);
    const html = tools[0].renderer.Viewer.render({ name: '<img src=x onerror="alert(1)">' });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    // A value its prop doesn't take is said in the canvas, as text too: a script's link is no link.
    const said = tools[0].renderer.Viewer.render({ href: { url: "javascript:alert(1)" }, buttonColor: 'red" onmouseover="alert(1)', name: "<b>Mug</b>" });
    expect(said).toContain("its href {&#34;url&#34;:&#34;javascript:alert(1)&#34;} isn't one it takes");
    expect(said).toContain("its buttonColor &#34;red");
    expect(said).not.toMatch(/<a\b|href=/);
    expect(said).not.toMatch(/<[^>]*onmouseover/);
    expect(said).not.toContain("<b>");
  });

  it("takes the builder's own settings for a tool: properties that aren't props, above its own, and what registerTool() takes", () => {
    const { builder, tools } = fakeBuilder();
    const transformer = (values: Values) => values;
    registerTools(builder, [ProductCard, Footer], {
      tools: { "acme.ProductCard": { properties: { product: { label: "From the store", widget: "store_picker" } }, transformer, usageLimit: 3 } },
    });
    const [product, footer] = tools;
    expect(Object.keys(product.options.acme_product_card.options).slice(0, 2)).toEqual(["product", "name"]);
    expect(product.options.acme_product_card.options.product).toEqual({ label: "From the store", widget: "store_picker" });
    expect(product.transformer).toBe(transformer);
    expect(product.usageLimit).toBe(3);
    expect(footer.transformer).toBeUndefined();
  });

  it("refuses a setting that's what the element gives its tool, saying where it's set", () => {
    const { builder } = fakeBuilder();
    for (const setting of ["name", "label", "icon", "supportedDisplayModes", "options", "values", "renderer"]) {
      expect(() => registerTools(builder, [ProductCard], { tools: { "acme.ProductCard": { [setting]: {} } } })).toThrow(`tools sets ${setting} for acme.ProductCard, which its element gives the tool`);
    }
  });

  it("refuses an element with a prop named as one of the builder's own for a block, which toDesign() keeps an HTML block", () => {
    const Padded = defineElement({ type: "acme.Padded", label: "Padded", props: { containerPadding: prop.length({ label: "Padding", default: 24 }) }, render: (p) => <Column style={{ padding: p.containerPadding }}><Text>Padded</Text></Column> });
    const Locked = defineElement({ type: "acme.Locked", label: "Locked", props: { locked: prop.boolean({ label: "Locked", default: false }) }, render: (p) => <Text>{p.locked ? "locked" : "open"}</Text> });
    const { builder } = fakeBuilder();
    expect(() => registerTools(builder, [Padded])).toThrow("acme.Padded has a prop named containerPadding, which is the builder's own in a block");
    // (The builder gives every block a `locked` of its own.)
    expect(() => registerTools(builder, [Locked])).toThrow("acme.Locked has a prop named locked");
    const { design } = toDesign(<Email><Padded containerPadding={32} /></Email>, { customTools: true });
    expect(blocks(design).map((content) => content.type)).toEqual(["html"]);
    // A block of one, written by hand, is left out.
    design.body.rows[0].columns[0].contents.push({ type: "custom", slug: "acme_padded", values: { containerPadding: "0px" } });
    expect(fromDesign(design, { elements: [Padded] }).report.join("\n")).toContain("whose prop containerPadding is the builder's own in a block: left out");
  });

  it("keeps the value of a tool's own property in the block, and out of the element", async () => {
    const { design } = toDesign(<Email><ProductCard name="Mug" /></Email>, { customTools: true });
    blocks(design)[0].values.product = { selected: { id: 2 } };
    const back = fromDesign(design, { elements: [ProductCard] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<ProductCard name="Mug" />');
  });

  it("refuses a tool's own property named as a prop, and settings for an element that isn't given", () => {
    const { builder } = fakeBuilder();
    expect(() => registerTools(builder, [ProductCard], { tools: { "acme.ProductCard": { properties: { price: { label: "Price", widget: "text" } } } } })).toThrow("acme.ProductCard has a prop named price");
    expect(() => registerTools(builder, [ProductCard], { tools: { "acme.Product": {} } })).toThrow("settings for acme.Product, which is none of the elements given");
  });

  it("refuses what isn't a template's own element", () => {
    const { builder } = fakeBuilder();
    expect(() => registerTools(builder, [Text as never])).toThrow("made with defineElement()");
  });
});

describe("a tool's fields", () => {
  // A field as the builder draws one: its markup in the panel, then mounted there with the block's value.
  const Code = defineElement({ type: "acme.Code", label: "Code", props: { code: prop.text({ label: "Code", maxLength: 3, default: "ABC" }), price: prop.number({ label: "Price", min: 0, default: 7.5 }) }, render: (p) => <Text>{`${p.code} ${p.price}`}</Text> });
  function field(key: string, value: unknown) {
    const { builder, editors, tools } = fakeBuilder();
    registerTools(builder, [Code]);
    const widget = editors.find((editor) => editor.name === `elements_text__acme_code__${key}`)!.Widget;
    const kept: unknown[] = [];
    const update = (next: unknown) => void kept.push(next);
    const draw = (shown: unknown) => {
      const node = document.createElement("div");
      document.body.append(node);
      node.innerHTML = widget.render(shown, update);
      widget.mount(node, shown, update);
      return { node, input: node.querySelector("input")!, error: node.querySelector<HTMLElement>("[data-elements-field-error]")! };
    };
    return { widget, kept, update, draw, tool: tools[0], ...draw(value) };
  }
  const type = (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("input"));
  };
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("keeps what its user types once its prop takes it, and says why it doesn't under the field, keeping the block's value", () => {
    vi.useFakeTimers();
    const { input, error, kept } = field("code", "ABC");
    expect(input.value).toBe("ABC");
    input.focus();
    type(input, "ABCD");
    vi.advanceTimersByTime(300);
    // Not kept, and not said yet: its user may be on the way to a value it takes.
    expect(kept).toEqual([]);
    expect(error.style.display).toBe("none");
    vi.advanceTimersByTime(500);
    expect(error.textContent).toBe("Code: is longer than 3 characters");
    expect(error.style.display).toBe("block");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(kept).toEqual([]);
    // Corrected: the message goes at once, and the value is kept once they pause.
    type(input, "AB");
    expect(error.style.display).toBe("none");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    vi.advanceTimersByTime(300);
    expect(kept).toEqual(["AB"]);
    // Left with a value it doesn't take: said at once, and not kept.
    type(input, "ABCDE");
    input.dispatchEvent(new Event("change"));
    expect(error.textContent).toBe("Code: is longer than 3 characters");
    vi.advanceTimersByTime(1000);
    expect(kept).toEqual(["AB"]);
  });

  it("keeps a number the builder keeps as text as its digits, and refuses one below its min", () => {
    const { input, error, kept } = field("price", "7.5");
    type(input, "-5");
    input.dispatchEvent(new Event("change"));
    expect(error.textContent).toBe("Price: expected a number from 0, not -5");
    type(input, "129.50");
    input.dispatchEvent(new Event("change"));
    expect(error.style.display).toBe("none");
    expect(kept).toEqual(["129.5"]);
  });

  it("gives the text as it's typed: \"A&lt;B\" is the six characters it is, never \"A<B\"", () => {
    const { input, error, kept } = field("code", "ABC");
    type(input, "A<B");
    input.dispatchEvent(new Event("change"));
    expect(kept).toEqual(["A<B"]);
    type(input, "A&lt;B");
    input.dispatchEvent(new Event("change"));
    expect(error.textContent).toBe("Code: is longer than 3 characters");
    expect(kept).toEqual(["A<B"]);
  });

  it("fails an export while a field holds a value that isn't kept: the block has the value it had, not the one its user sees", () => {
    const { input, tool, node, kept } = field("price", "7.5");
    const block = { code: "ABC", price: "7.5" };
    expect(tool.renderer.exporters.email(block)).toContain("ABC 7.5");
    type(input, "-5");
    input.dispatchEvent(new Event("change"));
    expect(() => tool.renderer.exporters.email(block)).toThrow(`[Elements] Code's Price holds "-5", which isn't kept (expected a number from 0, not -5): correct it to export`);
    expect(() => tool.renderer.exporters.web(block)).toThrow("which isn't kept");
    // Corrected, it's kept, and the export is of it.
    type(input, "9");
    input.dispatchEvent(new Event("change"));
    expect(tool.renderer.exporters.email({ ...block, price: "9" })).toContain("ABC 9");
    // Corrected while its user is still in the field, it's kept once they pause: until then, the export fails as well,
    // rather than go out with the value the block had.
    vi.useFakeTimers();
    type(input, "-5");
    type(input, "129.50");
    expect(kept).toEqual(["9"]);
    expect(() => tool.renderer.exporters.email({ ...block, price: "9" })).toThrow(`Code's Price holds "129.50", which isn't kept (it's being typed)`);
    vi.advanceTimersByTime(300);
    expect(kept).toEqual(["9", "129.5"]);
    expect(tool.renderer.exporters.email({ ...block, price: "129.5" })).toContain("ABC 129.5");
    vi.useRealTimers();
    // A field closed while holding one holds nothing: the block's value is what its user sees again.
    type(input, "-5");
    input.dispatchEvent(new Event("change"));
    expect(() => tool.renderer.exporters.email(block)).toThrow("which isn't kept");
    node.remove();
    expect(tool.renderer.exporters.email(block)).toContain("ABC 7.5");
  });

  it("waits while an input method composes: kept once its user's done, so the field isn't drawn again in the middle (\"a\", then \"ab\", isn't \"aab\")", () => {
    vi.useFakeTimers();
    const { input, kept, tool } = field("code", "");
    input.focus();
    const compose = (text: string) => {
      input.value = text;
      input.dispatchEvent(new InputEvent("input", { data: text, isComposing: true }));
    };
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    compose("a");
    vi.advanceTimersByTime(1000);
    expect(kept).toEqual([]);
    // Held meanwhile: an export now would be of the value the block has.
    expect(() => tool.renderer.exporters.email({ code: "", price: "7.5" })).toThrow(`Code's Code holds "a", which isn't kept (it's being typed)`);
    compose("ab");
    // Leaving the field while composing ends the composition first: nothing's kept before.
    input.dispatchEvent(new Event("change"));
    vi.advanceTimersByTime(1000);
    expect(kept).toEqual([]);
    input.dispatchEvent(new CompositionEvent("compositionend", { data: "ab" }));
    // A browser may send its last input after the composition ends: it's the same text, kept once.
    input.dispatchEvent(new InputEvent("input", { data: "ab" }));
    vi.advanceTimersByTime(300);
    expect(kept).toEqual(["ab"]);
    expect(tool.renderer.exporters.email({ code: "ab", price: "7.5" })).toContain("ab 7.5");
  });

  it("says what a field or a block holds as plain text, which the builder writes in place of the HTML: no markup", () => {
    const { input, tool, node } = field("price", "7.5");
    const thrown = (values: Record<string, unknown>) => {
      try {
        tool.renderer.exporters.email(values);
      } catch (error) {
        return (error as Error).message;
      }
      throw new Error("the export didn't fail");
    };
    type(input, `<img src=x onerror="alert(1)">`);
    input.dispatchEvent(new Event("change"));
    const held = thrown({ code: "ABC", price: "7.5" });
    expect(held).toContain(`Code's Price holds "\\u003cimg src=x onerror=\\"alert(1)\\"\\u003e", which isn't kept`);
    expect(held).not.toMatch(/[<>&]/);
    node.remove();
    const saved = thrown({ code: "<b>&</b>", price: "7.5" });
    expect(saved).toBe(`[Elements] Code (acme.Code) can't be drawn: its code "\\u003cb\\u003e\\u0026\\u003c/b\\u003e" isn't one it takes (is longer than 3 characters)`);
    // Read as JSON, the value is what was typed.
    expect(JSON.parse(`"${/"(.*)" isn't one/.exec(saved)![1]}"`)).toBe("<b>&</b>");
  });

  it("shows a value a design was saved with that its prop doesn't take, with why, to be corrected", () => {
    const { input, error } = field("price", "-5");
    expect(input.value).toBe("-5");
    expect(error.textContent).toBe("Price: expected a number from 0, not -5");
  });

  it("has the same markup whatever the value, so the builder keeps the input its user is in", () => {
    const { widget } = field("code", "ABC");
    expect(widget.render("ABC", () => {})).toBe(widget.render("XYZ", () => {}));
  });

  it("puts its user back where they were, the caret too, when the builder draws the field again in a new input with the value they typed", () => {
    vi.useFakeTimers();
    const { input, kept, draw } = field("code", "AB");
    input.focus();
    type(input, "ABC");
    input.setSelectionRange(1, 1);
    vi.advanceTimersByTime(300);
    expect(kept).toEqual(["ABC"]);
    // Drawn again, as the builder does once a value changes: the old input is gone.
    input.parentElement!.parentElement!.parentElement!.remove();
    const again = draw("ABC");
    expect(document.activeElement).toBe(again.input);
    expect(again.input.value).toBe("ABC");
    expect([again.input.selectionStart, again.input.selectionEnd]).toEqual([1, 1]);
    // Drawn again for another value (another block): not focused, and showing that value.
    again.input.blur();
    const other = draw("XY");
    expect(document.activeElement).not.toBe(other.input);
    expect(other.input.value).toBe("XY");
    // Kept, and not drawn again at once: a field mounted later with that value (another block's) isn't where they were.
    other.input.focus();
    type(other.input, "XYZ");
    vi.advanceTimersByTime(300);
    expect(kept).toEqual(["ABC", "XYZ"]);
    vi.advanceTimersByTime(2000);
    other.input.blur();
    const later = draw("XYZ");
    expect(document.activeElement).not.toBe(later.input);
  });

  it("checks a team's own control: given its prop's value only where the prop takes it, and keeping only one it takes", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number });
    const Price = defineElement({ type: "acme.Price", label: "Price", props: { price: currency({ label: "Price", min: 0, default: 7.5 }) }, render: (p) => <Text>{p.price}</Text> });
    const { builder, editors, tools } = fakeBuilder();
    const given: unknown[] = [];
    let give: (value: number | undefined) => void = () => {};
    registerTools(builder, [Price], { editors: { [currency.name]: { render: (value) => `<input value="${given.push(value) && (value ?? "")}">`, mount: (_node, _value, update) => void (give = update) } } });
    const widget = editors[0].Widget;
    const kept: unknown[] = [];
    const node = document.createElement("div");
    document.body.append(node);
    node.innerHTML = widget.render("7.5", (value: unknown) => kept.push(value));
    widget.mount(node, "7.5", (value: unknown) => kept.push(value));
    const error = node.querySelector<HTMLElement>("[data-elements-field-error]")!;
    give(-5);
    expect(kept).toEqual([]);
    expect(error.textContent).toBe("Price: expected a number from 0, not -5");
    // Its export fails meanwhile: the block still has 7.5.
    expect(() => tools[0].renderer.exporters.email({ price: "7.5" })).toThrow(`[Elements] Price's Price holds -5, which isn't kept (expected a number from 0, not -5)`);
    // What isn't a number yet ("1e" in a text input gives NaN) is said as that.
    give(Number.NaN);
    expect(error.textContent).toBe("Price: isn't a number");
    expect(() => tools[0].renderer.exporters.email({ price: "7.5" })).toThrow("Price's Price holds NaN, which isn't kept (isn't a number)");
    give(9.25);
    expect(kept).toEqual(["9.25"]);
    expect(error.style.display).toBe("none");
    expect(tools[0].renderer.exporters.email({ price: "9.25" })).toContain("9.25");
    // A block saved with a value its prop doesn't take: the control is given none, and why is said.
    node.innerHTML = widget.render("-5", (value: unknown) => kept.push(value));
    widget.mount(node, "-5", (value: unknown) => kept.push(value));
    expect(given).toEqual([7.5, undefined]);
    expect(node.querySelector<HTMLElement>("[data-elements-field-error]")!.textContent).toBe("Price: expected a number from 0, not -5");
  });
});

describe("a list's field", () => {
  // An FAQ: a list of objects, a list of texts, an object, and a list of blocks of two types.
  const Faq = defineElement({
    type: "acme.Faq",
    label: "FAQ",
    props: {
      entries: prop.list(prop.object({ question: prop.text({ label: "Question", required: true }), answer: prop.text({ label: "Answer", required: true }), open: prop.boolean({ label: "Open", default: false }) }, { label: "Entry" }), { label: "Questions", max: 3 }),
      tags: prop.list(prop.text({ label: "Tag", required: true }), { label: "Tags" }),
      contact: prop.object({ name: prop.text({ label: "Name" }), link: prop.link({ label: "Link" }) }, { label: "Contact" }),
      parts: prop.blocks({ note: prop.object({ text: prop.text({ label: "Text", required: true }) }, { label: "Note" }), size: prop.object({ level: prop.choice([1, 2, 3], { label: "Level", default: 1 }) }, { label: "Size" }) }, { label: "Parts" }),
    },
    render: (p) => <Text>{`${(p.entries ?? []).map((entry) => entry.question).join("|")} ${(p.tags ?? []).join(",")} ${p.contact?.name ?? ""} ${(p.parts ?? []).length}`}</Text>,
  });
  const last = (list: unknown[]) => list[list.length - 1];
  const ENTRIES = [
    { question: "How long is shipping?", answer: "3 to 5 days.", open: false },
    { question: "Can I return it?", answer: "Within 30 days.", open: true },
  ];
  function field(key: string, value: unknown) {
    const { builder, editors, tools } = fakeBuilder();
    registerTools(builder, [Faq]);
    const widget = editors.find((editor) => editor.name === `elements_list__acme_faq__${key}`)!.Widget;
    const kept: unknown[] = [];
    const update = (next: unknown) => void kept.push(next);
    const node = document.createElement("div");
    document.body.append(node);
    // As the builder draws it: its markup in the panel, then mounted there with the block's value.
    const draw = (shown: unknown, into = node) => {
      into.innerHTML = widget.render(shown, update);
      widget.mount(into, shown, update);
      return into;
    };
    draw(value);
    const part = (path: string) => node.querySelector<HTMLInputElement>(`input[data-path="${path}"], select[data-path="${path}"]:not([data-act])`)!;
    const button = (act: string, path: string) => node.querySelector<HTMLButtonElement>(`[data-act="${act}"][data-path="${path}"]`)!;
    const rows = () => [...node.querySelectorAll<HTMLElement>("[data-row]")].map((row) => row.getAttribute("data-row")!);
    const error = () => node.querySelector<HTMLElement>("[data-elements-field-error]")!;
    return { widget, kept, update, node, draw, part, button, rows, error, tool: tools[0] };
  }
  const type = (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("is registered for a list, an object and a list of blocks, as a list's value the prop has it, with its kind's schema", () => {
    const { builder, editors, tools } = fakeBuilder();
    registerTools(builder, [Faq]);
    const properties = tools[0].options.acme_faq.options;
    // A list starts empty; an object with none of its parts.
    expect(properties.entries).toEqual({ label: "Questions", defaultValue: [], widget: "elements_list__acme_faq__entries" });
    expect(properties.tags).toEqual({ label: "Tags", defaultValue: [], widget: "elements_list__acme_faq__tags" });
    expect(properties.contact).toEqual({ label: "Contact", widget: "elements_list__acme_faq__contact" });
    expect(properties.parts).toEqual({ label: "Parts", defaultValue: [], widget: "elements_list__acme_faq__parts" });
    // The builder's AI fills a field by its schema: the prop's own.
    expect(editors.find((editor) => editor.name === "elements_list__acme_faq__entries")!.Widget.schema).toEqual(Faq.definition.props.entries.kind.jsonSchema());
  });

  it("draws an item for each of the list's, with a field for each part, and keeps an edit once its user leaves the text", () => {
    vi.useFakeTimers();
    const { kept, part, rows } = field("entries", ENTRIES);
    const [first, second] = rows();
    expect(rows()).toHaveLength(2);
    expect(part(`${first}/question`).value).toBe("How long is shipping?");
    expect(part(`${second}/open`).checked).toBe(true);
    expect(part(`${second}/answer`).getAttribute("aria-label")).toBe("Questions, item 2, Answer");
    type(part(`${first}/answer`), "2 days.");
    // Given once its user's focus has moved, not on each key.
    expect(kept).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(kept).toEqual([[{ ...ENTRIES[0], answer: "2 days." }, ENTRIES[1]]]);
    // A box ticked is given at once.
    const open = part(`${first}/open`);
    open.checked = true;
    open.dispatchEvent(new Event("change", { bubbles: true }));
    expect(last(kept)).toEqual([{ ...ENTRIES[0], answer: "2 days.", open: true }, ENTRIES[1]]);
  });

  it("keeps none of a list its prop doesn't take, and says which item and which part, as an export does", () => {
    vi.useFakeTimers();
    const { kept, part, rows, error, tool } = field("entries", ENTRIES);
    const second = rows()[1];
    type(part(`${second}/answer`), "");
    vi.advanceTimersByTime(1);
    expect(kept).toEqual([]);
    expect(error().textContent).toBe("Questions: item 2, Answer: is needed");
    expect(part(`${second}/answer`).style.borderColor).not.toBe("");
    // Only the part it's about is said to be invalid, to a screen reader too.
    expect(part(`${second}/answer`).getAttribute("aria-invalid")).toBe("true");
    expect(part(`${rows()[0]}/question`).hasAttribute("aria-invalid")).toBe(false);
    const block = { entries: ENTRIES, tags: [], parts: [] };
    expect(() => tool.renderer.exporters.email(block)).toThrow(`[Elements] FAQ's Questions holds "", which isn't kept (item 2, Answer: is needed): correct it to export`);
    // Corrected: kept, and the export is of it.
    type(part(`${second}/answer`), "Within 14 days.");
    vi.advanceTimersByTime(1);
    expect(error().style.display).toBe("none");
    expect(kept).toEqual([[ENTRIES[0], { ...ENTRIES[1], answer: "Within 14 days." }]]);
    expect(tool.renderer.exporters.email({ ...block, entries: kept[0] })).toContain("How long is shipping?|Can I return it?");
  });

  it("fails an export while its user is typing, and keeps nothing when they put the text back as it was", () => {
    vi.useFakeTimers();
    const { kept, part, rows, tool } = field("entries", ENTRIES);
    const input = part(`${rows()[0]}/question`);
    const block = { entries: ENTRIES, tags: [], parts: [] };
    input.value = "How long?";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(() => tool.renderer.exporters.email(block)).toThrow(`FAQ's Questions holds "How long?", which isn't kept (it's being typed)`);
    input.value = "How long is shipping?";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    vi.advanceTimersByTime(1);
    expect(kept).toEqual([]);
    expect(tool.renderer.exporters.email(block)).toContain("How long is shipping?");
  });

  it("adds an item, which is kept once its parts are filled, and adds none past the list's max", () => {
    vi.useFakeTimers();
    const { kept, part, button, rows, error } = field("entries", ENTRIES);
    button("add", "").click();
    expect(rows()).toHaveLength(3);
    const third = rows()[2];
    // Its parts start at their defaults, or empty: not kept till it's filled.
    expect(kept).toEqual([]);
    expect(error().textContent).toBe("Questions: item 3, Question: is needed");
    expect(document.activeElement).toBe(button("remove", third));
    // The list takes 3 at most.
    expect(button("add", "").disabled).toBe(true);
    type(part(`${third}/question`), "Do you ship abroad?");
    vi.advanceTimersByTime(1);
    expect(kept).toEqual([]);
    type(part(`${third}/answer`), "Yes.");
    vi.advanceTimersByTime(1);
    expect(kept).toEqual([[...ENTRIES, { question: "Do you ship abroad?", answer: "Yes.", open: false }]]);
  });

  it("moves an item up or down and removes one, each kept at once, its user staying on the same item's button", () => {
    const { kept, button, rows, node, draw } = field("entries", ENTRIES);
    const [first, second] = rows();
    button("up", second).click();
    expect(last(kept)).toEqual([ENTRIES[1], ENTRIES[0]]);
    // The builder draws the field again with the value: the items keep their ids, and focus stays on the item moved.
    draw(last(kept));
    expect(rows()).toEqual([second, first]);
    expect(document.activeElement).toBe(button("down", second));
    button("remove", second).click();
    expect(last(kept)).toEqual([ENTRIES[0]]);
    draw(last(kept));
    expect(rows()).toEqual([first]);
    expect(node.contains(document.activeElement)).toBe(true);
  });

  it("puts its user back where they'd gone once the builder draws the field again with a value they gave", () => {
    vi.useFakeTimers();
    const { kept, part, rows, draw } = field("entries", ENTRIES);
    const first = rows()[0];
    const question = part(`${first}/question`);
    question.focus();
    question.value = "Shipping?";
    question.dispatchEvent(new Event("input", { bubbles: true }));
    question.dispatchEvent(new Event("change", { bubbles: true }));
    // Its user tabs on to the answer, then the value is given and the field drawn again.
    part(`${first}/answer`).focus();
    vi.advanceTimersByTime(1);
    expect(kept).toEqual([[{ ...ENTRIES[0], question: "Shipping?" }, ENTRIES[1]]]);
    draw(kept[0]);
    expect(document.activeElement).toBe(part(`${first}/answer`));
  });

  it("puts a list of texts' focus and error on the text, not its item's box", () => {
    const { button, rows, error, node } = field("tags", ["new"]);
    button("add", "").click();
    const added = rows()[1];
    // Added: its text is focused at once (it's the item's one part), and said to be needed.
    expect(document.activeElement).toBe(node.querySelector(`input[data-path="${added}"]`));
    expect(error().textContent).toBe("Tags: item 2: is needed");
    expect(node.querySelector<HTMLElement>(`input[data-path="${added}"]`)!.style.borderColor).not.toBe("");
  });

  it("edits a list of texts, an object, and a list of blocks, whose type starts its parts again", () => {
    vi.useFakeTimers();
    const tags = field("tags", ["new"]);
    tags.button("add", "").click();
    type(tags.part(tags.rows()[1]), "sale");
    vi.advanceTimersByTime(1);
    expect(last(tags.kept)).toEqual(["new", "sale"]);
    document.body.innerHTML = "";
    // An object keeps what its user didn't edit as it was saved: a link's target too.
    const contact = field("contact", { name: "Ada", link: { href: "https://example.com", target: "_blank" } });
    type(contact.part("/name"), "Grace");
    vi.advanceTimersByTime(1);
    expect(last(contact.kept)).toEqual({ name: "Grace", link: { href: "https://example.com", target: "_blank" } });
    document.body.innerHTML = "";
    const parts = field("parts", [{ type: "note", text: "Hello" }]);
    const block = parts.rows()[0];
    const select = parts.node.querySelector<HTMLSelectElement>(`select[data-act="type"][data-path="${block}"]`)!;
    select.value = "size";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(last(parts.kept)).toEqual([{ type: "size", level: 1 }]);
    const level = parts.part(`${block}/level`) as unknown as HTMLSelectElement;
    level.value = "2";
    level.dispatchEvent(new Event("change", { bubbles: true }));
    expect(last(parts.kept)).toEqual([{ type: "size", level: 3 }]);
  });

  it("drops what its user did once the field's drawn somewhere else, as a text field does", () => {
    vi.useFakeTimers();
    const { part, rows, draw, tool, error } = field("entries", ENTRIES);
    type(part(`${rows()[1]}/answer`), "");
    vi.advanceTimersByTime(1);
    expect(error().textContent).toBe("Questions: item 2, Answer: is needed");
    const block = { entries: ENTRIES, tags: [], parts: [] };
    expect(() => tool.renderer.exporters.email(block)).toThrow("which isn't kept");
    // The block's fields closed and opened again: the saved value, and nothing held.
    const again = document.createElement("div");
    document.body.append(again);
    draw(ENTRIES, again);
    expect(again.querySelector<HTMLInputElement>(`[data-path="${again.querySelectorAll("[data-row]")[1].getAttribute("data-row")}/answer"]`)!.value).toBe("Within 30 days.");
    expect(tool.renderer.exporters.email(block)).toContain("Can I return it?");
  });

  it("says what an object was saved with that it has no part for, till its user edits it", () => {
    vi.useFakeTimers();
    const { error, part, kept } = field("contact", { name: "Ada", department: "Finance" });
    expect(error().textContent).toBe(`Contact: "department" isn't one of its fields (name, link)`);
    type(part("/name"), "Grace");
    vi.advanceTimersByTime(1);
    expect(kept).toEqual([{ name: "Grace" }]);
    expect(error().style.display).toBe("none");
  });

  it("keeps a part's place by its own name, a \"/\" in it too; draws no part that isn't editable; and leaves out a list left out", () => {
    vi.useFakeTimers();
    const Odd = defineElement({
      type: "acme.Odd",
      label: "Odd",
      props: {
        info: prop.object({ "a/b": prop.text({ label: "Flat" }), a: prop.object({ b: prop.text({ label: "Nested" }) }, { label: "A" }) }, { label: "Info" }),
        account: prop.object({ name: prop.text({ label: "Name" }), id: prop.text({ label: "Id", editable: false }), enabled: prop.boolean({ label: "On" }), tags: prop.list(prop.text({ label: "Tag" }), { label: "Tags", min: 1 }) }, { label: "Account" }),
      },
      render: () => <Text>Odd</Text>,
    });
    const { builder, editors } = fakeBuilder();
    registerTools(builder, [Odd]);
    const draw = (key: string, value: unknown) => {
      const widget = editors.find((editor) => editor.name === `elements_list__acme_odd__${key}`)!.Widget;
      const kept: unknown[] = [];
      const node = document.createElement("div");
      document.body.append(node);
      node.innerHTML = widget.render(value, (next: unknown) => kept.push(next));
      widget.mount(node, value, (next: unknown) => kept.push(next));
      return { node, kept };
    };
    // "a/b" is one part, not b inside a.
    const info = draw("info", { "a/b": "flat", a: { b: "nested" } });
    const flat = info.node.querySelector<HTMLInputElement>('input[aria-label="Info, Flat"]')!;
    type(flat, "changed");
    vi.advanceTimersByTime(1);
    expect(info.kept).toEqual([{ "a/b": "changed", a: { b: "nested" } }]);
    // The id isn't editable: no field for it, and it keeps its value. Tags, left out with a min of 1, stay out when
    // another part changes.
    const account = draw("account", { name: "Ada", id: "42", enabled: false });
    expect(account.node.querySelector('[aria-label="Account, Id"]')).toBeNull();
    const on = account.node.querySelector<HTMLInputElement>('input[aria-label="Account, On"]')!;
    on.checked = true;
    on.dispatchEvent(new Event("change", { bubbles: true }));
    expect(account.kept).toEqual([{ name: "Ada", id: "42", enabled: true }]);
  });

  it("leaves an object out of its own where it was left out and nothing's done in it, and says a saved part its prop doesn't take at that part", () => {
    vi.useFakeTimers();
    const Profile = defineElement({
      type: "acme.Profile",
      label: "Profile",
      props: {
        info: prop.object({ name: prop.text({ label: "Name" }), crm: prop.object({ id: prop.text({ label: "ID", required: true, editable: false }) }, { label: "CRM" }) }, { label: "Info" }),
        amounts: prop.list(prop.number({ label: "Amount", min: 0 }), { label: "Amounts" }),
      },
      render: () => <Text>Profile</Text>,
    });
    const { builder, editors } = fakeBuilder();
    registerTools(builder, [Profile]);
    const draw = (key: string, value: unknown) => {
      const widget = editors.find((editor) => editor.name === `elements_list__acme_profile__${key}`)!.Widget;
      const kept: unknown[] = [];
      const node = document.createElement("div");
      document.body.append(node);
      node.innerHTML = widget.render(value, (next: unknown) => kept.push(next));
      widget.mount(node, value, (next: unknown) => kept.push(next));
      return { node, kept };
    };
    // The CRM object was left out: its ID isn't needed to change the name.
    const info = draw("info", { name: "Ada" });
    type(info.node.querySelector<HTMLInputElement>('input[aria-label="Info, Name"]')!, "Grace");
    vi.advanceTimersByTime(1);
    expect(info.kept).toEqual([{ name: "Grace" }]);
    // A number saved below its min: said, at its input.
    const amounts = draw("amounts", [-1]);
    expect(amounts.node.querySelector("[data-elements-field-error]")!.textContent).toBe("Amounts: item 1: expected a number from 0, not -1");
    expect(amounts.node.querySelector('input[aria-label="Amounts, item 1"]')!.getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps a box ticked, then unticked, as false; and lets go of what it held once it's drawn for another block, an item added meanwhile too", () => {
    vi.useFakeTimers();
    // A box with no default, left out: ticked, then unticked, it's false, not left out again.
    const Flags = defineElement({ type: "acme.Flags", label: "Flags", props: { settings: prop.object({ name: prop.text({ label: "Name" }), flag: prop.boolean({ label: "Flag" }) }, { label: "Settings" }) }, render: () => <Text>Flags</Text> });
    const flags = fakeBuilder();
    registerTools(flags.builder, [Flags]);
    const flagWidget = flags.editors.find((editor) => editor.name === "elements_list__acme_flags__settings")!.Widget;
    const flagKept: unknown[] = [];
    const flagNode = document.createElement("div");
    document.body.append(flagNode);
    const redraw = (value: unknown) => {
      flagNode.innerHTML = flagWidget.render(value, (next: unknown) => flagKept.push(next));
      flagWidget.mount(flagNode, value, (next: unknown) => flagKept.push(next));
    };
    redraw({ name: "Ada" });
    const flag = () => flagNode.querySelector<HTMLInputElement>('input[aria-label="Settings, Flag"]')!;
    flag().checked = true;
    flag().dispatchEvent(new Event("change", { bubbles: true }));
    expect(last(flagKept)).toEqual({ name: "Ada", flag: true });
    redraw(last(flagKept));
    flag().checked = false;
    flag().dispatchEvent(new Event("change", { bubbles: true }));
    expect(last(flagKept)).toEqual({ name: "Ada", flag: false });
    const { part, rows, button, widget, update, node, tool } = field("entries", [{ question: "Q?", answer: "A." }]);
    // A text left (its save waiting a moment), then an item added that isn't filled: drawn for another block, the
    // field holds nothing of either, and exports work.
    type(part(`${rows()[0]}/question`), "Changed?");
    button("add", "").click();
    const other = [{ question: "Other?", answer: "Yes.", open: false }];
    node.innerHTML = widget.render(other, update);
    widget.mount(node, other, update);
    vi.advanceTimersByTime(1);
    expect(tool.renderer.exporters.email({ entries: other, tags: [], parts: [] })).toContain("Other?");
  });

  it("keeps a part its user put back as it was saved, a link's target too; shows a part left empty at its default; and shows an item that isn't editable as it is", () => {
    vi.useFakeTimers();
    const Shop = defineElement({
      type: "acme.Shop",
      label: "Shop",
      props: {
        items: prop.list(prop.object({ name: prop.text({ label: "Name" }), link: prop.link({ label: "Link" }), price: prop.number({ label: "Price", min: 0, default: 30 }) }, { label: "Item" }), { label: "Items" }),
        skus: prop.list(prop.text({ label: "SKU", editable: false }), { label: "SKUs" }),
      },
      render: () => <Text>Shop</Text>,
    });
    const { builder, editors } = fakeBuilder();
    registerTools(builder, [Shop]);
    const draw = (key: string, value: unknown) => {
      const widget = editors.find((editor) => editor.name === `elements_list__acme_shop__${key}`)!.Widget;
      const kept: unknown[] = [];
      const node = document.createElement("div");
      document.body.append(node);
      node.innerHTML = widget.render(value, (next: unknown) => kept.push(next));
      widget.mount(node, value, (next: unknown) => kept.push(next));
      return { node, kept };
    };
    const saved = [{ name: "Desk", link: { href: "https://shop.example/desk", target: "_blank" }, price: 95 }];
    const items = draw("items", saved);
    const input = (label: string) => items.node.querySelector<HTMLInputElement>(`input[aria-label="Items, item 1, ${label}"]`)!;
    // Another address typed, then the one it had put back: still the link it was saved with, its target too.
    input("Link").value = "https://other.example";
    input("Link").dispatchEvent(new Event("input", { bubbles: true }));
    type(input("Link"), "https://shop.example/desk");
    vi.advanceTimersByTime(1);
    type(input("Name"), "Chair");
    vi.advanceTimersByTime(1);
    expect(last(items.kept)).toEqual([{ name: "Chair", link: { href: "https://shop.example/desk", target: "_blank" }, price: 95 }]);
    // A price emptied is its default, kept and shown.
    type(input("Price"), "");
    vi.advanceTimersByTime(1);
    expect((last(items.kept) as Array<{ price: number }>)[0].price).toBe(30);
    expect(input("Price").value).toBe("30");
    // An item that isn't editable is shown as it is, read-only.
    const skus = draw("skus", ["SKU-1"]);
    expect(skus.node.querySelector<HTMLInputElement>('input[aria-label="SKUs, item 1"]')!.readOnly).toBe(true);
  });

  it("gives an edit its user left to the block it was in, where the field's drawn for another block before it's given, and fails an export meanwhile", () => {
    vi.useFakeTimers();
    const { kept, part, rows, widget, update, node, tool } = field("entries", ENTRIES);
    type(part(`${rows()[0]}/question`), "Shipping?");
    const block = { entries: ENTRIES, tags: [], parts: [] };
    expect(() => tool.renderer.exporters.email(block)).toThrow("it's being typed");
    // Its user clicked another FAQ block: the field is drawn for that one, in the same place.
    const other = [{ question: "Other?", answer: "Yes.", open: false }];
    node.innerHTML = widget.render(other, update);
    widget.mount(node, other, update);
    expect(() => tool.renderer.exporters.email(block)).toThrow("it's being typed");
    vi.advanceTimersByTime(1);
    expect(kept).toEqual([[{ ...ENTRIES[0], question: "Shipping?" }, ENTRIES[1]]]);
    expect(tool.renderer.exporters.email({ ...block, entries: kept[0] })).toContain("Shipping?");
  });

  it("shows a list a design was saved with that its prop doesn't take, with why", () => {
    const { error } = field("entries", [{ question: "Only a question" }]);
    expect(error().textContent).toBe("Questions: item 1, Answer: is needed");
  });
});

describe("a Page's own elements", () => {
  it("round-trips the same way", async () => {
    const page = (
      <Page width={800}>
        <ProductCard name="Desk Lamp" price={129} />
      </Page>
    );
    const { design } = toDesign(page, { customTools: true });
    const back = fromDesign(design, { displayMode: "web", elements: [ProductCard] });
    expect(back.report).toEqual([]);
    expect((await render(back.element)).html).toBe((await render(page)).html);
  });
});
