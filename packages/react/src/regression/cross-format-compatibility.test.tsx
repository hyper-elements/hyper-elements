/**
 * The compatibility baseline: what existing templates give today, recorded, so a change that adds to Elements can
 * show it changed none of it. Each template in the gallery and the stress set (the screen ones as an Email and as a
 * Page), and templates with components of their own, in every root: the HTML, the plain text, the class names, the
 * diagnostics, the outline (each block's width), the Unlayer design and its report, a Document's PDF and a Canvas's
 * image as drawn (the data handed to the engine: every text run, box and page); and each saved builder design read
 * back (the template's code and report, and its HTML); and each entry's exports.
 *
 * Recorded at the commit that completes the conditions plan (PR #103), under `__compat__/`. A change that's meant to
 * change one of these rewrites it on purpose: UPDATE_COMPAT=1 pnpm --filter @hyper-elements/react test cross-format,
 * and the pull request says what changed and why. The controls at the end check this suite fails where it should.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { writeDocument } from "@unlayer-internal/elements-core/pdf";
import { writeCanvas } from "@unlayer-internal/elements-core/image";
import { fromDesign, toDesign } from "../builder";
import { gallery } from "../primitives/examples/gallery";
import { stress } from "../primitives/examples/stress";
import * as main from "../primitives/index";
import { Button, Column, component, Email, Heading, Image, outline, Page, prepare, prop, render, Row, Section, Text, validate } from "../primitives/index";

const DIR = join(__dirname, "__compat__");
const DESIGNS = join(__dirname, "../builder/__fixtures__/designs");
const UPDATE = !!process.env.UPDATE_COMPAT;

/** A component of a template's own, as an author writes one: props, a render, Elements' components inside. */
const ProductCard = component({
  type: "acme.ProductCard",
  label: "Product card",
  props: {
    name: prop.text({ label: "Name", required: true }),
    price: prop.text({ label: "Price", required: true }),
    photo: prop.image({ label: "Photo", required: true }),
    href: prop.link({ label: "Link", required: true }),
    accent: prop.color({ label: "Accent", default: "#0f766e" }),
  },
  render: ({ name, price, photo, href, accent }) => (
    <Column style={{ gap: 8, padding: 16, backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <Image src={photo} alt={name} style={{ width: "100%" }} />
      <Heading level={3} style={{ fontSize: 18 }}>{name}</Heading>
      <Text style={{ color: "#4b5563", mobile: { fontSize: 14 } }}>{price}</Text>
      <Button href={href} style={{ backgroundColor: accent, hover: { backgroundColor: "#111827" } }}>Buy {name}</Button>
    </Column>
  ),
});

const photo = { src: "https://example.com/shoe.png", width: 600, height: 400 };
const products = (Root: typeof Email | typeof Page) => (
  <Root width={640} title="New arrivals">
    <Section style={{ padding: [32, 24], gap: 24, backgroundColor: "#f3f4f6" }}>
      <Heading level={1} style={{ textAlign: "center", mobile: { fontSize: 24 } }}>New arrivals</Heading>
      <Row style={{ gap: 16 }}>
        <ProductCard name="Trail runner" price="$120" photo={photo} href="https://example.com/trail" />
        <ProductCard name="City walker" price="$95" photo={photo} href="https://example.com/city" accent="#7c3aed" />
      </Row>
      <Text hidden={{ mobile: true }}>Free shipping on every order.</Text>
    </Section>
  </Root>
);

const CASES: Array<{ name: string; template: ReactElement }> = [
  ...Object.entries(gallery).map(([name, template]) => ({ name: `gallery-${name}`, template })),
  ...Object.entries(stress).flatMap(([name, entry]) =>
    entry.roots === "screen"
      ? [
          { name: `stress-${name}-email`, template: entry.template(Email) },
          { name: `stress-${name}-page`, template: entry.template(Page) },
        ]
      : [{ name: `stress-${name}`, template: entry.template }]
  ),
  { name: "custom-products-email", template: products(Email) },
  { name: "custom-products-page", template: products(Page) },
];

type Record_ = Record<string, unknown>;

/** The class names in some HTML, each once, sorted. */
const classes = (html: string) => [...new Set([...html.matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean))].sort();
const diagnostics = (list: Array<{ code: string; severity: string; path?: string; message: string }>) => list.map(({ code, severity, path, message }) => ({ code, severity, path, message }));

/** What a template gives today. */
async function record(template: ReactElement): Promise<Record_> {
  const checked = validate(template);
  const rendered = await render(template);
  const prepared = prepare(template);
  const root = prepared.root!;
  const out: Record_ = {
    root: root.type,
    html: rendered.html,
    text: rendered.text,
    classes: classes(rendered.html),
    diagnostics: { validate: diagnostics(checked.diagnostics), render: diagnostics(rendered.diagnostics), prepare: diagnostics(prepared.diagnostics) },
    outline: outline(template),
  };
  if (root.type !== "Canvas") out.design = toDesign(template);
  if (root.type === "Document") out.pdf = writeDocument(root, { families: new Set(), fonts: [], image: () => undefined, date: new Date(Date.UTC(2026, 0, 1)) });
  if (root.type === "Canvas") out.image = writeCanvas(root, { families: new Set(), fallback: "", fonts: [], image: () => undefined });
  // As stored: what JSON keeps (an undefined is left out).
  return JSON.parse(JSON.stringify(out));
}

/** A saved builder design read back: the template's code and report, and its HTML. */
async function recordDesign(file: string): Promise<Record_> {
  const { element, code, report } = fromDesign(JSON.parse(readFileSync(join(DESIGNS, file), "utf8")));
  const rendered = await render(element);
  return JSON.parse(JSON.stringify({ code, report, html: rendered.html, text: rendered.text, diagnostics: diagnostics(rendered.diagnostics) }));
}

/** Each entry's exports, by name. */
async function recordExports(): Promise<Record_> {
  const entries: Record<string, Record<string, unknown>> = {
    ".": main,
    "./builder": await import("../builder/index"),
    "./pdf": await import("../pdf/index"),
    "./image": await import("../image/index"),
  };
  return Object.fromEntries(Object.entries(entries).map(([entry, module]) => [entry, Object.keys(module).sort()]));
}

/**
 * Where an output differs from what was recorded, one line each (none: it's the same). Strings are compared whole,
 * and the line shows where they part; the rest by value.
 */
export function differences(expected: unknown, actual: unknown, at = ""): string[] {
  if (typeof expected === "string" && typeof actual === "string") {
    if (expected === actual) return [];
    let i = 0;
    while (i < expected.length && expected[i] === actual[i]) i++;
    const around = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 40));
    return [`${at || "(value)"}: differs at ${i}: expected …${around(expected)}…, got …${around(actual)}…`];
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const out: string[] = [];
    if (expected.length !== actual.length) out.push(`${at}: ${expected.length} items expected, ${actual.length} found`);
    for (let i = 0; i < Math.min(expected.length, actual.length); i++) out.push(...differences(expected[i], actual[i], `${at}[${i}]`));
    return out;
  }
  if (expected && actual && typeof expected === "object" && typeof actual === "object" && !Array.isArray(expected) && !Array.isArray(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...keys].flatMap((key) => {
      const e = (expected as Record_)[key];
      const a = (actual as Record_)[key];
      if (!(key in (expected as Record_))) return [`${at}.${key}: not recorded, found ${JSON.stringify(a)?.slice(0, 80)}`];
      if (!(key in (actual as Record_))) return [`${at}.${key}: recorded, now missing`];
      return differences(e, a, `${at}.${key}`);
    });
  }
  return Object.is(expected, actual) ? [] : [`${at || "(value)"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
}

const fixture = (name: string) => join(DIR, `${name}.json`);
function check(name: string, actual: Record_): string[] {
  if (UPDATE) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(fixture(name), `${JSON.stringify(actual, null, 1)}\n`);
    return [];
  }
  if (!existsSync(fixture(name))) return [`${name}: no recording (UPDATE_COMPAT=1 records it)`];
  return differences(JSON.parse(readFileSync(fixture(name), "utf8")), actual);
}

describe("the compatibility baseline", () => {
  it.each(CASES)("$name gives what it gave", async ({ name, template }) => {
    expect(check(name, await record(template))).toEqual([]);
  });

  it.each(readdirSync(DESIGNS).filter((file) => file.endsWith(".json")))("the saved design %s reads back as it did", async (file) => {
    expect(check(`design-${file.replace(/\.json$/, "")}`, await recordDesign(file))).toEqual([]);
  });

  it("each entry exports what it did", async () => {
    expect(check("exports", await recordExports())).toEqual([]);
  });

  it("has a recording for every case, and none for a case that's gone", () => {
    if (UPDATE) return;
    const expected = [
      ...CASES.map((c) => c.name),
      ...readdirSync(DESIGNS)
        .filter((file) => file.endsWith(".json"))
        .map((file) => `design-${file.replace(/\.json$/, "")}`),
      "exports",
    ].sort();
    expect(
      readdirSync(DIR)
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(/\.json$/, ""))
        .sort()
    ).toEqual(expected);
  });
});

describe("the baseline's controls: it fails where an output changed", () => {
  const recorded = (name: string): Record_ => JSON.parse(readFileSync(fixture(name), "utf8"));
  const email = () => recorded("gallery-oyenLaunch");
  const page = () => recorded("custom-products-page");

  it("on a lost word", () => {
    const actual = email();
    const word = (actual.text as string).match(/[A-Za-z]{4,}/)![0];
    actual.text = (actual.text as string).replace(word, "");
    actual.html = (actual.html as string).replace(word, "");
    const found = differences(email(), actual);
    expect(found.some((line) => line.startsWith(".text:"))).toBe(true);
    expect(found.some((line) => line.startsWith(".html:"))).toBe(true);
  });

  it("on a changed class", () => {
    const actual = email();
    const name = (actual.classes as string[])[0];
    actual.html = (actual.html as string).replace(`class="${name}`, `class="${name}x`);
    actual.classes = classes(actual.html as string);
    const found = differences(email(), actual);
    expect(found.some((line) => line.startsWith(".classes"))).toBe(true);
  });

  it("on a changed breakpoint", () => {
    const actual = page();
    expect(actual.html as string).toMatch(/max-width: ?\d+px/);
    actual.html = (actual.html as string).replace(/max-width: ?(\d+)px/, (_, px) => `max-width:${Number(px) + 1}px`);
    expect(differences(page(), actual).some((line) => line.startsWith(".html:"))).toBe(true);
  });

  it("on a changed builder value", () => {
    const actual = email();
    const design = JSON.stringify(actual.design);
    const color = /"#[0-9a-f]{6}"/i.exec(design)![0];
    actual.design = JSON.parse(design.replace(color, '"#123456"'));
    expect(differences(email(), actual).some((line) => line.startsWith(".design."))).toBe(true);
  });

  it("on a changed diagnostic, and on one added or gone", () => {
    const actual = page();
    const diagnostics = actual.diagnostics as { render: Array<Record_> };
    diagnostics.render = [...diagnostics.render, { code: "new/one", severity: "info", path: "root", message: "New" }];
    expect(differences(page(), actual).some((line) => line.startsWith(".diagnostics.render"))).toBe(true);
  });
});
