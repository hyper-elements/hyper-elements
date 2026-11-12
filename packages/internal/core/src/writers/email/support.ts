/**
 * What Elements' Email writer can't write as a template asks, found in one pass before the email is written: what each
 * style and prop declares for email (the shared pass, `shared/support.ts`), and what no single style or prop says: a
 * wrapped Row's gap between its lines, a Layer it can't draw, a hidden table cell, a Vimeo video without a thumbnail.
 *
 * What email clients do with the HTML is no longer core's (plan email-client-models, D1): the checks from caniemail's
 * tables and from captures of real clients come from @hyper-elements/email-clients, through a plugin
 * (`validate(email, { plugins: [await emailClients()] })`).
 */
import { Diagnostics, type Diagnostic } from "../../diagnostics";
import { COMPONENTS } from "../../components";
import { videoParts } from "../../kinds";
import type { ResolvedNode } from "../../resolve";
import { support } from "../shared/support";
import { wrapsWithGap } from "../shared/estimate";
import { isNode, shown } from "./context";
import { layerShape } from "./layout";

export function emailSupport(root: ResolvedNode): Diagnostic[] {
  const d = new Diagnostics();
  d.list.push(...support(root, "email"));
  const visit = (node: ResolvedNode) => {
    structure(node, d);
    for (const child of node.children) if (isNode(child) && shown(child)) visit(child);
  };
  visit(root);
  return d.list;
}

/** Whether a node was made by a built-in component's expansion: its place in the template is inside one, `…(Menu)…`. */
export function builtIn(place: string): boolean {
  const made = [...place.matchAll(/\((\w+)\)/g)].pop()?.[1];
  return !!made && Object.prototype.hasOwnProperty.call(COMPONENTS, made);
}

/** What the Email writer can't do that no single style or prop says. */
function structure(node: ResolvedNode, d: Diagnostics): void {
  const { path, id } = node;
  if (node.type === "Row") {
    // Its children wrap as inline-blocks, whose lines touch: anything between them but no space around them takes a
    // negative margin or flex-wrap, which the email Elements writes can't rely on.
    const lines = wrapsWithGap(node);
    if (lines !== null) {
      d.add(
        "email/degraded",
        "info",
        `What it holds looks too wide for one line on ${lines} (an estimate), and an email can't keep its gap between the lines it wraps onto: they touch. Give what's in it padding, or put each line in a Row of its own`,
        `${path}.style.gap`,
        id
      );
    }
  }
  if (node.type === "Layer") {
    const shape = layerShape(node);
    if ("problem" in shape) d.error("email/layer", shape.problem, shape.path, id);
    // Where its image is hidden on phones, it's as tall as what's over it there, as on a page.
    else if (node.style.height === undefined && !shape.base.hidden?.mobile) {
      d.add("email/layer-phone", "info", "On phones, the email keeps this Layer's height and cuts its image at the sides (a page scales it): give the Layer a height to draw both the same", `${path}.style.height`, id);
    }
  }
  if (node.type === "TableCell" && node.hidden) {
    d.warning("email/unsupported", "A TableCell can't be hidden in email (its row would lose a column): hide its TableRow", `${path}.hidden`, id);
  }
  if (node.type === "Video" && node.props.thumbnail === undefined && !videoParts(String(node.props.src))?.thumbnail) {
    d.warning("email/video-thumbnail", "A Vimeo video's thumbnail can't be found without the network: give this Video a thumbnail, or the email shows a link with its title", `${path}.props.thumbnail`, id);
  }
}
