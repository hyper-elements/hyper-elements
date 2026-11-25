/**
 * The parent process: it finds the inputs, groups them by package and tsconfig, runs each group in a child process
 * of its own (one after another), writes every output file, and alone writes stdout. Children's stdout and stderr
 * are copied to its stderr. A child is ended, with every process in its group, however it ends: when it says it's
 * done, when it runs past `--timeout`, when it exits or crashes, and when the run is interrupted.
 */
import { fork, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectConfig } from "@hyper-elements/template-loader";
import { UsageError, type Args } from "./args";
import { ALL_RENDER_OUTPUTS, RENDER_OUTPUTS } from "./commands/render";
import { cliDiagnostic } from "./commands/shared";
import { outputBase, planDestinations, removeTemporaries, writeAtomically, type Planned } from "./destinations";
import { errorLine } from "./errors";
import { checkHtml, readStdin } from "./html";
import { readLintConfig, type LintConfig } from "./lint-config";
import { lintHtmlInput } from "./lint";
import { displayPath, findInputs, moduleFormat, packageFolder, resolveImport, staticImports, typeScriptTwin, type Input } from "./inputs";
import { endOrphans, killTree } from "./kill";
import { cleanFiles, ownToken, parseToken, stale } from "./loader-module";
import { formatDiagnostics } from "./format";
import { inputLine, inputText, summaryText, type Outcome } from "./output";
import { expandValues } from "./values-files";
import { readTrust, trusted, untrusted, type Trust } from "./trust";
import { clientsFolder, drawPreviews, NO_BROWSER_HELP, NO_PLAYWRIGHT_CORE_HELP, planPreviewFolders, servePreviews, writePreviews } from "./preview";
import type { CaptureMessage, ChildInput, ChildMessage, Diagnostic, Group, Late, PreviewFile, ResultMessage, SlotsNeeded, SlotsReply, StartMessage, SummaryLine, TrustList } from "./protocol";

export interface Io {
  cwd: string;
  /** Resolves once written (and flushed, for a pipe). */
  stdout(data: string | Uint8Array): Promise<void>;
  stderr(text: string): void;
  /** All of stdin, as UTF-8 text (`-`, an HTML email); process.stdin where it's not given. */
  stdin?(): Promise<string>;
}

const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

/**
 * The templates a child ended past --timeout didn't start: those after the one it was on (the first with no result:
 * a child renders its templates in order, and sends each result as it's done). They're run again in a new child, so
 * one template that never finishes fails alone, whatever the order of the arguments. Empty for any other ending.
 */
export function unfinished(report: ChildReport, inputs: Input[]): Input[] {
  if (report.done || report.reacts || report.ended?.reason !== "timeout") return [];
  return inputs.filter((input) => !report.results.has(input.id)).slice(1);
}

/** The children running, for an interrupt to end. */
const running = new Set<ChildProcess>();

interface GroupRun {
  key: string;
  group: Group;
  inputs: Input[];
}

export interface ChildReport {
  results: Map<number, ResultMessage>;
  reacts: boolean;
  done: boolean;
  late: string[];
  /** How it ended, where it ended before `done`. */
  ended?: { reason: "exit" | "signal" | "timeout"; detail: string; error: string };
}

/** When each child was started: on Windows, what it started is told apart by when (endOrphans). */
const forkedAt = new WeakMap<ChildProcess, number>();

/** Set by an interrupt: the run is ending, and its children with it. */
let interrupted = false;

/** A child process, waiting for its start message. */
function forkChild(cwd: string): ChildProcess {
  const child = fork(fileURLToPath(new URL("./child.js", import.meta.url)), [], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    // A process group of its own, so the child and every process it starts can be ended together (macOS, Linux).
    detached: process.platform !== "win32",
    // Bun installs a package it can't resolve where there's no node_modules (auto-install), from its cache or npm:
    // a template resolves only what its project has, as on Node.
    execArgv: bun ? ["--no-install"] : [],
    cwd,
  });
  forkedAt.set(child, Date.now());
  return child;
}

/**
 * `dev`: children started ahead of the next change, idle (no template code has run in them) until a group is given to
 * one, so a render doesn't wait for processes to start. Each is used once, as any child is; taking one starts the next.
 */
const spares: ChildProcess[] = [];
let spareCwd: string | undefined;
let spareCount = 0;

/** Keeps `count` spare children for `cwd` from now on. */
export function keepSpareChildren(cwd: string, count: number): void {
  if (spareCwd !== cwd) for (const child of spares.splice(0)) if (child.pid) killTree(child.pid);
  spareCwd = cwd;
  spareCount = count;
  for (const child of spares.splice(count)) if (child.pid) killTree(child.pid);
  while (spares.length < count) {
    const child = forkChild(cwd);
    // Its output flows from the start (it writes nothing until it's given a group; runChild copies it from then on):
    // a pipe left paused never ends on Bun, so its close would never come.
    child.stdout!.resume();
    child.stderr!.resume();
    spares.push(child);
    // An interrupt ends it with the others; it ends by itself if this process does (its IPC channel closes).
    running.add(child);
    child.once("exit", () => {
      running.delete(child);
      const at = spares.indexOf(child);
      if (at >= 0) spares.splice(at, 1);
    });
  }
}

function takeSpare(cwd: string): ChildProcess | undefined {
  if (spareCwd !== cwd) return undefined;
  for (let child = spares.shift(); child; child = spares.shift()) {
    keepSpareChildren(cwd, spareCount);
    if (child.exitCode === null && child.signalCode === null && child.connected) return child;
    if (child.pid) killTree(child.pid);
  }
  return undefined;
}

let children = 0;
/** When the run started: `--refresh` fetches what was cached before it. */
let runStarted = Date.now();

/** Starts a child for `inputs` and resolves once it has ended and been cleaned up after. */
export function runChild(
  command: Args["command"],
  inputs: Input[],
  alone: boolean,
  args: Args,
  props: Record<string, unknown> | undefined,
  token: string,
  io: Io,
  extra: Partial<StartMessage["options"]> = {},
  /** `dev`: ends the child (and its group) when a newer change makes its results moot. */
  abort?: AbortSignal,
): Promise<ChildReport> {
  const index = children++;
  const tsconfig = tsconfigPath(index);
  const message: StartMessage = {
    type: "start",
    command,
    inputs: inputs.map((input) => ({
      id: input.id,
      file: input.file,
      format: moduleFormat(input.file),
      ...(input.values ? { values: input.values } : {}),
      ...(input.templateFormat ? { templateFormat: input.templateFormat } : {}),
      ...(input.templateExport ? { templateExport: input.templateExport } : {}),
      ...(input.expect ? { expect: input.expect } : {}),
    })),
    alone,
    cwd: io.cwd,
    token,
    sequence: index * 100_000,
    tsconfig,
    deadline: args.timeout + 5_000,
    options: {
      props,
      pretty: args.pretty || undefined,
      clients: args.clients,
      rendered: args.rendered || undefined,
      ...(command === "preview" ? { dark: args.dark || undefined, fonts: args.fonts } : {}),
      ...extra,
      ...(args.templateFormat ? { templateFormat: args.templateFormat } : {}),
      ...(command === "render" || command === "check"
        ? {
            html: args.html || undefined,
            format: args.format,
            scale: args.scale,
            public: args.public === undefined ? undefined : resolve(io.cwd, args.public),
            refreshSince: args.refresh ? runStarted : undefined,
            offline: args.offline || undefined,
          }
        : {}),
    },
  };
  const report: ChildReport = { results: new Map(), reacts: false, done: false, late: [] };
  return new Promise((resolvePromise) => {
    const child = takeSpare(io.cwd) ?? forkChild(io.cwd);
    running.add(child);
    const copy = (data: Buffer) => io.stderr(data.toString("utf8"));
    child.stdout!.on("data", copy);
    child.stderr!.on("data", copy);
    let timedOut = false;
    const timer = setTimeout(() => {
      if (report.done) return;
      timedOut = true;
      killTree(child.pid!);
    }, args.timeout);
    child.on("message", (data: ChildMessage) => {
      // Nothing it sends after `done` counts.
      if (report.done) return;
      if (data.type === "result") report.results.set(data.id, data);
      else if (data.type === "reacts") report.reacts = true;
      else if (data.type === "slots-needed" && message.options.templateChild) {
        // Only a template child asks, and only for an input it was given (Decision 29).
        void answerSlots(data, inputs.find((input) => input.id === data.id), args, token, io).then((reply) => {
          if (child.connected) child.send(reply);
        });
      }
      else if (data.type === "done") {
        report.done = true;
        report.late = data.late;
        // Nothing a template scheduled, or a process it started in the group, runs after this.
        killTree(child.pid!);
      }
    });
    let finished = false;
    const finish = (code: number | null, signal: NodeJS.Signals | null, failure?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      // The group outlives its leader while any of its processes is alive. On Windows a child that ended on its own (a
      // crash) leaves what it started with no tree to end: found by when they started, and ended before the run goes on.
      if (child.pid) killTree(child.pid);
      const orphans =
        child.pid && !report.done && !timedOut && !abort?.aborted && !interrupted ? endOrphans(child.pid, forkedAt.get(child) ?? 0, Date.now()) : undefined;
      if (!report.done) {
        if (timedOut) report.ended = { reason: "timeout", detail: `${args.timeout} ms`, error: "" };
        else if (signal) report.ended = { reason: "signal", detail: signal, error: `child killed by ${signal}` };
        else if (failure) report.ended = { reason: "exit", detail: errorLine(failure), error: `child failed to start: ${errorLine(failure)}` };
        else report.ended = { reason: "exit", detail: `exit ${code}`, error: `child exited with ${code}` };
      }
      // What it wrote is copied before the run goes on; a process that left the group may hold the pipes: not waited for.
      let closed = false;
      const done = () => {
        if (closed) return;
        closed = true;
        child.stdout?.destroy();
        child.stderr?.destroy();
        running.delete(child);
        if (orphans) void orphans.then(() => resolvePromise(report));
        else resolvePromise(report);
      };
      child.once("close", done);
      setTimeout(done, 500).unref();
    };
    child.on("exit", (code, signal) => finish(code, signal));
    child.on("error", (error) => finish(null, null, error));
    // A spare that ended while it waited (its exit already reported).
    if (child.exitCode !== null || child.signalCode !== null) finish(child.exitCode, child.signalCode);
    if (abort) {
      const stop = () => child.pid && killTree(child.pid);
      if (abort.aborted) stop();
      else {
        abort.addEventListener("abort", stop, { once: true });
        child.once("exit", () => abort.removeEventListener("abort", stop));
      }
    }
    child.send(message);
  });
}

/** The packages the CLI loads beside a template (Elements and its peers, email-clients, lint): trusted where installed. */
const TOOLCHAIN = ["@hyper-elements/react", "react", "react-dom", "@hyper-elements/email-clients", "@hyper-elements/lint", "@react-pdf/renderer", "satori", "@resvg/resvg-js"];

/** A trusted list with the folders of the toolchain's packages as each template module resolves them (a workspace link too). */
function withToolchain(list: TrustList, modules: string[]): TrustList {
  const packages = new Set(list.packages);
  for (const module of new Set(modules)) {
    for (const name of TOOLCHAIN) {
      let dir: string | undefined;
      try {
        dir = dirname(createRequire(module).resolve(`${name}/package.json`));
      } catch {
        try {
          dir = dirname(createRequire(module).resolve(name));
          while (!existsSync(join(dir, "package.json")) && dirname(dir) !== dir) dir = dirname(dir);
        } catch {
          continue;
        }
      }
      try {
        packages.add(realpathSync(dir));
      } catch {
        // not there
      }
    }
  }
  return { files: list.files, packages: [...packages] };
}

/** A template child's options for these template modules: guarded where the project lists its trusted templates. */
export function templateChildOptions(trust: Trust, modules: string[]): Partial<StartMessage["options"]> {
  return { templateChild: true, ...(trust.list ? { guard: withToolchain(trust.list, modules) } : {}) };
}

/** The commands that check a template's design in a template child: their template modules and designs are set aside. */
const SETS_ASIDE = new Set<string>(["render", "check", "inspect", "outline"]);

/** A TSX template design's capture, read: one input per format, each its template module's, or why not. */
async function expandDesign(input: Input, args: Args, props: Record<string, unknown> | undefined, token: string, io: Io, nextId: () => number): Promise<{ inputs: Input[] } | { error: Diagnostic }> {
  const fail = (message: string, code = "template-design", fix?: string) => ({ error: cliDiagnostic(code, "error", message, fix) });
  let imports: string[];
  try {
    imports = await staticImports(input.file, readFileSync(input.file, "utf8"));
  } catch (error) {
    return fail(`${input.display} couldn't be read: ${errorLine(error)}`);
  }
  const replies = await runCapture([{ id: 0, file: input.file, capture: { kind: "design", imports } }], input.file, args, token, io, props);
  const reply = replies.get(0);
  if (reply?.type !== "captured-design") return fail(`${input.display}: ${reply?.type === "capture-failed" ? reply.error : "its capture gave no template"}`, "template-design", "a template design is export default () => <Template … />, its template imported from its module");
  // Its shape, as nothing it sends is believed beyond it.
  const { template, format, specifier, values } = reply;
  const strings = (list: unknown) => Array.isArray(list) && list.every((item) => typeof item === "string");
  if (!template || typeof template.id !== "string" || typeof template.version !== "string" || !strings(template.formats) || (format !== null && typeof format !== "string") || typeof reply.export !== "string" || !values || typeof values !== "object" || Array.isArray(values)) {
    return fail(`${input.display}: its capture isn't a template design's`);
  }
  if (typeof specifier !== "string" || !imports.includes(specifier)) return fail(`${input.display}: its template was said to come from ${JSON.stringify(specifier)}, which it doesn't import`);
  const module = resolveImport(input.file, specifier);
  if (!module) return fail(`${input.display}'s template ${specifier} isn't found from its folder (a template is imported by a relative path or a package, not an absolute one)`);
  const formats = template.formats;
  let selected: Array<string | undefined>;
  if (format !== null) {
    if (args.templateFormat !== undefined && args.templateFormat !== format) return fail(`${input.display} is the ${format} format; --template-format ${args.templateFormat} names another`, "template-format");
    selected = [format];
  } else if (formats.length) {
    if (args.templateFormat !== undefined && !formats.includes(args.templateFormat)) return fail(`${template.id} has the formats ${formats.join(", ")}, not ${args.templateFormat}`, "template-format");
    selected = args.templateFormat !== undefined ? [args.templateFormat] : formats;
  } else selected = [undefined];
  const real = (() => {
    try {
      return realpathSync(module);
    } catch {
      return module;
    }
  })();
  const stem = basename(input.file, extname(input.file));
  return {
    inputs: selected.map((templateFormat) => ({
      id: nextId(),
      file: module,
      real,
      display: input.display,
      kind: "template" as const,
      // Its values as a values file holds them, relative to the design file; its assets' sources from its `assets` export.
      values: { file: input.file, envelope: { version: 1, template: { module: specifier, id: template.id, version: template.version }, ...(templateFormat !== undefined ? { formats: [templateFormat] } : {}), values, ...(reply.assets ? { assets: reply.assets } : {}) } },
      ...(templateFormat !== undefined ? { templateFormat } : {}),
      templateExport: reply.export,
      expect: { id: template.id, version: template.version, formats },
      output: { folder: dirname(input.file), stem },
    })),
  };
}

/** The most a capture child's reply may be, serialized. */
const MAX_REPLY = 8 * 1024 * 1024;

/** A free path for a child's tsconfig (Node only): written by the child, for its group. */
function tsconfigPath(index: number): string | null {
  if (bun) return null;
  for (let n = 0; ; n++) {
    const candidate = join(tmpdir(), `hyper-elements-cli-tsconfig-${process.pid}-${index}${n ? `${n}` : ""}.json`);
    if (!existsSync(candidate)) return candidate;
  }
}

export interface CaptureRequest {
  id: number;
  file: string;
  capture: NonNullable<ChildInput["capture"]>;
}

/**
 * Runs agent code in a capture child (Decision 29): each slot module or TSX design captured, one reply per request.
 * The receiver accepts only `captured` (for a slot), `captured-design` (for a design) and `capture-failed`, each once
 * per request id it was given, each under 8 MB; anything else (another type, an unknown or repeated id, a reply too
 * large, an exit or a timeout before every reply) fails the requests it hasn't answered. Once each has its reply, the
 * child is ended with everything it started.
 */
export function runCapture(requests: CaptureRequest[], resolveFrom: string, args: Args, token: string, io: Io, props?: Record<string, unknown>): Promise<Map<number, CaptureMessage>> {
  const index = children++;
  const message: StartMessage = {
    type: "start",
    command: "capture",
    inputs: requests.map((request) => ({ id: request.id, file: request.file, format: moduleFormat(request.file), capture: request.capture })),
    alone: true,
    cwd: io.cwd,
    token,
    sequence: index * 100_000,
    tsconfig: tsconfigPath(index),
    deadline: args.timeout + 5_000,
    // A design is captured with the props it's rendered with (--props); a slot's content takes none.
    options: props ? { props } : {},
    resolveFrom,
  };
  const replies = new Map<number, CaptureMessage>();
  const kinds = new Map(requests.map((request) => [request.id, request.capture.kind]));
  return new Promise((resolvePromise) => {
    const child = forkChild(io.cwd);
    running.add(child);
    const copy = (data: Buffer) => io.stderr(data.toString("utf8"));
    child.stdout!.on("data", copy);
    child.stderr!.on("data", copy);
    let settled = false;
    const fail = (why: string) => {
      for (const request of requests) if (!replies.has(request.id)) replies.set(request.id, { type: "capture-failed", request: request.id, error: why });
    };
    const end = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child.pid) killTree(child.pid);
      const orphans = child.pid && !interrupted ? endOrphans(child.pid, forkedAt.get(child) ?? 0, Date.now()) : undefined;
      let closed = false;
      const done = () => {
        if (closed) return;
        closed = true;
        child.stdout?.destroy();
        child.stderr?.destroy();
        running.delete(child);
        if (orphans) void orphans.then(() => resolvePromise(replies));
        else resolvePromise(replies);
      };
      child.once("close", done);
      setTimeout(done, 500).unref();
    };
    const timer = setTimeout(() => {
      fail(`it didn't reply within ${args.timeout} ms`);
      end();
    }, args.timeout);
    child.on("message", (data: unknown) => {
      if (settled) return;
      const reply = data as CaptureMessage;
      const request = typeof reply?.request === "number" ? reply.request : undefined;
      const kind = request === undefined ? undefined : kinds.get(request);
      const size = (() => {
        try {
          return JSON.stringify(data).length;
        } catch {
          return Infinity;
        }
      })();
      const expected = kind === "slot" ? "captured" : "captured-design";
      const known = reply?.type === expected || reply?.type === "capture-failed";
      if (!kind || !known || replies.has(request!) || size > MAX_REPLY) {
        // Anything but one reply of the right kind to a request it was given: nothing it said is believed, even what
        // came before (a reply sent ahead of the real one by the code it ran).
        replies.clear();
        fail(!kind || !known ? `its capture process sent ${JSON.stringify(reply?.type ?? typeof data)}${request !== undefined ? ` for request ${request}` : ""}, which isn't a reply to a request it was given` : replies.has(request!) ? "its capture process replied twice" : `its capture process sent ${size} bytes, more than 8 MB`);
        end();
        return;
      }
      replies.set(request!, reply);
      if (replies.size === requests.length) end();
    });
    child.on("exit", (code, signal) => {
      if (settled) return;
      fail(signal ? `its capture process was killed by ${signal}` : `its capture process exited with ${code} before it replied`);
      end();
    });
    child.on("error", (error) => {
      if (settled) return;
      fail(`its capture process failed: ${errorLine(error)}`);
      end();
    });
    child.send(message);
  });
}

/** A capture reply's fragment, as far as the parent reads it: the template child reads it again with readFragment(). */
const isCapture = (value: unknown) => !!value && typeof value === "object" && (value as { kind?: unknown }).kind === "hyper-elements.fragment";

/**
 * A template child's `slots-needed`: each slot module resolved from the values file (or the file design writes),
 * captured in a capture child with the template's Elements, and the captures sent back (`slots-ready`), or why not.
 */
async function answerSlots(needed: SlotsNeeded, input: Input | undefined, args: Args, token: string, io: Io): Promise<SlotsReply> {
  const failed = (error: string): SlotsReply => ({ type: "slots-failed", id: needed.id, error });
  if (!input || !Array.isArray(needed.slots) || typeof needed.from !== "string") return failed("a slot request for an input this child wasn't given");
  const requests: CaptureRequest[] = [];
  for (const [i, slot] of needed.slots.entries()) {
    if (typeof slot?.module !== "string" || !(slot.module.startsWith("./") || slot.module.startsWith("../"))) return failed(`${slot?.path}'s module is a path relative to the values file (./launch.body.tsx), not ${JSON.stringify(slot?.module)}`);
    const file = resolve(dirname(needed.from), slot.module);
    if (!existsSync(file)) return failed(`${slot.path}'s module ${slot.module} isn't there`);
    requests.push({ id: i, file, capture: { kind: "slot" } });
  }
  const replies = await runCapture(requests, input.file, args, token, io);
  const captures: Record<string, unknown> = {};
  for (const [i, slot] of needed.slots.entries()) {
    const reply = replies.get(i);
    if (reply?.type !== "captured" || !isCapture(reply.capture)) return failed(`${slot.path} (${slot.module}): ${reply?.type === "capture-failed" ? reply.error : "its capture isn't a fragment"}`);
    captures[slot.path] = reply.capture;
  }
  return { type: "slots-ready", id: needed.id, captures };
}

export function readProps(path: string, cwd: string): Record<string, unknown> {
  let text: string;
  try {
    text = readFileSync(resolve(cwd, path), "utf8");
  } catch (error) {
    throw new UsageError(`--props ${path}: ${errorLine(error)}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new UsageError(`--props ${path} isn't JSON: ${errorLine(error)}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UsageError(`--props ${path} must hold a JSON object, the design's props.`);
  return value as Record<string, unknown>;
}

/** The interrupt: children ended, the files they and this run wrote deleted, no summary. */
export function onInterrupt(token: () => string | undefined, folders: () => Iterable<string>, exit: (code: number) => void): () => void {
  const handler = (signal: NodeJS.Signals) => {
    interrupted = true;
    for (const child of running) if (child.pid) killTree(child.pid);
    const mine = token();
    if (mine) {
      const own = parseToken(`// ${mine}`);
      cleanFiles(folders(), (owner) => !!owner && !!own && owner.host === own.host && owner.pid === own.pid && owner.random === own.random);
    }
    removeTemporaries();
    exit(signal === "SIGINT" ? 130 : 143);
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}

export interface RunState {
  token?: string;
  folders: Set<string>;
  /** `preview --serve` is serving: Ctrl-C ends it, with exit 0. */
  serving?: boolean;
}

export async function run(args: Args, io: Io, state: RunState = { folders: new Set() }): Promise<number> {
  const { cwd } = io;
  runStarted = Date.now();
  if (args.public !== undefined) {
    let folder = false;
    try {
      folder = statSync(resolve(cwd, args.public)).isDirectory();
    } catch {
      folder = false;
    }
    if (!folder) throw new UsageError(`--public ${args.public} isn't a folder.`);
  }
  const props = args.props === undefined ? undefined : readProps(args.props, cwd);
  // The trusted template modules (hyperElements.templates), expanded once before anything runs.
  const trust: Trust = SETS_ASIDE.has(args.command) ? readTrust(cwd) : {};
  // Lint's options, their shape checked before anything runs (and not read at all with --no-lint).
  const lint: LintConfig | false = args.lint ? readLintConfig(cwd) : false;
  const found = await findInputs(args.positional, cwd, undefined, { html: args.command === "check" || args.command === "preview", values: ["render", "check", "inspect", "outline"].includes(args.command) });
  // A values file is one input per format it lists (Decision 20); one whose shape is wrong is one input that fails.
  let nextId = found.inputs.length;
  const inputs: Input[] = [];
  const failedValues = new Map<number, Diagnostic>();
  for (const input of found.inputs) {
    if (input.kind !== "values") {
      inputs.push(input);
      continue;
    }
    const expanded = expandValues(input, args.templateFormat, () => nextId++);
    if ("error" in expanded) {
      failedValues.set(input.id, expanded.error);
      inputs.push(input);
    } else inputs.push(...expanded.inputs);
  }
  // HTML emails run in this process (no template code, no loader module); templates in children.
  const templates = inputs.filter((input) => input.kind !== "html" && !failedValues.has(input.id));
  const htmlInputs = inputs.filter((input) => input.kind === "html");
  const formatsOf = (list: Input[]) => (list.length > 1 && list.every((input) => input.values && input.values.file === list[0].values?.file) ? " (a values file's formats: give --template-format)" : "");
  if (args.command === "outline" && inputs.length !== 1) throw new UsageError(`outline takes one design; ${args.positional[0]} holds ${inputs.length}${formatsOf(inputs)}.`);
  if (args.stdout && inputs.length !== 1) throw new UsageError(`--stdout writes one design's output: this run has ${inputs.length} designs${formatsOf(inputs)}.`);
  for (const link of found.links) io.stderr(`- ${displayPath(cwd, link)}: a symbolic link to a folder, not followed (give the folder itself to include what's in it)\n`);
  let planned: Planned | undefined;
  // Outputs keep their path relative to the current folder (or --base), whatever else is given with them.
  const written = inputs.filter((input) => !failedValues.has(input.id));
  const base = (args.command === "render" && !args.stdout) || args.command === "preview" ? outputBase(written, cwd, args.base) : cwd;
  if (args.command === "render" && !args.stdout) planned = planDestinations(written, base, args.out, cwd, ALL_RENDER_OUTPUTS);
  const previewFolders = args.command === "preview" ? planPreviewFolders(inputs, base, args.out, cwd) : undefined;

  const token = ownToken();
  state.token = token;
  for (const input of templates) state.folders.add(dirname(input.file));

  const outcomes = new Map<number, Outcome & { pending?: Record<string, string>; binary?: string[]; pendingPreviews?: PreviewFile[] }>();
  const usage = new Set<number>();
  /** The inputs skipped because they aren't templates: a run where every input is one has no templates (exit 2). */
  const notTemplates = new Set<number>();
  const extra = new Map<number, Diagnostic[]>();
  const note = (id: number, diagnostic: Diagnostic) => extra.set(id, [...(extra.get(id) ?? []), diagnostic]);
  for (const [id, diagnostic] of failedValues) {
    const input = inputs.find((i) => i.id === id)!;
    outcomes.set(id, { file: input.display, root: null, status: "error", outputs: [], diagnostics: [diagnostic], input: "values" });
  }

  // What earlier runs left (killed before they cleaned up): only files their tokens prove a CLI run on this host made,
  // for a process that isn't running.
  const firstIn = new Map<string, number>();
  for (const input of templates) if (!firstIn.has(dirname(input.file))) firstIn.set(dirname(input.file), input.id);
  for (const problem of cleanFiles(state.folders, (owner) => stale(owner))) {
    note(firstIn.get(problem.folder) ?? templates[0].id, cliDiagnostic("cleanup", "warning", `Couldn't delete ${displayPath(cwd, problem.file)}, left by an earlier run: ${problem.message}`));
  }

  // A JavaScript template beside its TypeScript twin: tsx would load the twin for it.
  const runnable: Input[] = [];
  for (const input of templates) {
    const twin = typeScriptTwin(input.file);
    if (!twin) {
      runnable.push(input);
      continue;
    }
    outcomes.set(input.id, {
      file: input.display,
      root: null,
      status: "error",
      outputs: [],
      diagnostics: [
        cliDiagnostic(
          "ts-twin",
          "error",
          `${input.display} has a TypeScript twin, ${displayPath(cwd, twin)}: an import of the JavaScript file loads the TypeScript one, so this template can't be loaded as itself`,
          "rename one of the two files",
        ),
      ],
    });
  }

  /** Inputs grouped by package, then by tsconfig (a template's input: its template module's). */
  const grouped = (list: Input[]) => {
    const groups = new Map<string, GroupRun>();
    for (const input of list) {
      const pkg = packageFolder(dirname(input.file));
      const config = projectConfig(dirname(input.file)) ?? null;
      const key = `${pkg ?? ""}\0${config ?? ""}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, group: { package: pkg === null ? null : displayPath(cwd, pkg), tsconfig: config === null ? null : displayPath(cwd, config) }, inputs: [] };
        groups.set(key, group);
      }
      group.inputs.push(input);
    }
    return groups;
  };

  const late: Late[] = [];
  /** Set aside by an ordinary child: template modules and TSX template designs, for template children (Decision 31). */
  const asideModules: Input[] = [];
  const asideDesigns: Input[] = [];
  /** The inputs a template child ran: only their results say a template (an ordinary child's never does). */
  const fromTemplateChild = new Set<number>();
  const settle = (input: Input, result: ResultMessage | undefined, ended: ChildReport["ended"], templateChild = false) => {
    if (result && !templateChild && (result.templateModule || result.templateDesign) && SETS_ASIDE.has(args.command)) {
      // No outcome of its own: what it is is run in a template child (a design's expansion is what's reported).
      (result.templateModule ? asideModules : asideDesigns).push(input);
      return;
    }
    if (result) {
      if (result.usage) usage.add(input.id);
      if (result.notTemplate) notTemplates.add(input.id);
      if (templateChild) fromTemplateChild.add(input.id);
      // What a template is, and what its rules found, only from a template child.
      const template = templateChild && result.template ? { ...result.template, module: displayPath(cwd, input.file), trusted: !!trust.list } : undefined;
      if (templateChild && !trust.list && result.template) note(input.id, untrusted(displayPath(cwd, input.file), trust));
      outcomes.set(input.id, {
        file: input.display,
        root: result.root,
        status: result.status,
        outputs: [],
        diagnostics: result.diagnostics,
        formatted: result.formatted,
        error: result.error,
        pending: result.outputs,
        binary: result.binary,
        ...(input.values || input.kind === "values" ? { input: input.kind === "values" ? ("values" as const) : ("template" as const) } : {}),
        ...(input.templateFormat ? { templateFormat: input.templateFormat } : {}),
        ...(template ? { template } : {}),
        ...(templateChild && result.layout ? { layout: result.layout } : {}),
        ...(result.previews ? { pendingPreviews: result.previews } : {}),
        ...(args.command === "inspect" ? { inspection: result.inspection ?? null } : {}),
      });
      return;
    }
    if (ended?.reason === "timeout") {
      outcomes.set(input.id, {
        file: input.display,
        root: null,
        status: "error",
        outputs: [],
        diagnostics: [cliDiagnostic("timeout", "error", `It didn't finish within ${args.timeout} ms: the process running it was ended (the designs after it ran in a new one)`, "make the design finish sooner, or give a longer --timeout")],
      });
    } else {
      outcomes.set(input.id, { file: input.display, root: null, status: "error", outputs: [], diagnostics: [], error: ended?.error || "child ended before this design's result" });
    }
  };
  /** What a child left for the summary: late throws, and a child that ended badly after sending every result. */
  const lateFrom = (group: Group, report: ChildReport, inputs: Input[]) => {
    for (const message of report.late) late.push({ kind: "throw", group, message });
    if (!report.done && report.ended && !report.reacts && inputs.every((input) => report.results.has(input.id))) {
      late.push({ kind: "child", group, reason: report.ended.reason, detail: report.ended.detail });
    }
  };
  const runGroups = async (list: Input[], templateChild: boolean) => {
    for (const group of grouped(list).values()) {
      // The guard also lets the packages the CLI itself loads beside the template load, wherever they're installed.
      const extra: Partial<StartMessage["options"]> = { lint, ...(templateChild ? templateChildOptions(trust, group.inputs.map((input) => input.file)) : {}) };
      let members = group.inputs;
      while (members.length) {
        const report = await runChild(args.command, members, false, args, props, token, io, extra);
        if (report.reacts) {
          // More than one React in the group's process: each template again, alone, so only one that itself loads two fails.
          lateFrom(group.group, report, members);
          for (const input of members) {
            const alone = await runChild(args.command, [input], true, args, props, token, io, extra);
            settle(input, alone.results.get(input.id), alone.ended, templateChild);
            lateFrom(group.group, alone, [input]);
          }
          break;
        }
        // Past --timeout, the template the child was on fails, and the ones after it run in a new child (`unfinished`).
        const rest = unfinished(report, members);
        const ran = members.filter((input) => !rest.includes(input));
        for (const input of ran) settle(input, report.results.get(input.id), report.ended, templateChild);
        lateFrom(group.group, report, ran);
        members = rest;
      }
    }
  };

  // Where the project lists its trusted templates, a listed file given itself is loaded guarded first, in a template
  // child: a template module is checked there. One that isn't a template (a design kept beside its template, a
  // template's part) has nothing for a template child to check, and then runs as any input does, below.
  const listed = (input: Input) => !input.values && !!trust.list && trusted(input.file, trust.list);
  const listedInputs = runnable.filter(listed);
  await runGroups(listedInputs, true);
  const notTemplatesListed = listedInputs.filter((input) => notTemplates.has(input.id));
  for (const input of notTemplatesListed) {
    notTemplates.delete(input.id);
    fromTemplateChild.delete(input.id);
    outcomes.delete(input.id);
  }
  // Ordinary inputs, in ordinary children. Values files' inputs are their templates', for template children.
  await runGroups([...runnable.filter((input) => !input.values && !listed(input)), ...notTemplatesListed], false);

  // TSX template designs: each captured in a capture child, then expanded into one input per format (Decision 31).
  const expansions = new Map<number, Input[]>();
  for (const input of asideDesigns) {
    const fail = (diagnostic: Diagnostic, asUsage = false) => {
      if (asUsage) usage.add(input.id);
      outcomes.set(input.id, { file: input.display, root: null, status: "error", outputs: [], diagnostics: [diagnostic], input: "template" });
    };
    const expanded = await expandDesign(input, args, props, token, io, () => nextId++);
    if ("error" in expanded) {
      fail(expanded.error);
      continue;
    }
    if ((args.command === "outline" || args.stdout) && expanded.inputs.length > 1) {
      fail(cliDiagnostic("template-format", "error", `${input.display}'s template has ${expanded.inputs.length} formats (${expanded.inputs.map((e) => e.templateFormat).join(", ")}): ${args.stdout ? "--stdout writes one output" : "outline takes one"}, so give --template-format, or the design's format`), true);
      continue;
    }
    if (trust.list && !trusted(expanded.inputs[0].file, trust.list)) {
      fail(untrusted(displayPath(cwd, expanded.inputs[0].file), trust));
      continue;
    }
    // Its own names released, its expansion's reserved after every other input's.
    if (planned) {
      planned.release(input.id);
      const problem = expanded.inputs.map((e) => planned!.reserve(e)).find(Boolean);
      if (problem) {
        for (const e of expanded.inputs) planned.release(e.id);
        fail(cliDiagnostic("destination", "error", problem));
        continue;
      }
    }
    expansions.set(input.id, expanded.inputs);
    // Its template's folder gets loader modules too (its slots' captures): cleaned with the others.
    for (const e of expanded.inputs) state.folders.add(dirname(e.file));
  }

  // Template children: values files' inputs, template modules and designs' expansions, each template module trusted.
  const templateInputs: Input[] = [];
  for (const input of [...runnable.filter((input) => !!input.values), ...asideModules, ...[...expansions.values()].flat()]) {
    if (trust.list && !trusted(input.file, trust.list)) {
      outcomes.set(input.id, { file: input.display, root: null, status: "error", outputs: [], diagnostics: [untrusted(displayPath(cwd, input.file), trust)], ...(input.kind === "values" ? { input: "values" as const } : {}), ...(input.templateFormat ? { templateFormat: input.templateFormat } : {}) });
      continue;
    }
    templateInputs.push(input);
  }
  await runGroups(templateInputs, true);

  // Each input in order, a design's expansion where it was.
  const ordered: Input[] = inputs.flatMap((input) => expansions.get(input.id) ?? [input]);

  // --require-template: an input whose result isn't a template child's, or is another template's, fails (and writes nothing).
  if (args.requireTemplate !== undefined && (args.command === "check" || args.command === "render")) {
    for (const input of ordered) {
      const outcome = outcomes.get(input.id);
      if (!outcome) continue;
      const id = outcome.template?.id;
      if (fromTemplateChild.has(input.id) && id && (args.requireTemplate === true || id === args.requireTemplate)) continue;
      const wanted = args.requireTemplate === true ? "a template" : args.requireTemplate;
      outcome.status = "error";
      delete outcome.pending;
      outcome.formatted = undefined;
      outcome.diagnostics = [...outcome.diagnostics, cliDiagnostic("template-required", "error", id ? `It's made from ${id}, not ${wanted}` : `It isn't made from ${wanted}: --require-template takes designs a template checked (a values file, or a design whose root is the template)`, "make the design from the template: export default () => <Template … />")];
    }
  }

  // HTML emails: email-clients' renderInEmailClients(html), in this process: no template code runs for them.
  if (htmlInputs.length) {
    const probe = process.env.HYPER_ELEMENTS_CLI_PROBE ? (text: string) => io.stderr(`[probe] ${text}\n`) : undefined;
    for (const input of htmlInputs) {
      let html: string | Error;
      try {
        html = input.stdin ? await (io.stdin ? io.stdin() : readStdin()) : readFileSync(input.file, "utf8");
      } catch (error) {
        html = error instanceof Error ? error : new Error(String(error));
      }
      const result = await checkHtml(args.command as "check" | "preview", input, html, { clients: args.clients, dark: args.dark, fonts: args.fonts, probe });
      // check: lint's HTML checks too, with the copy of lint the file's folder resolves (else the CLI's own).
      if (args.command === "check" && lint && typeof html === "string" && !result.usage) {
        const linted = await lintHtmlInput(input, html, lint, probe);
        result.outcome.diagnostics = [...result.outcome.diagnostics, ...linted.diagnostics];
        if (linted.error) {
          // Beside what email-clients said, where it failed too.
          result.outcome.status = "error";
          result.outcome.error = result.outcome.error ? `${result.outcome.error}; ${linted.error}` : linted.error;
          result.usage = true;
        }
      }
      if (result.usage) usage.add(input.id);
      outcomes.set(input.id, { ...result.outcome, ...(result.previews ? { pendingPreviews: result.previews } : {}) });
    }
  }

  // Nothing left of this run's: loader modules and tsconfigs (a child that crashed leaves them).
  const own = parseToken(`// ${token}`)!;
  cleanFiles(state.folders, (owner) => !!owner && owner.host === own.host && owner.pid === own.pid && owner.random === own.random);

  // The outputs, written by this process alone.
  let stdoutText: string | Uint8Array | undefined;
  for (const input of ordered) {
    const outcome = outcomes.get(input.id)!;
    const pending = outcome.pending;
    const binary = new Set(outcome.binary ?? []);
    delete outcome.pending;
    delete outcome.binary;
    /** An output as it's written: a file's bytes (sent as base64), or text. */
    const data = (extension: string) => (binary.has(extension) ? new Uint8Array(Buffer.from(pending![extension], "base64")) : pending![extension]);
    const added = extra.get(input.id);
    if (added) outcome.diagnostics = [...outcome.diagnostics, ...added];
    // What this process adds is said after what the design's own Elements wrote (its format prefixes kept).
    if (added && outcome.formatted !== undefined) outcome.formatted = [outcome.formatted, formatDiagnostics(added)].filter(Boolean).join("\n");
    if (args.command === "preview") {
      const files = outcome.pendingPreviews;
      delete outcome.pendingPreviews;
      if (files && outcome.status === "ok") writePreviews(outcome, files, previewFolders!.get(input.id)!, cwd);
      continue;
    }
    if (!pending || outcome.status !== "ok") continue;
    if (args.command === "outline") {
      stdoutText = pending.outline.endsWith("\n") ? pending.outline : `${pending.outline}\n`;
      continue;
    }
    if (args.command !== "render") continue;
    if (args.stdout) {
      // The root's main output: an Email's or a Page's HTML, a Document's PDF, a Canvas's image (or the HTML written instead).
      const main = (RENDER_OUTPUTS[outcome.root ?? ""] ?? ["html"]).find((extension) => pending[extension] !== undefined) ?? "html";
      stdoutText = data(main);
      continue;
    }
    const paths = planned!.byInput.get(input.id)!;
    for (const extension of RENDER_OUTPUTS[outcome.root ?? ""] ?? []) {
      if (pending[extension] === undefined) continue;
      try {
        writeAtomically(paths[extension], data(extension));
        outcome.outputs.push(displayPath(cwd, paths[extension]));
      } catch (error) {
        outcome.status = "error";
        outcome.error = `couldn't write ${displayPath(cwd, paths[extension])}: ${errorLine(error)}`;
        break;
      }
    }
  }

  const all = ordered.map((input) => outcomes.get(input.id)!);

  // preview --findings: each written preview drawn in a browser (no browser found: exit 2, the files still written).
  let noBrowser = false;
  if (args.command === "preview" && args.findings && all.some((outcome) => outcome.previews?.length)) {
    const drawn = await drawPreviews(all, { cwd, screenshots: args.screenshots, stderr: io.stderr });
    if (!drawn.browser) {
      noBrowser = true;
      io.stderr(`hyper-elements: ${drawn.missing ? NO_PLAYWRIGHT_CORE_HELP : (drawn.bun ?? NO_BROWSER_HELP)}\n${(drawn.tried ?? []).map((tried) => `  - ${tried}\n`).join("")}`);
    }
  }

  const errors = all.filter((o) => o.status === "error").length;
  const warnings = all.reduce((n, o) => n + o.diagnostics.filter((d) => d.severity === "warning").length, 0);
  const skipped = all.filter((o) => o.status === "skipped").length;
  // No input turned out to be a template (each a module whose default export isn't one): the run had nothing to do.
  const none = ordered.length > 0 && ordered.every((input) => notTemplates.has(input.id));
  if (none) {
    const which = ordered.length === 1 ? "the input isn't one" : `none of the ${ordered.length} inputs is one`;
    io.stderr(`hyper-elements: no designs: ${which} (a design file is a module whose default export is a component that renders an Email, a Page, a Document or a Canvas).\n`);
  }
  const exitCode: 0 | 1 | 2 = usage.size || late.length || noBrowser || none ? 2 : errors || (args.maxWarnings !== undefined && warnings > args.maxWarnings) ? 1 : 0;
  const summary: SummaryLine = { version: 1, summary: { templates: all.length, errors, warnings, skipped, late }, exitCode };

  // preview --serve: the previews served until Ctrl-C (exit 0), their URLs written, and no summary.
  if (args.command === "preview" && args.serve && all.some((outcome) => outcome.previews?.length)) {
    const base = await servePreviews(all, clientsFolder(args.out, cwd), cwd);
    if (args.json) await io.stdout(all.map((outcome) => `${JSON.stringify(inputLine(args.command, outcome))}\n`).join(""));
    else await io.stdout(all.map(inputText).join("") + `Serving the previews at ${base} until Ctrl-C\n`);
    state.serving = true;
    return new Promise<number>(() => undefined);
  }

  if (args.json) {
    await io.stdout(all.map((outcome) => `${JSON.stringify(inputLine(args.command, outcome))}\n`).join("") + `${JSON.stringify(summary)}\n`);
  } else if (args.command === "outline" || args.stdout) {
    // stdout holds the outline or the HTML alone; what the run says goes to stderr.
    const said = all.filter((outcome) => args.command !== "outline" || outcome.status !== "ok" || outcome.diagnostics.length).map(inputText).join("");
    if (said) io.stderr(said);
    if (args.command !== "outline" || exitCode !== 0) io.stderr(summaryText(summary));
    if (stdoutText !== undefined) await io.stdout(stdoutText);
  } else {
    await io.stdout(all.map(inputText).join("") + summaryText(summary, htmlInputs.length ? (templates.length ? "input" : "email") : "design"));
  }
  if (args.maxWarnings !== undefined && warnings > args.maxWarnings && !args.json) {
    io.stderr(`✗ ${warnings} warnings, more than --max-warnings ${args.maxWarnings}\n`);
  }
  return exitCode;
}
