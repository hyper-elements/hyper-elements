/**
 * Snapshots (`snapshot()`): a design collected once and captured as inert data, which every entry point takes in
 * place of an element; slots' content captured on its own (`captureFragment()`), spliced in at its mark
 * (`slotMark()`), and seen by a preflight before anything is read; and captures read back from JSON (`readFragment()`).
 */
import React, { useState } from "react";
import { toDesign } from "../builder";
import { inspect } from "../inspect";
import { Button, Column, component, Email, Heading, Html, outline, prepare, prop, render, Section, Text, validate } from "./index";
import { captureFragment, readFragment, slotMark, snapshot, type FragmentCapture } from "./index";

const codes = (diagnostics: Array<{ code: string; path: string; severity: string }>) => diagnostics.filter((d) => d.severity === "error").map((d) => [d.code, d.path]);

describe("snapshot()", () => {
  const design = (
    <Email>
      <Section>
        <Heading>Hello</Heading>
      </Section>
    </Email>
  );

  it("is taken by every entry point in place of the element, and gives the same output", async () => {
    const snap = snapshot(design);
    expect((await render(snap)).html).toBe((await render(design)).html);
    expect(validate(snap)).toEqual(validate(design));
    expect(outline(snap)).toBe(outline(design));
    expect(prepare(snap).root).toEqual(prepare(design).root);
    expect(inspect(snap).nodes).toEqual(inspect(design).nodes);
    expect(() => toDesign(snap as never)).toThrow(/builder\/snapshot/);
  });

  it("collects the element once: what renders is what was captured", async () => {
    let runs = 0;
    const Changing = () => {
      runs++;
      return runs === 1 ? <Text>First</Text> : <Html html="<b>later</b>" />;
    };
    const snap = snapshot(
      <Email>
        <Changing />
      </Email>
    );
    expect(runs).toBe(1);
    const { html } = await render(snap);
    validate(snap);
    inspect(snap);
    expect(runs).toBe(1);
    expect(html).toContain("First");
    expect(html).not.toContain("later");
  });

  it("reads each value once: a getter gives the checks and the writer one value; a function is jsx/value", async () => {
    let reads = 0;
    const style = {
      get color() {
        reads++;
        return reads === 1 ? "#123456" : "#ab1234";
      },
    };
    const snap = snapshot(
      <Email>
        <Text style={style as never}>Hi</Text>
      </Email>
    );
    // However often the render read it before the capture, the capture read it once, and every reader after gets that.
    const captured = reads;
    const shown = (prepare(snap).root!.children[0] as { style: { color?: string } }).style.color!;
    const { html } = await render(snap);
    validate(snap);
    expect(reads).toBe(captured);
    expect(html).toContain(shown);
    expect(html).not.toContain(shown === "#123456" ? "#ab1234" : "#123456");
    const withFunction = snapshot(
      <Email>
        <Button href="https://a.example" attrs={{ "data-x": { toString: () => "x" } as never }}>
          Go
        </Button>
      </Email>
    );
    expect(codes(validate(withFunction).diagnostics)).toContainEqual(["jsx/value", "root.children[0].props.attrs.data-x.toString"]);
  });

  it("splices each slot's content in at its mark, keeping its whitespace, and asks the preflight first", async () => {
    const seen: string[] = [];
    const snap = snapshot(
      <Email>
        <Section field="body">
          <Text>
            Hello{slotMark("name")}!
          </Text>
          {slotMark("body")}
        </Section>
      </Email>,
      {
        fragments: { name: <> world</>, body: <Column><Text>Content</Text></Column> },
        preflight: (slot, capture, host, marks) => {
          seen.push(`${slot}:${host?.node.type}:${host?.path}:${marks}:${capture.nodes.length}`);
          return [];
        },
      }
    );
    expect(seen).toEqual(["name:Text:root.children[0].children[0]:1:1", "body:Section:root.children[0]:1:1"]);
    const { html } = await render(snap);
    expect(html).toContain("Hello world!");
    expect(html).toContain("Content");
    // Joined: one string where the mark was, so paths match what reading gives.
    expect(inspect(snap).nodes.map((n) => n.path)).toEqual(["root", "root.children[0]", "root.children[0].children[0]", "root.children[0].children[1]", "root.children[0].children[1].children[0]"]);
  });

  it("never reads a slot the preflight refuses, nor its components' renders", () => {
    let ran = false;
    const Evil = component({ type: "acme.Evil", label: "Evil", props: {}, render: () => ((ran = true), (<Column />)) });
    const snap = snapshot(
      <Email>
        <Section field="body">{slotMark("body")}</Section>
      </Email>,
      { fragments: { body: <Evil /> }, preflight: () => [{ code: "template/slot-element", severity: "error", message: "no", path: "root.children[0].children[0]" }] }
    );
    expect(codes(validate(snap).diagnostics)).toEqual([["template/slot-element", "root.children[0].children[0]"]]);
    expect(ran).toBe(false);
  });

  it("refuses a mark with no content, and a mark outside a snapshot", async () => {
    expect(codes(validate(snapshot(<Email><Section>{slotMark("body")}</Section></Email>)).diagnostics)).toEqual([["jsx/slot-mark", "jsx"]]);
    await expect(render(<Email><Section>{slotMark("body")}</Section></Email>)).rejects.toThrow(/jsx\/slot-mark/);
  });

  it("reads a slot's own collection problems at its field, and never reads a slot that has one", () => {
    const snap = snapshot(<Email><Section field="body">{slotMark("body")}</Section></Email>, { fragments: { body: <div>markup</div> } });
    expect(codes(validate(snap).diagnostics)).toEqual([["jsx/markup", "values.body"]]);
  });

  it("binds a slot's custom types to the definitions given, never the slot's own", async () => {
    const Card = component({ type: "acme.Card", label: "Card", props: { title: prop.text({ label: "Title", required: true }) }, render: ({ title }) => <Column><Text>{`Genuine ${title}`}</Text></Column> });
    const Fake = component({ type: "acme.Card", label: "Card", props: { title: prop.text({ label: "Title", required: true }) }, render: () => <Column><Html html="<script>x</script>" /></Column> });
    const snap = snapshot(<Email><Section field="body">{slotMark("body")}</Section></Email>, { fragments: { body: <Fake title="One" /> }, bind: { body: [Card.definition] } });
    const { html } = await render(snap);
    expect(html).toContain("Genuine One");
    expect(html).not.toContain("<script>x</script>");
  });
});

describe("captureFragment() and readFragment()", () => {
  it("captures content as JSON that reads back the same, and refuses what isn't a fragment", () => {
    const capture = captureFragment(<Column><Text style={{ color: "#111111" }}>Hi</Text></Column>);
    const json = JSON.parse(JSON.stringify(capture)) as FragmentCapture;
    expect(readFragment(json)).toEqual(json);
    expect(json).toMatchObject({ kind: "hyper-elements.fragment", version: 1, aborted: false, nodes: [{ type: "Column" }] });
    const bad = (value: unknown) => expect(() => readFragment(value)).toThrow(/jsx\/fragment/);
    bad({ ...json, kind: "other" });
    bad({ ...json, version: 2 });
    bad({ ...json, nodes: [{ type: "Text", onClick: "x", children: [] }] });
    let deep: unknown = { type: "Column", children: [] };
    for (let i = 0; i < 70; i++) deep = { type: "Column", children: [deep] };
    bad({ ...json, nodes: [deep] });
    bad({ ...json, nodes: [{ type: "Text", children: ["x".repeat(9 * 1024 * 1024)] }] });
  });

  it("keeps a template out of a fragment", () => {
    const Inner = () => {
      useState(0);
      return null;
    };
    expect(captureFragment(<Inner />).diagnostics).toEqual([]);
  });
});
