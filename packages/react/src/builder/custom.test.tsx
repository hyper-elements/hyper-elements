/** A template's own components in the builder: as custom tools' blocks in a design, read back, and registered in a builder. */
import { describe, expect, it } from "vitest";
import { Button, Column, component, defineTheme, Email, Heading, Image, Page, prop, render, Section, Text, token } from "../primitives/index";
import { fromDesign, registerTools, toDesign, toolName, type Builder } from "./index";

type Values = Record<string, any>;
type Content = { type: string; slug?: string; values: Values };
const blocks = (design: any): Content[] => design.body.rows.flatMap((row: any) => row.columns.flatMap((column: any) => column.contents));

const ProductCard = component({
  type: "acme.ProductCard",
  label: "Product",
  props: {
    name: prop.text({ label: "Product title", default: "Product title" }),
    price: prop.number({ label: "Price", min: 0, default: 7.99, editor: "currency" }),
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
const Footer = component({ type: "acme.LegalFooter", label: "Legal footer", props: {}, render: () => <Text style={{ fontSize: 12 }}>Acme Inc., 1 Market St.</Text> });

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
  it("is a component's type in the builder's words", () => {
    expect(toolName("acme.ProductCard")).toBe("acme_product_card");
    expect(toolName("my-shop.Hero2")).toBe("my_shop_hero2");
    expect(toolName("acme.CTA")).toBe("acme_cta");
  });
});

describe("toDesign with customTools", () => {
  it("writes each of the template's own components as an HTML block without it, as before", () => {
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
      price: 24,
      quantity: 2,
      href: { name: "web", values: { href: "https://example.com/mug", target: "_blank" } },
      buttonColor: "#0f766e",
      photo: { url: "https://example.com/mug.png", width: 1200, height: 800 },
      badge: "new",
      featured: true,
      font: { label: "Georgia", value: "Georgia, serif" },
      // A kind the builder has no editor for keeps its value.
      gap: 12,
      containerPadding: "0px",
      _meta: { htmlID: "hero-product", htmlClassNames: "u_content_custom_acme_product_card" },
    });
    expect(footer).toMatchObject({ type: "custom", slug: "acme_legal_footer", values: { _meta: { htmlID: "u_content_custom_acme_legal_footer_1", htmlClassNames: "u_content_custom_acme_legal_footer" } } });
    expect(design.counters).toMatchObject({ u_content_custom_acme_legal_footer: 1 });
  });

  it("writes a prop that isn't given as its default, where the builder has an editor for it, so its field shows what's drawn", () => {
    const [product] = blocks(toDesign(<Email><ProductCard name="Mug" /></Email>, { customTools: true }).design);
    expect(product.values).toMatchObject({ name: "Mug", price: 7.99, quantity: 1, href: { name: "web", values: { href: "https://example.com", target: "_self" } }, buttonColor: "#007bff", badge: "none", featured: false });
    // No default to show (photo, font), or no editor to show it in (gap).
    expect(Object.keys(product.values).filter((key) => ["photo", "font", "gap"].includes(key))).toEqual([]);
  });

  it("reads a default back as the prop not given, as a template wouldn't write it", () => {
    const { design } = toDesign(<Email><ProductCard name="Mug" buttonColor="#007bff" /></Email>, { customTools: true });
    expect(fromDesign(design, { components: [ProductCard] }).code).toContain('<acme.ProductCard name="Mug" />');
  });

  it("keeps a component placed where a Section goes as an HTML block, and says so", () => {
    const Hero = component({ type: "acme.Hero", label: "Hero", placement: "section", props: { title: prop.text({ label: "Title", required: true }) }, render: ({ title }) => <Section><Heading>{title}</Heading></Section> });
    const { design, report } = toDesign(<Email><Hero title="Launch" /></Email>, { customTools: true });
    expect(blocks(design).map((content) => content.type)).toEqual(["html"]);
    expect(report.join("\n")).toContain("HTML block");
  });

  it("writes a prop given a theme's token as the value it has there: the builder keeps no theme", () => {
    const theme = defineTheme({ colors: { primary: "#0f766e" } });
    const Tag = component({ type: "acme.Tag", label: "Tag", props: { color: prop.color({ label: "Color", default: "#000000" }) }, render: (p) => <Text style={{ color: p.color }}>tag</Text> });
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

  it("is hidden where the component is", () => {
    const [product] = blocks(toDesign(<Email><ProductCard name="Mug" hidden={{ mobile: true }} /></Email>, { customTools: true }).design);
    expect(product.values._override).toEqual({ mobile: { hideMobile: true } });
  });
});

describe("fromDesign with components", () => {
  it("reads each custom tool's block back as its component, and renders what the template did", async () => {
    const { design } = toDesign(email, { customTools: true });
    const back = fromDesign(design, { components: [ProductCard, Footer] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<acme.ProductCard id="hero-product" name="Morning Mug" price={24} quantity={2}');
    expect(back.code).toContain("<acme.LegalFooter />");
    expect((await render(back.element)).html).toBe((await render(email)).html);
  });

  it("reads a design made of the same blocks again as the same design", () => {
    const { design } = toDesign(email, { customTools: true });
    const again = toDesign(fromDesign(design, { components: [ProductCard, Footer] }).element, { customTools: true }).design;
    expect(again).toEqual(design);
  });

  it("leaves out a custom tool's block that's none of the components given, and says which", () => {
    const { design } = toDesign(email, { customTools: true });
    const { element, report } = fromDesign(design, { components: [Footer] });
    expect(report.join("\n")).toContain('rows[0].columns[0].contents[1]: the custom tool "acme_product_card" of the builder\'s is none of the components given');
    expect(fromDesign(design).report.filter((line) => line.includes("custom tool"))).toHaveLength(2);
    expect(element.props.children).toHaveLength(2);
  });

  it("reads what the builder's editors store: a counter's digits, a dropdown's text, a link and an image as theirs", async () => {
    const Pack = component({
      type: "acme.Pack",
      label: "Pack",
      props: { size: prop.choice([6, 12, 24], { label: "Size", default: 6 }), count: prop.number({ label: "Count", default: 1 }), href: prop.link({ label: "Link" }), photo: prop.image({ label: "Photo" }) },
      render: (p) => <Text>{`${p.count} × ${p.size}`}</Text>,
    });
    const { design } = toDesign(<Email><Pack /></Email>, { customTools: true });
    blocks(design)[0].values = { ...blocks(design)[0].values, size: "12", count: "3", href: { name: "web", values: { href: "https://example.com/p", target: "_self" } }, photo: { url: "https://example.com/p.png" } };
    const back = fromDesign(design, { components: [Pack] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<acme.Pack size={12} count={3} href="https://example.com/p" photo="https://example.com/p.png" />');
    expect((await render(back.element)).text).toContain("3 × 12");
  });

  it("reads the values the builder itself stored for an image, a font and two dropdowns", async () => {
    const Card = component({
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
    const back = fromDesign(design, { components: [Card] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<probe.Card photo={{ src: "https://hyperelements.dev/img/orbit-app.png", width: 1200, height: 700 }} font="georgia,palatino" size="large" packs={24} />');
    expect((await render(back.element)).text).toContain("Probe: pack of 24, size large");
  });

  it("leaves out a value its prop doesn't take, and says so, keeping the block", () => {
    const { design } = toDesign(email, { customTools: true });
    Object.assign(blocks(design)[1].values, { buttonColor: "greenish", quantity: 500, href: { name: "web", values: { href: "javascript:alert(1)" } }, extra: "<script>" });
    const { code, report } = fromDesign(design, { components: [ProductCard, Footer] });
    expect(report.join("\n")).toContain('its buttonColor "greenish"');
    expect(report.join("\n")).toContain("its quantity 500");
    expect(code).not.toContain("greenish");
    expect(code).not.toContain("javascript:");
    expect(code).not.toContain("script");
    expect(code).toContain('name="Morning Mug"');
  });

  it("refuses two components that are one tool", () => {
    const One = component({ type: "x.Y1Zed", label: "One", props: {}, render: () => <Text>1</Text> });
    const Two = component({ type: "x-y1.Zed", label: "Two", props: {}, render: () => <Text>2</Text> });
    expect(() => fromDesign({ body: { rows: [] } }, { components: [One, Two] })).toThrow("x.Y1Zed and x-y1.Zed are one tool in the builder (x_y1_zed)");
  });
});

/** A builder that keeps what's registered in it, and calls a viewer's render as it is. */
function fakeBuilder() {
  const tools: Values[] = [];
  const builder: Builder = { registerTool: (tool) => void tools.push(tool), createViewer: (viewer) => viewer };
  return { builder, tools };
}

describe("registerTools", () => {
  it("registers each component as a custom tool: its name, its label, a property for each prop the builder edits", () => {
    const { builder, tools } = fakeBuilder();
    expect(registerTools(builder, [ProductCard, Footer], { icons: { "acme.ProductCard": "fa-tag" } })).toEqual(["acme_product_card", "acme_legal_footer"]);
    const [product, footer] = tools;
    expect(product).toMatchObject({ name: "acme_product_card", label: "Product", icon: "fa-tag", supportedDisplayModes: ["web", "email"], values: {} });
    expect(footer).toMatchObject({ name: "acme_legal_footer", label: "Legal footer", icon: "fa-cube", options: {} });
    const properties = product.options.acme_product_card.options;
    expect(product.options.acme_product_card.title).toBe("Product");
    expect(properties).toEqual({
      name: { label: "Product title", defaultValue: "Product title", widget: "text" },
      // An editor the builder doesn't have ("currency"): its kind's.
      price: { label: "Price", defaultValue: 7.99, widget: "counter" },
      quantity: { label: "Quantity", defaultValue: 1, widget: "counter" },
      href: { label: "Button link", defaultValue: { name: "web", values: { href: "https://example.com", target: "_self" } }, widget: "link" },
      buttonColor: { label: "Button color", defaultValue: "#007bff", widget: "color_picker" },
      // No default: no value to start with, which the builder's editor shows as unset.
      photo: { label: "Photo", widget: "image" },
      badge: { label: "Badge", defaultValue: "none", widget: "dropdown", data: { options: [{ label: "none", value: "none" }, { label: "new", value: "new" }, { label: "sale", value: "sale" }] } },
      featured: { label: "Featured", defaultValue: false, widget: "toggle" },
      font: { label: "Font", widget: "font_family" },
      // No `gap`: the builder has no editor for a length, so it has no property (its value is kept).
    });
  });

  it("edits a prop with the editor it names, where the builder has one: its own, or one registered in it", () => {
    const Order = component({
      type: "acme.Order",
      label: "Order",
      props: {
        price: prop.number({ label: "Price", editor: "currency" }),
        note: prop.text({ label: "Note", editor: "rich_text" }),
        when: prop.text({ label: "When", editor: "date_range" }),
      },
      render: (p) => <Text>{p.note ?? ""}</Text>,
    });
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Order], { editors: ["currency"] });
    const properties = tools[0].options.acme_order.options;
    expect(properties.price.widget).toBe("currency");
    expect(properties.note.widget).toBe("rich_text");
    expect(properties.when.widget).toBe("text");
  });

  it("draws the component from the tool's values, as an Email's markup in the canvas and for email, a Page's for web", () => {
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

  it("draws a Page's markup in the canvas of a builder in web mode", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [ProductCard], { displayMode: "web" });
    expect(tools[0].renderer.Viewer.render({ name: "Mug" })).not.toContain("<table");
  });

  it("draws at its column's share of the content width", () => {
    const { builder, tools } = fakeBuilder();
    const Wide = component({ type: "acme.Wide", label: "Wide", props: { photo: prop.image({ label: "Photo", required: true }) }, render: (p) => <Image src={p.photo} alt="" /> });
    registerTools(builder, [Wide]);
    const values = { photo: { url: "https://example.com/wide.png", width: 1200, height: 600 }, containerPadding: "0px" };
    const full = tools[0].renderer.Viewer.render(values, { contentWidth: "600px" }, { columnIndex: 0, rowCells: [1] });
    const half = tools[0].renderer.Viewer.render(values, { contentWidth: "600px" }, { columnIndex: 1, rowCells: [1, 1] });
    expect(full).toContain('width="600"');
    expect(half).toContain('width="300"');
  });

  it("leaves a value its prop doesn't take out of the drawing, which then shows the default", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [ProductCard]);
    const html = tools[0].renderer.Viewer.render({ name: "Mug", buttonColor: "greenish", quantity: "lots" });
    expect(html).toContain("#007bff");
    expect(html).toContain("1 × $7.99");
  });

  it("says in the canvas what stops a block from being drawn, and exports nothing for it", () => {
    const { builder, tools } = fakeBuilder();
    const Named = component({ type: "acme.Named", label: "Named", props: { name: prop.text({ label: "Name", required: true }) }, render: (p) => <Text>{p.name}</Text> });
    registerTools(builder, [Named]);
    const { Viewer, exporters } = tools[0].renderer;
    const canvas = Viewer.render({});
    expect(canvas).toContain("Named:");
    expect(canvas).toContain("name");
    expect(exporters.email({})).toBe("");
    expect(exporters.web({})).toBe("");
  });

  it("writes a value as text, never as markup", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [ProductCard]);
    const html = tools[0].renderer.Viewer.render({ name: '<img src=x onerror="alert(1)">', href: { url: "javascript:alert(1)" }, buttonColor: 'red" onmouseover="alert(1)' });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onmouseover");
    expect(html).toContain("&lt;img");
  });

  it("refuses what isn't a template's own component", () => {
    const { builder } = fakeBuilder();
    expect(() => registerTools(builder, [Text as never])).toThrow("made with component()");
  });
});

describe("a Page's own components", () => {
  it("round-trips the same way", async () => {
    const page = (
      <Page width={800}>
        <ProductCard name="Desk Lamp" price={129} />
      </Page>
    );
    const { design } = toDesign(page, { customTools: true });
    const back = fromDesign(design, { displayMode: "web", components: [ProductCard] });
    expect(back.report).toEqual([]);
    expect((await render(back.element)).html).toBe((await render(page)).html);
  });
});
