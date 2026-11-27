/**
 * Hidden properties: what a tool has no field for, kept in its values under its Elements name (manifest.ts). The keys
 * toDesign() writes are the builder's own or the manifest's, every manifest entry is written by some template, a value
 * is in one place only, and the hazards of a design the builder edits keep them right.
 */
import type { Node } from "@hyper-elements/core";
import React from "react";
import { describe, expect, it } from "vitest";
import { Button, Column, component, Document, Email, Grid, Heading, Html, Image, List, ListItem, Menu, Page, Text, Row, Section, Table, TableCell, TableRow, Video } from "../primitives";
import { collectTemplate } from "../primitives/collect";
import { fromDesign, toDesign } from "./index";
import { BUILDER_KEYS, BUILDER_PHONE_KEYS, HIDDEN } from "./manifest";
import { outOfMarkup } from "./paint";
import { textJsonHtml } from "./text-json";

type Values = Record<string, any>;
type Item = { tool: string; values: Values };

const tree = (element: React.ReactElement): Node => collectTemplate(element).document!.root;
const designOf = (element: React.ReactElement) => JSON.parse(JSON.stringify(toDesign(element).design));
const back = (design: unknown, displayMode?: "email" | "web" | "document") => tree(fromDesign(design, { displayMode }).element);

/** Every item of a design, by its tool (the body, rows, columns and blocks). */
function items(design: any): Item[] {
  const out: Item[] = [{ tool: "body", values: design.body.values }];
  for (const rows of [design.body.rows, design.body.headers ?? [], design.body.footers ?? []]) {
    for (const row of rows) {
      out.push({ tool: "row", values: row.values });
      for (const column of row.columns) {
        out.push({ tool: "column", values: column.values });
        for (const content of column.contents) out.push({ tool: content.type, values: content.values });
      }
    }
  }
  return out;
}

describe("a Row hidden somewhere, in a Section", () => {
  it("keeps its own hiding, and its Section's where the Section is the one hidden", () => {
    const rows = (element: React.ReactElement) => designOf(element).body.rows.map((row: any) => row.values._override ?? {});
    const cells = [<Column key="a"><Text>A</Text></Column>, <Column key="b"><Text>B</Text></Column>];
    expect(rows(<Email><Section style={{ backgroundColor: "#eeeeee" }}><Row hidden={{ mobile: true }}>{cells}</Row></Section></Email>)).toEqual([{ mobile: { hideMobile: true } }]);
    expect(rows(<Email><Section hidden={{ desktop: true }}><Row>{cells}</Row></Section></Email>)).toEqual([{ desktop: { hideDesktop: true } }]);
    const kept = back(designOf(<Email><Section style={{ backgroundColor: "#eeeeee" }}><Row hidden={{ mobile: true }}>{cells}</Row></Section></Email>), "email");
    expect(JSON.stringify(kept)).toContain('"hidden":{"mobile":true}');
  });
});

/** Where a template hides some words: each device a node around them is hidden on. */
function hiddenAround(node: Node, words: string, around: { mobile?: true; desktop?: true } = {}): { mobile?: true; desktop?: true } | undefined {
  const here = { ...around, ...(node.hidden?.mobile ? { mobile: true as const } : {}), ...(node.hidden?.desktop ? { desktop: true as const } : {}) };
  for (const child of node.children ?? []) {
    const found = typeof child === "string" ? (child.includes(words) ? here : undefined) : hiddenAround(child, words, here);
    if (found) return found;
  }
  return undefined;
}

describe("a Grid hidden somewhere", () => {
  const words = ["First", "Second", "Third"];
  const cells = words.map((word) => <Text key={word}>{word}</Text>);
  const rows = (design: any) => design.body.rows.map((row: any) => row.values._override ?? {});

  for (const [device, key, name] of [["mobile", "hideMobile", "phones"], ["desktop", "hideDesktop", "desktops"]] as const) {
    for (const [Root, displayMode] of [[Email, "email"], [Page, "web"]] as const) {
      it(`hides each of its rows on ${name} in ${displayMode === "email" ? "an Email" : "a Page"}, and comes back hidden there`, () => {
        // Three cells in two columns: two rows of the builder's, both hidden.
        const { design, report } = toDesign(<Root><Grid columns={2} hidden={{ [device]: true }}>{cells}</Grid></Root>);
        const written = JSON.parse(JSON.stringify(design));
        expect(rows(written)).toEqual([{ [device]: { [key]: true } }, { [device]: { [key]: true } }]);
        expect(report).toEqual([]);
        const kept = back(written, displayMode);
        for (const word of words) expect(hiddenAround(kept, word), word).toEqual({ [device]: true });
      });
    }
  }

  it("keeps its hiding in a Section, and adds its Section's", () => {
    const shown = designOf(<Email><Section style={{ backgroundColor: "#eeeeee" }}><Grid columns={3} hidden={{ mobile: true }}>{cells}</Grid></Section></Email>);
    expect(rows(shown)).toEqual([{ mobile: { hideMobile: true } }]);
    for (const word of words) expect(hiddenAround(back(shown, "email"), word), word).toEqual({ mobile: true });
    const hidden = designOf(<Email><Section hidden={{ desktop: true }}><Grid columns={3} hidden={{ mobile: true }}>{cells}</Grid></Section></Email>);
    expect(rows(hidden)).toEqual([{ mobile: { hideMobile: true }, desktop: { hideDesktop: true } }]);
  });

  it("leaves its rows shown where it is", () => {
    expect(rows(designOf(<Email><Grid columns={3}>{cells}</Grid></Email>))).toEqual([{}]);
  });
});

describe("what's hidden on a device in a Section: the space around what shows there, as Elements draws it", () => {
  const Promo = component({ type: "acme.DesktopPromo", label: "Promo", props: {}, render: () => <Text hidden={{ mobile: true }}>Desktop promo</Text> });
  const band = { padding: { top: 48, right: 24, bottom: 48, left: 24 }, gap: 16, backgroundColor: "#f4f4f4" } as const;
  const spanning = (
    <Table hidden={{ mobile: true }}>
      <TableRow><TableCell colSpan={2}>Across</TableCell></TableRow>
      <TableRow><TableCell>A</TableCell><TableCell>B</TableCell></TableRow>
    </Table>
  );
  /** Each row's padding and its blocks', "desktop / phones" where they differ. */
  const spacing = (element: React.ReactElement) =>
    designOf(element).body.rows.map((row: any) => ({
      row: [row.values.padding, row.values._override?.mobile?.padding].filter(Boolean).join(" / "),
      blocks: row.columns.flatMap((column: any) => column.contents.map((content: any) => [content.values.containerPadding, content.values._override?.mobile?.containerPadding].filter(Boolean).join(" / "))),
    }));

  for (const [Root, name] of [[Email, "an Email"], [Page, "a Page"]] as const) {
    it(`keeps the Section's padding around what shows on each device, in ${name}`, () => {
      // First, an HTML block (your own element's) hidden on phones: there, the block after it starts the Section, and
      // the gap goes with the hidden one. On desktops, as it was.
      expect(spacing(<Root><Section style={band}><Promo /><Text>Welcome</Text></Section></Root>)).toEqual([{ row: "0px", blocks: ["48px 24px 0px", "16px 24px 48px / 48px 24px"] }]);
      // Last, a Table that's an HTML block hidden on phones, and a builder text hidden on desktops: the block before it
      // ends the Section there.
      expect(spacing(<Root><Section style={band}><Text>Welcome</Text>{spanning}</Section></Root>)).toEqual([{ row: "0px", blocks: ["48px 24px 0px / 48px 24px", "16px 24px 48px"] }]);
      expect(spacing(<Root><Section style={band}><Text>Welcome</Text><Text hidden={{ desktop: true }}>Phones only</Text></Section></Root>)).toEqual([{ row: "0px", blocks: ["48px 24px / 48px 24px 0px", "16px 24px 48px"] }]);
      // Nothing in it on phones: its row holds the Section's padding there.
      expect(spacing(<Root><Section style={band}><Promo /></Section></Root>)).toEqual([{ row: "0px / 48px 0px", blocks: ["48px 24px"] }]);
    });
  }

  it("puts a gap only between what shows on the same device", () => {
    // One on desktops, the other on phones: never together, so no gap.
    expect(spacing(<Email><Section style={{ gap: 16 }}><Text hidden={{ mobile: true }}>A</Text><Text hidden={{ desktop: true }}>B</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["0px", "0px"] }]);
    // Two hidden on phones first: the one after them starts the Section there.
    expect(spacing(<Email><Section style={band}><Promo /><Promo /><Text>B</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["48px 24px 0px", "16px 24px 0px", "16px 24px 48px / 48px 24px"] }]);
    // Between two: its gap goes with it.
    expect(spacing(<Email><Section style={band}><Text>A</Text><Promo /><Text>B</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["48px 24px 0px", "16px 24px 0px", "16px 24px 48px"] }]);
    // After a Row: each block that shows has its gap above it.
    expect(spacing(<Email><Section style={band}><Row><Text>Left</Text><Text>Right</Text></Row><Promo /><Text>B</Text></Section></Email>)).toEqual([
      { row: "48px 0px 0px 0px", blocks: ["0px", "0px"] },
      { row: "0px", blocks: ["16px 24px 0px", "16px 24px 48px"] },
    ]);
    // Nothing after the Row on phones: the Row ends the Section there.
    expect(spacing(<Email><Section style={band}><Row><Text>Left</Text><Text>Right</Text></Row><Promo /></Section></Email>)).toEqual([
      { row: "48px 0px 0px 0px / 48px 0px", blocks: ["0px", "0px"] },
      { row: "0px", blocks: ["16px 24px 48px"] },
    ]);
    // Nothing hidden: as it was.
    expect(spacing(<Email><Section style={band}><Text>A</Text><Text>B</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["48px 24px 0px", "16px 24px 48px"] }]);
  });

  it("spaces a plain Column in it as Elements does: its own gap and padding, shown where it isn't hidden itself", () => {
    // B's 20px is its own; the Column has no gap, the Section's 16px is above C.
    expect(spacing(<Email><Section style={{ gap: 16 }}><Column><Text hidden={{ mobile: true }}>A</Text><Text style={{ padding: { top: 20 } }}>B</Text></Column><Text>C</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["0px", "20px 0px 0px", "16px 0px 0px"] }]);
    // On phones B starts the Column: the Section's gap above it, not the Column's too.
    expect(spacing(<Email><Section style={{ gap: 16 }}><Text>Start</Text><Column style={{ gap: 16 }}><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Column></Section></Email>)).toEqual([{ row: "0px", blocks: ["0px", "16px 0px 0px", "16px 0px 0px"] }]);
    // A Column whose blocks are all hidden on phones still shows there: the gap after it stays.
    expect(spacing(<Email><Section style={{ gap: 16 }}><Column><Text hidden={{ mobile: true }}>A</Text></Column><Text>B</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["0px", "16px 0px 0px"] }]);
    // The Column's own padding stays around what shows in it.
    expect(spacing(<Email><Section style={{ padding: 48 }}><Column style={{ padding: 8 }}><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Column></Section></Email>)).toEqual([{ row: "0px", blocks: ["56px 56px 0px", "0px 56px 56px / 56px"] }]);
    // With something after it: its bottom padding below what shows in it, then the Section's gap.
    expect(spacing(<Email><Section style={{ gap: 16 }}><Column style={{ padding: 8 }}><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Column><Text>C</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["8px 8px 0px", "0px 8px 8px / 8px", "16px 0px 0px"] }]);
    // An empty Column in it shows as its padding, with a gap after it: on phones, B is 20px and a gap below it.
    expect(spacing(<Email><Section><Column style={{ gap: 16 }}><Column style={{ padding: 10 }} /><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Column></Section></Email>)).toEqual([{ row: "0px", blocks: ["20px 0px 0px", "16px 0px 0px / 36px 0px 0px"] }]);
    // Its own phone padding is its space there.
    expect(spacing(<Email><Section><Column style={{ gap: 16 }}><Column style={{ padding: 10, mobile: { padding: { top: 2, right: 10, bottom: 2, left: 10 } } }} /><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Column></Section></Email>)).toEqual([{ row: "0px", blocks: ["20px 0px 0px", "16px 0px 0px / 20px 0px 0px"] }]);
  });

  it("spaces the builder's rows of a Section too: a Row or a Grid hidden at its edge, or a run hidden before a Row", () => {
    expect(spacing(<Email><Section style={band}><Row hidden={{ mobile: true }}><Text>L</Text><Text>R</Text></Row><Text>Welcome</Text></Section></Email>)).toEqual([
      { row: "48px 0px 0px 0px", blocks: ["0px", "0px"] },
      { row: "0px", blocks: ["16px 24px 48px / 48px 24px"] },
    ]);
    expect(spacing(<Email><Section style={band}><Grid columns={2} hidden={{ mobile: true }}><Text>A</Text><Text>B</Text></Grid><Text>Welcome</Text></Section></Email>)).toEqual([
      { row: "48px 0px 0px 0px", blocks: ["0px", "0px"] },
      { row: "0px", blocks: ["16px 24px 48px / 48px 24px"] },
    ]);
    // A Grid's rows keep its own gap between them; on phones, with the block after it hidden, its last row ends the Section.
    expect(spacing(<Email><Section style={{ padding: 48, gap: 16 }}><Grid columns={2} style={{ gap: 12 }}><Text>A</Text><Text>B</Text><Text>C</Text><Text>D</Text></Grid><Text hidden={{ mobile: true }}>Desktop only</Text></Section></Email>)).toEqual([
      { row: "48px 0px 0px 0px", blocks: ["0px", "0px"] },
      { row: "12px 0px 0px 0px / 12px 0px 48px", blocks: ["0px", "0px"] },
      { row: "0px", blocks: ["16px 48px 48px"] },
    ]);
    // On phones the Row starts the Section: its padding above the Row, no gap.
    expect(spacing(<Email><Section style={{ padding: 16, gap: 16 }}><Text hidden={{ mobile: true }}>Hidden</Text><Row><Text>L</Text><Text>R</Text></Row></Section></Email>)).toEqual([
      { row: "0px", blocks: ["16px 16px 0px"] },
      { row: "16px 0px 16px 0px", blocks: ["0px", "0px"] },
    ]);
  });

  it("spaces a Row's Column on each device, its padding its column's", () => {
    expect(spacing(<Email><Row><Column style={{ gap: 16, padding: 8 }}><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Column><Text>Side</Text></Row></Email>)).toEqual([{ row: "0px 0px 0px 0px", blocks: ["0px", "16px 0px 0px / 0px", "0px"] }]);
    // Nothing in it shows on phones but a plain Column's padding: its column holds that there.
    const columns = designOf(<Email><Row><Column style={{ padding: 8 }}><Column style={{ padding: 10 }}><Text hidden={{ mobile: true }}>A</Text></Column></Column><Text>Side</Text></Row></Email>).body.rows[0].columns;
    expect(columns[0].values.padding).toBe("8px");
    expect(columns[0].values._override?.mobile?.padding).toBe("28px 8px 8px");
  });

  it("keeps a plain Column's spacing between the lines drawn around it", () => {
    const lined = { padding: 8, gap: 12, border: { top: { width: 1, style: "solid", color: "#000000" }, bottom: { width: 1, style: "solid", color: "#000000" } } } as const;
    // Hidden on phones before it: there the top line starts the Section; inside the lines, its padding and gap as they are.
    expect(spacing(<Email><Section style={{ padding: 48 }}><Text hidden={{ mobile: true }}>Hidden</Text><Column style={lined}><Text>One</Text><Text>Two</Text></Column></Section></Email>)).toEqual([
      { row: "0px", blocks: ["48px 48px 0px"] },
      { row: "0px", blocks: ["0px 48px / 48px 48px 0px"] },
      { row: "0px", blocks: ["8px 56px 0px", "12px 56px 8px"] },
      { row: "0px", blocks: ["0px 48px 48px"] },
    ]);
  });

  for (const [name, inside] of [
    ["a Row", <Row key="row" hidden={{ mobile: true }}><Text>L</Text><Text>R</Text></Row>],
    ["a Grid", <Grid key="grid" columns={2} hidden={{ mobile: true }}><Text>L</Text><Text>R</Text></Grid>],
  ] as const) {
    it(`keeps a Section's band on phones where all it holds is ${name} hidden there: a row of its own holds its padding, on phones only`, () => {
      const design = designOf(<Email><Section style={{ padding: 48, backgroundColor: "#eeeeee" }}>{inside}</Section></Email>);
      const spacer = design.body.rows[design.body.rows.length - 1];
      expect(spacer.values.padding).toBe("48px 0px");
      expect(spacer.values.backgroundColor).toBe("#eeeeee");
      expect(spacer.values._override).toEqual({ desktop: { hideDesktop: true } });
      expect(spacer.columns[0].contents).toEqual([]);
      // It comes back as a band of that space, on phones.
      const kept = back(design, "email");
      const band = (kept.children ?? []).filter((child): child is Node => typeof child !== "string").at(-1)!;
      expect(band).toMatchObject({ type: "Section", hidden: { desktop: true }, style: { padding: { top: 48, bottom: 48 }, backgroundColor: "#eeeeee" } });
    });
  }

  it("spaces it the same with paddings that aren't whole pixels, which the builder writes to two places", () => {
    expect(spacing(<Email><Section style={{ padding: 48.001, gap: 16 }}><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["48px 48px 0px", "16px 48px 48px / 48px"] }]);
    // 2.1 and 4.2 add up to a little over 6.3.
    expect(spacing(<Email><Section style={{ padding: 2.1, gap: 16 }}><Column style={{ padding: 4.2 }}><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Column></Section></Email>)).toEqual([{ row: "0px", blocks: ["6.3px 6.3px 0px", "0px 6.3px 6.3px / 6.3px"] }]);
    expect(spacing(<Email><Section style={{ padding: 48.001, mobile: { padding: { top: 16.003, right: 48.001, bottom: 16.003, left: 48.001 } } }}><Text>A</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["48px / 16px 48px"] }]);
  });

  it("keeps a block's own phone padding beside the Section's space", () => {
    // Shown on phones only, with its own 8px there: the 16px gap above it and the Section's 48px below it there.
    expect(spacing(<Email><Section style={band}><Text>Welcome</Text><Text hidden={{ desktop: true }} style={{ mobile: { padding: 8 } }}>Phones only</Text></Section></Email>)).toEqual([{ row: "0px", blocks: ["48px 24px / 48px 24px 0px", "16px 24px 48px / 24px 32px 56px"] }]);
  });

  it("comes back with a column's padding around its blocks where one is hidden on a device, on phones too", () => {
    // Folded into the blocks, the Column's 8px would be A's on top, which phones don't show, and B's phone padding
    // would drop it at the sides: a Column around them keeps it.
    const kept = back(designOf(<Email><Row><Column style={{ padding: 8, gap: 16 }}><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Column></Row></Email>), "email");
    const column = (kept.children ?? []).find((child): child is Node => typeof child !== "string")!;
    expect(column).toMatchObject({ type: "Column", style: { padding: { top: 8, right: 8, bottom: 8, left: 8 } } });
    expect(column.children).toMatchObject([
      { type: "Text", hidden: { mobile: true }, children: ["A"] },
      { type: "Text", style: { padding: { top: 16 } }, mobile: { padding: { top: 0, right: 0, bottom: 0, left: 0 } }, children: ["B"] },
    ]);
  });

  it("keeps the root's space on phones where all it holds there is hidden: a row of its own holds it, on phones only", () => {
    const rows = designOf(<Email><Column style={{ padding: 10 }}><Row hidden={{ mobile: true }}><Text>L</Text><Text>R</Text></Row></Column></Email>).body.rows;
    expect(rows.map((row: any) => [row.values.padding, row.values._override])).toEqual([
      ["10px 0px 10px 0px", { mobile: { hideMobile: true } }],
      ["20px 0px 0px", { desktop: { hideDesktop: true } }],
    ]);
  });

  for (const [style, name] of [[band, "a Section with a background"], [{ padding: 48 }, "a plain Section"]] as const) {
    it(`comes back with the Section's padding on each device, in ${name}`, () => {
      const kept = back(designOf(<Email><Section style={style}><Text hidden={{ mobile: true }}>Desktop only</Text><Text>Welcome</Text></Section></Email>), "email");
      const welcome = (node: Node): Node | undefined => (node.children ?? []).reduce<Node | undefined>((found, child) => found ?? (typeof child === "string" ? undefined : child.type === "Text" && child.children?.includes("Welcome") ? child : welcome(child)), undefined);
      const text = welcome(kept)!;
      expect(hiddenAround(kept, "Desktop only")).toEqual({ mobile: true });
      // On phones it starts the Section: 48px above it there, as above the hidden one on desktops.
      expect((text.mobile?.padding as { top: number } | undefined)?.top).toBe(48);
      expect((text.style?.padding as { top: number } | undefined)?.top).toBe(("gap" in style ? style.gap : undefined) ?? 0);
      // Nothing in it on phones: the Section's padding is still there, around the hidden block.
      const alone = back(designOf(<Email><Section style={style}><Text hidden={{ mobile: true }}>Desktop only</Text></Section></Email>), "email");
      const around = (node: Node): Node | undefined =>
        (node.mobile?.padding as { top?: number; bottom?: number } | undefined)?.top === 48 && (node.mobile?.padding as { bottom?: number }).bottom === 48 && hiddenAround(node, "Desktop only")
          ? node
          : (node.children ?? []).reduce<Node | undefined>((found, child) => found ?? (typeof child === "string" ? undefined : around(child)), undefined);
      expect(around(alone)).toBeDefined();
      expect(hiddenAround(alone, "Desktop only")).toEqual({ mobile: true });
    });
  }
});

describe("a Section's or a plain Column's own padding and gap on phones", () => {
  const spacing = (element: React.ReactElement) => {
    const { design, report } = toDesign(element);
    const rows = JSON.parse(JSON.stringify(design)).body.rows.map((row: any) => ({
      row: [row.values.padding, row.values._override?.mobile?.padding].filter(Boolean).join(" / "),
      blocks: row.columns.flatMap((column: any) => column.contents.map((content: any) => [content.values.containerPadding, content.values._override?.mobile?.containerPadding].filter(Boolean).join(" / "))),
    }));
    return { rows, report };
  };

  it("holds its top and bottom on phones, where its padding is", () => {
    expect(spacing(<Email><Section style={{ padding: 48, gap: 16, mobile: { padding: { top: 16, right: 48, bottom: 16, left: 48 } } }}><Text>A</Text><Text>B</Text></Section></Email>)).toEqual({
      rows: [{ row: "0px", blocks: ["48px 48px 0px / 16px 48px 0px", "16px 48px 48px / 16px 48px"] }],
      report: [],
    });
    expect(spacing(<Email><Section style={{ gap: 16 }}><Column style={{ padding: 20, mobile: { padding: { top: 4, right: 20, bottom: 4, left: 20 } } }}><Text>A</Text><Text>B</Text></Column></Section></Email>)).toEqual({
      rows: [{ row: "0px", blocks: ["20px 20px 0px / 4px 20px 0px", "0px 20px 20px / 0px 20px 4px"] }],
      report: [],
    });
  });

  it("holds its gap on phones between what shows there", () => {
    expect(spacing(<Email><Section style={{ gap: 24, mobile: { gap: 8 } }}><Text>A</Text><Text>B</Text><Text>C</Text></Section></Email>)).toEqual({
      rows: [{ row: "0px", blocks: ["0px", "24px 0px 0px / 8px 0px 0px", "24px 0px 0px / 8px 0px 0px"] }],
      report: [],
    });
    expect(spacing(<Email><Section><Column style={{ gap: 24, mobile: { gap: 8 } }}><Text>A</Text><Text>B</Text></Column></Section></Email>)).toEqual({
      rows: [{ row: "0px", blocks: ["0px", "24px 0px 0px / 8px 0px 0px"] }],
      report: [],
    });
  });

  it("holds a Row's and an empty Section's own phone padding, at their top and bottom, as their row's", () => {
    const row = designOf(<Email><Row style={{ padding: 20, mobile: { padding: { top: 4, right: 20, bottom: 4, left: 20 } } }}><Text>L</Text><Text>R</Text></Row></Email>).body.rows[0];
    expect([row.values.padding, row.values._override?.mobile?.padding]).toEqual(["20px 0px 20px 0px", "4px 0px 4px 0px"]);
    expect(toDesign(<Email><Row style={{ padding: 20, mobile: { padding: 4 } }}><Text>L</Text><Text>R</Text></Row></Email>).report).toContain("root.children[0]: the builder's row has no place for mobile.padding at its sides: left out");
    const empty = designOf(<Email><Section style={{ padding: 40, mobile: { padding: { top: 10, right: 40, bottom: 10, left: 40 } } }} /></Email>).body.rows[0];
    expect([empty.values.padding, empty.values._override?.mobile?.padding]).toEqual(["40px 0px", "10px 0px"]);
  });

  it("says where it's another at its sides, which the builder has no place for on phones", () => {
    expect(spacing(<Email><Section style={{ padding: 48, mobile: { padding: 16 } }}><Text>A</Text></Section></Email>)).toEqual({
      rows: [{ row: "0px", blocks: ["48px / 16px 48px"] }],
      report: ["root.children[0]: the builder's row has no place for mobile.padding at its sides: left out"],
    });
    expect(spacing(<Email><Section><Column style={{ padding: 20, mobile: { padding: 4 } }}><Text>A</Text></Column></Section></Email>).report).toEqual([
      "root.children[0].children[0]: the builder has no phone values for a plain Column (padding at its sides): left out",
    ]);
  });

  for (const [name, element, displayMode] of [
    ["a band whose blocks are hidden on phones", <Email key="band"><Section style={{ padding: 48, backgroundColor: "#eeeeee" }}><Text hidden={{ mobile: true }}>A</Text></Section></Email>, "email"],
    ["an Image after a Text hidden on phones", <Email key="image"><Section style={{ padding: 48, gap: 16 }}><Text hidden={{ mobile: true }}>A</Text><Image src={{ src: "https://x.test/a.png", width: 100, height: 50 }} alt="" /></Section></Email>, "email"],
    ["a Page", <Page key="page"><Section style={{ padding: 48, gap: 16 }}><Text hidden={{ mobile: true }}>A</Text><Text>B</Text></Section></Page>, "web"],
    ["a Row before a Text hidden on phones, in an Email", <Email key="row"><Section style={{ padding: { top: 48, right: 0, bottom: 48, left: 0 }, gap: 16 }}><Row><Text>L</Text><Text>R</Text></Row><Text hidden={{ mobile: true }}>Desktop only</Text></Section></Email>, "email"],
    ["a Row before a Text hidden on phones, in a Page", <Page key="row-page"><Section style={{ padding: { top: 48, right: 0, bottom: 48, left: 0 }, gap: 16 }}><Row><Text>L</Text><Text>R</Text></Row><Text hidden={{ mobile: true }}>Desktop only</Text></Section></Page>, "web"],
  ] as const) {
    it(`gives the same builder design back after round trips: ${name}`, () => {
      const first = designOf(element);
      const second = designOf(fromDesign(first, { displayMode }).element);
      const third = designOf(fromDesign(second, { displayMode }).element);
      // Sides as numbers, however they're written ("48px 0px" or "48px 0px 48px 0px").
      const sidesOf = (value: unknown) => {
        if (typeof value !== "string") return value;
        const [top, right = top, bottom = top, left = right] = value.trim().split(/\s+/).map((part) => parseFloat(part));
        return [top, right, bottom, left];
      };
      const phone = (override: any) => (override ? { ...override, mobile: override.mobile && { ...override.mobile, padding: sidesOf(override.mobile.padding), containerPadding: sidesOf(override.mobile.containerPadding) } } : override);
      const spaceOf = (design: any) => design.body.rows.map((row: any) => [sidesOf(row.values.padding), phone(row.values._override), row.columns.map((column: any) => column.contents.map((content: any) => [sidesOf(content.values.containerPadding), phone(content.values._override)]))]);
      expect(spaceOf(second)).toEqual(spaceOf(first));
      expect(spaceOf(third)).toEqual(spaceOf(first));
      expect(toDesign(fromDesign(first, { displayMode }).element).report.join("\n")).not.toContain("padding");
    });
  }
});

/** Every style and prop a tool has no field for, set. */
const everyHidden = [
  <Email key="email" title="Welcome" lang="en" fonts={[{ family: "Inter", src: "https://fonts.test/inter.woff2", format: "woff2", weight: 400 }]}>
    <Section style={{ backgroundColor: "#eeeeee", border: "1px solid #cccccc" }}>
      <Text style={{ fontStyle: "italic", textTransform: "uppercase", textDecoration: "underline", backgroundColor: "#ffffff", border: "1px solid #000000", borderRadius: 4, width: 300, maxWidth: 400, padding: 8, mobile: { maxWidth: 200 } }}>
        Boxed
      </Text>
      <List style={{ indent: 30, gap: 6 }}>
        <ListItem>One</ListItem>
        <ListItem>Two</ListItem>
      </List>
      <Heading style={{ fontStyle: "italic", textTransform: "lowercase", textDecoration: "line-through", backgroundColor: "#ffffff", border: "1px solid #000000", borderRadius: 4, width: 300, maxWidth: 400, padding: 8 }}>Heading</Heading>
      <Button href="https://x.test" title="Go there" aria-label="Go to x" style={{ textAlign: "left", width: 300, fontStyle: "italic", textTransform: "uppercase", textDecoration: "underline", maxWidth: 400 }}>
        Go
      </Button>
      <Image src={{ src: "https://x.test/a.png", width: 600, height: 300 }} alt="" title="A picture" style={{ maxWidth: 400, height: 150, border: "1px solid #000000", borderRadius: 8 }} />
      <Menu items={[{ text: "A", href: "https://a.test" }]} style={{ lineHeight: 2, textTransform: "uppercase" }} />
      <Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" thumbnail="https://x.test/thumb.png" title="Launch" style={{ width: 500, maxWidth: 400 }} />
      <Html html="<b>Sale</b>" text="Sale" />
    </Section>
    <Row style={{ borderRadius: 8, width: 500, minWidth: 300, maxWidth: 560, height: 200, overflow: "hidden", justifyContent: "center", flexWrap: "wrap" }}>
      <Column style={{ justifyContent: "end", minWidth: 100, maxWidth: 400, height: 100, overflow: "hidden" }} hidden={{ desktop: true }}>
        <Text>A</Text>
      </Column>
      <Column hidden={{ mobile: true }}>
        <Text>B</Text>
      </Column>
    </Row>
  </Email>,
  <Page key="page" description="A page">
    <Text>Page</Text>
  </Page>,
  <Document key="document" margin={[10, 20, 30, 40]}>
    <Text>Document</Text>
    <Table style={{ width: 400, maxWidth: 500, border: "2px solid #000000", borderCollapse: "collapse", rowBorder: "1px solid #cccccc" }}>
      <TableRow>
        <TableCell>Cell</TableCell>
      </TableRow>
    </Table>
  </Document>,
];

/** What a text block's markup holds of what its tool has no field for. */
const inMarkup = (values: Record<string, any>) => Object.keys(outOfMarkup(typeof values.textJson === "string" ? textJsonHtml(values.textJson).html : String(values.text ?? "")).values);

describe("hidden properties", () => {
  const written = everyHidden.flatMap((template) => items(toDesign(template).design));

  it("are only what the manifest lists: toDesign() writes the builder's own keys and the manifest's, nothing else", () => {
    const unknown = written.flatMap(({ tool, values }) => {
      const hidden = new Set((HIDDEN[tool] ?? []).map((entry) => entry.key));
      const keys = Object.keys(values).filter((key) => !BUILDER_KEYS[tool]?.includes(key) && !hidden.has(key)).map((key) => `${tool}.${key}`);
      const phone = Object.keys(values._override?.mobile ?? {}).filter((key) => !BUILDER_PHONE_KEYS[tool]?.includes(key) && !hidden.has(key)).map((key) => `${tool}._override.mobile.${key}`);
      return [...keys, ...phone];
    });
    expect(unknown).toEqual([]);
  });

  it("are each written by some template (the manifest lists nothing toDesign() doesn't write)", () => {
    const seen = new Set(written.flatMap(({ tool, values }) => [...Object.keys(values), ...Object.keys(values._override?.desktop ?? {}), ...Object.keys(values._override?.mobile ?? {}), ...inMarkup(values)].map((key) => `${tool}.${key}`)));
    const unwritten = Object.entries(HIDDEN).flatMap(([tool, entries]) => entries.filter((entry) => !seen.has(`${tool}.${entry.key}`)).map((entry) => `${tool}.${entry.key}`));
    expect(unwritten).toEqual([]);
  });

  it("are prefixed exactly where the tool uses the name for something else, and say why", () => {
    for (const [tool, entries] of Object.entries(HIDDEN)) {
      for (const entry of entries) {
        const name = entry.path.slice(entry.path.indexOf(".") + 1);
        if (entry.prefixed) {
          expect([tool, entry.key, BUILDER_KEYS[tool].includes(name), entry.key !== name]).toEqual([tool, entry.key, true, true]);
        } else {
          expect([tool, entry.key, entry.key === name || entry.path.startsWith("hidden."), BUILDER_KEYS[tool].includes(entry.key) && !entry.path.startsWith("hidden.")]).toEqual([tool, entry.key, true, false]);
        }
      }
    }
    expect(HIDDEN.button.find((entry) => entry.prefixed)).toMatchObject({ path: "style.textAlign", key: "buttonTextAlign" });
  });

  it("are written as the builder's editors write values: lengths and sides in px, borders side by side", () => {
    const paragraph = written.find((item) => item.tool === "paragraph" && item.values.textJson.includes("Boxed"))!.values;
    expect(paragraph._override.mobile).toEqual({ maxWidth: "200px" });
    const list = written.find((item) => item.tool === "paragraph" && item.values.textJson.includes("extended-list"))!.values;
    expect(list).toMatchObject({ indent: "30px", gap: "6px" });
    const button = written.find((item) => item.tool === "button")!.values;
    expect(button).toMatchObject({ buttonTextAlign: "left", textAlign: "left", title: "Go there", "aria-label": "Go to x", size: { autoWidth: false, width: "300px" } });
    // Its title is the builder's accessibility title, a field.
    const body = written.find((item) => item.tool === "body")!.values;
    expect(body).toMatchObject({ accessibilityTitle: "Welcome", lang: "en", fonts: [{ family: "Inter", src: "https://fonts.test/inter.woff2", format: "woff2", weight: 400 }] });
    expect(body.title).toBeUndefined();
  });

  it("come back as the template's styles and props", () => {
    for (const [i, template] of everyHidden.entries()) {
      const mode = (["email", "web", "document"] as const)[i];
      const round = back(designOf(template), mode);
      const twice = back(designOf(fromDesign(designOf(template), { displayMode: mode }).element), mode);
      expect(twice).toEqual(round);
    }
    const [email] = everyHidden;
    const round = back(designOf(email));
    expect(round.props).toMatchObject({ title: "Welcome", lang: "en" });
    const json = JSON.stringify(round);
    for (const value of ['"textTransform":"lowercase"', '"textDecoration":"line-through"', '"title":"A picture"', '"thumbnail":"https://x.test/thumb.png"', '"justifyContent":"end"', '"flexWrap":"wrap"', '"overflow":"hidden"', '"minWidth":100']) expect(json).toContain(value);
    expect(back(designOf(everyHidden[1]), "web").props).toEqual({ description: "A page" });
    expect(back(designOf(everyHidden[2]), "document").props).toEqual({ margin: { top: 10, right: 20, bottom: 30, left: 40 } });
  });

  it("are in one place: a value written to a field (a Section's space in its rows' padding, a block's place in its spacing) isn't hidden too", () => {
    const design = designOf(
      <Email>
        <Section style={{ backgroundColor: "#eeeeee", padding: 20, gap: 10, color: "#333333", textAlign: "center" }}>
          <Text style={{ padding: 4 }}>A</Text>
          <Button href="https://x.test" style={{ padding: 12, width: 200 }}>
            B
          </Button>
        </Section>
      </Email>
    );
    const all = items(design);
    const row = all.find((item) => item.tool === "row")!.values;
    const [paragraph, button] = all.filter((item) => item.tool === "paragraph" || item.tool === "button").map((item) => item.values);
    // The Section's padding and gap are its blocks' spacing; its text style, theirs.
    expect([row.padding, row.backgroundColor, paragraph.containerPadding, button.containerPadding]).toEqual(["0px", "#eeeeee", "24px 24px 4px", "10px 20px 20px"]);
    expect([paragraph.color, paragraph.textAlign, button.textAlign]).toEqual(["#333333", "center", "center"]);
    // The Section's own values aren't hidden on its row, nor the blocks' padding beside their spacing.
    for (const key of ["gap", "color", "textAlign", "sectionBorder"]) expect([key, row[key]]).toEqual([key, undefined]);
    expect(Object.keys(paragraph)).not.toContain("padding");
    expect(button.padding).toBe("12px");
    expect(button.size).toEqual({ autoWidth: false, width: "200px" });
  });

  describe("in a design the builder edits", () => {
    const heading = (
      <Email>
        <Heading style={{ backgroundColor: "#fde68a", borderRadius: 8, fontStyle: "italic" }}>Title</Heading>
      </Email>
    );
    const block = (design: any) => design.body.rows[0].columns[0].contents[0];

    it("keep them where a field is edited on a tool that carries them", () => {
      const design = designOf(heading);
      block(design).values.color = "#ff0000";
      block(design).values.text = block(design).values.text.replace("Title", "New title");
      expect(back(design).children).toEqual([{ type: "Heading", style: { color: "#ff0000", fontStyle: "italic", backgroundColor: "#fde68a", borderRadius: 8 }, children: ["New title"] }]);
    });

    it("keep them on each copy of a duplicated row", () => {
      const design = designOf(heading);
      design.body.rows.push(JSON.parse(JSON.stringify(design.body.rows[0])));
      const [first, second] = back(design).children as Node[];
      expect(second).toEqual(first);
      expect(first.style).toMatchObject({ backgroundColor: "#fde68a", borderRadius: 8 });
    });

    it("go with a block copied into another design", () => {
      const from = designOf(heading);
      const into = designOf(
        <Email>
          <Text>Other</Text>
        </Email>
      );
      into.body.rows[0].columns[0].contents.push(block(from));
      expect(back(into).children).toEqual([
        { type: "Text", children: ["Other"] },
        { type: "Heading", style: { fontStyle: "italic", backgroundColor: "#fde68a", borderRadius: 8 }, children: ["Title"] },
      ]);
    });

    const text = (
      <Email>
        <Text style={{ textTransform: "uppercase", maxWidth: 400, border: { top: "1px solid #000000" } }}>Words</Text>
      </Email>
    );
    const paragraphOf = (html: string, rest = {}) => {
      const design = designOf(text);
      const made = block(design);
      // The builder's export of its rich text, as its editor leaves it after an edit.
      made.type = "text";
      delete made.values.textJson;
      Object.assign(made.values, { text: html, ...rest });
      return fromDesign(design);
    };

    it("draw in a Text's own paragraph, which the builder draws, not as values it only keeps", () => {
      const design = designOf(text);
      const { values } = block(design);
      expect(block(design).type).toBe("paragraph");
      for (const key of ["textTransform", "maxWidth", "border"]) expect(values[key]).toBeUndefined();
      const [paragraph] = JSON.parse(values.textJson).root.children;
      expect(paragraph).toMatchObject({ type: "extended-paragraph", style: "text-transform:uppercase;max-width:400px;border-top:1px solid #000000" });
      expect(back(design).children).toEqual([{ type: "Text", style: { textTransform: "uppercase", maxWidth: 400, border: { top: { width: 1, style: "solid", color: "#000000" } } }, children: ["Words"] }]);
    });

    it("come back as its editor leaves them: its own spacing and colors, and a copy on each paragraph a new line makes", () => {
      const same = { textTransform: "uppercase", maxWidth: 400 };
      expect(tree(paragraphOf('<p style="margin: 0px; text-transform: uppercase; max-width: 400px; line-height: 150%;">Words</p>').element).children).toEqual([{ type: "Text", style: { ...same, lineHeight: 1.5 }, children: ["Words"] }]);
      expect(tree(paragraphOf('<p style="margin: 0px; text-transform: uppercase; max-width: 400px;">One</p><p style="margin: 0px; text-transform: uppercase; max-width: 400px;">Two</p>').element).children).toEqual([
        { type: "Text", style: same, children: ["One"] },
        { type: "Text", style: same, children: ["Two"] },
      ]);
      const painted = tree(paragraphOf('<p style="background-color: rgb(221, 221, 221); border-top: 1px solid rgb(0, 0, 0); border-radius: 4px; padding: 24px 8px 0px;">Words</p>').element).children as Node[];
      expect(painted).toEqual([{ type: "Text", style: { backgroundColor: "#dddddd", border: { top: { width: 1, style: "solid", color: "#000000" } }, borderRadius: 4, padding: { top: 24, right: 8, bottom: 0, left: 8 } }, children: ["Words"] }]);
    });

    it("are read as markup, and said, where a block's paragraphs don't share them", () => {
      const { element, report } = paragraphOf('<p style="text-transform: uppercase;">One</p><p style="text-transform: lowercase;">Two</p>');
      expect((tree(element).children as Node[])[0].type).toBe("Html");
      expect(report).toEqual([expect.stringContaining("it's an Html block of its markup")]);
    });

    it("are gone where the builder deleted them", () => {
      const design = designOf(heading);
      block(design).values.text = '<span style="display:block;border-radius:8px">Title</span>';
      expect(back(design).children).toEqual([{ type: "Heading", style: { borderRadius: 8 }, children: ["Title"] }]);
    });

    it("leave out one that can't be read, and say so", () => {
      const design = designOf(heading);
      block(design).values.text = '<span style="display:block;font-style:italic;border-radius:round">Title</span>';
      block(design).values.backgroundColor = { not: "a color" };
      const result = fromDesign(design);
      expect(tree(result.element).children).toEqual([{ type: "Heading", style: { fontStyle: "italic" }, children: ["Title"] }]);
      expect(result.report).toEqual([expect.stringMatching(/^rows\[0\]\.columns\[0\]\.contents\[0\]: its backgroundColor can't be read/), expect.stringMatching(/^rows\[0\]\.columns\[0\]\.contents\[0\]: its borderRadius can't be read/)]);
    });
  });
});
