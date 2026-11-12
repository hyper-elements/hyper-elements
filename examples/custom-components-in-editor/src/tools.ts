/**
 * The editor's custom JavaScript (`customJS`): Oyen's components as tools of the Unlayer editor. `registerTools()`
 * makes each tool from its component's definition: its name, its label, a field for each prop, and its drawing, in
 * the canvas and in what the editor exports.
 *
 * A prop says what its value is (`prop.number`); `editor` names the control that edits it. "counter" is one of the
 * editor's own. "currency" is Oyen's, registered here: without it, the price would be edited with a number's control.
 */
import { registerTools } from "@hyper-elements/react/builder";
import { components } from "./components";

declare const unlayer: Parameters<typeof registerTools>[0] & {
  registerPropertyEditor(editor: { name: string; Widget: unknown }): void;
  createWidget(widget: { render(value: unknown): string; mount(node: HTMLElement, value: unknown, updateValue: (value: unknown) => void): void }): unknown;
};

unlayer.registerPropertyEditor({
  name: "currency",
  Widget: unlayer.createWidget({
    // A property editor of a team's own draws all of its field, its label too.
    render: (value) =>
      `<div style="margin:0 0 8px;font:600 13px/1.4 sans-serif;color:#1a1917">Price</div>` +
      `<div style="display:flex;align-items:center;border:1px solid #d3cec4;border-radius:4px;overflow:hidden;background:#fff">` +
      `<span style="padding:8px 12px;background:#f3f1ec;font:600 13px/1 sans-serif;color:#1a1917">€ $ £</span>` +
      `<input class="oyen-currency" type="number" min="0" step="1" value="${Number(value) || 0}" style="flex:1;min-width:0;border:0;padding:8px 10px;font:14px/1.2 sans-serif" />` +
      `</div>`,
    mount(node, _value, updateValue) {
      const input = node.querySelector<HTMLInputElement>(".oyen-currency");
      if (input) input.onchange = () => updateValue(Number(input.value));
    },
  }),
});

registerTools(unlayer, components, {
  editors: ["currency"],
  icons: {
    "oyen.Announcement": "fa-bullhorn",
    "oyen.Callout": "fa-circle-dot",
    "oyen.Spec": "fa-ruler-horizontal",
    "oyen.FieldNote": "fa-quote-left",
    "oyen.PriceBand": "fa-tag",
  },
});
