import { Email, Page } from "@hyper-elements/react";
import { gallery } from "../../react/src/primitives/examples/gallery";
import { stress } from "../../react/src/primitives/examples/stress";

/** Every screen template of the gallery and the stress set, as an Email and a Page. */
export const screenTemplates = () => [
  ...Object.entries(gallery).map(([name, template]) => ({ name, template })),
  ...Object.entries(stress).flatMap(([name, entry]) =>
    entry.roots === "screen"
      ? [
          { name: `${name}-email`, template: entry.template(Email) },
          { name: `${name}-page`, template: entry.template(Page) },
        ]
      : [{ name, template: entry.template }]
  ),
];
