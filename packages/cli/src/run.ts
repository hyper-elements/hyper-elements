/**
 * The parent process: it finds the inputs, groups them by package and tsconfig, runs each group in a child process
 * of its own (one after another), writes every output file, and alone writes stdout. Children's stdout and stderr
 * are copied to its stderr. A child is ended, with every process in its group, however it ends: when it says it's
 * done, when it runs past `--timeout`, when it exits or crashes, and when the run is interrupted.
 */
import { fork, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectConfig } from "@unlayer-internal/template-loader";
import { UsageError, type Args } from "./args";
import { ALL_RENDER_OUTPUTS, RENDER_OUTPUTS } from "./commands/render";
import { cliDiagnostic } from "./commands/shared";
import { outputBase, planDestinations, removeTemporaries, writeAtomically, type Planned } from "./destinations";
import { errorLine } from "./errors";
import { checkHtml, readStdin } from "./html";
import { displayPath, findInputs, moduleFormat, packageFolder, typeScriptTwin, type Input } from "./inputs";
import { endOrphans, killTree } from "./kill";
import { cleanFiles, ownToken, parseToken, stale } from "./loader-module";
import { inputLine, inputText, summaryText, type Outcome } from "./output";
import { clientsFolder, drawPreviews, NO_BROWSER_HELP, NO_PLAYWRIGHT_CORE_HELP, planPreviewFolders, servePreviews, writePreviews } from "./preview";
import type { ChildMessage, Diagnostic, Group, Late, PreviewFile, ResultMessage, StartMessage, SummaryLine } from "./protocol";

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
  let tsconfig: string | null = null;
  if (!bun) {
    for (let n = 0; ; n++) {
      const candidate = join(tmpdir(), `hyper-elements-cli-tsconfig-${process.pid}-${index}${n ? `${n}` : ""}.json`);
      if (!existsSync(candidate)) {
        tsconfig = candidate;
        break;
      }
    }
  }
  const message: StartMessage = {
    type: "start",
    command,
    inputs: inputs.map((input) => ({ id: input.id, file: input.file, format: moduleFormat(input.file) })),
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
      ...(command === "render"
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
    // Decoded as streams, so a character split between two chunks comes through whole.
    const copy = (text: string) => io.stderr(text);
    child.stdout!.setEncoding("utf8").on("data", copy);
    child.stderr!.setEncoding("utf8").on("data", copy);
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
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UsageError(`--props ${path} must hold a JSON object, the template's props.`);
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
  const found = await findInputs(args.positional, cwd, undefined, { html: args.command === "check" || args.command === "preview" });
  const { inputs } = found;
  // HTML emails run in this process (no template code, no loader module); templates in children.
  const templates = inputs.filter((input) => input.kind !== "html");
  const htmlInputs = inputs.filter((input) => input.kind === "html");
  if (args.command === "outline" && inputs.length !== 1) throw new UsageError(`outline takes one template; ${args.positional[0]} holds ${inputs.length}.`);
  if (args.stdout && inputs.length !== 1) throw new UsageError(`--stdout writes one template's output: this run has ${inputs.length} templates.`);
  for (const link of found.links) io.stderr(`- ${displayPath(cwd, link)}: a symbolic link to a folder, not followed (give the folder itself to include what's in it)\n`);
  let planned: Planned | undefined;
  // Outputs keep their path relative to the current folder (or --base), whatever else is given with them.
  const base = (args.command === "render" && !args.stdout) || args.command === "preview" ? outputBase(inputs, cwd, args.base) : cwd;
  if (args.command === "render" && !args.stdout) planned = planDestinations(inputs, base, args.out, cwd, ALL_RENDER_OUTPUTS);
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

  // Groups: by package, then by tsconfig.
  const groups = new Map<string, GroupRun>();
  for (const input of runnable) {
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

  const late: Late[] = [];
  const settle = (input: Input, result: ResultMessage | undefined, ended: ChildReport["ended"]) => {
    if (result) {
      if (result.usage) usage.add(input.id);
      if (result.notTemplate) notTemplates.add(input.id);
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
        diagnostics: [cliDiagnostic("timeout", "error", `It didn't finish within ${args.timeout} ms: the process running it was ended (the templates after it ran in a new one)`, "make the template finish sooner, or give a longer --timeout")],
      });
    } else {
      outcomes.set(input.id, { file: input.display, root: null, status: "error", outputs: [], diagnostics: [], error: ended?.error || "child ended before this template's result" });
    }
  };
  /** What a child left for the summary: late throws, and a child that ended badly after sending every result. */
  const lateFrom = (group: Group, report: ChildReport, inputs: Input[]) => {
    for (const message of report.late) late.push({ kind: "throw", group, message });
    if (!report.done && report.ended && !report.reacts && inputs.every((input) => report.results.has(input.id))) {
      late.push({ kind: "child", group, reason: report.ended.reason, detail: report.ended.detail });
    }
  };

  for (const group of groups.values()) {
    let members = group.inputs;
    while (members.length) {
      const report = await runChild(args.command, members, false, args, props, token, io);
      if (report.reacts) {
        // More than one React in the group's process: each template again, alone, so only one that itself loads two fails.
        lateFrom(group.group, report, members);
        for (const input of members) {
          const alone = await runChild(args.command, [input], true, args, props, token, io);
          settle(input, alone.results.get(input.id), alone.ended);
          lateFrom(group.group, alone, [input]);
        }
        break;
      }
      // Past --timeout, the template the child was on fails, and the ones after it run in a new child (`unfinished`).
      const rest = unfinished(report, members);
      const ran = members.filter((input) => !rest.includes(input));
      for (const input of ran) settle(input, report.results.get(input.id), report.ended);
      lateFrom(group.group, report, ran);
      members = rest;
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
      if (result.usage) usage.add(input.id);
      outcomes.set(input.id, { ...result.outcome, ...(result.previews ? { pendingPreviews: result.previews } : {}) });
    }
  }

  // Nothing left of this run's: loader modules and tsconfigs (a child that crashed leaves them).
  const own = parseToken(`// ${token}`)!;
  cleanFiles(state.folders, (owner) => !!owner && owner.host === own.host && owner.pid === own.pid && owner.random === own.random);

  // The outputs, written by this process alone.
  let stdoutText: string | Uint8Array | undefined;
  for (const input of inputs) {
    const outcome = outcomes.get(input.id)!;
    const pending = outcome.pending;
    const binary = new Set(outcome.binary ?? []);
    delete outcome.pending;
    delete outcome.binary;
    /** An output as it's written: a file's bytes (sent as base64), or text. */
    const data = (extension: string) => (binary.has(extension) ? new Uint8Array(Buffer.from(pending![extension], "base64")) : pending![extension]);
    const added = extra.get(input.id);
    if (added) outcome.diagnostics = [...outcome.diagnostics, ...added];
    if (added && outcome.formatted !== undefined) outcome.formatted = undefined;
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

  const all = inputs.map((input) => outcomes.get(input.id)!);

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
  const none = inputs.length > 0 && inputs.every((input) => notTemplates.has(input.id));
  if (none) {
    const which = inputs.length === 1 ? "the input isn't one" : `none of the ${inputs.length} inputs is one`;
    io.stderr(`hyper-elements: no templates: ${which} (a template is a module whose default export is a component that renders an Email, a Page, a Document or a Canvas).\n`);
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
    await io.stdout(all.map(inputText).join("") + summaryText(summary, htmlInputs.length ? (templates.length ? "input" : "email") : "template"));
  }
  if (args.maxWarnings !== undefined && warnings > args.maxWarnings && !args.json) {
    io.stderr(`✗ ${warnings} warnings, more than --max-warnings ${args.maxWarnings}\n`);
  }
  return exitCode;
}
