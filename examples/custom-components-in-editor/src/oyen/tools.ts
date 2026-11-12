/**
 * The editor's custom JavaScript (`customJS`): Oyen's components as tools of the Unlayer editor. `registerTools()`
 * makes each tool from its component's definition: its name, its label, a field for each prop, and its drawing, in
 * the canvas and in what the editor exports.
 *
 * A prop says what its value is (`prop.number`); `editor` names the control that edits it. "counter" is one of the
 * editor's own. "currency" is the example's (`../currency.ts`): without it, the price would be edited with a number's control.
 */
import { registerTools } from "@hyper-elements/react/builder";
import { registerCurrencyEditor, type Editors } from "../currency";
import { components } from "./components";

declare const unlayer: Parameters<typeof registerTools>[0] & Editors;

registerCurrencyEditor(unlayer);

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
