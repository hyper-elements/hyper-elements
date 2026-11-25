/**
 * Templates (`@hyper-elements/react/template`): values read strictly by their fields, the design built and checked in
 * each format (bindings, images shown as their rules say), describe(), update(), values files and versions, and a
 * template as a design's root, handed to the template by every entry point.
 */
import React, { forwardRef, memo, Suspense } from "react";
import { toDesign } from "../builder";
import { inspect } from "../inspect";
import { Canvas, Column, component, Email, Grid, Heading, Image, Layer, Menu, outline, Page, prepare, prop, render, Section, Social, Text, validate, type Diagnostic } from "../primitives/index";
import { digest, launch, newsletter } from "./examples";
import { check, field, fitInside, formatDate, readValuesFile, sniffImage, template, templateRequest, toValuesFile } from "./index";

const codes = (diagnostics: Diagnostic[]) => diagnostics.filter((d) => d.severity !== "info").map((d) => [d.code, d.path]);
const values = <T,>(result: { values?: T }) => result.values!;

const CDN = "https://cdn.acme.example";
const shot = { src: `${CDN}/s.png`, width: 2400, height: 1500 };
const waves = { src: `${CDN}/w.png`, width: 2160, height: 1360 };

describe("examples", () => {
  it.each([
    ["launch", launch, ["square", "landscape"]],
    ["digest", digest, ["default"]],
    ["newsletter", newsletter, ["default"]],
  ] as const)("%s: check() accepts its example, and builds each format", async (_, t, formats) => {
    const checked = (t as typeof launch).check(t.example);
    expect(codes(checked.diagnostics)).toEqual([]);
    expect(checked.valid).toBe(true);
    expect(Object.keys(checked.snapshots)).toEqual(formats);
    for (const snapshot of Object.values(checked.snapshots)) expect((await render(snapshot!)).html.length).toBeGreaterThan(100);
  });

  it("design() returns the declared root's element, with no wrapper", () => {
    const element = launch.design(launch.example, { format: "square" });
    expect((element.type as { displayName?: string }).displayName ?? (element.type as { name: string }).name).toBe("Canvas");
    expect(() => launch.design(launch.example)).toThrow(/template\/format/);
    expect(() => launch.design({ ...launch.example, headline: 3 } as never, { format: "square" })).toThrow(/template\/value/);
  });
});

describe("values", () => {
  const T = template({
    id: "acme.Values",
    version: "1.0.0",
    label: "Values",
    root: "Email",
    fields: {
      title: prop.text({ label: "Title", required: true, maxLength: 10, pattern: "^[A-Z]" }),
      when: prop.date({ label: "When" }),
      tone: prop.choice(["calm", "loud"], { label: "Tone", default: "calm" }),
      tags: prop.list(prop.text({ label: "Tag" }), { label: "Tags", min: 1, max: 2 }),
      cta: prop.object({ text: prop.text({ label: "Text", required: true }), href: prop.link({ label: "Link", required: true }) }, { label: "Call to action" }),
      photo: field.image({ label: "Photo", aspect: { min: 1, max: 2 }, minWidth: 100, minHeight: 50, accepts: ["png", "jpeg"] }),
    },
    example: { title: "Hello", tags: ["a"] },
    render: (v) => (
      <Email>
        <Text field="title">{v.title}</Text>
      </Email>
    ),
  });
  const read = (input: unknown) => T.check(input);

  it("reads each kind, and refuses each with its code and path", () => {
    expect(values(read({ title: "Hello", tags: ["a"] }))).toEqual({ title: "Hello", tone: "calm", tags: ["a"] });
    // Text that isn't required may be empty.
    expect(read({ title: "Hello", tags: [""] }).valid).toBe(true);
    const cases: Array<[unknown, string, string]> = [
      [{ tags: ["a"] }, "template/required", "values.title"],
      // Blank is missing: an empty string, and one that's only spaces.
      [{ title: "", tags: ["a"] }, "template/required", "values.title"],
      [{ title: "  \n ", tags: ["a"] }, "template/required", "values.title"],
      [{ title: "hello", tags: ["a"] }, "template/value", "values.title"],
      [{ title: "Hello world, again", tags: ["a"] }, "template/value", "values.title"],
      [{ title: "Hello", tags: ["a"], when: "2026-02-30" }, "template/value", "values.when"],
      [{ title: "Hello", tags: ["a"], tone: "quiet" }, "template/value", "values.tone"],
      [{ title: "Hello", tags: [] }, "template/count", "values.tags"],
      [{ title: "Hello", tags: ["a", "b", "c"] }, "template/count", "values.tags"],
      [{ title: "Hello", tags: ["a", 3] }, "template/value", "values.tags[1]"],
      [{ title: "Hello", tags: ["a"], cta: { text: "Go" } }, "template/required", "values.cta.href"],
      [{ title: "Hello", tags: ["a"], cta: { text: "Go", href: "https://a.example", color: "red" } }, "template/unknown-field", "values.cta.color"],
      [{ title: "Hello", tags: ["a"], photo: "https://a.example/p.png" }, "template/value", "values.photo"],
      [{ title: "Hello", tags: ["a"], photo: { src: "https://a.example/p.png", width: 100 } }, "template/value", "values.photo"],
      [{ title: "Hello", tags: ["a"], photo: { src: "https://a.example/p.png", width: 300, height: 100 } }, "template/asset-aspect", "values.photo"],
      [{ title: "Hello", tags: ["a"], photo: { src: "https://a.example/p.png", width: 50, height: 50 } }, "template/asset-pixels", "values.photo"],
      [{ title: "Hello", tags: ["a"], photo: { src: "https://a.example/p.gif", width: 200, height: 150 } }, "template/asset-type", "values.photo"],
      [{ title: "Hello", tags: ["a"], photo: { src: "https://a.example/p.png", width: 200, height: 150, sha256: "abc" } }, "template/value", "values.photo"],
    ];
    for (const [input, code, path] of cases) {
      const result = read(input);
      expect(result.valid, JSON.stringify(input)).toBe(false);
      expect(codes(result.diagnostics), JSON.stringify(input)).toContainEqual([code, path]);
    }
    // Near misses: each passes.
    for (const input of [
      { title: "Héllo", tags: ["a", "b"] },
      { title: "Hello", tags: ["a"], when: "2024-02-29" },
      { title: "Hello", tags: ["a"], cta: { text: "Go", href: "https://a.example" } },
      { title: "Hello", tags: ["a"], photo: { src: "https://a.example/p.jpg", width: 200, height: 100 } },
      { title: "Hello", tags: ["a"], photo: { src: "https://a.example/p", width: 100, height: 100 } },
    ]) {
      // (Errors only: the photo, which this template doesn't show, is template/unbound, a warning.)
      expect(read(input).diagnostics.filter((d) => d.severity === "error"), JSON.stringify(input)).toEqual([]);
    }
  });

  it("refuses a field it doesn't have, theme, style and children too, naming its fields", () => {
    for (const key of ["headlineFont", "theme", "style", "children"]) {
      const result = read({ title: "Hello", tags: ["a"], [key]: "x" });
      expect(codes(result.diagnostics)).toEqual([["template/unknown-field", `values.${key}`]]);
      expect(result.diagnostics[0].message).toContain("its fields: title, when, tone, tags, cta, photo");
      expect(result.diagnostics[0].fix).toBeDefined();
    }
  });

  it("a list not given is [] and its min applies; an optional object not given is undefined", () => {
    expect(codes(read({ title: "Hello" }).diagnostics)).toEqual([["template/count", "values.tags"]]);
    expect(values(read({ title: "Hello", tags: ["a"] }))).not.toHaveProperty("cta");
  });

  it("matches a pattern the same way every time, with the u flag, and as its schema says", () => {
    const P = prop.text({ label: "P", pattern: "^\\p{Lu}" });
    for (let i = 0; i < 3; i++) {
      expect(P.kind.parse("Ölfass").ok).toBe(true);
      expect(P.kind.parse("ölfass").ok).toBe(false);
    }
    expect(P.kind.jsonSchema()).toEqual({ type: "string", pattern: "^\\p{Lu}" });
  });

  it("is plain data: a getter is read once, and a function is jsx/value", () => {
    let reads = 0;
    const input = {
      tags: ["a"],
      get title() {
        reads++;
        return reads === 1 ? "Hello" : "x";
      },
    };
    const { valid } = validate(React.createElement(T, input as never));
    expect(valid).toBe(true);
    expect(reads).toBe(1);
    const withFunction = validate(React.createElement(T, { title: "Hello", tags: ["a"], cta: { text: () => "Go", href: "https://a.example" } } as never));
    expect(codes(withFunction.diagnostics)).toEqual([["jsx/value", "values.cta.text"]]);
  });
});

describe("update()", () => {
  const checked = values(digest.check({ ...digest.example, promo: { text: "Join", href: "https://acme.example/join" } }));

  it("keeps what it doesn't name by reference, merges objects, replaces lists", () => {
    const later = digest.update(checked, { intro: "New intro" });
    expect(later.intro).toBe("New intro");
    expect(later.stories).toBe(checked.stories);
    expect(later.promo).toBe(checked.promo);
    const promo = digest.update(checked, { promo: { text: "Join us" } });
    expect(promo.promo).toEqual({ text: "Join us", href: "https://acme.example/join" });
    const one = digest.update(checked, { stories: [{ title: "Only", href: "https://acme.example/only" }] });
    expect(one.stories).toEqual([{ title: "Only", href: "https://acme.example/only" }]);
    expect(digest.update(checked, { promo: null })).not.toHaveProperty("promo");
  });

  it("throws for a field it doesn't have and for a bad value", () => {
    expect(() => digest.update(checked, { headlineFont: "Comic Sans" } as never)).toThrow(/template\/unknown-field at values\.headlineFont/);
    expect(() => digest.update(checked, { stories: [] })).toThrow(/template\/count at values\.stories: 0 items; this template takes 1 to 6/);
  });
});

describe("bindings", () => {
  it("checks a node's field against the fields, and gives diagnostics on bound nodes their field", () => {
    const T = template({
      id: "acme.Bound",
      version: "1.0.0",
      label: "Bound",
      root: "Email",
      fields: { title: prop.text({ label: "Title", required: true }), stories: prop.list(prop.object({ title: prop.text({ label: "Title" }) }, { label: "Story" }), { label: "Stories" }) },
      example: { title: "Hi", stories: [{ title: "One" }] },
      render: (v) => (
        <Email>
          <Heading field="title">{v.title}</Heading>
          <Text field="title" style={{ margin: 4 } as never}>
            {v.title}
          </Text>
          <Text field="stories[0].title">{v.stories[0]?.title}</Text>
          <Text field="stories[3].title">x</Text>
          <Text field="nope">x</Text>
        </Email>
      ),
    });
    const result = T.check(T.example);
    expect(codes(result.diagnostics)).toEqual([
      ["style/unknown", "root.children[1].style.margin"],
    ]);
    expect(result.diagnostics.find((d) => d.code === "style/unknown")?.field).toBe("title");
    // The design's own error stops the check before bindings; without it, both unknown bindings are found.
    const fixed = template({ ...T, id: "acme.Bound2", render: (v: { title: string }) => <Email><Heading field="title">{v.title}</Heading><Text field="stories[3].title">x</Text><Text field="nope">x</Text></Email> } as never) as typeof T;
    expect(codes(fixed.check(fixed.example).diagnostics)).toEqual([
      ["template/unknown-binding", "root.children[1].field"],
      ["template/unknown-binding", "root.children[2].field"],
    ]);
  });

  it("finds a binding on a Grid's child and the Grid, a Menu and a Social, in prepare() and inspect()", () => {
    const T = template({
      id: "acme.Grid",
      version: "1.0.0",
      label: "Grid",
      root: "Page",
      fields: { cards: prop.list(prop.text({ label: "Card" }), { label: "Cards" }), nav: prop.text({ label: "Nav" }), icons: prop.text({ label: "Icons" }) },
      example: { cards: ["a", "b"] },
      render: (v) => (
        <Page>
          <Section>
            <Grid field="cards" columns={2}>
              {v.cards.map((card, i) => (
                <Text key={i} field={`cards[${i}]`}>
                  {card}
                </Text>
              ))}
            </Grid>
            <Menu field="nav" items={[{ text: "Home", href: "https://a.example" }]} />
            <Social field="icons" icons={[{ name: "X", href: "https://x.com/a" }]} />
          </Section>
        </Page>
      ),
    });
    expect(codes(T.check(T.example).diagnostics)).toEqual([]);
    const root = prepare(T.design(T.example)).root!;
    const fields: string[] = [];
    const walk = (node: typeof root) => {
      if (node.field) fields.push(`${node.type}:${node.field}`);
      for (const child of node.children) if (typeof child !== "string") walk(child);
    };
    walk(root);
    expect(fields).toEqual(["Column:cards", "Text:cards[0]", "Text:cards[1]", "Row:nav", "Row:icons"]);
    const inspected = inspect(T.design(T.example));
    expect(inspected.nodes.filter((n) => n.field).map((n) => `${n.type}:${n.field}`)).toEqual(["Grid:cards", "Text:cards[0]", "Text:cards[1]", "Menu:nav", "Social:icons"]);
  });

  it("drops a binding inside a custom component's render, and an image with rules nothing shows is template/unbound", () => {
    const Card = component({ type: "acme.PhotoCard", label: "Photo card", props: { photo: prop.image({ label: "Photo", required: true }) }, render: ({ photo }) => <Column><Image field="photo" src={photo} alt="" /></Column> });
    const T = template({
      id: "acme.Card",
      version: "1.0.0",
      label: "Card",
      root: "Email",
      fields: { photo: field.image({ label: "Photo", required: true, fit: "contain" }) },
      example: { photo: { src: `${CDN}/p.png`, width: 400, height: 300 } },
      render: (v) => (
        <Email>
          <Card photo={v.photo} />
        </Email>
      ),
    });
    const result = T.check(T.example);
    expect(result.valid).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toEqual(expect.arrayContaining(["template/unbound"]));
    expect(prepare(T.design(T.example)).diagnostics.map((d) => d.code)).toContain("field/dropped");
  });

  it("leaves a custom component's own prop named field to it", async () => {
    const Tag = component({ type: "acme.Tag", label: "Tag", props: { field: prop.text({ label: "Field" }) }, render: ({ field: name }) => <Text>{name}</Text> });
    const { html } = await render(
      <Email>
        <Tag field="mine" />
      </Email>
    );
    expect(html).toContain("mine");
  });
});

describe("images where they're shown", () => {
  const make = (style: Record<string, number>, rules: Parameters<typeof field.image>[0], base = false) =>
    template({
      id: "acme.Shown",
      version: "1.0.0",
      label: "Shown",
      root: "Canvas",
      fields: { photo: field.image(rules) },
      example: { photo: { src: `${CDN}/p.png`, width: 1600, height: 900 } },
      render: (v) => (
        <Canvas width={600} height={600}>
          {base ? (
            <Layer style={style}>
              <Image field="photo" src={v.photo!} alt="" />
            </Layer>
          ) : (
            <Image field="photo" src={v.photo!} alt="" style={style} />
          )}
        </Canvas>
      ),
    });
  const found = (t: ReturnType<typeof make>) => codes(t.check(t.example).diagnostics).map(([code]) => code);

  it("a contain image sized with fitInside() is neither cropped nor distorted; one stretched is template/asset-distorted", () => {
    expect(found(make(fitInside({ width: 1600, height: 900 }, { width: 400, height: 400 }), { label: "Photo", fit: "contain" }))).toEqual([]);
    // The negative control: the template's own mistake, not a bad value.
    expect(found(make({ width: 400, height: 400 }, { label: "Photo", fit: "contain" }))).toEqual(["template/asset-distorted"]);
  });

  it("a contain image as a Layer's base is cropped; a cover image is cropped past maxCrop or not", () => {
    expect(found(make({ width: 400, height: 400 }, { label: "Photo", fit: "contain" }, true))).toEqual(["template/asset-cropped"]);
    expect(found(make({ width: 400, height: 400 }, { label: "Photo", fit: "cover", maxCrop: 0.3 }, true))).toEqual(["template/asset-cropped"]);
    expect(found(make({ width: 400, height: 400 }, { label: "Photo", fit: "cover", maxCrop: 0.5 }, true))).toEqual([]);
  });
});

describe("describe()", () => {
  it("lists the formats, every field with its schema and rules, and each image's regions and suggested size", () => {
    const described = launch.describe();
    expect(described).toMatchObject({ version: 1, id: "acme.LaunchGraphic", templateVersion: "1.0.0", root: "Canvas", formats: launch.formats });
    const at = (path: string) => described.fields.find((f) => f.path === path)!;
    expect(at("headline")).toMatchObject({ kind: "text", required: true, schema: { type: "string", maxLength: 90 }, fit: { square: { sizes: [88, 76, 64], maxLines: 3 }, landscape: { sizes: [64, 56, 48], maxLines: 3 } } });
    expect(at("features")).toMatchObject({ kind: "list", schema: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", maxLength: 48 } } });
    expect(at("launchDate")).toMatchObject({ kind: "date", schema: { type: "string", format: "date" } });
    expect(at("locale")).toMatchObject({ kind: "choice", default: "en-US", schema: { enum: ["en-US", "de-DE", "fr-FR"] } });
    expect(at("artwork")).toMatchObject({
      kind: "image",
      fit: "cover",
      maxCrop: 0.6,
      regions: { square: { box: [952, 400], pixels: [1904, 800] }, landscape: { box: [488, 547], pixels: [976, 1094] } },
      suggested: { width: 1904, height: 1094, crop: { square: "cuts 27% of the height", landscape: "cuts 49% of the width" } },
    });
    expect(described.valuesSchema).toMatchObject({ type: "object", additionalProperties: false, required: ["headline", "features", "launchDate", "screenshot", "artwork"] });
  });

  it("keeps an image's rules inside a list of objects, and check() reads them at their path", () => {
    expect(digest.describe().fields.find((f) => f.path === "stories[].image")).toMatchObject({ kind: "image", fit: "contain", aspect: { min: 1.5, max: 2 } });
    const square = { title: "Sq", href: "https://acme.example/s", image: { src: `${CDN}/sq.png`, width: 500, height: 500 } };
    expect(codes(digest.check({ ...digest.example, stories: [digest.example.stories[0], square] }).diagnostics)).toEqual([["template/asset-aspect", "values.stories[1].image"]]);
  });

  it("returns guidance, which check() lists for review and never fails on", () => {
    expect(newsletter.describe().fields.find((f) => f.path === "heading")?.guidance).toBe("Lead with the news in one sentence.");
    expect(newsletter.check(newsletter.example).review).toEqual([
      { field: "heading", guidance: "Lead with the news in one sentence." },
      { template: "acme.Newsletter", guidance: "Friendly and plain. One main call to action. No emoji in headings." },
    ]);
  });
});

describe("a template as a design's root", () => {
  const Design = () => <Launch format="square" headline="Orbit is live" features={["a", "b", "c"]} launchDate="2026-12-10" screenshot={shot} artwork={waves} />;
  const Launch = launch;

  it("runs the template's check in render(), validate(), outline(), prepare() and inspect(), which name the template", async () => {
    const rendered = await render(<Design />);
    expect(rendered.template).toEqual({ id: "acme.LaunchGraphic", version: "1.0.0" });
    expect(rendered.html).toContain("Orbit is live");
    expect(rendered.html).toBe((await render(launch.design({ ...launch.example, headline: "Orbit is live", launchDate: "2026-12-10", features: ["a", "b", "c"], screenshot: shot, artwork: waves }, { format: "square" }))).html);
    expect(validate(<Design />)).toMatchObject({ valid: true, template: { id: "acme.LaunchGraphic" } });
    expect(outline(<Design />)).toContain("Canvas");
    expect(prepare(<Design />).template).toEqual({ id: "acme.LaunchGraphic", version: "1.0.0" });
    expect(inspect(<Design />).template).toEqual({ id: "acme.LaunchGraphic", version: "1.0.0" });
    const bad = <Launch format="square" headline="Orbit is live" features={["a"]} launchDate="2026-12-10" screenshot={shot} artwork={waves} />;
    await expect(render(bad)).rejects.toThrow(/template\/count at values\.features/);
    expect(codes(validate(bad).diagnostics)).toEqual([["template/count", "values.features"]]);
  });

  it("is recognized through a component, a Fragment, memo() and forwardRef()", () => {
    const props = { format: "square", headline: "x", features: ["a", "b", "c"], launchDate: "2026-12-10", screenshot: shot, artwork: waves } as const;
    const Memo = memo(Launch);
    const Ref = forwardRef((_: object, _ref) => <Launch {...props} />);
    for (const element of [<Design />, <><Design /></>, <Memo {...props} />, <Ref />]) expect(validate(element).template?.id).toBe("acme.LaunchGraphic");
  });

  it("is template/not-root beside or inside a node, twice, or rendered twice", () => {
    const one = <Launch format="square" {...launch.example} />;
    for (const element of [
      <Email>{one}</Email>,
      <>
        {one}
        <Section />
      </>,
      <>
        {one}
        {one}
      </>,
    ]) {
      expect(codes(validate(element).diagnostics)).toContainEqual(["template/not-root", "jsx"]);
    }
  });

  it("isn't used where a Suspense boundary didn't finish", () => {
    const Never = () => {
      throw new Promise(() => undefined);
    };
    const element = (
      <Suspense fallback={null}>
        <Never />
        <Design />
      </Suspense>
    );
    const result = validate(element);
    expect(result.template).toBeUndefined();
    expect(result.diagnostics.map((d) => d.code)).toContain("jsx/async");
  });

  it("needs a format where there are several: template/format, and check() checks each", () => {
    const both = <Launch headline="x" features={["a", "b", "c"]} launchDate="2026-12-10" screenshot={shot} artwork={waves} />;
    return expect(render(both))
      .rejects.toThrow(/template\/format/)
      .then(() => {
        const checked = check(both);
        expect(checked.valid).toBe(true);
        expect(Object.keys(checked.snapshots)).toEqual(["square", "landscape"]);
        expect(check(<Design />).snapshots).toHaveProperty("square");
        expect(codes(check(<Email />).diagnostics)).toContainEqual(["template/not-template", "jsx"]);
        expect(validate(both).valid).toBe(true);
      });
  });

  it("templateRequest() gives a design's template, its props as recorded and its format, without needing them valid", () => {
    const request = templateRequest(<Newsletter {...newsletter.example} heading="" />);
    expect(request.template).toBe(newsletter);
    expect(request.diagnostics).toEqual([]);
    // As given: not read, not checked (an empty heading is the template's check's to refuse).
    expect(request.props).toEqual({ ...newsletter.example, heading: "" });
    expect(request.format).toBeUndefined();
    const square = templateRequest(<Launch format="square" headline="" features={[]} launchDate="2026-12-10" screenshot={shot} artwork={waves} />);
    expect(square.template).toBe(launch);
    expect(square.format).toBe("square");
    expect(square.props).toMatchObject({ headline: "", features: [] });
    expect(square.props).not.toHaveProperty("format");
    // A component that returns the template is one design; its memo() is unwrapped as React unwraps it.
    const Wrapped = memo(() => <Newsletter {...newsletter.example} />);
    expect(templateRequest(<Wrapped />).template).toBe(newsletter);
    const plain = templateRequest(<Email><Text>x</Text></Email>);
    expect(plain.template).toBeUndefined();
    expect(plain.diagnostics.map((d) => d.code)).toContain("template/not-template");
    expect(templateRequest(<Launch format={"tall" as never} headline="x" features={[]} launchDate="2026-12-10" screenshot={shot} artwork={waves} />).diagnostics.map((d) => d.code)).toEqual(["template/format"]);
  });

  it("isn't the builder's: toDesign() is builder/template", () => {
    expect(() => toDesign(<Newsletter {...newsletter.example} />)).toThrow(/builder\/template/);
    expect(toDesign(newsletter.design(newsletter.example)).design.body.rows.length).toBeGreaterThan(0);
  });

  it("refuses a field named as a prop of its component", () => {
    for (const name of ["format", "key", "ref", "children"]) {
      expect(() => template({ id: "acme.Bad", version: "1.0.0", label: "Bad", root: "Email", fields: { [name]: prop.text({ label: "x" }) }, example: {}, render: () => <Email /> } as never)).toThrow(/template\/field-name/);
    }
  });
});

const Newsletter = newsletter;

describe("values files and versions", () => {
  it("round-trips with assets beside the values", () => {
    const file = toValuesFile(launch, launch.example, { module: "../templates/launch.tsx", formats: ["square"], assets: { artwork: { sha256: "ab", source: { kind: "generated", model: "m" } } } });
    expect(file).toMatchObject({ version: 1, template: { module: "../templates/launch.tsx", id: "acme.LaunchGraphic", version: "1.0.0" }, formats: ["square"] });
    expect(file.values.locale).toBe("en-US");
    const back = readValuesFile(JSON.parse(JSON.stringify(file)), launch);
    // Its values as the template takes them (here, as they are), and what only the artwork's file says, left undecided.
    expect(back).toEqual({ values: file.values, migrated: file.values, formats: ["square"], assets: file.assets, diagnostics: [expect.objectContaining({ code: "template/asset-unread", severity: "info", path: "values.artwork" })] });
    expect(() => toValuesFile(launch, { ...launch.example, headline: 3 }, { module: "x" })).toThrow(/template\/value/);
  });

  const at = (version: string, migrate?: Record<number, (v: Record<string, unknown>) => unknown>) =>
    template({ id: digest.id, version, label: digest.label, root: "Email", fields: digest.fields, example: digest.example, render: (v) => digest.design(v as never), ...(migrate ? { migrate } : {}) });
  const file = (version: string, values: unknown = digest.example) => ({ version: 1, template: { module: "./digest.tsx", id: "acme.Digest", version }, values });

  it("reads the same version as it is, a newer minor with a note, a newer major through migrate, and refuses an older template", () => {
    expect(readValuesFile(file("2.1.0"), digest).diagnostics).toEqual([]);
    expect(readValuesFile(file("2.0.3"), digest).diagnostics.map((d) => d.code)).toEqual(["template/upgraded"]);
    const old = { intro: "Hi", items: [{ title: "One", href: "https://acme.example/1" }] };
    expect(readValuesFile(file("1.4.0", old), digest).diagnostics.map((d) => d.code)).toEqual(["template/version"]);
    const migrated = readValuesFile(file("1.4.0", old), at("2.1.0", { 1: ({ items, ...rest }) => ({ ...rest, stories: items }) }));
    expect(migrated.diagnostics.map((d) => d.code)).toEqual(["template/upgraded"]);
    expect(migrated.values?.stories).toEqual(old.items);
    expect(readValuesFile(file("2.2.0"), digest).diagnostics.map((d) => d.code)).toEqual(["template/version"]);
    expect(readValuesFile({ ...file("2.1.0"), template: { module: "x", id: "acme.Other", version: "2.1.0" } }, digest).diagnostics.map((d) => d.code)).toEqual(["template/id"]);
  });
});

describe("helpers", () => {
  it("formatDate() writes the day given, in UTC, for a locale", () => {
    expect(formatDate("2026-12-03", "en-US", { dateStyle: "long" })).toBe("December 3, 2026");
    expect(formatDate("2026-12-03", "de-DE", { dateStyle: "long" })).toBe("3. Dezember 2026");
    expect(formatDate("2026-12-03", "fr-FR", { dateStyle: "long" })).toBe("3 décembre 2026");
    expect(() => formatDate("3/12/2026", "en-US")).toThrow(TypeError);
  });

  it("fitInside() keeps the aspect inside the box", () => {
    expect(fitInside({ width: 2400, height: 1500 }, { width: 860, height: 340 })).toEqual({ width: 544, height: 340 });
    expect(fitInside({ width: 100, height: 300 }, { width: 50, height: 50 })).toEqual({ width: 16.66, height: 50 });
  });

  it("sniffImage() reads PNG, JPEG (baseline and progressive), GIF and SVG, and nothing else", () => {
    const bytes = (...parts: Array<number[] | string>) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
    const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const png = (colorType: number, extra: number[] = []) => bytes([0x89], "PNG\r\n\x1a\n", u32(13), "IHDR", u32(640), u32(480), [8, colorType, 0, 0, 0], u32(0), extra, u32(0), "IDAT");
    expect(sniffImage(png(2))).toEqual({ width: 640, height: 480, type: "png", alpha: false });
    expect(sniffImage(png(6))).toEqual({ width: 640, height: 480, type: "png", alpha: true });
    expect(sniffImage(png(2, [...u32(6), ..."tRNS".split("").map((c) => c.charCodeAt(0)), 0, 0, 0, 0, 0, 0, ...u32(0)]))?.alpha).toBe(true);
    const jpeg = (sof: number) => bytes([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, sof, 0, 17, 8, 0x01, 0xe0, 0x02, 0x80, 3]);
    expect(sniffImage(jpeg(0xc0))).toEqual({ width: 640, height: 480, type: "jpeg", alpha: false });
    expect(sniffImage(jpeg(0xc2))).toEqual({ width: 640, height: 480, type: "jpeg", alpha: false });
    expect(sniffImage(bytes("GIF89a", [0x80, 0x02, 0xe0, 0x01, 0, 0, 0, 0x21, 0xf9, 0x04, 0x01]))).toEqual({ width: 640, height: 480, type: "gif", alpha: true });
    const svg = (tag: string) => new TextEncoder().encode(`<?xml version="1.0"?>${tag}<rect/></svg>`);
    expect(sniffImage(svg('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96">'))).toEqual({ width: 320, height: 96, type: "svg", alpha: true });
    expect(sniffImage(svg('<svg viewBox="0 0 640 480">'))).toEqual({ width: 640, height: 480, type: "svg", alpha: true });
    expect(sniffImage(svg('<svg width="320" viewBox="0 0 640 480">'))).toEqual({ width: 320, height: 240, type: "svg", alpha: true });
    expect(sniffImage(bytes("RIFF0000WEBP"))).toBeUndefined();
    expect(sniffImage(new Uint8Array())).toBeUndefined();
  });
});

describe("the template object", () => {
  it("is defined only with a well-formed spec", () => {
    const base = { id: "acme.Ok", version: "1.0.0", label: "Ok", root: "Email", fields: {}, example: {}, render: () => <Email /> };
    expect(() => template(base as never)).not.toThrow();
    for (const [change, path] of [
      [{ id: "Ok" }, "id"],
      [{ version: "1.0" }, "version"],
      [{ root: "Div" }, "root"],
      [{ formats: { Square: {} } }, "formats.Square"],
      [{ root: "Canvas", formats: { square: { width: 10 } } }, "formats.square"],
      [{ example: undefined }, "example"],
    ] as const) {
      try {
        template({ ...base, ...change } as never);
        throw new Error("defined");
      } catch (thrown) {
        expect((thrown as { diagnostics?: Diagnostic[] }).diagnostics?.map((d) => d.path), JSON.stringify(change)).toContain(path);
      }
    }
  });

  it("renders nothing outside a collecting render", () => {
    expect((launch as unknown as () => null)()).toBeNull();
  });
});

