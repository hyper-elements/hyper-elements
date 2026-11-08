import React from "react";
import { Button, Canvas, Column, component, Document, Email, Heading, Page, PageNumber, prop, Row, Section, Span, Svg, Text, validate } from "../primitives/index";
import { describeComponent, describeComponents, inspect, INSPECT_VERSION } from "./index";

describe("describeComponents()", () => {
  it("lists every component with its roots, and each prop and style with its kind, group and roots", () => {
    const all = describeComponents();
    expect(all.version).toBe(INSPECT_VERSION);
    expect(all.roots).toEqual(["Email", "Page", "Document", "Canvas"]);
    const text = all.components.find((c) => c.type === "Text")!;
    expect(text.roots).toEqual(["Email", "Page", "Document", "Canvas"]);
    expect(text.properties.find((p) => p.path === "style.fontSize")).toMatchObject({ kind: "length", group: "Typography", roots: ["Email", "Page", "Document", "Canvas"], mobile: true });
    expect(text.properties.find((p) => p.path === "style.padding")).toMatchObject({ group: "Spacing" });
    expect(all.conditions).toEqual([
      { name: "mobile", on: "on phones", roots: ["Email", "Page"] },
      { name: "hover", on: "on hover", roots: ["Email", "Page", "Document", "Canvas"] },
    ]);
  });

  it("narrows to what one root takes", () => {
    const email = describeComponents({ root: "Email" });
    expect(email.root).toBe("Email");
    const types = email.components.map((c) => c.type);
    expect(types).toContain("Row");
    expect(types).not.toContain("Svg");
    expect(types).not.toContain("PageHeader");
    expect(types).not.toContain("Page");
    const document = describeComponents({ root: "Document" });
    expect(document.components.map((c) => c.type)).toContain("PageHeader");
    // A Document has no phones: no phone styles, and no phone condition.
    expect(document.components.flatMap((c) => c.properties).some((p) => p.mobile)).toBe(false);
    expect(document.conditions.map((c) => c.name)).toEqual(["hover"]);
  });

  it("describes one component, and a template's own with the built-in ones", () => {
    expect(describeComponent("Svg", { root: "Email" })).toBeUndefined();
    expect(describeComponent("Svg", { root: "Canvas" })).toMatchObject({ version: INSPECT_VERSION, type: "Svg", roots: ["Canvas"] });
    expect(describeComponent("Nope")).toBeUndefined();
    const Card = component({ type: "acme.Card", label: "Card", props: { title: prop.text({ label: "Title", required: true }) }, render: ({ title }) => <Column><Heading>{title}</Heading></Column> });
    expect(describeComponents({ components: [Card] }).components.map((c) => c.type)).toContain("acme.Card");
    expect(describeComponent("acme.Card", { components: [Card], root: "Page" })!.properties.map((p) => p.path)).toEqual(["props.title", "style.flex"]);
  });

  it("agrees with validation: a component a root doesn't take is an error there", () => {
    for (const root of ["Email", "Page", "Document", "Canvas"] as const) {
      const types = new Set(describeComponents({ root }).components.map((c) => c.type));
      expect(types.has("PageNumber"), root).toBe(root === "Document");
    }
    const page = validate(<Page><Text>Page <PageNumber /></Text></Page>);
    expect(page.diagnostics.map((d) => d.code)).toEqual(["document/page-number"]);
    expect(validate(<Document><Text>Page <PageNumber /></Text></Document>).valid).toBe(true);
  });
});

describe("inspect()", () => {
  it("lists each component in the template, what it's given, and whether its root takes it", () => {
    const result = inspect(
      <Email>
        <Section style={{ backgroundColor: "#f3f4f6" }}>
          <Row>
            <Column style={{ padding: 16, mobile: { padding: 8 } }}>
              <Button href="https://example.com" style={{ hover: { backgroundColor: "#111827" } }}>Go</Button>
            </Column>
          </Row>
        </Section>
      </Email>
    );
    expect(result).toMatchObject({ version: INSPECT_VERSION, root: "Email", valid: true });
    expect(result.nodes.map((node) => [node.path, node.type, node.allowed])).toEqual([
      ["root", "Email", true],
      ["root.children[0]", "Section", true],
      ["root.children[0].children[0]", "Row", true],
      ["root.children[0].children[0].children[0]", "Column", true],
      ["root.children[0].children[0].children[0].children[0]", "Button", true],
    ]);
    expect(result.nodes[3].given).toEqual(["style.padding", "mobile.padding"]);
    expect(result.nodes[4].given).toEqual(["props.href", "hover.backgroundColor"]);
  });

  it("puts each problem on the component it's on, not on the ones holding it", () => {
    const result = inspect(
      <Page>
        <Text>
          Page <PageNumber />
        </Text>
        <Heading style={{ fontSize: 24, mobile: { fontSize: 18 } }}>Hi</Heading>
      </Page>
    );
    expect(result.valid).toBe(false);
    expect(result.nodes.map((node) => [node.path, node.type, node.allowed, node.problems.map((d) => d.code)])).toEqual([
      ["root", "Page", true, []],
      ["root.children[0]", "Text", true, []],
      // A component its root doesn't take is listed, not allowed, with its error.
      ["root.children[0].children[1]", "PageNumber", false, ["document/page-number"]],
      ["root.children[1]", "Heading", true, []],
    ]);
    expect(result.diagnostics.map((d) => [d.code, d.path])).toEqual([["document/page-number", "root.children[0].children[1]"]]);
  });

  it("lists a component its root doesn't take, and keeps each one after it at the path diagnostics give", () => {
    // Reading leaves the PageNumber out and joins the text either side of it: the Span after it is still children[3].
    const result = inspect(
      <Page>
        <Text>
          {"Page "}
          <PageNumber total />
          {" of "}
          <Span style={{ fontWeight: "heavy" as never }}>ten</Span>
        </Text>
      </Page>
    );
    expect(result.nodes.map((node) => [node.path, node.type, node.allowed, node.given, node.problems.map((d) => d.code)])).toEqual([
      ["root", "Page", true, [], []],
      ["root.children[0]", "Text", true, [], []],
      ["root.children[0].children[1]", "PageNumber", false, ["props.total"], ["document/page-number"]],
      ["root.children[0].children[3]", "Span", true, ["style.fontWeight"], [result.diagnostics[1].code]],
    ]);
    expect(result.diagnostics.map((d) => d.path)).toEqual(["root.children[0].children[1]", "root.children[0].children[3].style.fontWeight"]);
  });

  it("lists a prop or style a root doesn't take as given, with its error", () => {
    const result = inspect(
      <Document>
        <Heading style={{ fontSize: 24, mobile: { fontSize: 18 } }}>Report</Heading>
      </Document>
    );
    expect(result.nodes[1]).toMatchObject({ type: "Heading", allowed: true, given: ["style.fontSize", "mobile.fontSize"] });
    expect(result.nodes[1].problems.map((d) => d.code)).toEqual(["mobile/not-supported"]);
  });

  it("says the root, and what's not allowed under it", () => {
    const canvas = inspect(
      <Canvas width={400} height={200}>
        <Svg width={10} height={10} viewBox="0 0 10 10" />
      </Canvas>
    );
    expect(canvas.root).toBe("Canvas");
    expect(canvas.nodes[1]).toMatchObject({ type: "Svg", roots: ["Page", "Document", "Canvas"], allowed: true });
    const email = inspect(
      <Email>
        <Svg width={10} height={10} viewBox="0 0 10 10" />
      </Email>
    );
    expect(email.valid).toBe(false);
    expect(email.nodes[1]).toMatchObject({ type: "Svg", allowed: false });
    expect(email.nodes[1].problems.map((d) => d.code)).toEqual(["target/unsupported"]);
  });

  it("finds what validate() finds", () => {
    const template = (
      <Document>
        <Text style={{ fontSize: 12, mobile: { fontSize: 10 } }}>Hello</Text>
      </Document>
    );
    expect(inspect(template).diagnostics).toEqual(validate(template).diagnostics);
    expect(inspect(template).nodes[1].problems.map((d) => d.code)).toEqual(["mobile/not-supported"]);
  });

  it("takes only a template", () => {
    expect(() => inspect(null as never)).toThrow(/takes a template as JSX/);
    expect(inspect(<>{null}</>)).toMatchObject({ root: null, valid: false, nodes: [] });
  });
});
