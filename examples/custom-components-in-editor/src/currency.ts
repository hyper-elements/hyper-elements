/**
 * A property editor of the example's own: a price, shown as money. A prop asks for it by name
 * (`prop.number({ label: "Price", editor: "currency" })`), and its value is still the prop's: a number.
 */
export interface Editors {
  registerPropertyEditor(editor: { name: string; layout?: string; Widget: unknown }): void;
  createWidget(widget: { render(value: unknown, updateValue: (value: unknown) => void, data?: unknown): string; mount(node: HTMLElement, value: unknown, updateValue: (value: unknown) => void, data?: unknown): void }): unknown;
}

export function registerCurrencyEditor(unlayer: Editors): void {
  unlayer.registerPropertyEditor({
    name: "currency",
    Widget: unlayer.createWidget({
      // A property editor of a team's own draws all of its field, its label too.
      render: (value) =>
        `<div style="margin:0 0 8px;font:600 13px/1.4 sans-serif;color:#1a1917">Price</div>` +
        `<div style="display:flex;align-items:center;border:1px solid #d3cec4;border-radius:4px;overflow:hidden;background:#fff">` +
        `<span style="padding:8px 12px;background:#f3f1ec;font:600 13px/1 sans-serif;color:#1a1917">€ $ £</span>` +
        `<input class="example-currency" type="number" min="0" step="1" value="${Number(value) || 0}" style="flex:1;min-width:0;border:0;padding:8px 10px;font:14px/1.2 sans-serif" />` +
        `</div>`,
      mount(node, _value, updateValue) {
        const input = node.querySelector<HTMLInputElement>(".example-currency");
        if (input) input.onchange = () => updateValue(Number(input.value));
      },
    }),
  });
}
