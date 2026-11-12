/**
 * The editor's custom JavaScript (`customJS`) for the shop's components. `registerTools()` makes each a tool of the
 * Unlayer editor from its definition: its name, its label, a field for each prop, and its drawing.
 *
 * The Product tool has one thing more, which is the editor's and not the component's: a field that lists the store's
 * products. Picking one fills the photo, the name, the description, the price and the link together, and each stays
 * editable after. That's two of the editor's own settings for a tool, passed through `tools`:
 *
 * - `properties`: a field of the tool that isn't a prop of the component (`product`, edited with the picker below);
 * - `transformer`: the editor's hook that runs when a field changes, and returns the block's values.
 */
import { registerTools } from "@hyper-elements/react/builder";
import { registerCurrencyEditor, type Editors } from "../currency";
import { components } from "./components";

declare const unlayer: Parameters<typeof registerTools>[0] & Editors;

const IMG = "https://hyperelements.dev/img";
const SITE = "https://common-goods.example";

/** The store: what an app would fetch from its own catalogue. */
const store = [
  { id: "low-water", name: "Low Water", description: "A two-color print on cotton paper, 50 × 70 cm. Signed and numbered, in a run of 200.", price: 64, photo: { url: `${IMG}/gallery/saltworks/low-water.png`, width: 1200, height: 680 } },
  { id: "fr-2", name: "FR-2 field recorder", description: "A pocket recorder with two capsules that turn, one dial, and nothing to set.", price: 349, photo: { url: `${IMG}/gallery/oyen/fr2-drawing.png`, width: 1020, height: 900 } },
  { id: "orbit", name: "Orbit, one year", description: "Every template and every render, for a year.", price: 96, photo: { url: `${IMG}/orbit-app.png`, width: 1200, height: 700 } },
];

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The picker: the store's products, with a search. Its value is the product picked. */
unlayer.registerPropertyEditor({
  name: "store_picker",
  Widget: unlayer.createWidget({
    render: (value) => {
      const picked = (value as { id?: string } | undefined)?.id;
      const row = (product: (typeof store)[number]) =>
        `<button type="button" data-product="${product.id}" data-name="${escape(product.name.toLowerCase())}" style="display:flex;align-items:center;gap:10px;width:100%;margin:0 0 6px;padding:6px;text-align:left;cursor:pointer;background:#fff;border:1px solid ${product.id === picked ? "#0e7c66" : "#e6e3dc"};border-radius:8px;font:13px/1.35 sans-serif;color:#14171a">` +
        `<img src="${product.photo.url}" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:4px" />` +
        `<span style="flex:1"><b>${escape(product.name)}</b><br /><span style="color:#5e6670">€${product.price}</span></span>` +
        `</button>`;
      return (
        `<div style="margin:0 0 8px;font:600 13px/1.4 sans-serif;color:#14171a">From the store</div>` +
        `<input class="store-search" type="search" placeholder="Search products" style="width:100%;margin:0 0 8px;padding:8px 10px;border:1px solid #e6e3dc;border-radius:8px;font:13px/1.2 sans-serif" />` +
        `<div class="store-list">${store.map(row).join("")}</div>`
      );
    },
    mount(node, _value, updateValue) {
      const search = node.querySelector<HTMLInputElement>(".store-search");
      const rows = [...node.querySelectorAll<HTMLButtonElement>("[data-product]")];
      if (search) search.oninput = () => rows.forEach((row) => (row.style.display = row.dataset.name!.includes(search.value.trim().toLowerCase()) ? "flex" : "none"));
      rows.forEach((row) => (row.onclick = () => updateValue({ id: row.dataset.product })));
    },
  }),
});

registerCurrencyEditor(unlayer);

registerTools(unlayer, components, {
  editors: ["currency"],
  icons: {
    "shop.ProductCard": "fa-bag-shopping",
    "shop.Testimonial": "fa-quote-left",
    "shop.Coupon": "fa-ticket-simple",
    "shop.OrderTracker": "fa-truck-fast",
    "shop.Ticket": "fa-ticket",
  },
  tools: {
    "shop.ProductCard": {
      properties: { product: { label: "From the store", widget: "store_picker" } },
      // The editor's hook, with the block's values as the editor stores them: an image is `{ url, width, height }`,
      // a link `{ name, values }`.
      transformer: (values: Record<string, unknown>, source: { name: string; value: unknown }) => {
        const product = source.name === "product" ? store.find((item) => item.id === (source.value as { id?: string } | undefined)?.id) : undefined;
        if (!product) return values;
        return {
          ...values,
          name: product.name,
          description: product.description,
          price: product.price,
          currency: "EUR",
          photo: product.photo,
          href: { name: "web", values: { href: `${SITE}/${product.id}`, target: "_blank" } },
        };
      },
    },
  },
});
