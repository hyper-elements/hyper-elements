/**
 * The editor's custom JavaScript (`customJS`): Oyen's components as tools of the Unlayer editor. `registerTools()`
 * makes each tool from its component's definition: its name, its label, a field for each prop, and its drawing, in
 * the canvas and in what the editor exports.
 *
 * A prop says what its value is (`prop.number`), and the editor picks its control from that: a whole number gets its
 * counter. The price is a property of the example's (`../properties.ts` defines it), and its control
 * (`../currency.ts`) is given here under the property's name: without it, the price would be edited with a number's
 * own field.
 */
import { registerTools } from "@hyper-elements/react/builder";
import { currencyField } from "../currency";
import { currency } from "../properties";
import { components } from "./components";

declare const unlayer: Parameters<typeof registerTools>[0];

registerTools(unlayer, components, {
  editors: { [currency.name]: currencyField },
  icons: {
    "oyen.Announcement": "fa-bullhorn",
    "oyen.Callout": "fa-circle-dot",
    "oyen.Spec": "fa-ruler-horizontal",
    "oyen.FieldNote": "fa-quote-left",
    "oyen.PriceBand": "fa-tag",
  },
});
