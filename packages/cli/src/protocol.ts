/**
 * What the parent and a child process say to each other over the IPC channel, and the shapes of what the CLI
 * reports (the `--json` lines).
 */

/** A diagnostic as Elements gives it (packages/core/src/diagnostics.ts), or one of the CLI's own (`cli/…`, path ""). */
export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path: string;
  nodeId?: string;
  clients?: readonly string[];
  fix?: string;
  see?: string;
}

export type Command = "render" | "check" | "outline" | "preview" | "inspect" | "describe" | "migrate";
export type Root = "Email" | "Page" | "Document" | "Canvas";

/** A template sent to a child: its id in the run, its absolute path, and how the child loads it. */
export interface ChildInput {
  id: number;
  file: string;
  /** "cjs": a CommonJS module on Node (loaded with require); otherwise an ES module (and always on Bun). */
  format: "esm" | "cjs";
}

export interface StartMessage {
  type: "start";
  command: Command;
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
}

export interface ChildOptions {
  /** `--props`: one object for every template, over PreviewProps. */
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
  /** describe: the component (all where none) and the root. */
  component?: string;
  root?: string;
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
  /** `describe`: describeComponents()'s or describeComponent()'s result, as it is. */
  described?: unknown;
  /** The run can't do what it was asked for this template (Elements missing or out of range, process.exit): exit 2. */
  usage?: boolean;
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

export type ChildMessage = ResultMessage | ReactsMessage | DoneMessage;

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
  input: "template";
  root: Root | null;
  status: "ok" | "error" | "skipped";
  outputs: string[];
  diagnostics: Diagnostic[];
  error?: string;
  /** `preview`: each preview file written. */
  previews?: Preview[];
  /** `preview --findings`: the browser the previews were drawn in, or null where none was found (with `reason`). */
  browser?: string | null;
  reason?: "no-browser";
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
