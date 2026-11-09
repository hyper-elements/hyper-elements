/**
 * Themes: tokens, roles, scopes, component defaults by a prop's value, variants, named styles and `formats`, merged into
 * each node when a template is read (Decision 9 of the themes-and-pages plan).
 */
import type { ReactElement } from "react";
import { checkDocument, Registry, type Diagnostic, type Json, type ResolvedNode } from "@unlayer-internal/elements-core";
import { toDesign } from "../builder";
import { inspect, INSPECT_VERSION } from "../inspect";
import { collectTemplate } from "./collect";
import { Button, Column, component, defineTheme, Divider, Document, Email, extendTheme, Grid, Heading, Html, Link, Page, prepare, prop, render, Row, Section, Text, token, validate } from "./index";

const brand = defineTheme({
  colors: {
    background: "#ffffff",
    foreground: "#111827",
    primary: "#0f766e",
    primaryForeground: "#ffffff",
    border: "#e5e7eb",
    muted: "#f3f4f6",
    accent: "#7c3aed",
    link: "{colors.primary}",
    gray: { 900: "#111827" },
  },
  spacing: { sm: 8, md: 16, lg: 32 },
  fontSizes: { small: 14, body: 16 },
  fonts: { body: "Inter, Arial, sans-serif", heading: "Georgia, serif" },
  radii: { md: 8, card: { topLeft: 12, topRight: 12 } },
  components: {
    Heading: { fontWeight: 600, by: { level: { 1: { fontSize: 40, mobile: { fontSize: 30 } }, 2: { fontSize: 28 } } } },
    Button: {
      borderRadius: "{radii.md}",
      hover: { backgroundColor: "#115e59" },
      variants: {
        secondary: { backgroundColor: "{colors.muted}", color: "{colors.foreground}" },
        outline: { apply: ["outlined"], backgroundColor: "transparent", color: "{colors.primary}" },
        small: { padding: [6, 12], fontSize: "{fontSizes.small}" },
        loud: { backgroundColor: "{colors.accent}" },
      },
    },
  },
  styles: {
    card: { padding: "{spacing.lg}", backgroundColor: "{colors.background}", mobile: { padding: "{spacing.md}" } },
    outlined: { border: { width: 1, style: "solid", color: "{colors.border}" } },
    h1: { fontSize: 32, mobile: { fontSize: 26 } },
    quiet: { color: "#6b7280" },
  },
});

/** The laid-out tree of a template, and what was found. */
function laid(element: ReactElement) {
  const { root, diagnostics } = prepare(element);
  return { root: root!, diagnostics };
}
const child = (node: ResolvedNode, ...indices: number[]): ResolvedNode => indices.reduce<ResolvedNode>((at, i) => at.children.filter((c): c is ResolvedNode => typeof c !== "string")[i], node);
const codes = (diagnostics: readonly Diagnostic[]) => diagnostics.map((d) => d.code);
const errors = (element: ReactElement) => validate(element).diagnostics.filter((d) => d.severity === "error");

describe("roles", () => {
  it("give the root its background, text color and font, and the built-ins theirs", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Heading>Title</Heading>
        <Button href="https://example.com">Go</Button>
        <Link href="https://example.com">a link</Link>
        <Divider />
      </Email>
    );
    expect(root.style).toMatchObject({ backgroundColor: "#ffffff", color: "#111827", fontFamily: "Inter, Arial, sans-serif" });
    expect(child(root, 0).style.fontFamily).toBe("Georgia, serif");
    expect(child(root, 1).style).toMatchObject({ backgroundColor: "#0f766e", color: "#ffffff" });
    expect(child(root, 2).style.color).toBe("#0f766e");
    expect(child(root, 3).style.borderTop).toEqual({ width: 1, style: "solid", color: "#e5e7eb" });
  });

  it("apply only where the theme defines the token", () => {
    const { root } = laid(
      <Email theme={defineTheme({ colors: { foreground: "#222222" } })}>
        <Button href="https://example.com">Go</Button>
      </Email>
    );
    expect(root.style.color).toBe("#222222");
    // The Button's own defaults: the theme has no primary.
    expect(child(root, 0).style.backgroundColor).toBe("#0879a1");
  });

  it("sit under a component default, a variant, a named style and the node's own style", () => {
    const theme = defineTheme({ colors: { primary: "#0f766e" }, components: { Button: { variants: { red: { backgroundColor: "#ff0000" } } } }, styles: { blue: { backgroundColor: "#0000ff" } } });
    const { root } = laid(
      <Email theme={theme}>
        <Button href="https://example.com" variant="red">a</Button>
        <Button href="https://example.com" style={{ apply: ["blue"] }}>b</Button>
        <Button href="https://example.com" style={{ backgroundColor: "#00ff00" }}>c</Button>
      </Email>
    );
    expect([0, 1, 2].map((i) => child(root, i).style.backgroundColor)).toEqual(["#ff0000", "#0000ff", "#00ff00"]);
  });
});

describe("precedence", () => {
  it("is component default, its by value, variants in order, named styles in order, then its own style", () => {
    const theme = defineTheme({
      components: {
        Heading: { color: "#000001", by: { level: { 2: { color: "#000002" } } }, variants: { a: { color: "#00000a" }, b: { color: "#00000b" } } },
      },
      styles: { x: { color: "#0000f1" }, y: { color: "#0000f2" } },
    });
    const colors = laid(
      <Email theme={theme}>
        <Heading level={1}>default</Heading>
        <Heading level={2}>by</Heading>
        <Heading level={2} variant={["a", "b"]}>a then b</Heading>
        <Heading level={2} variant={["b", "a"]}>b then a</Heading>
        <Heading level={2} variant="a" style={{ apply: ["x", "y"] }}>x then y</Heading>
        <Heading level={2} variant="a" style={{ apply: ["y", "x"] }}>y then x</Heading>
        <Heading level={2} variant="a" style={{ apply: ["x"], color: "#ffffff" }}>own</Heading>
      </Email>
    ).root.children.map((node) => (node as ResolvedNode).style.color);
    expect(colors).toEqual(["#000001", "#000002", "#00000b", "#00000a", "#0000f2", "#0000f1", "#ffffff"]);
  });

  it("merges each condition block key by key", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Section style={{ apply: ["card"], mobile: { gap: 4 } }}>
          <Text>a</Text>
        </Section>
      </Email>
    );
    expect(child(root, 0).mobile).toEqual({ padding: { top: 16, right: 16, bottom: 16, left: 16 }, gap: 4 });
  });

  it("lets a key the node sets in its base take that key out of lower sources' blocks", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Heading style={{ apply: ["h1"], fontSize: 20 }}>own size</Heading>
        <Heading style={{ apply: ["h1"], fontSize: 20, mobile: { fontSize: 18 } }}>own phone size</Heading>
        <Heading style={{ apply: ["h1"] }}>the named style's</Heading>
        <Button href="https://example.com" style={{ backgroundColor: "#ff0000" }}>own color</Button>
      </Email>
    );
    expect(child(root, 0).style.fontSize).toBe(20);
    expect(child(root, 0).mobile?.fontSize).toBeUndefined();
    expect(child(root, 1).mobile?.fontSize).toBe(18);
    expect(child(root, 2).mobile?.fontSize).toBe(26);
    expect(child(root, 3).hover?.backgroundColor).toBeUndefined();
  });

  it("keeps a lower source's block where a variant or named style, not the node, sets the base key", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Button href="https://example.com" variant="loud">a</Button>
      </Email>
    );
    expect(child(root, 0).style.backgroundColor).toBe("#7c3aed");
    expect(child(root, 0).hover?.backgroundColor).toBe("#115e59");
  });

  it("gives every Heading its level's size without the template naming it", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Heading>one (the default level)</Heading>
        <Heading level={2}>two</Heading>
        <Heading level={3}>three</Heading>
      </Email>
    );
    expect(child(root, 0).style.fontSize).toBe(40);
    expect(child(root, 0).mobile?.fontSize).toBe(30);
    expect(child(root, 1).style.fontSize).toBe(28);
    // No theme value for level 3: the built-in's.
    expect(child(root, 2).style.fontSize).toBe(20);
  });
});

describe("tokens", () => {
  it("stand for a whole value, an array item or part of an object form", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Column style={{ padding: [token("spacing.lg"), token("spacing.md")], border: { width: 1, style: "solid", color: token("colors.border") }, borderRadius: token("radii.card") }}>
          <Text style={{ color: token("colors.gray.900"), fontSize: token("fontSizes.small") }}>a</Text>
        </Column>
      </Email>
    );
    const column = child(root, 0);
    expect(column.style.padding).toEqual({ top: 32, right: 16, bottom: 32, left: 16 });
    expect(column.style.border).toMatchObject({ top: { width: 1, style: "solid", color: "#e5e7eb" } });
    expect(column.style.borderRadius).toEqual({ topLeft: 12, topRight: 12, bottomRight: 0, bottomLeft: 0 });
    expect(child(column, 0).style).toMatchObject({ color: "#111827", fontSize: 14 });
  });

  it("follow aliases inside the theme, written as strings or as token()", () => {
    const theme = defineTheme({ colors: { base: "#123456", brand: "{colors.base}", other: { $token: "colors.brand" } as never } });
    const { root } = laid(
      <Email theme={theme}>
        <Text style={{ color: token("colors.other") }}>a</Text>
      </Email>
    );
    expect(child(root, 0).style.color).toBe("#123456");
  });

  it("aren't read in a value's string form, or as alias strings in a template", () => {
    const found = errors(
      <Email theme={brand}>
        <Text style={{ color: "{colors.primary}" }}>a</Text>
      </Email>
    );
    expect(codes(found)).toEqual(["style/invalid"]);
  });

  it("are refused from the wrong group, in a loop, or where they don't exist", () => {
    const theme = defineTheme({ colors: { a: "{colors.b}", b: "{colors.a}", primary: "#000000" }, spacing: { md: 16 } });
    const found = errors(
      <Email theme={theme}>
        <Text style={{ color: token("spacing.md") }}>wrong group</Text>
        <Text style={{ color: token("colors.primry") }}>typo</Text>
        <Text style={{ color: token("colors.a") }}>loop</Text>
      </Email>
    );
    expect(codes(found)).toEqual(expect.arrayContaining(["theme/value", "theme/missing-token", "theme/cycle"]));
    expect(found.find((d) => d.code === "theme/missing-token")?.message).toContain('did you mean "colors.primary"');
    expect(found.find((d) => d.code === "theme/value")?.path).toBe("root.children[0].style.color");
  });

  it("without a theme, a token is missing", () => {
    expect(codes(errors(<Email><Text style={{ color: token("colors.primary") }}>a</Text></Email>))).toEqual(["theme/missing-token"]);
  });

  it("check every token when the theme is read, used or not, and refuse modes and groups that come later", () => {
    const found = errors(
      <Email theme={{ colors: { ok: "#000000", bad: "not a color", "gray-900": "#111111", mode: { base: "#fff", dark: "#000" } }, fontSizes: { zero: 0 }, shadows: { sm: "0 1px 2px #000" } } as never}>
        <Text>a</Text>
      </Email>
    );
    expect(found.map((d) => [d.code, d.path])).toEqual([
      ["theme/schema", "root.theme.colors.bad"],
      ["theme/schema", "root.theme.colors.gray-900"],
      ["theme/schema", "root.theme.colors.mode"],
      ["theme/schema", "root.theme.fontSizes.zero"],
      ["theme/schema", "root.theme.shadows"],
    ]);
    expect(found[1].message).toContain("gray.900");
    expect(found[2].message).toContain("dark mode");
  });

  it("tell a token from a group one way: a corner object in radii is a token, a corner name can't name one", () => {
    const found = errors(
      <Email theme={{ radii: { card: { topLeft: 4, topRight: 8 }, group: { a: 2 }, topLeft: 3 } } as never}>
        <Column style={{ borderRadius: token("radii.card") }}>
          <Column style={{ borderRadius: token("radii.group.a") }}>
            <Text>a</Text>
          </Column>
        </Column>
      </Email>
    );
    expect(found.map((d) => [d.code, d.path])).toEqual([["theme/schema", "root.theme.radii.topLeft"]]);
  });
});

describe("scopes", () => {
  it("make an inverted band one prop: its background and text change, a Button inside keeps the primary", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Section tokens={{ colors: { background: "#111827", foreground: "#ffffff" } }}>
          <Text>white</Text>
          <Button href="https://example.com">Go</Button>
        </Section>
        <Section>
          <Text>default</Text>
        </Section>
      </Email>
    );
    const band = child(root, 0);
    expect(band.style).toMatchObject({ backgroundColor: "#111827", color: "#ffffff" });
    expect(child(band, 0).text.color).toBe("#ffffff");
    expect(child(band, 1).style.backgroundColor).toBe("#0f766e");
    // A Section without tokens applies no roles of its own.
    expect(child(root, 1).style.backgroundColor).toBeUndefined();
  });

  it("nest, swap two tokens, and carry the theme's aliases with them", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Section tokens={{ colors: { foreground: token("colors.background"), background: token("colors.foreground") } }}>
          <Column tokens={{ colors: { primary: "#ff0000" } }}>
            <Link href="https://example.com" style={{ color: token("colors.link") }}>a</Link>
            <Button href="https://example.com">b</Button>
          </Column>
        </Section>
      </Email>
    );
    const band = child(root, 0);
    expect(band.style).toMatchObject({ backgroundColor: "#111827", color: "#ffffff" });
    expect(child(band, 0, 0).style.color).toBe("#ff0000");
    expect(child(band, 0, 1).style.backgroundColor).toBe("#ff0000");
  });

  it("work without a theme", () => {
    const { root, diagnostics } = laid(
      <Email>
        <Section tokens={{ colors: { background: "#000000", foreground: "#ffffff" } }}>
          <Text>a</Text>
        </Section>
      </Email>
    );
    expect(codes(diagnostics.filter((d) => d.severity === "error"))).toEqual([]);
    expect(child(root, 0).style).toMatchObject({ backgroundColor: "#000000", color: "#ffffff" });
  });

  it("let a literal component default on a container beat the scope's role, and a reference follow it", () => {
    const literal = defineTheme({ components: { Section: { backgroundColor: "#eeeeee" } } });
    const reference = defineTheme({ colors: { background: "#ffffff" }, components: { Section: { backgroundColor: "{colors.background}" } } });
    const band = (theme: typeof literal) => child(laid(<Email theme={theme}><Section tokens={{ colors: { background: "#000000" } }}><Text>a</Text></Section></Email>).root, 0).style.backgroundColor;
    expect(band(literal)).toBe("#eeeeee");
    expect(band(reference)).toBe("#000000");
  });

  it("go only on Section, Row, Column and Grid", () => {
    expect(codes(errors(<Email><Text tokens={{ colors: { foreground: "#000" } }}>a</Text></Email>))).toEqual(["prop/unknown"]);
  });
});

describe("a template's own components", () => {
  const Card = component({
    type: "acme.Card",
    label: "Card",
    props: { title: prop.text({ label: "Title", required: true }), tint: prop.color({ label: "Tint" }), variant: prop.text({ label: "A prop named variant" }) },
    render: ({ title, tint, variant }, { theme }) => (
      <Column style={{ backgroundColor: tint }}>
        <Text>{title}</Text>
        <Text>{`${(theme.colors as Record<string, Json> | undefined)?.foreground}`}</Text>
        <Text>{variant ?? "none"}</Text>
        <Column tokens={{ colors: { foreground: "#00ff00" } }}>
          <Text>green</Text>
        </Column>
      </Column>
    ),
  });
  const textDefaults = defineTheme({ colors: { foreground: "#000000" }, components: { Text: { color: "{colors.foreground}" } } });

  it("render what they hold in the scopes around them, as the same nodes written there would be", () => {
    const { root } = laid(
      <Page theme={textDefaults}>
        <Section tokens={{ colors: { foreground: "#777777" } }}>
          <Column tokens={{ colors: { foreground: "#ffffff" } }}>
            <Text>direct</Text>
            <Card title="custom" variant="kept" tint={token("colors.foreground")} />
          </Column>
        </Section>
      </Page>
    );
    const column = child(root, 0, 0);
    const card = child(column, 1);
    expect(child(column, 0).style.color).toBe("#ffffff");
    expect(card.style.backgroundColor).toBe("#ffffff");
    expect(child(card, 0).style.color).toBe("#ffffff");
    expect(child(card, 1).children).toEqual(["#ffffff"]);
    // A prop of its own named variant keeps its meaning.
    expect(child(card, 2).children).toEqual(["kept"]);
    // A scope inside what it renders.
    expect(child(card, 3, 0).style.color).toBe("#00ff00");
  });

  it("take no named styles themselves", () => {
    expect(codes(errors(<Email theme={brand}><Card title="a" style={{ apply: ["card"] } as never} /></Email>))).toEqual(["style/apply-place"]);
  });
});

describe("variants and named styles", () => {
  it("merge in order, and a variant's named styles under it", () => {
    const { root } = laid(
      <Email theme={brand}>
        <Button href="https://example.com" variant={["outline", "small"]}>Docs</Button>
      </Email>
    );
    expect(child(root, 0).style).toMatchObject({ backgroundColor: "transparent", color: "#0f766e", fontSize: 14, padding: { top: 6, right: 12, bottom: 6, left: 12 }, border: { top: { width: 1, style: "solid", color: "#e5e7eb" } } });
  });

  it("say what's unknown, with what exists", () => {
    const found = errors(
      <Email theme={brand}>
        <Button href="https://example.com" variant="secundary">a</Button>
        <Text style={{ apply: ["carrd"] }}>b</Text>
        <Text style={{ mobile: { apply: ["card"] } as never }}>c</Text>
      </Email>
    );
    expect(found.map((d) => [d.code, d.path])).toEqual([
      ["variant/unknown", "root.children[0].variant"],
      ["style/unknown-name", "root.children[1].style.apply[0]"],
      ["style/apply-place", "root.children[2].style.mobile.apply"],
    ]);
    expect(found[0].message).toContain('did you mean "secondary"');
    expect(found[1].message).toContain('did you mean "card"');
  });

  it("have none without a theme", () => {
    const found = errors(<Email><Button href="https://example.com" variant="secondary">a</Button></Email>);
    expect(found.map((d) => d.code)).toEqual(["variant/unknown"]);
    expect(found[0].message).toContain("no theme");
  });

  it("refuse a loop of named styles, and a second by prop", () => {
    const found = errors(
      <Email theme={{ styles: { a: { apply: ["b"] }, b: { apply: ["a"] } }, components: { Heading: { by: { level: {}, dir: {} } } } } as never}>
        <Text style={{ apply: ["a"] }}>x</Text>
      </Email>
    );
    expect(codes(found)).toEqual(expect.arrayContaining(["theme/cycle", "theme/schema"]));
  });

  it("are suggested where another library's styling prop is written", () => {
    const found = errors(<Email theme={brand}><Button href="https://example.com" {...({ className: "primary" } as object)}>a</Button></Email>);
    expect(found[0].code).toBe("prop/unknown");
    expect(found[0].message).toContain('variant="…"');
    expect(found[0].message).toContain("secondary");
  });
});

describe("theme/inherited", () => {
  const theme = defineTheme({ components: { Text: { color: "#333333" } }, colors: { foreground: "#000000" } });

  it("says where a component default stops a node's own color reaching what it holds, once", () => {
    const found = validate(
      <Email theme={theme}>
        <Section style={{ color: "#ffffff", backgroundColor: "#000000" }}>
          <Text>a</Text>
          <Text>b</Text>
        </Section>
      </Email>
    ).diagnostics.filter((d) => d.code === "theme/inherited");
    expect(found.map((d) => d.path)).toEqual(["root.children[0].children[0].style.color"]);
    expect(found[0].message).toContain("colors.foreground");
  });

  it("isn't said where the default is the same, the node sets its own, or the default follows a scope", () => {
    const follows = defineTheme({ colors: { foreground: "#000000" }, components: { Text: { color: "{colors.foreground}" } } });
    const said = (element: ReactElement) => validate(element).diagnostics.filter((d) => d.code === "theme/inherited");
    expect(said(<Email theme={theme}><Section style={{ color: "#333333" }}><Text>same</Text></Section></Email>)).toEqual([]);
    expect(said(<Email theme={theme}><Section style={{ color: "#ffffff" }}><Text style={{ color: "#ffffff" }}>own</Text></Section></Email>)).toEqual([]);
    expect(said(<Email theme={follows}><Section tokens={{ colors: { foreground: "#ffffff" } }}><Text>scope</Text></Section></Email>)).toEqual([]);
  });
});

describe("extendTheme() and formats", () => {
  it("merges objects key by key at every depth, and replaces a list", () => {
    const base = defineTheme({ colors: { primary: "#000000", gray: { 100: "#f3f4f6", 900: "#111827" } }, components: { Button: { padding: 8, variants: { x: { color: "#000000" } } } }, styles: { a: { apply: ["b"], color: "#000000" }, b: {} } });
    const extended = extendTheme(base, { colors: { gray: { 900: "#000000" } }, components: { Button: { variants: { y: { color: "#ffffff" } } } }, styles: { a: { apply: [] } } });
    expect(extended.colors).toEqual({ primary: "#000000", gray: { 100: "#f3f4f6", 900: "#000000" } });
    expect(Object.keys(extended.components.Button.variants)).toEqual(["x", "y"]);
    expect(extended.components.Button.padding).toBe(8);
    expect(extended.styles.a).toEqual({ apply: [], color: "#000000" });
  });

  it("is frozen data that survives a JSON round trip", async () => {
    expect(Object.isFrozen(brand)).toBe(true);
    expect(Object.isFrozen(brand.colors)).toBe(true);
    expect(brand.tokens.colors.primary).toEqual({ $token: "colors.primary" });
    expect(brand.tokens.radii.card).toEqual({ $token: "radii.card" });
    const copy = JSON.parse(JSON.stringify(brand));
    expect(copy.tokens).toBeUndefined();
    const html = async (theme: unknown) => (await render(<Email theme={theme as never}><Button href="https://example.com">Go</Button></Email>)).html;
    expect(await html(copy)).toBe(await html(brand));
  });

  it("formats override the theme for one kind of root", () => {
    const theme = extendTheme(brand, { formats: { email: { components: { Button: { borderRadius: 0 } } }, page: { colors: { primary: "#000000" } } } });
    expect(child(laid(<Email theme={theme}><Button href="https://example.com">a</Button></Email>).root, 0).style.borderRadius).toBe(0);
    const page = child(laid(<Page theme={theme}><Button href="https://example.com">a</Button></Page>).root, 0);
    expect(page.style.borderRadius).toBe(8);
    expect(page.style.backgroundColor).toBe("#000000");
    expect(errors(<Email theme={{ formats: { web: {} } } as never}><Text>a</Text></Email>).map((d) => d.path)).toEqual(["root.theme.formats.web"]);
  });

  it("leaves out what a root doesn't take: a theme's phone styles in a Document", () => {
    const { root, diagnostics } = laid(
      <Document theme={brand}>
        <Heading>a</Heading>
      </Document>
    );
    expect(codes(diagnostics.filter((d) => d.severity === "error"))).toEqual([]);
    expect(child(root, 0).style.fontSize).toBe(40);
    expect(child(root, 0).mobile).toBeUndefined();
  });
});

describe("reading", () => {
  it("merges once: a document read again is the same, with no new diagnostics", () => {
    const { document, components } = collectTemplate(
      <Email theme={brand}>
        <Section style={{ apply: ["card"] }} tokens={{ colors: { foreground: "#ffffff" } }}>
          <Heading>a</Heading>
          <Button href="https://example.com" variant="loud">b</Button>
        </Section>
      </Email>
    );
    expect(document!.theme).toBeDefined();
    const again = checkDocument(JSON.parse(JSON.stringify(document)), new Registry(components));
    expect(again.diagnostics).toEqual([]);
    expect(again.document).toEqual(document);
  });

  it("keeps a template with neither a theme nor a scope as it was", () => {
    const { document } = collectTemplate(<Email><Text>a</Text></Email>);
    expect(document).toEqual({ root: { type: "Email", children: [{ type: "Text", children: ["a"] }] } });
  });

  it("renders concurrent templates with different themes, each with its own", async () => {
    const other = extendTheme(brand, { colors: { primary: "#ff0000" } });
    const [a, b] = await Promise.all([brand, other].map((theme) => render(<Email theme={theme}><Button href="https://example.com">Go</Button></Email>)));
    expect(a.html).toContain("#0f766e");
    expect(b.html).toContain("#ff0000");
    expect(b.html).not.toContain("#0f766e");
  });
});

describe("a Page's custom properties", () => {
  it("are every token on the root, and on a scope those that differ there (an alias whose token changed too)", async () => {
    const { html } = await render(
      <Page theme={brand}>
        <Section tokens={{ colors: { primary: "#ff0000" } }}>
          <Grid tokens={{ spacing: { md: 20 } }}>
            <Text>a</Text>
          </Grid>
        </Section>
      </Page>
    );
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)![1];
    expect(style).toContain("--colors-primary:#0f766e;");
    expect(style).toContain("--colors-gray-900:#111827");
    expect(style).toContain("--spacing-lg:32px");
    expect(style).toContain("--radii-card:12px 12px 0 0");
    expect(style).toMatch(/\{--colors-primary:#f00;--colors-link:#f00\}/);
    expect(style).toMatch(/\{--spacing-md:20px\}/);
    expect(html).toContain('<main class="e');
  });

  it("keep a value as written: a font with & and text like a color", async () => {
    const { html } = await render(<Page theme={defineTheme({ fonts: { body: '"R&D Sans #ffffff", Arial' } })}><Text>a</Text></Page>);
    expect(html).toContain('--fonts-body:"R&D Sans #ffffff", Arial');
  });

  it("aren't written in an Email, a Document or a Canvas", async () => {
    expect((await render(<Email theme={brand}><Text>a</Text></Email>)).html).not.toContain("--colors-");
    expect((await render(<Document theme={brand}><Text>a</Text></Document>)).html).not.toContain("--colors-");
  });

  it("are reached by an Html block's own markup", async () => {
    const { html } = await render(<Page theme={brand}><Html html={'<p style="color:var(--colors-primary)">a</p>'} /></Page>);
    expect(html).toContain("var(--colors-primary)");
  });
});

describe("hostile themes", () => {
  it("can't add a declaration, a rule or an element through a token's name or value", async () => {
    const hostile = {
      colors: { 'x:0;color:red;--y': "#000000", ok: "#000000", bad: "#000;}</style><script>alert(1)</script>" },
      fonts: { body: "Arial;}body{display:none", heading: "a</style><b>" },
    };
    const found = errors(<Page theme={hostile as never}><Text>a</Text></Page>);
    expect(found.map((d) => d.path)).toEqual(["root.theme.colors.x:0;color:red;--y", "root.theme.colors.bad", "root.theme.fonts.body", "root.theme.fonts.heading"]);
    const scoped = errors(<Page><Section tokens={{ colors: { "a}b": "#000000", c: "red;}x{" } } as never}><Text>a</Text></Section></Page>);
    expect(scoped.length).toBe(2);
  });
});

describe("inspect()", () => {
  it("lists the theme: its tokens, the roles it defines, its named styles and each component's variants", () => {
    const inspected = inspect(<Email theme={brand}><Button href="https://example.com" variant="secondary">a</Button></Email>);
    expect(inspected.version).toBe(INSPECT_VERSION);
    expect(INSPECT_VERSION).toBe(2);
    expect(inspected.theme!.tokens).toContainEqual({ path: "colors.link", group: "colors", value: "#0f766e" });
    expect(inspected.theme!.roles).toEqual(expect.arrayContaining(["colors.background", "colors.foreground", "fonts.body", "colors.primary", "colors.primaryForeground", "fonts.heading", "colors.border"]));
    expect(inspected.theme!.styles).toEqual(["card", "outlined", "h1", "quiet"]);
    expect(inspected.theme!.components).toEqual([{ type: "Heading", variants: [], by: "level" }, { type: "Button", variants: ["secondary", "outline", "small", "loud"] }]);
    expect(inspected.nodes[1].given).toEqual(["props.href", "variant"]);
    expect(inspect(<Email><Text>a</Text></Email>).theme).toBeNull();
  });
});

describe("the builder", () => {
  it("writes the theme's values and says it keeps no theme", () => {
    const { design, report } = toDesign(
      <Email theme={brand}>
        <Button href="https://example.com" variant="secondary">a</Button>
      </Email>
    );
    expect(report.some((line) => line.includes("keeps no theme"))).toBe(true);
    expect(JSON.stringify(design)).toContain("#f3f4f6");
  });

  it("draws a template's own component in a locked block with the theme and the scopes around it", () => {
    const Tinted = component({ type: "acme.Tinted", label: "Tinted", props: {}, render: () => <Column><Button href="https://example.com">a</Button></Column> });
    const { design } = toDesign(
      <Email theme={brand}>
        <Section tokens={{ colors: { primary: "#ff0000" } }}>
          <Row>
            <Column>
              <Tinted />
            </Column>
          </Row>
        </Section>
      </Email>
    );
    const json = JSON.stringify(design);
    expect(json).toContain("#f00");
  });
});
