// What the page and its sandbox say to each other. The page sends a Request; the sandbox answers with one Result.
// Everything in a Result is data the visitor's code could have written: the page checks its shape (see
// src/playground/sandbox.ts) and never runs or trusts it.

export type RootName = "Email" | "Page" | "Document" | "Canvas";

export interface FontNeed {
  family: string;
  weight: number;
  style: "normal" | "italic";
}

/** A font file the page fetched for a PDF or an image (TTF, OTF or WOFF). */
export interface FontFile extends FontNeed {
  src: Uint8Array;
}

interface Common {
  /** The template's code: a module, or JSX alone. */
  code: string;
  /** An Email's client checks (on unless false). Lint's checks run either way. */
  checks?: boolean;
}

export type Request =
  /** Existing HTML is data, never compiled or evaluated as template code. */
  | { kind: "html-previews"; html: string; clients?: string[]; dark?: boolean }
  | (Common & { kind: "render" })
  | (Common & { kind: "pdf"; fonts: FontFile[]; images: Record<string, Uint8Array> })
  | (Common & { kind: "image"; format: "png" | "svg"; scale: number; fonts: FontFile[]; images: Record<string, Uint8Array> })
  | (Common & { kind: "previews"; clients?: string[]; dark?: boolean })
  /** What the components are, for the editor's completions (`code` is unused). */
  | (Common & { kind: "describe" });

/** A component as the editor completes it: its name, and the props and styles it takes. */
export interface Described {
  name: string;
  summary: string;
  props: Array<{ name: string; detail: string }>;
  styles: Array<{ name: string; detail: string }>;
}

export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path: string;
  nodeId?: string;
  clients?: string[];
  fix?: string;
  see?: string;
  /** The path of the component it's about, and the line of the code that component is on. */
  node?: string;
  line?: number;
}

export interface SourceNode {
  path: string;
  type: string;
  line?: number;
}

export interface PlaygroundError {
  /** syntax: the code doesn't compile. import, export: what it imports or exports. runtime: it threw. template: Elements' own diagnostics say why. internal, timeout: the sandbox's. */
  kind: "syntax" | "import" | "export" | "runtime" | "template" | "internal" | "timeout";
  message: string;
  line?: number;
  column?: number;
}

export interface Preview {
  id: string;
  client: string;
  /** For webmail (Outlook.com, Gmail on the web), the computer it's read on: each is previewed on both. */
  computer?: "windows" | "mac";
  dark: boolean;
  width: number;
  approximate: boolean;
  html: string;
}

export interface Result {
  ok: boolean;
  kind: Request["kind"];
  root: RootName | null;
  error?: PlaygroundError;
  diagnostics: Diagnostic[];
  /** Each component in the template, in document order. */
  nodes: SourceNode[];
  logs: Array<{ level: "log" | "info" | "warn" | "error"; message: string }>;
  ms: number;
  html?: string;
  text?: string;
  outline?: string;
  /** The path of the block each line of `outline` is about. */
  outlinePaths?: string[];
  /** An Email's block map: each block's path, and its UTF-8 byte offset in `html`. */
  blocks?: Array<{ path: string; type: string; offset: number }>;
  theme?: { tokens: number; styles: string[]; variants: string[] };
  /** A Canvas's size in px; an image's as drawn. */
  size?: { width: number; height: number };
  /** What a PDF or an image of it needs fetched. */
  assets?: { fonts: FontNeed[]; images: string[] };
  /** The PDF, PNG or SVG. */
  bytes?: Uint8Array;
  previews?: Preview[];
  skipped?: Array<{ client: string; reason: string }>;
  components?: Described[];
  /** An Email's clients by id, each as @hyper-elements/email-clients names it ("outlook": "Classic Outlook"). */
  clientNames?: Record<string, string>;
}
