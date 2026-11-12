/**
 * `render`: a template's output, as its root says. An Email's HTML and plain text, a Page's HTML, a Document's PDF
 * (with `--html`, its print HTML too) and a Canvas's PNG or SVG. The parent writes the files.
 *
 * A Document and a Canvas are drawn with the project's own `@hyper-elements/react/pdf` or `/image` (and so its
 * `@react-pdf/renderer`, or its `satori` and `@resvg/resvg-js`), loaded as the template resolves them, with the fonts
 * and images `templateAssets()` lists, loaded by assets.ts.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadAssets, offlineFailure, type FontFile, type TemplateAssets } from "../assets";
import { exportsOf, resolvedPath } from "../elements";
import { notFound } from "../errors";
import type { Diagnostic } from "../protocol";
import { cliDiagnostic, elementsErrorDiagnostics, hasErrors, type CommandResult, type TemplateContext } from "./shared";

/** The files `render` writes for each root, by extension: a root's first is its main output (`--stdout`'s). */
export const RENDER_OUTPUTS: Record<string, string[]> = {
  Email: ["html", "txt"],
  Page: ["html"],
  Document: ["pdf", "html"],
  Canvas: ["png", "svg", "html"],
};

/** Every extension `render` may write, reserved for each input before any template runs. */
export const ALL_RENDER_OUTPUTS = ["html", "txt", "pdf", "png", "svg"];

/** The release of @hyper-elements/react that adds templateAssets(), which the CLI needs for a PDF or an image. */
export const ASSETS_RELEASE = "0.4.3";

/** What each drawn root needs: Elements' entry, and the engines it imports. */
const DRAWN = {
  Document: { entry: "@hyper-elements/react/pdf", engines: ["@react-pdf/renderer"], file: "PDF" },
  Canvas: { entry: "@hyper-elements/react/image", engines: ["satori", "@resvg/resvg-js"], file: "image" },
} as const;

/**
 * The roots whose output isn't Node's byte for byte on Bun, which `render` refuses there (exit 2). A Document: Bun's
 * zlib compresses the PDF's streams differently (what they hold is the same). A Canvas's PNG and SVG are the same.
 */
const NOT_ON_BUN = new Set(["Document"]);
const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

interface DrawEntry {
  templateAssets(element: unknown): TemplateAssets;
  renderPdf?(element: unknown, options: { fonts: FontFile[]; images: Record<string, Uint8Array> }): Promise<{ pdf: Uint8Array; diagnostics: Diagnostic[] }>;
  renderImage?(element: unknown, options: { fonts: FontFile[]; images: Record<string, Uint8Array>; format?: "png" | "svg"; scale?: number }): Promise<{ image: Uint8Array; diagnostics: Diagnostic[] }>;
}

export async function renderTemplate(context: TemplateContext): Promise<CommandResult> {
  const { root } = context;
  try {
    if (root === "Document" || root === "Canvas") return await renderDrawn(context, root);
    return await renderHtml(context);
  } catch (error) {
    const diagnostics = elementsErrorDiagnostics(error);
    if (diagnostics) return { status: "error", diagnostics };
    throw error;
  }
}

/** An Email's or a Page's HTML (and an Email's text); a Document's or a Canvas's HTML, with `note` saying why. */
async function renderHtml(context: TemplateContext, note?: Diagnostic): Promise<CommandResult> {
  const { element, root, elements, options } = context;
  const result = await elements.render(element, options.pretty ? { pretty: true } : {});
  const diagnostics = [...result.diagnostics, ...(note ? [note] : [])];
  const outputs: Record<string, string> = { html: result.html };
  if (root === "Email") outputs.txt = result.text;
  return { status: hasErrors(diagnostics) ? "error" : "ok", diagnostics, outputs };
}

async function renderDrawn(context: TemplateContext, root: "Document" | "Canvas"): Promise<CommandResult> {
  const { element, elements, options } = context;
  const drawn = DRAWN[root];
  const entry = await loadEntry(context, root);
  if (entry === "old") {
    // As before templateAssets(): the HTML, on either runtime.
    const what = root === "Document" ? "the Document's print HTML: the CLI writes its PDF (.pdf)" : "the Canvas's HTML: the CLI writes its image (.png, .svg)";
    return renderHtml(context, cliDiagnostic("html-only", "info", `This is ${what} with @hyper-elements/react ${ASSETS_RELEASE} or later, which adds templateAssets()`, `update @hyper-elements/react to ${ASSETS_RELEASE} or later`));
  }
  // (HYPER_ELEMENTS_CLI_BUN_PDF: for the CLI's own tests, which check the file still differs on Bun.)
  if (bun && NOT_ON_BUN.has(root) && !process.env.HYPER_ELEMENTS_CLI_BUN_PDF) {
    return {
      status: "error",
      usage: true,
      diagnostics: [
        cliDiagnostic(
          "bun",
          "error",
          `A ${root}'s ${drawn.file} isn't written on Bun: Bun's zlib compresses its streams differently, so the file isn't the one Node writes`,
          "run it with Node: npx hyper-elements render …",
        ),
      ],
    };
  }
  if (Array.isArray(entry)) {
    return { status: "error", diagnostics: [], error: `A ${root}'s ${drawn.file} needs ${entry.join(" and ")}, not installed where this template is: npm i ${entry.join(" ")}` };
  }

  const loaded = await loadAssets(entry.templateAssets(element), {
    template: context.file,
    cwd: context.cwd,
    public: options.public,
    refreshSince: options.refreshSince,
    offline: options.offline,
  });
  if (offlineFailure(loaded)) return { status: "error", diagnostics: loaded.diagnostics };

  let file: Uint8Array;
  let found: Diagnostic[];
  const outputs: Record<string, string> = {};
  try {
    if (root === "Document") {
      const result = await entry.renderPdf!(element, { fonts: loaded.fonts, images: loaded.images });
      file = result.pdf;
      found = result.diagnostics;
    } else {
      const result = await entry.renderImage!(element, { fonts: loaded.fonts, images: loaded.images, format: options.format ?? "png", ...(options.scale !== undefined ? { scale: options.scale } : {}) });
      file = result.image;
      found = result.diagnostics;
    }
  } catch (error) {
    const diagnostics = elementsErrorDiagnostics(error);
    if (diagnostics) return { status: "error", diagnostics: [...loaded.diagnostics, ...diagnostics] };
    throw error;
  }
  const extension = root === "Document" ? "pdf" : (options.format ?? "png");
  outputs[extension] = Buffer.from(file).toString("base64");
  const diagnostics = [...loaded.diagnostics, ...found];
  if (root === "Document" && options.html) {
    const result = await elements.render(element, options.pretty ? { pretty: true } : {});
    outputs.html = result.html;
    // What prepare() says is in both: said once.
    const said = new Set(diagnostics.map((d) => JSON.stringify(d)));
    for (const d of result.diagnostics) if (!said.has(JSON.stringify(d))) diagnostics.push(d);
  }
  return { status: hasErrors(diagnostics) ? "error" : "ok", diagnostics, outputs, binary: [extension] };
}

/**
 * The project's `/pdf` or `/image`, as the template resolves it: the entry; "old" for an Elements without
 * templateAssets() (its HTML is written, as before); or the engines it imports that aren't installed.
 */
async function loadEntry(context: TemplateContext, root: "Document" | "Canvas"): Promise<DrawEntry | "old" | string[]> {
  const { entry: specifier, engines } = DRAWN[root];
  let mod: unknown;
  try {
    mod = await context.load(specifier);
  } catch (error) {
    if (!engines.some((name) => notFound(error, name))) throw error;
    // An Elements without templateAssets() wrote the HTML before, engines or not: it still does.
    let entryFile: string | undefined;
    try {
      entryFile = resolvedPath(context.resolve(specifier));
    } catch {
      entryFile = undefined;
    }
    if (entryFile && !readText(entryFile).includes("templateAssets")) return "old";
    const missing = engines.filter((name) => !installed(name, [dirname(context.file), ...(entryFile ? [dirname(realOr(entryFile))] : [])]));
    return missing.length ? missing : engines.filter((name) => notFound(error, name));
  }
  const entry = exportsOf<DrawEntry>(mod, "templateAssets");
  return typeof entry?.templateAssets === "function" ? entry : "old";
}

function readText(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function realOr(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** Whether a package is installed where any of `folders` looks for it (a node_modules above it holds it). */
function installed(name: string, folders: string[]): boolean {
  for (const start of folders) {
    for (let dir = start; ; dir = dirname(dir)) {
      if (existsSync(join(dir, "node_modules", name, "package.json"))) return true;
      if (dirname(dir) === dir) break;
    }
  }
  return false;
}
