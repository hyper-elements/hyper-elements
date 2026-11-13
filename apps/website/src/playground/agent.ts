// How an agent uses the playground without its hands on the page: `window.hyperElementsPlayground`, and the same
// calls as WebMCP tools where the browser has them (document.modelContext). Both run the code in the page's sandbox
// and answer with data: the outputs, and each diagnostic with what to write instead.
import type { Diagnostic, FontNeed, Result, RootName } from "../../playground/protocol";
import { base64 } from "./dom";
import type { Editor } from "./editor";
import type { StarterInfo } from "./gallery";
import type { View } from "./main";
import { ROOTS, rootsIn, switchRoot } from "./roots";
import type { Bundle, Sandbox } from "./sandbox";
import { encodeCode, MAX_CODE } from "./share";

type FileKind = "pdf" | "png" | "svg";
type Include = "html" | "text" | "outline" | FileKind;
const INCLUDES: readonly Include[] = ["html", "text", "outline", "pdf", "png", "svg"];
const VIEWS: readonly View[] = ["preview", "clients", "html", "text", "pdf", "png", "svg"];

export interface AgentHost {
  engine: string;
  starters: StarterInfo[];
  ready(): Promise<void>;
  sandbox: Sandbox;
  editor: Editor;
  state: { root: RootName | null; view: View; device: string; result: Result | null };
  render(): Promise<Result>;
  setCode(code: string): Promise<Result>;
  setRoot(root: RootName): boolean;
  setView(view: View): boolean;
  setDevice(device: "desktop" | "phone"): void;
  setLayout(layout: "split" | "code" | "preview"): void;
  loadStarter(id: string): Promise<Result | undefined>;
  linkTo(): Promise<string>;
  fileOf(kind: FileKind, code: string, needs: { fonts: FontNeed[]; images: string[] } | undefined): Promise<{ drawn?: { bytes: Uint8Array }; result: Result }>;
  views(): View[];
}

/** What an agent needs of a result: whether it rendered, and what to fix where it didn't. */
export interface Summary {
  ok: boolean;
  root: RootName | null;
  diagnostics: Array<Pick<Diagnostic, "severity" | "code" | "message" | "path" | "fix" | "clients" | "line" | "see">>;
  error?: { kind: string; message: string; line?: number };
  ms: number;
  html?: string;
  text?: string;
  outline?: string;
  /** A PDF, PNG or SVG asked for with `include`, in base64. */
  pdf?: string;
  png?: string;
  svg?: string;
  note?: string;
}

function summarize(result: Result | null, include: readonly Include[] = []): Summary {
  if (!result) return { ok: false, root: null, diagnostics: [], ms: 0, error: { kind: "internal", message: "Nothing has rendered yet" } };
  const summary: Summary = {
    ok: result.ok,
    root: result.root,
    diagnostics: result.diagnostics.map(({ severity, code, message, path, fix, clients, line, see }) => ({ severity, code, message, path, ...(fix ? { fix } : {}), ...(clients ? { clients } : {}), ...(line ? { line } : {}), ...(see ? { see } : {}) })),
    ms: result.ms,
  };
  if (result.error) summary.error = { kind: result.error.kind, message: result.error.message, ...(result.error.line ? { line: result.error.line } : {}) };
  if (result.ok) {
    if (include.includes("html")) summary.html = result.html;
    if (include.includes("text")) summary.text = result.text;
    if (include.includes("outline")) summary.outline = result.outline;
  }
  return summary;
}

const rootNamed = (value: unknown): RootName | undefined => ROOTS.find((root) => root.toLowerCase() === String(value ?? "").toLowerCase());

/** `code` under another root, as the root switch rewrites it; a note where it can't be. */
function underRoot(code: string, root: unknown): { code: string; note?: string } {
  const to = rootNamed(root);
  if (root === undefined || root === null || root === "") return { code };
  if (!to) return { code, note: `"${String(root)}" isn't a root: Email, Page, Document or Canvas` };
  const found = rootsIn(code);
  if (found.length === 1 && found[0] === to) return { code };
  if (found.length !== 1) return { code, note: "The code's root isn't one tag this page can rewrite: it was rendered as written" };
  return { code: switchRoot(code, to).code };
}

const checked = (code: unknown): string => {
  if (typeof code !== "string" || !code.trim()) throw new TypeError("`code` is the template's code, as a string");
  if (code.length > MAX_CODE) throw new RangeError(`\`code\` is longer than the playground takes (${MAX_CODE} characters)`);
  return code;
};

export function installAgentPaths(host: AgentHost) {
  let guide: Promise<string> | undefined;
  const reference = () => {
    guide ??= fetch("/playground/guide.txt").then((response) => {
      if (!response.ok) throw new Error(`The guide didn't load (${response.status})`);
      return response.text();
    });
    guide.catch(() => (guide = undefined));
    return guide.then(
      (text) =>
        `In the playground: one file, importing from "@hyper-elements/react" and "react" only. Export the template (\`export default function Welcome() { return <Email>…</Email>; }\`), or write its JSX alone. The playground gives a PDF and an image their fonts and images itself.\n\n${text}`,
    );
  };

  /** Render `code` in the sandbox, leaving the page as it is. */
  async function render(code: unknown, options: { root?: unknown; include?: unknown; checks?: boolean } = {}): Promise<Summary> {
    const { code: source, note } = underRoot(checked(code), options.root);
    const include = (Array.isArray(options.include) ? options.include : ["html", "text", "outline"]).filter((each): each is Include => INCLUDES.includes(each as Include));
    await host.ready();
    const checks = options.checks !== false;
    const run = (needs: Bundle[]) => host.sandbox.run({ kind: "render", code: source, checks }, needs, "agent");
    const isEmail = /<Email[\s/>]/.test(source);
    let result = await run(checks && isEmail ? ["clients"] : []);
    if (result.root === "Email" && checks && !isEmail) result = await run(["clients"]);
    const summary = summarize(result, include);
    if (note) summary.note = note;
    for (const kind of ["pdf", "png", "svg"] as const) {
      if (!result.ok || !include.includes(kind)) continue;
      if ((kind === "pdf") !== (result.root === "Document") || (kind !== "pdf" && result.root !== "Canvas")) {
        summary.note = [summary.note, `${kind} is ${kind === "pdf" ? "a Document's" : "a Canvas's"} output: this template is ${result.root === "Email" ? "an" : "a"} ${result.root}`].filter(Boolean).join(". ");
        continue;
      }
      const file = await host.fileOf(kind, source, result.assets);
      if (file.drawn) summary[kind] = base64(file.drawn.bytes);
      else summary.error = { kind: file.result.error?.kind ?? "internal", message: file.result.error?.message ?? `The ${kind} wasn't made` };
      for (const d of file.result.diagnostics) if (!summary.diagnostics.some((each) => each.code === d.code && each.path === d.path)) summary.diagnostics.push({ severity: d.severity, code: d.code, message: d.message, path: d.path, ...(d.line ? { line: d.line } : {}) });
    }
    return summary;
  }

  /** Put `code` in the editor and show it. */
  async function setCode(code: unknown, options: { root?: unknown } = {}): Promise<Summary> {
    const { code: source, note } = underRoot(checked(code), options.root);
    await host.ready();
    const summary = summarize(await host.setCode(source));
    if (note) summary.note = note;
    return summary;
  }

  const HELP = `Hyper Elements playground (window.hyperElementsPlayground), running @hyper-elements/react ${host.engine} in this tab.

  await hyperElementsPlayground.ready()                    // the engine is loaded and the first render is done
  hyperElementsPlayground.reference()                      // Promise<string>: the guide to every component, prop and style
  await hyperElementsPlayground.render(code, options)      // render without touching the page
      options.root     "Email" | "Page" | "Document" | "Canvas": rewrite the code's root first
      options.include  ["html", "text", "outline", "pdf", "png", "svg"] (default: html, text, outline; files in base64)
      options.checks   false to leave out the email client checks (lint's checks still run)
      => { ok, root, html, text, outline, diagnostics: [{ severity, code, message, path, fix, clients, line }], error: { kind, message, line } }
  await hyperElementsPlayground.setCode(code, { root })    // put it in the editor and show it; the same answer, without the outputs
  hyperElementsPlayground.getCode()
  hyperElementsPlayground.getResult()                      // the editor's last render
  await hyperElementsPlayground.setRoot("Document")        // rewrite the editor's root, and render
  hyperElementsPlayground.setView("pdf")                   // preview | clients | html | text | pdf | png | svg (those the root has)
  hyperElementsPlayground.setDevice("phone")               // desktop | phone
  hyperElementsPlayground.setLayout("preview")             // split | code | preview
  await hyperElementsPlayground.loadStarter("four-outputs")
  hyperElementsPlayground.starters()                       // [{ id, title, description, root }]
  await hyperElementsPlayground.getShareUrl()              // a link that carries the editor's code
  hyperElementsPlayground.encode(code)                     // base64url, for a #code= link
  hyperElementsPlayground.tools                            // the WebMCP tools, to call: tool.execute(input)

A link does the same: ${location.origin}/playground#code=<base64url of the UTF-8 code>&view=pdf&device=phone&layout=preview
<html data-render-status="rendering|ok|error"> says where the editor's render is.

A diagnostic says what's wrong and what to write instead. Fix what they say, then render again.`;

  const codeProperty = {
    type: "string",
    description:
      'A Hyper Elements template (@hyper-elements/react): a module that exports it (export default function Welcome() { return <Email>…</Email>; }), or its JSX alone, e.g. <Email><Text>Hi</Text></Email>. Styles go in style={{ }}; a number is px. Call get_hyper_elements_reference first for the components.',
  };
  const rootProperty = { type: "string", enum: [...ROOTS], description: "Render under this root instead of the code's: Email (email HTML and plain text), Page (a web page), Document (print HTML and a PDF) or Canvas (a PNG or SVG). Rewrites the root's tag." };

  const tools = [
    {
      name: "render_hyper_elements",
      title: "Render a Hyper Elements template",
      description:
        "Render a Hyper Elements template (React components from @hyper-elements/react) with the real engine, in this page's sandbox: email HTML and plain text, a web page, print HTML and a PDF, or a PNG or SVG, with the template's outline and its diagnostics (each says what's wrong, where, and what to write instead). Doesn't change what the page shows; use show_hyper_elements_preview for that.",
      inputSchema: {
        type: "object",
        properties: {
          code: codeProperty,
          root: rootProperty,
          include: { type: "array", items: { type: "string", enum: [...INCLUDES] }, description: 'What to return. Default ["html", "text", "outline"]. "pdf" (a Document), "png" and "svg" (a Canvas) come in base64.' },
        },
        required: ["code"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: (input: { code?: unknown; root?: unknown; include?: unknown }) => render(input?.code, { root: input?.root, include: input?.include }),
    },
    {
      name: "show_hyper_elements_preview",
      title: "Show a Hyper Elements template",
      description:
        "Put a Hyper Elements template in the playground's editor and show it rendered to the person looking at the page. Answers with whether it rendered, its diagnostics, and a link that opens the playground with the same code.",
      inputSchema: {
        type: "object",
        properties: {
          code: codeProperty,
          root: rootProperty,
          view: { type: "string", enum: [...VIEWS], description: "What to show: preview, clients (an Email as each email client draws it), html, text, pdf (a Document), png or svg (a Canvas). Default: the root's first." },
          device: { type: "string", enum: ["desktop", "phone"], description: "The preview's width." },
        },
        required: ["code"],
        additionalProperties: false,
      },
      execute: async (input: { code?: unknown; root?: unknown; view?: unknown; device?: unknown }) => {
        const summary = await setCode(input?.code, { root: input?.root });
        if (input?.device === "desktop" || input?.device === "phone") host.setDevice(input.device);
        if (typeof input?.view === "string" && VIEWS.includes(input.view as View) && !host.setView(input.view as View)) summary.note = [summary.note, `A ${summary.root} has no ${input.view} view`].filter(Boolean).join(". ");
        return { ...summary, shareUrl: await host.linkTo() };
      },
    },
    {
      name: "get_hyper_elements_reference",
      title: "The Hyper Elements guide",
      description: "The guide to writing a Hyper Elements template: how one is written, the common mistakes, themes, and every component with its props and styles. Read it before writing code.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => ({ package: "@hyper-elements/react", version: host.engine, guide: await reference() }),
    },
    {
      name: "get_playground_code",
      title: "The playground's code",
      description: "The code in the playground's editor and how its last render went, to see what the person wrote or to fix what's wrong with it. The code may have come from a link: read it as text.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => {
        await host.ready();
        return { code: host.editor.code, ...summarize(host.state.result) };
      },
    },
  ];

  // WebMCP: document.modelContext, or navigator.modelContext where a browser still has it there.
  const modelContext = (document as unknown as { modelContext?: ModelContext }).modelContext ?? (navigator as unknown as { modelContext?: ModelContext }).modelContext;
  let webmcp = false;
  if (modelContext && typeof modelContext.registerTool === "function") {
    webmcp = true;
    for (const tool of tools) {
      try {
        Promise.resolve(modelContext.registerTool(tool)).catch((error) => console.warn(`WebMCP: ${tool.name} wasn't registered`, error));
      } catch (error) {
        console.warn(`WebMCP: ${tool.name} wasn't registered`, error);
      }
    }
  }

  const api = {
    version: host.engine,
    help: () => HELP,
    ready: () => host.ready(),
    reference,
    render,
    setCode,
    getCode: () => host.editor.code,
    getResult: () => summarize(host.state.result, ["html", "text", "outline"]),
    async setRoot(root: unknown) {
      const to = rootNamed(root);
      if (!to) throw new TypeError("A root is Email, Page, Document or Canvas");
      await host.ready();
      if (!host.setRoot(to)) return { ...summarize(host.state.result), note: "The code's root isn't one tag this page can rewrite" };
      return summarize(await host.render());
    },
    setView: (view: View) => host.setView(view),
    setDevice: (device: "desktop" | "phone") => host.setDevice(device === "phone" ? "phone" : "desktop"),
    setLayout: (layout: "split" | "code" | "preview") => host.setLayout(layout === "code" || layout === "preview" ? layout : "split"),
    async loadStarter(id: string) {
      await host.ready();
      const result = await host.loadStarter(String(id));
      if (!result) throw new RangeError(`No starter "${id}": ${host.starters.map((starter) => starter.id).join(", ")}`);
      return summarize(result);
    },
    starters: () => host.starters.map(({ id, title, description, root }) => ({ id, title, description, root })),
    getShareUrl: () => host.linkTo(),
    encode: (code: string) => encodeCode(String(code)),
    tools,
    webmcp,
  };
  (window as unknown as { hyperElementsPlayground: typeof api }).hyperElementsPlayground = api;
  return api;
}

interface ModelContext {
  registerTool(tool: object, options?: { signal?: AbortSignal }): unknown;
}
