import { describe, expect, expectTypeOf, it } from "vitest";
import React, { createContext, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, Column, component, defineProperty, ElementsError, Email, Heading, Image, Page, prop, render, Row, Section, Text, validate, type Token } from "./index";
import { describeComponent, type ExpandProps } from "@hyper-elements/core";
import { collectTemplate } from "./collect";

const treeOf = (element: React.ReactElement) => collectTemplate(element).document!;

const ProductCard = component({
  type: "acme.ProductCard",
  label: "Product card",
  props: {
    name: prop.text({ label: "Name", required: true }),
    photo: prop.image({ label: "Photo", required: true }),
    href: prop.link({ label: "Link", required: true }),
    accent: prop.color({ label: "Accent", default: "#0879a1" }),
    size: prop.choice(["small", "large"], { label: "Size", default: "small" }),
  },
  render: ({ name, photo, href, accent, size }) => (
    <Column style={{ gap: 8 }}>
      <Image src={photo} alt={name} />
      <Heading level={size === "large" ? 2 : 3}>{name}</Heading>
      <Button href={href} style={{ backgroundColor: accent }}>
        Buy
      </Button>
    </Column>
  ),
});

const Hero = component({
  type: "acme.Hero",
  label: "Hero",
  placement: "section",
  props: { title: prop.text({ label: "Title", required: true }) },
  render: ({ title }) => (
    <Section style={{ backgroundColor: "#111", padding: 32 }}>
      <Heading style={{ color: "#fff" }}>{title}</Heading>
    </Section>
  ),
});

const shop = (
  <Page>
    <Hero title="New arrivals" />
    <Row style={{ gap: 16 }}>
      <ProductCard name="Sneaker" photo="https://example.com/a.png" href="https://example.com/a" />
      <ProductCard id="boot" name="Boot" photo="https://example.com/b.png" href="https://example.com/b" accent="#FF0000" size="large" style={{ flex: 2 }} />
    </Row>
  </Page>
);

describe("component()", () => {
  it("is one node in the template, with its props normalized", () => {
    const document = treeOf(shop);
    expect(document.root.children![0]).toEqual({ type: "acme.Hero", props: { title: "New arrivals" } });
    expect((document.root.children![1] as { children: unknown[] }).children).toEqual([
      { type: "acme.ProductCard", props: { name: "Sneaker", photo: "https://example.com/a.png", href: "https://example.com/a" } },
      {
        id: "boot",
        type: "acme.ProductCard",
        props: { name: "Boot", photo: "https://example.com/b.png", href: "https://example.com/b", accent: "#ff0000", size: "large" },
        style: { flex: 2 },
      },
    ]);
  });

  it("renders as the primitives it's made of, in every instance", async () => {
    const { body, text, diagnostics } = await render(shop);
    expect(diagnostics).toEqual([]);
    expect(body).toMatch(/<section style="[^"]*background-color:#111">/);
    expect(body).toContain('<h3 style="margin:0;font-size:20px');
    expect(body).toContain('<h2 style="margin:0;font-size:24px');
    expect(body).toContain('style="flex:2 1 0%');
    expect(body).toContain("background-color:#f00");
    expect(body).toContain("background-color:#0879a1");
    expect(text).toContain("NEW ARRIVALS");
    // An id only where one is written: "boot" on the second card is the instance's, not written into its render.
    expect(body).not.toMatch(/ id="/);
  });

  it("works among the template's own components, hooks and context", () => {
    const Currency = createContext("$");
    const Price = ({ amount }: { amount: number }) => {
      const symbol = useContext(Currency);
      return <ProductCard name={`Sale ${symbol}${amount}`} photo="https://example.com/c.png" href="https://example.com/c" />;
    };
    const document = treeOf(
      <Currency.Provider value="€">
        <Page>
          <Price amount={5} />
        </Page>
      </Currency.Provider>
    );
    expect(document.root.children).toEqual([{ type: "acme.ProductCard", props: { name: "Sale €5", photo: "https://example.com/c.png", href: "https://example.com/c" } }]);
  });

  it("can be made of other custom components", async () => {
    const Grid = component({
      type: "acme.Pair",
      label: "Pair",
      props: {},
      render: () => (
        <Row>
          <ProductCard name="a" photo="https://example.com/a.png" href="#" />
          <ProductCard name="b" photo="https://example.com/b.png" href="#" />
        </Row>
      ),
    });
    const { body } = await render(
      <Page>
        <Grid />
      </Page>
    );
    expect(body.match(/<h3 /g)).toHaveLength(2);
  });

  it("reports wrong props, children, and what it renders that doesn't fit", async () => {
    // @ts-expect-error name and href are required
    const missing = <ProductCard photo="https://example.com/a.png" />;
    const result = validate(<Page>{missing}</Page>);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["prop/required", "prop/required"]);

    const WithChildren = ProductCard as unknown as React.FC<Record<string, unknown>>;
    const children = validate(
      <Page>
        <WithChildren name="a" photo="https://example.com/a.png" href="#">
          <Text>x</Text>
        </WithChildren>
      </Page>
    );
    expect(children.diagnostics.map((d) => d.code)).toEqual(["children/not-allowed"]);

    const Wrong = component({ type: "acme.Wrong", label: "Wrong", props: {}, render: () => <Text style={{ margin: 4 } as never}>x</Text> });
    await expect(render(<Page><Wrong /></Page>)).rejects.toThrow(ElementsError);
    // A Hero goes where a Section goes.
    expect(validate(<Page><Column><Hero title="x" /></Column></Page>).diagnostics.map((d) => d.code)).toEqual(["children/not-allowed"]);
  });

  it("takes numbers and lengths, checked against their limits", async () => {
    const Spacer = component({
      type: "acme.Spacer",
      label: "Spacer",
      props: {
        lines: prop.number({ label: "Lines", min: 1, max: 4, integer: true, default: 1 }),
        indent: prop.length({ label: "Indent", min: 0, default: 0 }),
      },
      render: ({ lines, indent }) => <Text style={{ padding: [0, 0, 0, indent], lineHeight: lines * 1.5 }}>{"x"}</Text>,
    });
    const { html } = await render(<Page><Spacer lines={2} indent={12} /></Page>);
    expect(html).toContain("line-height:3;");
    expect(html).toContain("padding:0 0 0 12px");
    expect(validate(<Page><Spacer lines={0.5} indent={-4} /></Page>).diagnostics.map((d) => d.path)).toEqual(["root.children[0].props.lines", "root.children[0].props.indent"]);
  });

  it("is validated as render() checks it: what it renders, the output's checks and layout, rendering it once", async () => {
    let renders = 0;
    const Broken = component({
      type: "acme.Broken",
      label: "Broken",
      props: {},
      render: () => {
        renders++;
        return (
          <Column>
            {/* @ts-expect-error a Button needs an href: invalid on purpose */}
            <Button>Go</Button>
          </Column>
        );
      },
    });
    const template = (
      <Email>
        <Broken />
      </Email>
    );
    const result = validate(template);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((d) => [d.code, d.path])).toEqual([["prop/required", "root.children[0](acme.Broken).children[0].props.href"]]);
    expect(renders).toBe(1);
    await expect(render(template)).rejects.toThrow(/prop\/required/);
    expect(renders).toBe(2);
  });

  it("is validated with the output's warnings, which leave it valid", () => {
    const result = validate(
      <Email>
        <Row style={{ justifyContent: "space-between" }}>
          <Column />
        </Row>
      </Email>
    );
    // Then React's note that the email client checks come from email-clients' plugin.
    expect(result).toMatchObject({ valid: true, diagnostics: [{ code: "email/unsupported", severity: "warning", path: "root.children[0].style.justifyContent" }, { code: "email/more-checks", severity: "info" }] });
  });

  it("can't share its type with another custom component in one template", async () => {
    const card = (label: string) =>
      component({ type: "acme.Card", label, props: { title: prop.text({ label: "Title", required: true }) }, render: ({ title }) => <Text>{`${label}: ${title}`}</Text> });
    const [A, B] = [card("A"), card("B")];
    const template = (
      <Page>
        <A title="one" />
        <B title="two" />
      </Page>
    );
    expect(validate(template)).toMatchObject({ valid: false, diagnostics: [{ code: "custom/duplicate", severity: "error", path: "jsx" }] });
    await expect(render(template)).rejects.toThrow(/Two different custom components are named acme\.Card/);
    // One component used twice is one component.
    expect(validate(<Page><A title="one" /><A title="two" /></Page>).valid).toBe(true);
    // component() called in a component makes one per render: the message says where to call it.
    const Product = ({ title }: { title: string }) => {
      const Inline = component({ type: "acme.Inline", label: "Inline", props: { title: prop.text({ label: "Title", required: true }) }, render: (props) => <Text>{props.title}</Text> });
      return <Inline title={title} />;
    };
    const twice = validate(<Page><Product title="one" /><Product title="two" /></Page>);
    expect(twice.diagnostics.map((d) => d.code)).toEqual(["custom/duplicate"]);
    expect(twice.diagnostics[0].message).toMatch(/call it once, at the top of a module/);
  });

  it("says how to use it when rendered on its own", () => {
    expect(() => renderToStaticMarkup(<ProductCard name="a" photo="https://example.com/a.png" href="#" />)).toThrow(/render\(\)/);
  });

  it("describes its props for editors", () => {
    const described = describeComponent("acme.ProductCard", { components: [ProductCard.definition] })!;
    expect(described.properties.map((p) => [p.path, p.editor, p.required])).toEqual([
      ["props.name", "text", true],
      ["props.photo", "image", true],
      ["props.href", "link", true],
      ["props.accent", "color", false],
      ["props.size", "choice", false],
      ["style.flex", "number", false],
    ]);
  });

  it("names the editor of a prop where its kind's own isn't the one wanted, its value its kind's either way", async () => {
    const Order = component({
      type: "acme.Order",
      label: "Order",
      props: {
        quantity: prop.number({ label: "Quantity", min: 1, default: 1, editor: "counter" }),
        price: prop.number({ label: "Price", min: 0, default: 19, editor: "currency", editorOptions: { symbol: "€" } }),
        note: prop.text({ label: "Note", default: "" }),
      },
      render: (p) => <Text>{`${p.quantity} × ${p.price}`}</Text>,
    });
    const described = describeComponent("acme.Order", { components: [Order.definition] })!;
    const editors = Object.fromEntries(described.properties.filter((property) => property.path.startsWith("props.")).map((property) => [property.path, [property.editor, property.namedEditor]]));
    // Its kind's editor is still said: an app with no editor by the prop's name shows that one.
    expect(editors).toEqual({ "props.quantity": ["number", "counter"], "props.price": ["number", "currency"], "props.note": ["text", undefined] });
    // What a prop gives its editor besides the value is said as it is.
    expect(described.properties.filter((property) => property.editorOptions).map((property) => [property.path, property.editorOptions])).toEqual([["props.price", { symbol: "€" }]]);
    expect((await render(<Email><Order quantity={2} price={24} /></Email>)).text).toContain("2 × 24");
    expect(validate(<Email><Order price={-1} /></Email>).diagnostics.map((d) => d.code)).toEqual(["prop/invalid"]);
  });

  it("says what a prop gives its kind's own editor, where it names no other", () => {
    const Stepper = component({
      type: "acme.Stepper",
      label: "Stepper",
      props: { steps: prop.number({ label: "Steps", integer: true, default: 10, editorOptions: { step: 5 } }), plain: prop.number({ label: "Plain", default: 1 }) },
      render: (p) => <Text>{`${p.steps} ${p.plain}`}</Text>,
    });
    const described = describeComponent("acme.Stepper", { components: [Stepper.definition] })!;
    const props = described.properties.filter((property) => property.path.startsWith("props."));
    expect(props.map((property) => [property.path, property.editor, property.namedEditor, property.editorOptions])).toEqual([
      ["props.steps", "number", undefined, { step: 5 }],
      ["props.plain", "number", undefined, undefined],
    ]);
  });

  it("refuses an editor's name that isn't a word", () => {
    const named = (editor: string) => () => component({ type: "acme.Named", label: "Named", props: { n: prop.number({ label: "N", editor }) }, render: () => <Text>n</Text> });
    expect(named("my_color-picker2")).not.toThrow();
    for (const name of ["", "two words", "<b>", "1st"]) expect(named(name)).toThrow(`acme.Named: the editor of n is a name ("counter", "currency"), not ${JSON.stringify(name)}`);
  });

  it("refuses editorOptions that aren't an object", () => {
    const given = (editorOptions: never) => () => component({ type: "acme.Named", label: "Named", props: { n: prop.number({ label: "N", editor: "counter", editorOptions }) }, render: () => <Text>n</Text> });
    expect(given({ step: 5 } as never)).not.toThrow();
    for (const options of [5, "step", [5], null]) expect(given(options as never)).toThrow(`acme.Named: the editorOptions of n are an object ({ step: 5 }), not ${JSON.stringify(options)}`);
  });

  it("limits a text to the texts its enum lists", async () => {
    const Tag = component({
      type: "acme.Tag",
      label: "Tag",
      props: { tone: prop.text({ label: "Tone", enum: ["calm", "loud"], default: "calm" }), note: prop.text({ label: "Note" }) },
      render: (p) => <Text>{`${p.tone}: ${p.note ?? ""}`}</Text>,
    });
    const described = describeComponent("acme.Tag", { components: [Tag.definition] })!;
    // Edited as a choice is, and said as one.
    expect(described.properties.filter((property) => property.path.startsWith("props.")).map((property) => [property.path, property.editor, property.accepts])).toEqual([
      ["props.tone", "choice", 'one of "calm", "loud"'],
      ["props.note", "text", "text"],
    ]);
    expect((await render(<Email><Tag tone="loud" note="now" /></Email>)).text).toContain("loud: now");
    // @ts-expect-error -- a text that isn't one of its enum's: said where it's written, and where it's checked.
    const shouted = <Tag tone="shout" />;
    expect(validate(<Email>{shouted}</Email>).diagnostics.map((d) => [d.code, d.message])).toEqual([["prop/invalid", expect.stringContaining('tone: expected one of "calm", "loud", not "shout"')]]);
    type Props = ExpandProps<typeof Tag.definition.props>;
    expectTypeOf<Props["tone"]>().toEqualTypeOf<"calm" | "loud">();
    expectTypeOf<Props["note"]>().toEqualTypeOf<string | undefined>();
    // @ts-expect-error -- a default that isn't one of the enum's.
    prop.text({ label: "Tone", enum: ["calm", "loud"], default: "shout" });
    for (const values of [[], [1], "calm"]) expect(() => prop.text({ label: "Tone", enum: values as never })).toThrow(`A text's enum lists the texts it may be (["$", "€"]), not ${JSON.stringify(values)}`);
  });

  it("defines a property of a team's own on one of prop's helpers: called, it's that helper's prop, with the property's editor and options", async () => {
    const currency = defineProperty({
      name: "acme.currency",
      base: prop.number,
      options: { symbol: prop.text({ enum: ["$", "€", "£"], default: "$" }), decimals: prop.number({ integer: true, min: 0, default: 2 }), compact: prop.boolean({}) },
    });
    expect([currency.name, currency.base, Object.keys(currency.options)]).toEqual(["acme.currency", "number", ["symbol", "decimals", "compact"]]);
    const price = currency({ label: "Price", min: 0, default: 19, symbol: "€" });
    // The prop is its base's, as that helper makes it.
    expect([price.label, price.default, price.kind.name, price.kind.accepts]).toEqual(["Price", 19, "number", "a number from 0"]);
    // Its editor is the property's: its name, what it edits, its options whole (each its default where the prop doesn't
    // say, and left out where there's none).
    expect(price.editor).toEqual({ name: "acme.currency", edits: "number", options: { symbol: "€", decimals: 2 } });
    // Data alone, with no control in it: what a description can hold, and a template renders with.
    expect(JSON.parse(JSON.stringify(price.editor))).toEqual(price.editor);
    // The helper's own names work as they're written apart, too (`const { number, text } = prop`).
    const { number, text } = prop;
    const stepped = defineProperty({ name: "acme.stepped", base: number, options: { unit: text({ required: true }) } });
    expect(stepped({ label: "Weight", unit: "kg" }).editor).toEqual({ name: "acme.stepped", edits: "number", options: { unit: "kg" } });
    const flip = defineProperty({ name: "acme.flip", base: prop.boolean });
    const Order = component({
      type: "acme.Order",
      label: "Order",
      props: {
        price,
        shipping: currency({ label: "Shipping", min: 0, required: true, compact: true }),
        gift: flip({ label: "Gift" }),
      },
      render: (p) => <Text>{`${p.price} + ${p.shipping}`}</Text>,
    });
    const described = describeComponent("acme.Order", { components: [Order.definition] })!;
    const props = described.properties.filter((property) => property.path.startsWith("props."));
    // Its kind's editor is still said, for an app with no control by the name.
    expect(props.map((property) => [property.path, property.editor, property.namedEditor, property.editorOptions])).toEqual([
      ["props.price", "number", "acme.currency", { symbol: "€", decimals: 2 }],
      ["props.shipping", "number", "acme.currency", { symbol: "$", decimals: 2, compact: true }],
      ["props.gift", "toggle", "acme.flip", undefined],
    ]);
    // The value is its base's whatever edits it: its limits, and what render is given.
    expect((await render(<Email><Order price={24} shipping={5} /></Email>)).text).toContain("24 + 5");
    expect(validate(<Email><Order price={-1} shipping={5} /></Email>).diagnostics.map((d) => d.code)).toEqual(["prop/invalid"]);
    // @ts-expect-error -- a required prop is required in JSX, made by a property as by its helper.
    const short = <Order price={24} />;
    expect(validate(<Email>{short}</Email>).diagnostics.map((d) => d.code)).toEqual(["prop/required"]);
    type Props = ExpandProps<typeof Order.definition.props>;
    expectTypeOf<Props["price"]>().toEqualTypeOf<number>();
    expectTypeOf<Props["shipping"]>().toEqualTypeOf<number>();
    expectTypeOf<Props["gift"]>().toEqualTypeOf<boolean | undefined>();
  });

  it("makes a property on a text with an enum, a length or a color as on a number", () => {
    const size = defineProperty({ name: "acme.size", base: prop.text, options: { columns: prop.number({ integer: true, min: 1, default: 3 }) } });
    const picked = size({ label: "Size", enum: ["s", "m", "l"], default: "m" });
    expect([picked.kind.accepts, picked.default, picked.editor]).toEqual(['one of "s", "m", "l"', "m", { name: "acme.size", edits: "choice", options: { columns: 3 } }]);
    const gap = defineProperty({ name: "acme.gap", base: prop.length });
    expect([gap({ label: "Gap", units: ["px", "%"], default: "50%" }).default, gap({ label: "Gap" }).editor]).toEqual(["50%", { name: "acme.gap", edits: "length", options: {} }]);
    const swatch = defineProperty({ name: "acme.swatch", base: prop.color, options: { palette: prop.text({ default: "brand" }) } });
    const Card = component({
      type: "acme.Swatched",
      label: "Swatched",
      props: { size: picked, tint: swatch({ label: "Tint", default: "#0879a1" }) },
      render: (p) => <Text style={{ color: p.tint }}>{p.size}</Text>,
    });
    type Props = ExpandProps<typeof Card.definition.props>;
    expectTypeOf<Props["size"]>().toEqualTypeOf<"s" | "m" | "l">();
    expectTypeOf<Props["tint"]>().toEqualTypeOf<string>();
    // A color made by a property takes a theme's token in JSX, as prop.color's does.
    expectTypeOf<Parameters<typeof Card>[0]["tint"]>().toEqualTypeOf<string | Token | undefined>();
  });

  it("refuses a property's definition that isn't one: its name, its base, an option", () => {
    for (const name of ["currency", "Acme.currency", "acme.", "acme.two words"]) {
      expect(() => defineProperty({ name, base: prop.number })).toThrow(`A property's name is a namespace, a dot and a word ("acme.currency"), not ${JSON.stringify(name)}`);
    }
    const helpers = "prop.text, prop.color, prop.image, prop.link, prop.boolean, prop.fontFamily, prop.fontWeight, prop.number, prop.length";
    // @ts-expect-error -- a base is one of prop's helpers itself, not its name.
    expect(() => defineProperty({ name: "acme.currency", base: "number" })).toThrow(`The property acme.currency is made on one of prop's helpers (${helpers})`);
    // @ts-expect-error -- a choice takes its values apart from its options: a text with an enum is the base for one.
    expect(() => defineProperty({ name: "acme.currency", base: prop.choice })).toThrow(`The property acme.currency is made on one of prop's helpers (${helpers}): for one of a few values, prop.text with an enum`);
    // An option named as something its prop takes would hide it.
    for (const option of ["label", "default", "required", "min", "integer", "editor", "editorOptions"]) {
      expect(() => defineProperty({ name: "acme.currency", base: prop.number, options: { [option]: prop.text({}) } })).toThrow(`The property acme.currency can't have an option named ${option}: that's its prop's`);
    }
    // (What another helper takes is free: a number has no enum, a text no min.)
    expect(() => defineProperty({ name: "acme.currency", base: prop.number, options: { enum: prop.text({}), units: prop.text({}) } })).not.toThrow();
    expect(() => defineProperty({ name: "acme.label", base: prop.text, options: { min: prop.number({}) } })).not.toThrow();
    expect(() => defineProperty({ name: "acme.label", base: prop.text, options: { enum: prop.text({}) } })).toThrow("The property acme.label can't have an option named enum: that's its prop's");
    // @ts-expect-error -- an option is made with one of prop's helpers, which says what it may be.
    expect(() => defineProperty({ name: "acme.currency", base: prop.number, options: { symbol: "€" } })).toThrow('The property acme.currency: its option symbol is made with one of prop\'s helpers (prop.text({ default: "$" })), not "€"');
    // @ts-expect-error -- an option's default is one of its own values.
    expect(() => defineProperty({ name: "acme.currency", base: prop.number, options: { symbol: prop.text({ enum: ["$", "€"], default: "¥" }) } })).toThrow(
      'The property acme.currency: the default of its option symbol: expected one of "$", "€", not "¥"'
    );
  });

  it("refuses what a property isn't given right where it's called: an option it doesn't have, a value that isn't the option's, another editor", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number, options: { symbol: prop.text({ enum: ["$", "€", "£"], default: "$" }), locale: prop.text({ required: true }) } });
    // @ts-expect-error -- no such option: a typo is said, not dropped.
    expect(() => currency({ label: "Price", locale: "en", symbl: "€" })).toThrow("The property acme.currency has no option named symbl (it has symbol, locale, beside what prop.number takes)");
    // @ts-expect-error -- not one of the option's values.
    expect(() => currency({ label: "Price", locale: "en", symbol: "¥" })).toThrow('The property acme.currency: its symbol: expected one of "$", "€", "£", not "¥"');
    // @ts-expect-error -- a required option is required.
    expect(() => currency({ label: "Price" })).toThrow("The property acme.currency needs its locale");
    // @ts-expect-error -- its editor is its own.
    expect(() => currency({ label: "Price", locale: "en", editor: "counter" })).toThrow("The property acme.currency is edited with its own editor: it takes no editor");
    // @ts-expect-error -- and so are that editor's options.
    expect(() => currency({ label: "Price", locale: "en", editorOptions: { step: 5 } })).toThrow("The property acme.currency is edited with its own editor: it takes no editorOptions");
    // @ts-expect-error -- what another helper takes isn't this one's.
    expect(() => currency({ label: "Price", locale: "en", units: ["px"] })).toThrow("The property acme.currency has no option named units (it has symbol, locale, beside what prop.number takes)");
    const plain = defineProperty({ name: "acme.plain", base: prop.boolean });
    // @ts-expect-error -- with no options of its own, it takes what its helper does.
    expect(() => plain({ label: "Plain", symbol: "€" })).toThrow("The property acme.plain has no option named symbol (it takes what prop.boolean takes)");
  });

  it("refuses a prop that isn't one: no label, a property that isn't called, an editor that isn't a property's", () => {
    const currency = defineProperty({ name: "acme.currency", base: prop.number, options: { symbol: prop.text({ default: "€" }) } });
    const made = (props: Record<string, any>) => () => component({ type: "acme.Named", label: "Named", props, render: () => <Text>n</Text> });
    // A component's prop has a label (an option of a property needs none): said where it's written, and where the component is made.
    // @ts-expect-error -- no label.
    expect(() => component({ type: "acme.Named", label: "Named", props: { n: prop.number({ min: 0 }) }, render: () => <Text>n</Text> })).toThrow("acme.Named: n needs a label: what an editor shows for it");
    // @ts-expect-error -- no label, made by a property.
    expect(() => component({ type: "acme.Named", label: "Named", props: { n: currency({ min: 0 }) }, render: () => <Text>n</Text> })).toThrow("acme.Named: n needs a label: what an editor shows for it");
    expect(made({ n: currency })).toThrow('acme.Named: n is a property\'s definition: call it for the prop (n: currency({ label: "…" }))');
    // @ts-expect-error -- a prop's editor is a name; a property is the prop itself.
    const named = prop.number({ label: "N", editor: currency });
    expect(made({ n: named })).toThrow('acme.Named: the editor of n is a property\'s definition: that\'s the prop itself (n: currency({ label: "…" }))');
    // What a property gives a prop is checked as it's read, however it got there.
    const { editor } = currency({ label: "Price" });
    expect(made({ title: { ...prop.text({ label: "Title" }), editor } })).toThrow("acme.Named: the editor acme.currency edits a number, and title is a text");
    expect(made({ n: { ...currency({ label: "N" }), editorOptions: { symbol: "$" } } })).toThrow("acme.Named: n gives editorOptions beside the editor acme.currency, which takes its options from its property");
    expect(made({ n: { ...prop.number({ label: "N" }), editor: { name: "currency", edits: "number", options: {} } } })).toThrow('acme.Named: the editor of n is one a property gives (defineProperty()), named like "acme.currency", not "currency"');
  });

  it("types render's props: required and defaulted ones always there", () => {
    type Props = ExpandProps<typeof ProductCard.definition.props>;
    expectTypeOf<Props["accent"]>().toEqualTypeOf<string>();
    expectTypeOf<Props["size"]>().toEqualTypeOf<"small" | "large">();
    expectTypeOf<Props["name"]>().toEqualTypeOf<string>();
    const sized = { width: prop.length({ label: "Width", units: ["px", "%"], default: 100 }), count: prop.number({ label: "Count", default: 1 }) };
    type Sized = ExpandProps<typeof sized>;
    expectTypeOf<Sized["width"]>().not.toEqualTypeOf<undefined>();
    expectTypeOf<undefined>().not.toMatchTypeOf<Sized["width"]>();
    expectTypeOf<Sized["count"]>().toEqualTypeOf<number>();
    // A font weight's value is one a style's fontWeight takes (100 to 900), not any number.
    const weighted = { weight: prop.fontWeight({ label: "Weight", default: 700 }) };
    expectTypeOf<ExpandProps<typeof weighted>["weight"]>().toEqualTypeOf<100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900>();
    expectTypeOf(<Text style={{ fontWeight: 700 as ExpandProps<typeof weighted>["weight"] }}>bold</Text>).not.toBeNever();
  });
});
