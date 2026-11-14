/**
 * The example's own properties, as a template knows them: a name, the helper of `prop` each is made on, and what its
 * editor takes. There's no control here, so a template that uses one renders anywhere. The control is the editor's
 * side (`currency.ts`), registered under the same name.
 */
import { defineProperty, prop } from "@hyper-elements/react";

/** A price, edited as money. It's a number still, with a number's own limits. `symbol` is what its field shows. */
export const currency = defineProperty({
  name: "example.currency",
  base: prop.number,
  options: {
    symbol: prop.text({ enum: ["$", "€", "£"], default: "$" }),
  },
});
