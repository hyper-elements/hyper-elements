import { checkDocument } from "../normalize";
import { checkTargetExpanded, LAYOUT_VERSION, resolveExpanded, type ResolvedDocument, type ResolvedNode } from "../resolve";
import { ElementsError, type Diagnostic } from "../diagnostics";
import { acceptPlugins, pluginChecks, pluginOutputChecks, type ElementsPlugin, type PluginsOption } from "../plugins";
import { expandDocument } from "../expand";
import { registryOf, type ComponentsOption } from "../registry";
import type { Target } from "../define";
import { renderEmail, type EmailOptions } from "./email";
import { checkAssetsOption, cutOutPictures, type EmailAssetsOption, type Picture, type RenderedFile } from "./email/pictures";
import { emailSupport } from "./email/support";
import { overflow, pagedSupport } from "./shared/paged";
import { support } from "./shared/support";
import { pageBreakpoints, renderPage, type PageOptions } from "./page";
import { renderText } from "./plain-text";
import { prettyHtml } from "./shared/pretty";
import type { BlockMap } from "./shared/block-map";

export { renderEmail, EMAIL_PHONE_MARGIN, type EmailHtml, type EmailOptions } from "./email";
export { checkAssetsOption, cutOutPictures, pictureName, pictureUrl, type EmailAssetsOption, type Picture, type PictureDrawer, type PictureSource, type PictureToDraw, type RenderedFile } from "./email/pictures";
export { renderPage, PAGE_PHONE_WIDTH, pagePhoneWidth, type PageHtml, type PageOptions } from "./page";
export { renderText, type TextOptions } from "./plain-text";
export { emailSupport } from "./email/support";
export { support } from "./shared/support";
export { overflow, pagedSupport } from "./shared/paged";
export { Stylesheet, CLASS_PREFIX, type Media } from "./shared/classes";
export { BLOCK_MAP_VERSION, type BlockMap, type BlockMapEntry } from "./shared/block-map";

export interface RenderOptions extends PageOptions, EmailOptions, PluginsOption {
  /** The HTML indented, for reading it; for sending, the compact HTML (white space may change how some email clients show it). */
  pretty?: boolean;
  /**
   * For tools that preview a design: also return `blocks`, where each block is in `html` (its template path and the
   * UTF-8 byte offset just after its outermost element's tag name), for every root (a Document's print HTML, a Canvas
   * as HTML). The HTML is the same either way. Not with `pretty`.
   */
  blockMap?: boolean;
  /**
   * Where the files an Email links to are hosted, and what draws them: an Email with a Canvas (or an Svg) needs it, as
   * each is a picture, a PNG file the email links to. `render()` returns the files in `files`; upload them to `baseUrl`.
   *
   *   render(email, { assets: { baseUrl: "https://cdn.example.com/email/", draw: emailImages({ fonts }) } })
   *
   * with `emailImages` from `@hyper-elements/react/image`.
   */
  assets?: EmailAssetsOption;
}

export interface RenderResult {
  /** The whole document, from `<!DOCTYPE html>`. */
  html: string;
  /** The plain-text version. */
  text: string;
  /** What goes in `<head>` and in `<body>`, and the body's own style: to embed the output in a page of your own. */
  head: string;
  body: string;
  bodyStyle: string;
  /** Warnings and notes (errors are thrown). */
  diagnostics: Diagnostic[];
  /** With `blockMap`: where each block is in `html`. */
  blocks?: BlockMap;
  /**
   * For an Email with a Canvas (or an Svg): the PNG files it links to, one per picture, named as the HTML links to them
   * under `assets.baseUrl`. Upload them there before sending.
   */
  files?: RenderedFile[];
}

/** renderTemplate()'s result: with its pictures still to draw (finishRender() draws them). */
export type WrittenTemplate = RenderResult & { pictures?: Picture[] };

/** The output each root renders to, and whether its writer exists yet. */
const OUTPUTS: Record<string, { target: Target; ready: boolean; later?: string }> = {
  Page: { target: "web", ready: true },
  // Print HTML: a page writer's, each page a box of the paper's size.
  Document: { target: "web", ready: true },
  // A Canvas as HTML, to look at (@hyper-elements/react/image writes the image).
  Canvas: { target: "web", ready: true },
  Email: { target: "email", ready: true },
};

export interface Prepared {
  /** The template laid out, its custom components expanded; null where it has errors. */
  resolved: ResolvedDocument | null;
  /** The output its root renders to. */
  target: Target | null;
  /** Everything found: errors, warnings and notes. */
  diagnostics: Diagnostic[];
  /** The plugins passed that can run (their `checkOutput` runs on the written output). */
  plugins: ElementsPlugin[];
  /** An Email's pictures: each Canvas (and Svg) in it, cut out to draw, an Image of its file in its place. */
  pictures?: Picture[];
}

/**
 * What both validating and rendering do, once: the template checked, its
 * custom components expanded (each rendered once), checked against the output
 * its root says, laid out, and what that output can't do as asked found; then
 * what the plugins find on the laid-out tree (their `check`). What needs the
 * written output is left to rendering (their `checkOutput`).
 */
export function prepareTemplate(input: unknown, options: ComponentsOption & PluginsOption & { assets?: EmailAssetsOption } = {}): Prepared {
  const accepted = acceptPlugins(options.plugins);
  const registry = registryOf(options);
  const checked = checkDocument(input, registry);
  const diagnostics = [...checked.diagnostics];
  const failed = () => diagnostics.some((d) => d.severity === "error");
  if (!checked.document || failed()) return { resolved: null, target: null, diagnostics: [...diagnostics, ...accepted.diagnostics], plugins: accepted.plugins };
  const root = checked.document.root.type;
  /** What it found, then what core said about the plugins passed (their `check` runs only on a template laid out without errors). */
  let pictures: Picture[] = [];
  const done = (resolved: ResolvedDocument | null, target: Target | null, checks: Diagnostic[] = []): Prepared => ({
    resolved,
    target,
    diagnostics: [...diagnostics, ...accepted.diagnostics, ...checks],
    plugins: accepted.plugins,
    ...(pictures.length ? { pictures } : {}),
  });
  const output = OUTPUTS[root];
  if (!output?.ready) {
    diagnostics.push({ code: "output/unavailable", severity: "error", message: output?.later ?? `A ${root} can't be rendered yet`, path: "root" });
    return done(null, null);
  }
  const expanded = expandDocument(checked.document, registry, output.target);
  diagnostics.push(...expanded.diagnostics);
  if (failed()) return done(null, output.target);
  if (root === "Email") {
    // Each Canvas (and Svg) is a picture: cut out, checked as the Canvas it is, an Image of its file in its place.
    const cut = cutOutPictures(expanded.document, registry, expanded.paths, options.assets, checked.document.theme);
    pictures = cut.pictures;
    diagnostics.push(...cut.diagnostics);
    // (What a page says of fit is its preview's: the picture measures it.)
    const measured = (d: Diagnostic) => d.code === "web/degraded" && /\.props\.fit$/.test(d.path);
    for (const picture of pictures) diagnostics.push(...validateTemplate(picture.document).diagnostics.filter((d) => !measured(d)).map((d) => ({ ...d, path: picture.at(d.path) })));
    if (failed()) return done(null, output.target);
  }
  diagnostics.push(...checkTargetExpanded(expanded.document, output.target, registry, expanded.paths));
  if (failed()) return done(null, output.target);
  const resolved = resolveExpanded(expanded.document, registry, expanded.paths);
  // A picture wider than its column is said once, as one (widePictures), not as the Image it's written as.
  const picturePaths = new Set(pictures.map((picture) => picture.path));
  diagnostics.push(...resolved.diagnostics.filter((d) => !(d.code === "layout/overflow" && picturePaths.has(d.path))));
  const found = output.target === "email" ? emailSupport(resolved.root) : support(resolved.root, output.target);
  // A Document's page and a Canvas are a fixed size: content that can't fit is cut off.
  if (root === "Document" || root === "Canvas") found.push(...overflow(resolved.root));
  found.push(...pageBreakpoints(resolved.root));
  diagnostics.push(...inTemplate(resolved, found));
  diagnostics.push(...widePictures(resolved, pictures));
  if (failed()) return done(null, output.target);
  return done(resolved, output.target, pluginChecks(accepted.plugins, resolved));
}

/**
 * A picture wider than where it is: phones and most clients shrink it to fit, but classic Outlook shows an image at its
 * width attribute, past its column.
 */
function widePictures(resolved: ResolvedDocument, pictures: Picture[]): Diagnostic[] {
  if (!pictures.length) return [];
  const byPath = new Map(pictures.map((picture) => [picture.path, picture]));
  const out: Diagnostic[] = [];
  const at = resolved.templatePath ?? ((path: string) => path);
  const visit = (node: ResolvedNode) => {
    const picture = node.type === "Image" ? byPath.get(at(node.path)) : undefined;
    if (picture && node.available !== null && picture.width > node.available + 0.5) {
      out.push({
        code: "email/canvas-width",
        severity: "warning",
        message: `This picture is ${picture.width}px wide where ${Math.floor(node.available)}px is free: phones and most clients shrink it to fit, but classic Outlook shows it at ${picture.width}px, past its column`,
        fix: `make it at most ${Math.floor(node.available)}px wide`,
        path: picture.path,
        ...(picture.nodeId ? { nodeId: picture.nodeId } : {}),
      });
    }
    for (const child of node.children) if (typeof child !== "string") visit(child);
  };
  visit(resolved.root);
  return out;
}

/** Diagnostics found on the tree as laid out, at their places in the template (a Grid's children, a custom component's). */
export function inTemplate(resolved: ResolvedDocument, diagnostics: Diagnostic[]): Diagnostic[] {
  const { templatePath } = resolved;
  return templatePath ? diagnostics.map((diagnostic) => ({ ...diagnostic, path: templatePath(diagnostic.path) })) : diagnostics;
}

/**
 * A template's problems, without writing it: errors make it invalid, warnings and notes don't. A Document's are its
 * PDF's too, and a Canvas's its image's (what they can't show that its HTML can).
 */
export function validateTemplate(input: unknown, options: ComponentsOption & PluginsOption = {}): { valid: boolean; diagnostics: Diagnostic[] } {
  const { diagnostics, resolved } = prepareTemplate(input, options);
  const root = resolved?.root;
  const paged = root?.type === "Document" ? pagedSupport(root, "pdf") : root?.type === "Canvas" ? pagedSupport(root, "image") : [];
  const all = [...diagnostics, ...(resolved ? inTemplate(resolved, paged) : paged)];
  return { valid: !all.some((d) => d.severity === "error"), diagnostics: all };
}

/**
 * A template (Elements' internal tree, with the custom components it uses)
 * rendered to the output its root says: prepared (`prepareTemplate`), then
 * written. Throws an `ElementsError` listing the errors if there are any.
 */
export function renderTemplate(input: unknown, options: RenderOptions & ComponentsOption = {}): WrittenTemplate {
  // Indenting rewrites the HTML after it's written, which would move every offset.
  if (options.blockMap && options.pretty) throw new ElementsError([{ code: "render/block-map-pretty", severity: "error", message: "blockMap gives offsets in the compact HTML; leave pretty off", path: "root" }]);
  const badAssets = checkAssetsOption(options.assets);
  if (badAssets.length) throw new ElementsError(badAssets);
  const { resolved, target, diagnostics, plugins, pictures } = prepareTemplate(input, options);
  if (!resolved) throw new ElementsError(diagnostics);
  const first = pictures?.[0];
  if (first && !options.assets) {
    throw new ElementsError([
      ...diagnostics,
      {
        code: "email/canvas-assets",
        severity: "error",
        message: "A Canvas (or an Svg) in an Email is a picture, a PNG file the email links to: say where the files are hosted, and what draws them, with render()'s assets option",
        fix: 'render(email, { assets: { baseUrl: "https://cdn.example.com/email/", draw: emailImages({ fonts }) } }), with emailImages from @hyper-elements/react/image; then upload each of result.files to baseUrl',
        path: first.path,
        ...(first.nodeId ? { nodeId: first.nodeId } : {}),
      },
    ]);
  }
  const text = renderText(resolved, options);
  const written = target === "email" ? renderEmail(resolved, options) : { ...renderPage(resolved, options), stylesheet: "", diagnostics: [] };
  // The plugins' checks on the written output, compact (what `pretty` would change isn't what an email client receives).
  const outputChecks = pluginOutputChecks(plugins, { root: resolved.root.type, html: written.html, head: written.head, body: written.body, stylesheet: written.stylesheet }, resolved);
  const shown = (html: string) => (options.pretty ? prettyHtml(html) : html);
  const blocks = "blocks" in written ? written.blocks : undefined;
  return {
    html: shown(written.html),
    head: shown(written.head),
    body: shown(written.body),
    bodyStyle: written.bodyStyle,
    text,
    diagnostics: [...diagnostics, ...inTemplate(resolved, written.diagnostics), ...outputChecks],
    ...(blocks ? { blocks } : {}),
    ...(pictures?.length ? { pictures } : {}),
  };
}

/** Each item done by `work` (given its index), `at` most at once, the results in the items' order. The first that fails rejects. */
async function inTurns<T, R>(items: T[], at: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(at, items.length) }, worker));
  return results;
}

/** The same finding once: drawing a picture checks it again. */
function once(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((d) => {
    const key = `${d.code}\u0000${d.path}\u0000${d.message}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

/**
 * A written template's pictures drawn, by `assets.draw`, once each: what render() returns. One that can't be drawn
 * rejects it, so no HTML is returned that links to a file that isn't there.
 */
export async function finishRender(written: WrittenTemplate, options: Pick<RenderOptions, "assets"> = {}): Promise<RenderResult> {
  const { pictures, ...result } = written;
  if (!pictures?.length) return result;
  // HTML that links files nothing draws isn't returned.
  if (!options.assets) throw new ElementsError([{ code: "email/canvas-assets", severity: "error", message: "This Email's pictures are drawn by the assets it was written with: pass them to finishRender() too", path: pictures[0]!.path }]);
  const { draw } = options.assets;
  const unique = new Map<string, Picture>();
  for (const picture of pictures) if (!unique.has(picture.name)) unique.set(picture.name, picture);
  // What each picture's drawing says, in the pictures' order, whichever is drawn first.
  const found: Diagnostic[][] = [];
  // A few at a time: each holds its pixels (a 1200 by 630 Canvas at 2x is 12 MB) while it's drawn.
  const files = await inTurns(
    [...unique.values()],
    4,
    async (picture, index): Promise<RenderedFile> => {
      // Laid out here, as its checks were (prepareTemplate): the drawer draws what's laid out.
      const prepared = prepareTemplate(picture.document);
      if (!prepared.resolved) throw new ElementsError(prepared.diagnostics.map((d) => ({ ...d, path: picture.at(d.path) })));
      let drawn: Awaited<ReturnType<typeof draw.draw>>;
      try {
        drawn = await draw.draw({ document: picture.document, width: picture.width, height: picture.height, root: prepared.resolved.root, layout: LAYOUT_VERSION });
      } catch (error) {
        if (error instanceof ElementsError) throw new ElementsError(error.diagnostics.map((d) => ({ ...d, path: picture.at(d.path) })));
        const why = error instanceof Error ? error.message : String(error);
        throw new ElementsError([{ code: "email/canvas-draw", severity: "error", message: `This picture couldn't be drawn: ${why}`, path: picture.path, ...(picture.nodeId ? { nodeId: picture.nodeId } : {}) }]);
      }
      found[index] = drawn.diagnostics.map((d) => ({ ...d, path: picture.at(d.path) }));
      return { name: picture.name, contentType: draw.contentType, bytes: drawn.bytes, width: picture.width, height: picture.height };
    }
  );
  const notes = (draw.notes ?? []).map((d) => ({ ...d, path: pictures[0]!.path }));
  return { ...result, diagnostics: once([...result.diagnostics, ...found.flat(), ...notes]), files };
}
