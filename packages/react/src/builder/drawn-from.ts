/**
 * A Document's Menu or Video in the builder: an HTML block of its markup (the builder's document mode has no menu or
 * video tool), which carries the values the builder's tool for it would hold, under `_drawnFrom`, with a hash of the
 * markup. The builder keeps values its tools don't show, as it keeps hidden properties. fromDesign() reads the block
 * back as the Menu or Video while its markup is the one toDesign() drew, and as an Html block once it's edited.
 */
import { merge } from "./hide";
import { problemsOf } from "./check";
import { CONTENT } from "./manifest";
import { videoParts, type Node } from "@hyper-elements/core";
import { obj, videoUrl, type Context } from "./reading";
import type { Values } from "./values";

/** The value an HTML block carries its tool's values in. */
export const DRAWN_FROM = "_drawnFrom";

/** What an HTML block can be drawn from: a Document's Menu or Video, by its tool. */
const DRAWN: Record<string, string> = { menu: "Menu", video: "Video" };

/**
 * Whether carried values hold what the tool's reader reads a block by, as toDesign() writes it: a menu's items, each
 * with its words; a video's YouTube or Vimeo URL, as the video reader finds it.
 */
const READABLE: Record<string, (values: Values) => boolean> = {
  menu: (values) => Array.isArray(obj(values.menu).items) && (obj(values.menu).items as unknown[]).every((item) => typeof obj(item).text === "string"),
  video: (values) => videoParts(videoUrl(values.video) ?? "") !== undefined,
};

/** A short hash of markup (FNV-1a, 32 bits): what tells markup edited in the builder from the markup toDesign() drew. */
export function markupHash(html: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < html.length; i++) hash = Math.imul(hash ^ html.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** A block's values but those every block has (its place's spacing, its id, its hiding): its tool's own, phone ones too. */
const toolsOwn = (values: Values): Values => Object.fromEntries(Object.entries(values).filter(([key]) => key === "_override" || !CONTENT.includes(key)));

/** What an HTML block of `html` carries for the tool it's drawn from: the tool's own values, the rest being the block's. */
export function drawnFrom(tool: "menu" | "video", values: Values, html: string): Values {
  return { [DRAWN_FROM]: { tool, values: toolsOwn(values), htmlHash: markupHash(html) } };
}

/** A block's tool read from its values, in a context: a tool's reader (blocks.ts). */
export type ReadTool = (tool: string, values: Values, context: Context) => Node[];

/**
 * An HTML block read back as the Menu or Video it's drawn from, by its tool's reader: from the values it carries and
 * its own (its spacing, id and hiding as the builder holds them now), while its markup is the one toDesign() drew. As
 * it went or not at all: none, and said, where the markup was edited, or what it carries isn't what toDesign() writes
 * (a value the reader can't read, or one the template's check would leave out); the block is read as an Html block then.
 */
export function readDrawnFrom(values: Values, context: Context, read: ReadTool): Node[] | undefined {
  const given = values[DRAWN_FROM];
  if (given === undefined) return undefined;
  const notWritten = () => context.say(`its ${DRAWN_FROM} isn't one toDesign() writes: read as an Html block`);
  const { tool, values: own, htmlHash } = (given && typeof given === "object" && !Array.isArray(given) ? given : {}) as Values;
  if (typeof tool !== "string" || !Object.hasOwn(DRAWN, tool) || !own || typeof own !== "object" || Array.isArray(own) || !READABLE[tool](own as Values) || typeof htmlHash !== "string") {
    notWritten();
    return undefined;
  }
  if (typeof values.html !== "string" || markupHash(values.html) !== htmlHash) {
    context.say(`its markup, drawn for a ${DRAWN[tool]}, was edited: read as an Html block`);
    return undefined;
  }
  const block = Object.fromEntries(Object.entries(values).filter(([key]) => CONTENT.includes(key)));
  // What the reader says is said only where the block is read by it.
  const said: string[] = [];
  const nodes = read(tool, merge(toolsOwn(own as Values), block), { ...context, say: (message) => said.push(message) });
  if (!nodes.length || nodes.some((node) => problemsOf(node).length)) {
    notWritten();
    return undefined;
  }
  for (const message of said) context.say(message);
  return nodes;
}
