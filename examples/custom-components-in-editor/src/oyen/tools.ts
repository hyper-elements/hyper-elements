/**
 * The editor's custom JavaScript (`customJS`): Oyen's components as tools of the Unlayer editor. `registerTools()`
 * makes each tool from its component's definition: its name, its label, a field for each prop, and its drawing, in
 * the canvas and in what the editor exports.
 *
 * A prop says what its value is (`prop.number`); `editor` names the control that edits it. "counter" is one of the
 * editor's own. "currency" is the example's (`../currency.ts`), given here as it's written: without it, the price would
 * be edited with a number's own field.
 */
import { registerTools } from "@hyper-elements/react/builder";
import { currency } from "../currency";
import { components } from "./components";

declare const unlayer: Parameters<typeof registerTools>[0];

registerTools(unlayer, components, {
  editors: { currency },
  icons: {
    "oyen.Announcement": "fa-bullhorn",
    "oyen.Callout": "fa-circle-dot",
    "oyen.Spec": "fa-ruler-horizontal",
    "oyen.FieldNote": "fa-quote-left",
    "oyen.PriceBand": "fa-tag",
  },
});
