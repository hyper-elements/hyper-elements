import React from "react";
import { Email, Heading, Text, prop, render } from "../dist/primitives.js";
import { toDesign } from "../dist/builder.js";
import { template } from "../dist/template.js";

const h = React.createElement;
const tree = h(Email, { title: "Browser runtime probe" }, h(Text, null, "Browser runtime probe content"));

// A template (/template), as a design's root: its check runs, then its design renders.
const Card = template({
  id: "acme.ProbeCard",
  version: "1.0.0",
  label: "Probe card",
  root: "Email",
  fields: { title: prop.text({ label: "Title", required: true, maxLength: 60 }), items: prop.list(prop.text({ label: "Item" }), { label: "Items", min: 1 }) },
  example: { title: "Template in the browser", items: ["one"] },
  render: (v) => h(Email, null, h(Heading, { field: "title" }, v.title), ...v.items.map((item, i) => h(Text, { key: i }, item))),
});

globalThis.__HYPER_ELEMENTS_BROWSER_RUNTIME_PROBE__ = Promise.all([render(tree), render(h(Card, Card.example))]).then(([{ html }, designed]) => ({
  html,
  templateHtml: designed.html,
  templateId: designed.template?.id,
  rows: toDesign(tree).design.body.rows.length,
  processType: typeof globalThis.process,
}));
