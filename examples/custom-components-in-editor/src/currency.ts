/**
 * A property editor of the example's own: a price, shown as money. A prop asks for it by name
 * (`prop.number({ label: "Price", editor: "currency", editorOptions: { step: 1 } })`), and its value is still the
 * prop's: a number. `registerTools()` registers it, given in its `editors`.
 */
import type { EditorWidget } from "@hyper-elements/react/builder";

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const currency: EditorWidget = {
  // A property editor of a team's own draws all of its field: its label too, which is its prop's. It's given the
  // price as the number it is, and what the prop's `editorOptions` say.
  render: (value, _update, options) =>
    `<div style="margin:0 0 8px;font:600 13px/1.4 sans-serif;color:#1a1917">${escape(options.label)}</div>` +
    `<div style="display:flex;align-items:center;border:1px solid #d3cec4;border-radius:4px;overflow:hidden;background:#fff">` +
    `<span style="padding:8px 12px;background:#f3f1ec;font:600 13px/1 sans-serif;color:#1a1917">€ $ £</span>` +
    `<input class="example-currency" type="number" min="0" step="${Number(options.step) || "any"}" value="${Number(value) || 0}" style="flex:1;min-width:0;border:0;padding:8px 10px;font:14px/1.2 sans-serif" />` +
    `</div>`,
  mount(node, _value, update) {
    const input = node.querySelector<HTMLInputElement>(".example-currency");
    if (input) input.onchange = () => update(Number(input.value));
  },
};
