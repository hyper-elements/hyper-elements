/**
 * An Email's pictures. A Canvas in an Email, and an Svg on its own there, is a PNG file the email links to: email
 * clients drop inline SVG (Gmail, Outlook, Yahoo) and `data:` images (every Gmail), and classic Outlook shows a hosted
 * SVG as a broken image (Outlook 2019 in the real client, November 2026), so every client gets the same PNG, at twice
 * its size.
 *
 * Before an Email is checked and laid out, each is cut out as a template of its own (a Canvas root, its text styles,
 * language and fonts as where it is) and put back as an Image of its file: the Email's writer, its checks and the
 * builder see an Image. `render()` draws the files after writing (finishRender), with `assets.draw`
 * (`emailImages()` from `@hyper-elements/react/image`: passed in, so nothing core imports draws).
 *
 * A file is named by the SHA-256 of the Canvas as drawn (custom components expanded, styles applied) and of what draws
 * it (`assets.draw.key`: its scale, fonts and images, and the engines' versions), never by the file's bytes: the name
 * is known before anything is drawn, so the HTML is the same everywhere, and a name always means one picture.
 */
import { reportDeclared } from "../../declared";
import { Diagnostics, type Diagnostic } from "../../diagnostics";
import { templatePathsOf, type TemplatePaths } from "../../expand";
import { isNode, type ElementsDocument, type Json, type Node } from "../../model";
import type { Registry } from "../../registry";
import { directed, passedText, stylesOfText, toPx, type ResolvedNode, type ResolvedText } from "../../resolve";
import { utf8Encode } from "../shared/bytes";
import { sha256Hex } from "../shared/sha256";

/** A picture to draw: a Canvas as its own template, and the size it's shown at in px. */
export interface PictureSource {
  document: ElementsDocument;
  width: number;
  height: number;
}

/** A picture as a drawer gets it: its template laid out, in the layout version (LAYOUT_VERSION) the core writes. */
export interface PictureToDraw extends PictureSource {
  root: ResolvedNode;
  layout: number;
}

/**
 * Draws an Email's pictures: `emailImages()` from `@hyper-elements/react/image`. `key` is what it draws with (its scale,
 * fonts and images, the engines' versions) and goes into each file's name, so drawing with another is another file;
 * `suffix` and `extension` end the name (`<hash>-2x.png`).
 */
export interface PictureDrawer {
  readonly key: string;
  readonly suffix: string;
  readonly extension: "png";
  readonly contentType: "image/png";
  /** What it says of itself, once in each render that draws a picture (an engine whose version it can't read). */
  readonly notes?: readonly Diagnostic[];
  draw(picture: PictureToDraw): Promise<{ bytes: Uint8Array; diagnostics: Diagnostic[] }>;
}

/** `render()`'s `assets`: where the files an Email links to are hosted, and what draws them. */
export interface EmailAssetsOption {
  /** The URL the files go under (`https://cdn.example.com/email/`): each picture links to it and its file's name. */
  baseUrl: string;
  /** Draws each Canvas (and Svg) as a PNG: `emailImages({ fonts })` from `@hyper-elements/react/image`. */
  draw: PictureDrawer;
}

/** A file `render()` wrote for the email to link to: upload it to `assets.baseUrl` before sending. */
export interface RenderedFile {
  /** Its name under `assets.baseUrl`. */
  name: string;
  contentType: string;
  bytes: Uint8Array;
  /** The size it's shown at, in px (its pixels are twice that, at the default scale). */
  width: number;
  height: number;
}

/** A picture cut out of an Email: its file's name, what's drawn, and where it is in the template. */
export interface Picture extends PictureSource {
  name: string;
  /** The Canvas's (or Svg's) place in the template, and its place as laid out (as an Image now). */
  path: string;
  laidOut: string;
  nodeId?: string;
  /** A path in the cut-out template (a diagnostic's) as the Email template's. */
  at(path: string): string;
}

const EXAMPLE = 'render(email, { assets: { baseUrl: "https://cdn.example.com/email/", draw: emailImages({ fonts }) } }), with emailImages from @hyper-elements/react/image';

const optionError = (message: string): Diagnostic => ({ code: "render/assets", severity: "error", message, path: "root", fix: EXAMPLE });

/**
 * A URL the files can go under: http or https, a host (names or an IPv4 address) and a port that is one, then a path
 * with no query or fragment, which the files' names follow (`?v=2` would put the name in the query, and every image
 * would ask for the same file).
 */
const BASE_URL = /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::(\d{1,5}))?(?:\/[^\s"'<>?#\\]*)?$/i;
const goodBase = (url: string) => {
  const found = BASE_URL.exec(url);
  return !!found && (found[1] === undefined || Number(found[1]) <= 65535);
};

/** What's wrong with `assets` as given: nothing for a well-formed option. */
export function checkAssetsOption(assets: unknown): Diagnostic[] {
  if (assets === undefined) return [];
  if (!assets || typeof assets !== "object" || Array.isArray(assets)) return [optionError(`assets takes { baseUrl, draw }, not ${JSON.stringify(assets) ?? typeof assets}`)];
  const { baseUrl, draw } = assets as Record<string, unknown>;
  const out: Diagnostic[] = [];
  if (typeof baseUrl !== "string" || !goodBase(baseUrl)) {
    out.push(optionError(`assets.baseUrl is the folder the files are hosted in, an http or https URL with no query or fragment, which each file's name follows: not ${JSON.stringify(baseUrl) ?? typeof baseUrl}`));
  }
  const d = draw as Partial<PictureDrawer> | undefined;
  if (!d || typeof d !== "object" || typeof d.draw !== "function" || typeof d.key !== "string" || typeof d.suffix !== "string" || !/^[a-z0-9]+$/i.test(d.suffix) || d.extension !== "png" || d.contentType !== "image/png") {
    out.push(optionError("assets.draw draws each Canvas of the Email as a PNG: emailImages({ fonts }) from @hyper-elements/react/image"));
  }
  return out;
}

/** A picture's URL: its name in the folder `baseUrl` is, written with or without its last "/". */
export function pictureUrl(baseUrl: string, name: string): string {
  return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${name}`;
}

/** JSON with its keys in order: the same Canvas is the same text, however its props were written. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    return `{${entries
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** A picture's file's name: the SHA-256 of what draws it and what's drawn. */
export function pictureName(document: ElementsDocument, draw: Pick<PictureDrawer, "key" | "suffix" | "extension"> | undefined): string {
  const hash = sha256Hex(utf8Encode(`${draw?.key ?? ""}\n${canonical(document)}`)).slice(0, 32);
  return `${hash}-${draw?.suffix ?? "2x"}.${draw?.extension ?? "png"}`;
}

type Sides = { top: number; right: number; bottom: number; left: number };
const sides = (value: Json | undefined): Sides => (value && typeof value === "object" && !Array.isArray(value) ? (value as unknown as Sides) : { top: 0, right: 0, bottom: 0, left: 0 });
const borderWidth = (border: Json | undefined, side: keyof Sides): number => {
  const line = border && typeof border === "object" && !Array.isArray(border) ? (border as Record<string, { width?: number } | undefined>)[side] : undefined;
  return line?.width ?? 0;
};

/** An Svg's box in px: its drawing, its padding and its border. */
function svgBox(node: Node): { width: number; height: number } {
  const style = (node.style ?? {}) as Record<string, Json>;
  const padding = sides(style.padding);
  const width = Number(node.props?.width ?? 0) + padding.left + padding.right + borderWidth(style.border, "left") + borderWidth(style.border, "right");
  const height = Number(node.props?.height ?? 0) + padding.top + padding.bottom + borderWidth(style.border, "top") + borderWidth(style.border, "bottom");
  return { width, height };
}

/** The props a root gives what's in it, which a Canvas cut out of it takes where it has none of its own. */
const FROM_ROOT = ["lang", "dir"] as const;

/** What a Canvas holds that the checks read: its text, its links, its merge tags. */
interface Contents {
  words: number;
  links: string[];
  mergeTags: string[];
  /** Text that reads as a sending service's merge tag (`{{name}}`, `*|FNAME|*`). */
  tagLike: string[];
}

const TAG_LIKE = /\{\{[^}]*\}\}|\{%[^%]*%\}|\*\|[A-Za-z0-9_:]+\|\*|%%[^%\s]+%%/;

function contents(node: Node, path: string, out: Contents = { words: 0, links: [], mergeTags: [], tagLike: [] }): Contents {
  if (node.type === "Link" || node.type === "Button") out.links.push(path);
  if (node.type === "MergeTag") out.mergeTags.push(path);
  node.children?.forEach((child, index) => {
    const at = `${path}.children[${index}]`;
    if (isNode(child)) contents(child, at, out);
    else if (typeof child === "string") {
      out.words += child.split(/\s+/).filter(Boolean).length;
      if (TAG_LIKE.test(child)) out.tagLike.push(at);
    }
  });
  return out;
}

/** More words than this in a Canvas in an Email is body copy, which is best as Text (it shows with images off). */
const BODY_COPY_WORDS = 30;

/**
 * Each Canvas in an Email, and each Svg there not in a Canvas, cut out as a picture and put back as an Image of its file
 * (under `assets.baseUrl`; a name alone where there's no `assets`, as for validate()). The document's nodes are replaced
 * where they are; `paths` gives each Image its Canvas's place in the template. What the checks say of each is in
 * `diagnostics`, at its places in the template.
 */
export function cutOutPictures(document: ElementsDocument, registry: Registry, paths: TemplatePaths, assets?: EmailAssetsOption, theme?: ElementsDocument["theme"]): { pictures: Picture[]; diagnostics: Diagnostic[] } {
  const pictures: Picture[] = [];
  const diagnostics: Diagnostic[] = [];
  const root = document.root;
  if (root.type !== "Email") return { pictures, diagnostics };
  // Places as the document is now: a Canvas's inside is reported where it is in the template.
  const templatePath = templatePathsOf(document, paths);
  const rootFonts = Array.isArray(root.props?.fonts) ? (root.props!.fonts as Json[]) : [];

  const report = (diagnostic: Omit<Diagnostic, "path"> & { at: string }, nodeId?: string) => {
    const { at, ...rest } = diagnostic;
    diagnostics.push({ ...rest, path: templatePath(at), ...(nodeId ? { nodeId } : {}) });
  };

  /**
   * The text a node gives what's in it, as the resolver works it out (passedText): a picture's text starts from its
   * place's. A Link's is its words', not a picture's: it gives what it's given.
   */
  const passed = (node: Node, given: ResolvedText | undefined): ResolvedText => (node.type === "Link" && given ? given : passedText(node, registry, given));

  const cut = (node: Node, at: string, inherited: ResolvedText, dir: Json | undefined): Node => {
    const svg = node.type === "Svg";
    let width: number;
    let height: number;
    let canvas: Node;
    if (svg) {
      const box = svgBox(node);
      // Drawn on whole pixels: a fraction of one rounds up. One of no size draws nothing: an Image hidden everywhere
      // keeps its place, so what's after it is where it was (the builder finds each block by its place).
      if (!(box.width > 0) || !(box.height > 0)) {
        const none: Node = { type: "Image", props: { src: "", alt: "" }, hidden: { mobile: true, desktop: true } };
        paths.set(none, paths.get(node) ?? at);
        return none;
      }
      width = Math.ceil(box.width);
      height = Math.ceil(box.height);
      const { id: _, hidden: __, field: ___, mobile: ____, style, ...rest } = node;
      const { flex: _f, ...own } = (style ?? {}) as Record<string, Json>;
      canvas = { type: "Canvas", props: { width, height }, style: stylesOfText(inherited), children: [{ ...rest, ...(Object.keys(own).length ? { style: own } : {}) }] };
    } else {
      width = toPx(node.props?.width ?? 1200, null) ?? 1200;
      height = toPx(node.props?.height ?? 630, null) ?? 630;
      const { id: _, hidden: __, field: ___, mobile: ____, ...rest } = node;
      const { alt: _alt, ...props } = (node.props ?? {}) as Record<string, Json>;
      // Its own direction sets where its text starts, unless it's aligned (as the resolver does, in place).
      const text = directed(inherited, node.props?.dir, (node.style as Record<string, Json> | undefined)?.textAlign);
      canvas = { ...rest, props: { ...props, width, height }, style: { ...stylesOfText(text), ...((node.style ?? {}) as Record<string, Json>) } };
    }
    // Its direction, language and fonts as where it is (a Row's direction, the Email's), under its own.
    const props = canvas.props as Record<string, Json>;
    if (props.dir === undefined && dir !== undefined) props.dir = dir;
    for (const key of FROM_ROOT) if (props[key] === undefined && root.props?.[key] !== undefined) props[key] = root.props[key]!;
    const fonts = [...(Array.isArray(props.fonts) ? (props.fonts as Json[]) : []), ...rootFonts];
    if (fonts.length) props.fonts = fonts;
    else delete props.fonts;

    // Read as the template was: with its theme (what's left of it in the nodes is read against it), merged already.
    const cutOut: ElementsDocument = { root: canvas, ...(theme !== undefined ? { theme } : {}), merged: true };
    const name = pictureName(cutOut, assets?.draw);
    // The cut-out's paths: its root is the Canvas (an Svg's is the Svg, its only child).
    const ownFonts = !svg && Array.isArray(node.props?.fonts) ? (node.props!.fonts as Json[]).length : 0;
    const inside = (path: string) => {
      // Its fonts are its own, then the Email's: one of the Email's is said where the Email gives it.
      const font = /^root\.props\.fonts(?:\[(\d+)\](.*))?$/.exec(path);
      if (font && (font[1] === undefined ? !ownFonts : Number(font[1]) >= ownFonts)) return font[1] === undefined ? path : `root.props.fonts[${Number(font[1]) - ownFonts}]${font[2]}`;
      if (!svg) return path === "root" || path.startsWith("root.") || path.startsWith("root[") ? `${at}${path.slice(4)}` : at;
      return path.startsWith("root.children[0]") ? `${at}${path.slice("root.children[0]".length)}` : at;
    };
    pictures.push({ name, document: cutOut, width, height, path: templatePath(at), laidOut: at, ...(node.id ? { nodeId: node.id } : {}), at: (path) => templatePath(inside(path)) });

    // What a picture can't do, said where it is: its own styles' declared limits in an email (an Svg's share of a Row),
    // as the support pass says them of what's laid out (what's in it is checked as the Canvas it is).
    const declared = new Diagnostics();
    const definition = registry.get(node.type);
    for (const [key, value] of Object.entries(node.style ?? {})) {
      const spec = (definition?.style as Record<string, { support?: { email?: Parameters<typeof reportDeclared>[5] } }> | undefined)?.[key];
      reportDeclared(declared, { type: node.type, ...(node.id ? { id: node.id } : {}), props: (node.props ?? {}) as Record<string, Json>, style: (node.style ?? {}) as Record<string, Json> }, `${at}.style.${key}`, key, value as Json, spec?.support?.email, "email");
    }
    for (const diagnostic of declared.list) diagnostics.push({ ...diagnostic, path: templatePath(diagnostic.path) });
    for (const key of Object.keys(node.mobile ?? {})) {
      report({ code: "email/canvas-mobile", severity: "warning", message: `A ${node.type}'s phone styles aren't drawn: its picture is the same on phones (shrunk to fit)`, fix: "leave its mobile styles out", at: `${at}.mobile.${key}` }, node.id);
    }
    const found = contents(node, at);
    const kind = node.type;
    const alt = svg ? (node.props?.title as string | undefined) : (node.props?.alt as string | undefined);
    const background = svg ? (node.style as Record<string, Json> | undefined)?.backgroundColor : (canvas.style as Record<string, Json>).backgroundColor;
    for (const path of found.mergeTags) {
      report({ code: "email/canvas-merge-tag", severity: "error", message: `A MergeTag in a ${kind} is drawn into its picture as written: the sending service can't fill it in`, fix: "put the MergeTag in a Text beside or over the picture", at: path }, node.id);
    }
    for (const path of found.tagLike) {
      report({ code: "email/canvas-merge-tag", severity: "warning", message: `This text in a ${kind} reads as a merge tag: it's drawn into the picture as written, and the sending service can't fill it in`, fix: "put it in a Text beside or over the picture", at: path }, node.id);
    }
    for (const path of found.links) {
      report({ code: "email/canvas-link", severity: "warning", message: `A link in a ${kind} is drawn into its picture: it can't be clicked`, fix: `put the ${kind} in a Link, so the picture links there`, at: path }, node.id);
    }
    if (found.words > 0 && !alt) {
      report({ code: "email/canvas-alt", severity: "warning", message: `This ${kind} has text, and no ${svg ? "title" : "alt"}: where images don't load (classic Outlook doesn't, by default) and for screen readers, its text is lost`, fix: `give it ${svg ? "a title" : "alt"} that says what it says`, at }, node.id);
    }
    if (found.words > 0 && background === undefined) {
      report({ code: "email/canvas-background", severity: "warning", message: `This ${kind} has text and no background: its picture is transparent, and in a dark mode its text can be dark on dark`, fix: "give it a backgroundColor", at }, node.id);
    }
    if (found.words > BODY_COPY_WORDS) {
      report({ code: "email/canvas-text", severity: "info", message: `This ${kind} holds ${found.words} words: in a picture, text doesn't show where images don't load, can't be selected or found, and scores worse with spam filters`, fix: "keep body copy in Text, and the picture for what it draws", at }, node.id);
    }

    const image: Node = {
      ...(node.id ? { id: node.id } : {}),
      type: "Image",
      props: { src: { src: assets ? pictureUrl(assets.baseUrl, name) : name, width, height }, alt: alt ?? "" },
      style: {
        width,
        ...(background !== undefined ? { backgroundColor: background } : {}),
      },
      ...(node.hidden ? { hidden: node.hidden } : {}),
    };
    paths.set(image, paths.get(node) ?? at);
    return image;
  };

  const visit = (node: Node, at: string, inherited: ResolvedText | undefined, around: Json | undefined) => {
    const passes = passed(node, inherited);
    // A Row's direction is what's in it's (as the root's is), unless that sets its own.
    const dir = node !== root && node.props?.dir !== undefined ? node.props.dir : around;
    if (!node.children) return;
    for (let index = node.children.length - 1; index >= 0; index--) {
      const child = node.children[index];
      if (!isNode(child)) continue;
      const path = `${at}.children[${index}]`;
      if (child.type === "Canvas" || child.type === "Svg") node.children[index] = cut(child, path, passes, dir);
      else visit(child, path, passes, dir);
    }
  };

  visit(root, "root", undefined, undefined);
  // In the template's order.
  pictures.reverse();
  return { pictures, diagnostics };
}
