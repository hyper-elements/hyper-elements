/** A template's own components in the builder: as custom tools' blocks in a design, read back, and registered in a builder. */
import { describe, expect, it } from "vitest";
import { Button, Column, component, defineProperty, defineTheme, Document, Email, Heading, Image, Page, prop, render, Row, Section, Text, token } from "../primitives/index";
import { fromDesign, registerTools, toDesign, toolName, type Builder, type EditorWidget } from "./index";

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
const Hero = component({ type: "acme.Hero", label: "Hero", placement: "section", props: { title: prop.text({ label: "Title", required: true }) }, render: ({ title }) => <Section><Heading>{title}</Heading></Section> });
// One prop of each kind whose field isn't the kind's own in the builder.
const Kinds = component({
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
// A prop its component needs, with what a block dragged in starts with.
const Banner = component({ type: "acme.Banner", label: "Banner", props: { title: prop.text({ label: "Title", required: true, default: "Welcome" }) }, render: (p) => <Text>{p.title}</Text> });

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

  it("takes the component itself, and refuses what's neither it nor its type", () => {
    expect(toolName(ProductCard)).toBe("acme_product_card");
    for (const other of [undefined, {}, 5]) expect(() => toolName(other as never)).toThrow("toolName takes a template's own component (made with component()) or its type");
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
    expect(fromDesign(design, { components: [ProductCard] }).code).toContain('<acme.ProductCard name="Mug" />');
  });

  it("keeps a prop its component needs where it's given its default: a template has to give it", async () => {
    const banner = <Email><Banner title="Welcome" /></Email>;
    const back = fromDesign(toDesign(banner, { customTools: true }).design, { components: [Banner] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<acme.Banner title="Welcome" />');
    expect((await render(back.element)).html).toBe((await render(banner)).html);
  });

  it("keeps a component placed where a Section goes as an HTML block, and says so", () => {
    const { design, report } = toDesign(<Email><Hero title="Launch" /></Email>, { customTools: true });
    expect(blocks(design).map((content) => content.type)).toEqual(["html"]);
    expect(report.join("\n")).toContain("HTML block");
  });

  it("says of a Document's own component that the builder's document mode doesn't draw its tool's block", () => {
    const document = <Document><Footer /></Document>;
    const { design, report } = toDesign(document, { customTools: true });
    expect(blocks(design).map((content) => content.slug)).toEqual(["acme_legal_footer"]);
    expect(report).toEqual(["root.children[0]: a acme.LegalFooter is its custom tool's block: the builder's document mode keeps it but doesn't draw or export it, so what's in it isn't in the builder's PDF"]);
    // It comes back as the component still.
    const back = fromDesign(design, { displayMode: "document", components: [Footer] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain("<acme.LegalFooter />");
    // An Email's or a Page's is drawn there: nothing to say.
    expect(toDesign(<Email><Footer /></Email>, { customTools: true }).report).toEqual([]);
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

  it("leaves out a block with no value for a prop its component needs, and says so: the rest still renders", async () => {
    const Photo = component({ type: "acme.Photo", label: "Photo", props: { photo: prop.image({ label: "Photo", required: true }) }, render: (p) => <Image src={p.photo} alt="" /> });
    const Count = component({ type: "acme.Count", label: "Count", props: { n: prop.number({ label: "Count", required: true, min: 1 }) }, render: (p) => <Text>{p.n}</Text> });
    const { design } = toDesign(<Email><Heading>Hello</Heading></Email>);
    // As dragged in from the panel and not filled yet, with its counter emptied, and with a number its prop doesn't take.
    design.body.rows[0].columns[0].contents.push({ type: "custom", slug: "acme_photo", values: {} }, { type: "custom", slug: "acme_count", values: { n: "" } }, { type: "custom", slug: "acme_count", values: { n: 0 } });
    const back = fromDesign(design, { components: [Photo, Count] });
    expect(back.report).toHaveLength(4);
    expect(back.report).toContain('rows[0].columns[0].contents[1]: the custom tool "acme_photo" has no photo, which a acme.Photo needs: left out');
    expect(back.report).toContain('rows[0].columns[0].contents[2]: the custom tool "acme_count" has no n, which a acme.Count needs: left out');
    expect(back.report.filter((line) => line.startsWith("rows[0].columns[0].contents[3]: ")).join("\n")).toMatch(/its n 0 .*left out\n.*has no n, which a acme\.Count needs: left out/);
    expect(back.code).not.toContain("acme.");
    expect((await render(back.element)).html).toContain(">Hello</h");
  });

  it("leaves out a block of a component placed where a Section goes, and says so", async () => {
    const { design } = toDesign(<Email><Heading>Hello</Heading></Email>);
    design.body.rows[0].columns[0].contents.push({ type: "custom", slug: "acme_hero", values: { title: "Launch" } });
    const back = fromDesign(design, { components: [Hero] });
    expect(back.report).toEqual(['rows[0].columns[0].contents[1]: the custom tool "acme_hero" is a acme.Hero\'s, which goes where a Section does, not in a column: left out']);
    expect(back.code).not.toContain("acme.Hero");
    expect((await render(back.element)).html).toContain(">Hello</h");
  });

  it("keeps an image's width where its height isn't known", async () => {
    const Photo = component({ type: "acme.Photo", label: "Photo", props: { photo: prop.image({ label: "Photo", required: true }) }, render: (p) => <Image src={p.photo} alt="" /> });
    const narrow = <Email><Photo photo={{ src: "https://example.com/p.png", width: 120 }} /></Email>;
    const { design } = toDesign(narrow, { customTools: true });
    expect(blocks(design)[0].values.photo).toEqual({ url: "https://example.com/p.png", width: 120 });
    const back = fromDesign(design, { components: [Photo] });
    expect(back.report).toEqual([]);
    expect((await render(back.element)).html).toBe((await render(narrow)).html);
  });

  it("reads a link its user emptied, where the prop has one by default, as a link to nothing: not its default again", async () => {
    const { design } = toDesign(<Email><ProductCard name="Mug" /></Email>, { customTools: true });
    blocks(design)[0].values.href = { name: "web", values: { href: "", target: "_blank" } };
    const back = fromDesign(design, { components: [ProductCard] });
    expect(back.report).toEqual([]);
    expect((await render(back.element)).html).not.toContain("https://example.com");
    // A template's own link to nothing stays one.
    const none = <Email><ProductCard name="Mug" href={{ href: "" }} /></Email>;
    expect((await render(fromDesign(toDesign(none, { customTools: true }).design, { components: [ProductCard] }).element)).html).toBe((await render(none)).html);
    expect((await render(none)).html).not.toContain("https://example.com");
  });

  it("reads what each kind's field keeps: a number that isn't whole and a length with a unit as text, a font weight as a dropdown's", async () => {
    const { design } = toDesign(<Email><Kinds /></Email>, { customTools: true });
    expect(blocks(design)[0].values).toMatchObject({ ratio: "0.5", offset: 0, width: "50%", gap: 8, weight: "400" });
    Object.assign(blocks(design)[0].values, { ratio: "0.25", offset: "-3", width: "120", gap: "16", weight: "700" });
    const back = fromDesign(design, { components: [Kinds] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain("<acme.Kinds ratio={0.25} offset={-3} width={120} gap={16} weight={700} />");
    expect((await render(back.element)).text).toContain("0.25 -3 120 16");
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
  const editors: Values[] = [];
  const builder: Builder = { registerTool: (tool) => void tools.push(tool), createViewer: (viewer) => viewer, registerPropertyEditor: (editor) => void editors.push(editor), createWidget: (widget) => widget };
  return { builder, tools, editors };
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
      // An editor nobody gave ("currency"): its kind's, which for a number that isn't whole is the text field, keeping text.
      price: { label: "Price", defaultValue: "7.99", widget: "text" },
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
      ratio: { label: "Ratio", defaultValue: "0.5", widget: "text" },
      // No floor of its own: the counter's is zero, so it's given one far below.
      offset: { label: "Offset", defaultValue: 0, widget: "counter", data: { minValue: -1e9 } },
      width: { label: "Width", defaultValue: "50%", widget: "text" },
      gap: { label: "Gap", defaultValue: 8, widget: "counter", data: { minValue: 4 } },
      weight: { label: "Weight", defaultValue: "400", widget: "dropdown", data: { options: [100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => ({ label: String(weight), value: String(weight) })) } },
    });
  });

  it("edits a prop with the editor it names: one of the builder's own that keeps its kind's value, or one of the team's", () => {
    const Order = component({
      type: "acme.Order",
      label: "Order",
      props: {
        price: prop.number({ label: "Price", default: 5, editor: "currency", editorOptions: { symbol: "€" } }),
        steps: prop.number({ label: "Steps", min: 0, max: 100, integer: true, default: 10, editorOptions: { step: 5 } }),
        // The builder's counter shows whole numbers alone: a number that isn't whole keeps its kind's.
        rating: prop.number({ label: "Rating", min: 0, max: 5, default: 4.5, editor: "counter" }),
        side: prop.choice(["left", "center", "right"], { label: "Side", default: "left", editor: "alignment" }),
        due: prop.text({ label: "Due", editor: "datetime" }),
        // Editors that keep what the prop isn't (markup, an image), and one nobody has: its kind's.
        note: prop.text({ label: "Note", editor: "rich_text" }),
        title: prop.text({ label: "Title", editor: "image" }),
        when: prop.text({ label: "When", editor: "date_range" }),
      },
      render: (p) => <Text>{p.note ?? ""}</Text>,
    });
    const { builder, tools, editors } = fakeBuilder();
    registerTools(builder, [Order], { editors: { currency: true } });
    const properties = tools[0].options.acme_order.options;
    // One registered in the builder already: by its name, with the prop's label and options, the value as the builder keeps it.
    expect(properties.price).toEqual({ label: "Price", defaultValue: "5", widget: "currency", data: { label: "Price", symbol: "€" } });
    expect(editors).toEqual([]);
    // The builder's own: its limits from the prop, and the prop's options beside them.
    expect(properties.steps).toEqual({ label: "Steps", defaultValue: 10, widget: "counter", data: { minValue: 0, maxValue: 100, step: 5 } });
    expect(properties.rating).toEqual({ label: "Rating", defaultValue: "4.5", widget: "text" });
    expect(properties.side).toMatchObject({ widget: "alignment", defaultValue: "left" });
    expect(properties.due.widget).toBe("datetime");
    expect([properties.note.widget, properties.title.widget, properties.when.widget]).toEqual(["text", "text", "text"]);
  });

  it("registers an editor of the team's own given as it's written, for each prop that names it, with the prop's value as the prop has it", () => {
    const Price = component({ type: "acme.Price", label: "Price", props: { price: prop.number({ label: "Price", min: 0, default: 7.5, editor: "currency", editorOptions: { symbol: "€" } }) }, render: (p) => <Text>{p.price.toFixed(2)}</Text> });
    const { builder, tools, editors } = fakeBuilder();
    const given: unknown[] = [];
    registerTools(builder, [Price], {
      editors: {
        currency: {
          render: (value, _update, options) => `<label>${options.label}</label><input value="${given.push([value, options]) && value}">`,
          mount: (_node, _value, update) => update(9.25),
        },
      },
    });
    expect(tools[0].options.acme_price.options.price).toEqual({ label: "Price", defaultValue: "7.5", widget: "currency__acme_price__price", data: { label: "Price", symbol: "€" } });
    expect(editors.map((editor) => editor.name)).toEqual(["currency__acme_price__price"]);
    // The builder keeps a number that isn't whole as text: the editor is given the number, and what it gives back is kept as text again.
    const kept: unknown[] = [];
    expect(editors[0].Widget.render("7.5", (value: unknown) => kept.push(value))).toBe('<label>Price</label><input value="7.5">');
    expect(given).toEqual([[7.5, { label: "Price", symbol: "€" }]]);
    editors[0].Widget.mount(null, "7.5", (value: unknown) => kept.push(value));
    expect(kept).toEqual(["9.25"]);
    // And the block is drawn from what's kept.
    expect(tools[0].renderer.Viewer.render({ price: "9.25" })).toContain(">9.25</p>");
  });

  it("gives a property a template defines its control: the prop's own value, and the property's options as the prop has them", () => {
    const currency = defineProperty({
      name: "acme.currency",
      base: prop.number,
      options: { symbol: prop.text({ enum: ["$", "€", "£"], default: "€" }), decimals: prop.number({ integer: true, min: 0, default: 2 }), note: prop.text({}) },
    });
    const Price = component({
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
    expect(editors[0].Widget.render("7.5", (value: unknown) => kept.push(value))).toBe('<label>Price</label>$<input value="7.50">');
    expect(given).toEqual([[7.5, "$", 2]]);
    editors[0].Widget.mount(null, "7.5", (value: unknown) => kept.push(value));
    expect(kept).toEqual(["9.25"]);
    // The design keeps the value as its kind's editor does, whatever edits it.
    const [block] = blocks(toDesign(<Email><Price price={12.5} /></Email>, { customTools: true }).design);
    expect(block.values).toMatchObject({ price: "12.5", was: "9" });
    expect(fromDesign({ body: { rows: [{ cells: [1], columns: [{ contents: [block] }] }] } }, { components: [Price] }).code).toContain("<acme.Price price={12.5} />");
  });

  it("edits a prop with its kind's editor where its property's control isn't given, with none of the property's options", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number, options: { symbol: prop.text({ default: "€" }) } });
    const Stock = component({ type: "acme.Stock", label: "Stock", props: { units: currency({ label: "Units", min: 1, integer: true, default: 3, symbol: "$" }) }, render: (p) => <Text>{p.units}</Text> });
    const { builder, tools, editors } = fakeBuilder();
    registerTools(builder, [Stock]);
    expect(tools[0].options.acme_stock.options.units).toEqual({ label: "Units", defaultValue: 3, widget: "counter", data: { minValue: 1 } });
    // One registered in the builder already, by the property's name: its options as the prop has them, the value as the builder keeps it.
    registerTools(builder, [Stock], { editors: { "acme.currency": true } });
    expect(tools[1].options.acme_stock.options.units).toEqual({ label: "Units", defaultValue: 3, widget: "acme.currency", data: { label: "Units", symbol: "$" } });
    expect(editors).toEqual([]);
  });

  it("refuses an editor given as it's written in a builder that can't register one", () => {
    const Price = component({ type: "acme.Price", label: "Price", props: { price: prop.number({ label: "Price", default: 1, editor: "currency" }) }, render: (p) => <Text>{p.price}</Text> });
    const bare: Builder = { registerTool: () => {}, createViewer: (viewer) => viewer };
    expect(() => registerTools(bare, [Price], { editors: { currency: { render: () => "" } } })).toThrow("editors gives currency as it's written, which takes a builder with registerPropertyEditor() and createWidget()");
    expect(() => registerTools(bare, [Price], { editors: { currency: true } })).not.toThrow();
  });

  it("refuses an editor given for no prop of the components given: a name mistyped would leave its prop with its kind's editor, without a word", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number });
    const Price = component({ type: "acme.Price", label: "Price", props: { price: currency({ label: "Price", default: 1 }), due: prop.text({ label: "Due", editor: "datetime" }) }, render: (p) => <Text>{p.price}</Text> });
    const { builder, tools } = fakeBuilder();
    expect(() => registerTools(builder, [Price], { editors: { "acme.curency": { render: () => "" } } })).toThrow(
      "[Elements] registerTools: editors has acme.curency, which is the editor of no prop of the components given (their props name acme.currency, datetime)"
    );
    expect(() => registerTools(builder, [Price], { editors: { "acme.curency": true } })).toThrow("editors has acme.curency");
    expect(() => registerTools(builder, [Footer], { editors: { "acme.currency": true } })).toThrow("editors has acme.currency, which is the editor of no prop of the components given (none of their props names one)");
    // Nothing is registered where one is refused.
    expect(tools).toEqual([]);
    expect(() => registerTools(builder, [Price, Footer], { editors: { "acme.currency": true } })).not.toThrow();
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

  it("draws in a column with less room than a root can be at the room it has, not wider", () => {
    const { builder, tools } = fakeBuilder();
    // A photo, which fills its room, over a Row, whose columns are one under the other where they don't fit in it.
    const Pair = component({
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
    const Pair = component({ type: "acme.Pair", label: "Pair", props: {}, render: () => <Row><Column><Text>Left</Text></Column><Column><Text>Right</Text></Column></Row> });
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
    const Note = component({ type: "acme.Note", label: "Note", props: {}, render: () => <Column><Text style={{ fontSize: 20, mobile: { fontSize: 14 } }}>Note</Text><Text hidden={{ desktop: true }}>On a phone</Text></Column> });
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

  it("draws a block dragged in with a prop its component needs at its default", () => {
    const { builder, tools } = fakeBuilder();
    registerTools(builder, [Banner]);
    const start = { title: tools[0].options.acme_banner.options.title.defaultValue };
    expect(start).toEqual({ title: "Welcome" });
    expect(tools[0].renderer.Viewer.render(start)).toContain(">Welcome</p>");
    expect(tools[0].renderer.exporters.email(start)).toContain(">Welcome</p>");
  });

  it("registers no tool for a component placed where a Section goes, which is no block in a column", () => {
    const { builder, tools } = fakeBuilder();
    expect(registerTools(builder, [Hero, Footer])).toEqual(["acme_legal_footer"]);
    expect(tools.map((tool) => tool.name)).toEqual(["acme_legal_footer"]);
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

  it("refuses a setting that's what the component gives its tool, saying where it's set", () => {
    const { builder } = fakeBuilder();
    for (const setting of ["name", "label", "icon", "supportedDisplayModes", "options", "values", "renderer"]) {
      expect(() => registerTools(builder, [ProductCard], { tools: { "acme.ProductCard": { [setting]: {} } } })).toThrow(`tools sets ${setting} for acme.ProductCard, which its component gives the tool`);
    }
  });

  it("refuses a component with a prop named as one of the builder's own for a block, which toDesign() keeps an HTML block", () => {
    const Padded = component({ type: "acme.Padded", label: "Padded", props: { containerPadding: prop.length({ label: "Padding", default: 24 }) }, render: (p) => <Column style={{ padding: p.containerPadding }}><Text>Padded</Text></Column> });
    const Locked = component({ type: "acme.Locked", label: "Locked", props: { locked: prop.boolean({ label: "Locked", default: false }) }, render: (p) => <Text>{p.locked ? "locked" : "open"}</Text> });
    const { builder } = fakeBuilder();
    expect(() => registerTools(builder, [Padded])).toThrow("acme.Padded has a prop named containerPadding, which is the builder's own in a block");
    // (The builder gives every block a `locked` of its own.)
    expect(() => registerTools(builder, [Locked])).toThrow("acme.Locked has a prop named locked");
    const { design } = toDesign(<Email><Padded containerPadding={32} /></Email>, { customTools: true });
    expect(blocks(design).map((content) => content.type)).toEqual(["html"]);
    // A block of one, written by hand, is left out.
    design.body.rows[0].columns[0].contents.push({ type: "custom", slug: "acme_padded", values: { containerPadding: "0px" } });
    expect(fromDesign(design, { components: [Padded] }).report.join("\n")).toContain("whose prop containerPadding is the builder's own in a block: left out");
  });

  it("keeps the value of a tool's own property in the block, and out of the component", async () => {
    const { design } = toDesign(<Email><ProductCard name="Mug" /></Email>, { customTools: true });
    blocks(design)[0].values.product = { selected: { id: 2 } };
    const back = fromDesign(design, { components: [ProductCard] });
    expect(back.report).toEqual([]);
    expect(back.code).toContain('<acme.ProductCard name="Mug" />');
  });

  it("refuses a tool's own property named as a prop, and settings for a component that isn't given", () => {
    const { builder } = fakeBuilder();
    expect(() => registerTools(builder, [ProductCard], { tools: { "acme.ProductCard": { properties: { price: { label: "Price", widget: "text" } } } } })).toThrow("acme.ProductCard has a prop named price");
    expect(() => registerTools(builder, [ProductCard], { tools: { "acme.Product": {} } })).toThrow("settings for acme.Product, which is none of the components given");
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
