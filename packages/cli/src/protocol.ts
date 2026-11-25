/**
 * What the parent and a child process say to each other over the IPC channel, and the shapes of what the CLI
 * reports (the `--json` lines).
 */

/** A diagnostic as Elements gives it (packages/internal/core/src/diagnostics.ts), or one of the CLI's own (`cli/…`, path ""). */
export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path: string;
  nodeId?: string;
  clients?: readonly string[];
  fix?: string;
  see?: string;
  /** The template field the node shows, where a template's render binds it. */
  field?: string;
  /** A template module's diagnostic: the format of the template it's about. */
  templateFormat?: string;
  /** An HTML email's diagnostic (email-clients' EmailHtmlDiagnostic, `path: "html"`): its line (from 1, or null). */
  line?: number | null;
  /** Up to 80 characters of that line. */
  excerpt?: string;
}

export type Command = "render" | "check" | "outline" | "preview" | "inspect" | "describe" | "migrate" | "dev" | "design" | "template";
/** A capture child's command, beside the others: it loads slot modules and template designs, and replies with captures only. */
export type ChildCommand = Command | "capture";
export type Root = "Email" | "Page" | "Document" | "Canvas";

/** A template sent to a child: its id in the run, its absolute path, and how the child loads it. */
export interface ChildInput {
  id: number;
  file: string;
  /** "cjs": a CommonJS module on Node (loaded with require); otherwise an ES module (and always on Bun). */
  format: "esm" | "cjs";
  /**
   * A values file's input: `file` is its template module, and this the values file (absolute) and its JSON, checked by
   * the parent's shape check. The child reads it against the template (readValuesFile()), never as a module.
   */
  values?: { file: string; envelope: Record<string, unknown> };
  /** A values file's or a template module's format, where one is selected. */
  templateFormat?: string;
  /** A TSX template design's input: the export of `file` (the template module) that is its template, and what it must be. */
  templateExport?: string;
  expect?: { id: string; version: string; formats: string[] };
  /** capture: what the request is (a slot module, or a TSX design and its static imports). */
  capture?: { kind: "slot" } | { kind: "design"; imports: string[] };
}

export interface StartMessage {
  type: "start";
  command: ChildCommand;
  inputs: ChildInput[];
  /** The group's templates run alone, one per child: a React count above one fails the template. */
  alone: boolean;
  cwd: string;
  /** The owner token every file the child writes starts with. */
  token: string;
  /** The first number of this child's loader modules' names (`.hyper-elements-<pid>-<n>`). */
  sequence: number;
  /** Where the child writes the group's tsconfig (Node only), or null on Bun. */
  tsconfig: string | null;
  /** Milliseconds the child has, from its start, before its watchdog ends it (the parent's timeout plus 5 s). */
  deadline: number;
  options: ChildOptions;
  /** capture: the template module whose folder Elements is resolved from (`captureFragment()` is the template's). */
  resolveFrom?: string;
}

/** The trusted template modules (`hyperElements.templates`), expanded by the parent: what a template child may load. */
export interface TrustList {
  /** Real paths of the files the list holds. */
  files: string[];
  /** Real paths of the listed packages' folders. */
  packages: string[];
}

export interface ChildOptions {
  /** `--props`: one object for every design, instead of its PreviewProps. */
  props?: Record<string, unknown>;
  pretty?: boolean;
  clients?: string[];
  rendered?: boolean;
  /** render: a Document's print HTML too. */
  html?: boolean;
  /** render: a Canvas's image format and scale. */
  format?: "png" | "svg";
  scale?: number;
  /** render: the folder root-relative fonts and images are read from (absolute), where `--public` gives one. */
  public?: string;
  /** render: http(s) sources cached before this time (ms since the epoch) are fetched again (`--refresh`). */
  refreshSince?: number;
  /** render: nothing is fetched; an http(s) source not in the cache fails the template. */
  offline?: boolean;
  /** preview: renderInEmailClients()'s `dark` and `fonts`. */
  dark?: boolean;
  fonts?: "url" | "inline";
  /** describe: the input is a template module, described by its template's describe(). */
  describeTemplate?: boolean;
  /** describe: the element (all where none) and the root. */
  element?: string;
  root?: string;
  /**
   * render, check, dev: lint's options, their shape checked (`hyperElements.lint`, `{}` where none), for the copy of
   * `@hyper-elements/lint` the child loads to check what they mean; false with `--no-lint`.
   */
  lint?: { rules?: Record<string, string>; kind?: string } | false;
  /** check, render: a template module's formats narrowed (`--template-format`). */
  templateFormat?: string;
  /** design: what to do (new or set), and what with. */
  design?: DesignRequest;
  /**
   * A template child: every input is a template's (a values file, a template module, a TSX design's expansion), and no
   * agent code runs in it. With `guard`, it loads only the trusted list, installed packages and its own loader modules.
   */
  templateChild?: boolean;
  guard?: TrustList;
}

/** A capture child's replies: one per request, and nothing else is accepted from it. */
export type CaptureMessage =
  | { type: "captured"; request: number; capture: unknown }
  | {
      type: "captured-design";
      request: number;
      template: { id: string; version: string; formats: string[] };
      format: string | null;
      specifier: string;
      export: string;
      values: Record<string, unknown>;
      assets?: Record<string, unknown>;
    }
  | { type: "capture-failed"; request: number; error: string; code?: string };

/** The template channel's slot exchange: a template child asks for its slot modules' captures, and gets them. */
export interface SlotsNeeded {
  type: "slots-needed";
  id: number;
  /** Each slot stored as `{ module }` (after migration), relative to `from`. */
  slots: Array<{ path: string; module: string }>;
  /** The values file (or the one design writes) its modules are relative to. */
  from: string;
}
export type SlotsReply = { type: "slots-ready"; id: number; captures: Record<string, unknown> } | { type: "slots-failed"; id: number; error: string };

/** `design new` and `design set`, as the child does them: it reads and checks; the parent writes. */
export interface DesignRequest {
  kind: "new" | "set";
  /** The values file written (absolute): where its module and images are written relative to. */
  output: string;
  /** new: the values given (--values); set: the file's envelope as it is. */
  values?: Record<string, unknown>;
  /** new, from a TSX design (--from): the folder its values' image files are relative to (the design's). */
  valuesFolder?: string;
  envelope?: Record<string, unknown>;
  /** Each value set, in order: a JSON value or text, or `file`, an image's absolute path (`@path`). */
  sets: Array<{ path: string; value?: unknown; file?: string }>;
  draft?: boolean;
  /** Each image's source (--source), by field path. */
  sources?: Record<string, Record<string, unknown>>;
}

/** What a template's check measured and found, for `check --json`: fitted text, regions, rules, review items. */
export interface TemplateLayout {
  fits?: unknown[];
  regions?: Record<string, unknown>;
  rules?: unknown[];
  review?: unknown[];
}

/** One preview file from renderInEmailClients(), for the parent to write. */
export interface PreviewFile {
  id: string;
  client: string;
  filename: string;
  html: string;
}

/** One input's result, from the child. */
export interface ResultMessage {
  type: "result";
  id: number;
  root: Root | null;
  status: "ok" | "error" | "skipped";
  diagnostics: Diagnostic[];
  /** `formatDiagnostics()` of `diagnostics`, from the template's own Elements where it loaded. */
  formatted?: string;
  error?: string;
  /**
   * What `render` writes, by extension (`html`, `txt`, `pdf`, `png`, `svg`); what `outline` prints (`outline`). A
   * file's bytes (a PDF, an image) are base64, and their extensions listed in `binary`: IPC carries text.
   */
  outputs?: Record<string, string>;
  binary?: string[];
  /** `preview`: the files renderInEmailClients() made. */
  previews?: PreviewFile[];
  /** `inspect`: inspect()'s result, as it is. */
  inspection?: unknown;
  /** `describe`: describeElements()'s or describeElement()'s result, as it is (an older Elements' given in that shape). */
  described?: unknown;
  /** The run can't do what it was asked for this template (Elements missing or out of range, process.exit): exit 2. */
  usage?: boolean;
  /** Skipped because it isn't a template (its default export isn't a component, or renders no root): a run of none exits 2. */
  notTemplate?: boolean;
  /** A values file or a template module: the template, as its module says. */
  template?: { id: string; version: string };
  /** What its template's check measured and found. */
  layout?: TemplateLayout;
  /** An ordinary child's input that turned out to be a template's: run again in a template child (Decision 31). */
  templateDesign?: boolean;
  templateModule?: boolean;
  /** `design`: the values file to write (the parent writes it), or why not. */
  designed?: { file: Record<string, unknown>; valid: boolean; missing?: string[]; changed: string[] };
}

/** More than one React in a group's process: the parent runs each of its templates again, alone. */
export interface ReactsMessage {
  type: "reacts";
}

/** The child's last message: what template code threw outside a render. */
export interface DoneMessage {
  type: "done";
  late: string[];
}

export type ChildMessage = ResultMessage | ReactsMessage | DoneMessage | SlotsNeeded;

/** A template, as a line reports it: where its module is, and whether the project's list trusts it. */
export interface TemplateInfo {
  id: string;
  version: string;
  module?: string;
  trusted?: boolean;
}

/** A group: the package (the folder of the nearest package.json) and the tsconfig its templates compile with. */
export interface Group {
  package: string | null;
  tsconfig: string | null;
}

export type Late =
  | { kind: "throw"; group: Group; message: string }
  | { kind: "child"; group: Group; reason: "exit" | "signal" | "timeout"; detail: string };

export interface InputLine {
  version: 1;
  command: Command;
  file: string;
  /** "html": an HTML email (`check` and `preview`), whose `root` is null; "values": a values file. */
  input: "template" | "html" | "values";
  /** A values file's format, where its template has formats. */
  templateFormat?: string;
  /** A values file's, a template module's or a template design's template, as the template child that checked it found it. */
  template?: TemplateInfo;
  fits?: unknown[];
  regions?: Record<string, unknown>;
  rules?: unknown[];
  review?: unknown[];
  root: Root | null;
  status: "ok" | "error" | "skipped";
  outputs: string[];
  diagnostics: Diagnostic[];
  error?: string;
  /** `preview`: each preview file written. */
  previews?: Preview[];
  /** `preview --findings`: the browser the previews were drawn in, or null where none was found (with `reason`). */
  browser?: string | null;
  reason?: "no-browser" | "no-playwright-core";
}

/** A preview, as `preview` reports it: `ready` and `findings` are what the drawn page said (null where not drawn). */
export interface Preview {
  id: string;
  client: string;
  path: string;
  /** `--serve`: where it's served. */
  url?: string;
  ready: "ok" | "incomplete" | "error" | null;
  findings: Record<string, unknown> | null;
  /** `--screenshots`: the PNG written beside it. */
  screenshot?: string;
}

/** `inspect --json`: one line per template. */
export interface InspectLine {
  version: 1;
  command: "inspect";
  file: string;
  status: "ok" | "error" | "skipped";
  /** inspect()'s result as it is, or null where the template didn't load (or was skipped). */
  inspection: unknown;
  /** Where there's no inspection: what the CLI found instead. */
  diagnostics?: Diagnostic[];
  error?: string;
}

export interface SummaryLine {
  version: 1;
  summary: {
    templates: number;
    errors: number;
    warnings: number;
    skipped: number;
    late: Late[];
  };
  exitCode: 0 | 1 | 2;
}
