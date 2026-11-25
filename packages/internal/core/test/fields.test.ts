/**
 * What templates add to the core: the list, object and date kinds, `guidance` on a prop, and the `field` key a node
 * shows a template field with (checked, carried through a Grid and a built-in composite, dropped inside a custom
 * component's render, and on the laid-out tree).
 */
import { asset, checkDocument, date, defineCustomComponent, describeComponents, enumOf, list, object, prepareTemplate, prop, Registry, text, type Kind, type Node, type ResolvedNode } from "../src";

const value = (kind: Kind<any, any>, input: unknown) => {
  const parsed = kind.parse(input);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value;
};
const message = (kind: Kind<any, any>, input: unknown) => {
  const parsed = kind.parse(input);
  return parsed.ok ? undefined : parsed.message;
};

describe("list()", () => {
  it("takes as few as min and as many as max of one kind, each item parsed", () => {
    const features = list(text({ maxLength: 5 }), { min: 2, max: 3 });
    expect(value(features, ["a", "b"])).toEqual(["a", "b"]);
    expect(message(features, ["a"])).toBe("has 1 item; it takes 2 to 3");
    expect(message(features, ["a", "b", "c", "d"])).toBe("has 4 items; it takes 2 to 3");
    expect(message(features, ["a", "too long"])).toBe("item 2: is longer than 5 characters");
    expect(message(features, "a")).toMatch(/^expected a list of text/);
    expect(features.jsonSchema()).toEqual({ type: "array", items: { type: "string", maxLength: 5 }, minItems: 2, maxItems: 3 });
    expect(message(list(text(), { min: 3, max: 3 }), [])).toBe("has 0 items; it takes exactly 3");
  });
});

describe("object()", () => {
  const story = object({ title: { kind: text(), required: true }, image: { kind: asset() }, tone: { kind: enumOf(["calm", "loud"]), default: "calm" } });

  it("parses each field, fills defaults, and refuses a missing required one or a key that isn't a field", () => {
    expect(value(story, { title: "One" })).toEqual({ title: "One", tone: "calm" });
    expect(value(story, { title: "One", image: { src: "https://a.com/i.png", width: 2, height: 1 }, tone: "loud" })).toEqual({ title: "One", image: { src: "https://a.com/i.png", width: 2, height: 1 }, tone: "loud" });
    expect(message(story, {})).toBe("title is missing");
    expect(message(story, { title: "One", color: "red" })).toBe('"color" isn\'t one of its fields (title, image, tone)');
    expect(message(story, { title: 1 })).toMatch(/^title: expected text/);
    expect(message(story, ["x"])).toMatch(/^expected an object of title, image, tone/);
  });

  it("has a schema of exactly its fields", () => {
    expect(story.jsonSchema()).toMatchObject({ type: "object", required: ["title"], additionalProperties: false, properties: { title: { type: "string" } } });
  });
});

describe("date()", () => {
  it("takes a real calendar day as YYYY-MM-DD, by arithmetic", () => {
    expect(value(date(), "2026-12-03")).toBe("2026-12-03");
    expect(value(date(), "2024-02-29")).toBe("2024-02-29");
    expect(message(date(), "2026-02-29")).toBe("2026-02-29 isn't a day of the calendar");
    expect(message(date(), "1900-02-29")).toBe("1900-02-29 isn't a day of the calendar");
    expect(value(date(), "2000-02-29")).toBe("2000-02-29");
    expect(message(date(), "2026-13-01")).toBeDefined();
    expect(message(date(), "2026-12-3")).toMatch(/^expected a date as YYYY-MM-DD/);
    expect(message(date(), "2026-12-03T00:00:00Z")).toBeDefined();
    expect(date().jsonSchema()).toEqual({ type: "string", format: "date" });
  });
});

describe("guidance", () => {
  it("is described where a prop declares it, and nowhere else", () => {
    const Card = defineCustomComponent({
      type: "acme.Card",
      label: "Card",
      props: { photo: prop(asset(), { label: "Photo", guidance: "One person, face centered." }), name: prop(text(), { label: "Name" }) },
      expand: () => ({ type: "Column" }),
    });
    const described = describeComponents({ components: [Card] }).find((c) => c.type === "acme.Card")!;
    expect(described.properties.find((p) => p.path === "props.photo")?.guidance).toBe("One person, face centered.");
    expect(described.properties.find((p) => p.path === "props.name")).not.toHaveProperty("guidance");
    expect(describeComponents().some((c) => c.properties.some((p) => "guidance" in p))).toBe(false);
  });
});

describe("the field key", () => {
  const doc = (root: Node) => ({ root });
  const laidOut = (root: Node, registry?: Registry) => {
    const checked = checkDocument(doc(root), registry);
    const prepared = prepareTemplate(checked.document!, registry ? { components: registry.all().filter((d) => d.type.includes(".")) as never } : {});
    return { checked, root: prepared.resolved!.root };
  };
  const fields = (node: ResolvedNode, out: Array<[string, string, string]> = []) => {
    if (node.field) out.push([node.path, node.type, node.field]);
    for (const child of node.children) if (typeof child !== "string") fields(child, out);
    return out;
  };

  it("is kept on the node and the laid-out node; one field may be shown by two nodes", () => {
    const { checked, root } = laidOut({
      type: "Email",
      children: [
        { type: "Heading", field: "headline", children: ["Hi"] },
        { type: "Text", field: "headline", children: ["Hi again"] },
        { type: "Text", field: "stories[1].title", children: ["Two"] },
      ],
    });
    expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(fields(root)).toEqual([
      ["root.children[0]", "Heading", "headline"],
      ["root.children[1]", "Text", "headline"],
      ["root.children[2]", "Text", "stories[1].title"],
    ]);
    // A document read again keeps it.
    expect(checkDocument(checked.document!).document).toEqual(checked.document);
  });

  it("is a field's path, or template/field-path, and markup in one is never kept", () => {
    for (const bad of ["", "1x", "a..b", "a[01]", "a[-1]", "<b>x</b>", "a b", 3]) {
      const { document, diagnostics } = checkDocument(doc({ type: "Email", children: [{ type: "Text", field: bad as string, children: ["x"] }] }));
      expect(diagnostics.map((d) => [d.code, d.path])).toContainEqual(["template/field-path", "root.children[0].field"]);
      expect(document?.root.children?.[0]).not.toHaveProperty("field");
    }
    for (const good of ["a", "_a", "features[0]", "features[12]", "stories[1].image", "a.b.c[2].d"]) {
      expect(checkDocument(doc({ type: "Email", children: [{ type: "Text", field: good, children: ["x"] }] })).diagnostics).toEqual([]);
    }
  });

  it("goes onto the Column a Grid becomes, and its children keep theirs", () => {
    const { root } = laidOut({ type: "Page", children: [{ type: "Grid", field: "cards", props: { columns: 2 }, children: [{ type: "Text", field: "cards[0]", children: ["a"] }, { type: "Text", field: "cards[1]", children: ["b"] }] }] });
    expect(fields(root).map(([, type, field]) => [type, field])).toEqual([
      ["Column", "cards"],
      ["Text", "cards[0]"],
      ["Text", "cards[1]"],
    ]);
  });

  it("goes onto what a built-in composite (a Menu, a Social) becomes", () => {
    const { root } = laidOut({
      type: "Email",
      children: [
        { type: "Menu", field: "nav", props: { items: [{ text: "Home", href: "https://a.com" }] } },
        { type: "Social", field: "icons", props: { icons: [{ name: "X", href: "https://x.com/a" }] } },
      ],
    });
    expect(fields(root).map(([, , field]) => field)).toEqual(["nav", "icons"]);
  });

  it("is dropped, with field/dropped, where a custom component's render writes it", () => {
    const Card = defineCustomComponent({
      type: "acme.Card",
      label: "Card",
      props: {},
      expand: () => ({ type: "Column", children: [{ type: "Text", field: "headline", children: ["x"] }] }),
    });
    const registry = new Registry([Card]);
    const { checked, root } = laidOut({ type: "Email", children: [{ type: "acme.Card" }] }, registry);
    expect(fields(root)).toEqual([]);
    const prepared = prepareTemplate(checked.document!, { components: [Card] });
    expect(prepared.diagnostics.map((d) => [d.code, d.severity])).toContainEqual(["field/dropped", "info"]);
  });
});
