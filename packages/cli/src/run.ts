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
import { planDestinations, removeTemporaries, writeAtomically, type Planned } from "./destinations";
import { errorLine } from "./errors";
import { displayPath, findInputs, moduleFormat, packageFolder, typeScriptTwin, type Input } from "./inputs";
import { killTree } from "./kill";
import { cleanFiles, ownToken, parseToken, stale } from "./loader-module";
import { inputLine, inputText, summaryText, type Outcome } from "./output";
import type { ChildMessage, Diagnostic, Group, Late, ResultMessage, StartMessage, SummaryLine } from "./protocol";

export interface Io {
  cwd: string;
  /** Resolves once written (and flushed, for a pipe). */
  stdout(data: string | Uint8Array): Promise<void>;
  stderr(text: string): void;
}

const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";

/** The children running, for an interrupt to end. */
const running = new Set<ChildProcess>();

interface GroupRun {
  key: string;
  group: Group;
  inputs: Input[];
}

interface ChildReport {
  results: Map<number, ResultMessage>;
  reacts: boolean;
  done: boolean;
  late: string[];
  /** How it ended, where it ended before `done`. */
  ended?: { reason: "exit" | "signal" | "timeout"; detail: string; error: string };
}

let children = 0;
/** When the run started: `--refresh` fetches what was cached before it. */
let runStarted = Date.now();

/** Starts a child for `inputs` and resolves once it has ended and been cleaned up after. */
function runChild(command: Args["command"], inputs: Input[], alone: boolean, args: Args, props: Record<string, unknown> | undefined, token: string, io: Io): Promise<ChildReport> {
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
    const child = fork(fileURLToPath(new URL("./child.js", import.meta.url)), [], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      // A process group of its own, so the child and every process it starts can be ended together (macOS, Linux).
      detached: process.platform !== "win32",
      execArgv: [],
      cwd: io.cwd,
    });
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
      // The group outlives its leader while any of its processes is alive.
      if (child.pid) killTree(child.pid);
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
        resolvePromise(report);
      };
      child.once("close", done);
      setTimeout(done, 500).unref();
    };
    child.on("exit", (code, signal) => finish(code, signal));
    child.on("error", (error) => finish(null, null, error));
    child.send(message);
  });
}

function readProps(path: string, cwd: string): Record<string, unknown> {
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
  const found = await findInputs(args.positional, cwd);
  const { inputs } = found;
  if (args.command === "outline" && inputs.length !== 1) throw new UsageError(`outline takes one template; ${args.positional[0]} holds ${inputs.length}.`);
  if (args.stdout && inputs.length !== 1) throw new UsageError(`--stdout writes one template's output: this run has ${inputs.length} templates.`);
  for (const link of found.links) io.stderr(`- ${displayPath(cwd, link)}: a symbolic link to a folder, not followed (give the folder itself to include what's in it)\n`);
  let planned: Planned | undefined;
  if (args.command === "render" && !args.stdout) planned = planDestinations(inputs, found.base, args.out, cwd, ALL_RENDER_OUTPUTS);

  const token = ownToken();
  state.token = token;
  for (const input of inputs) state.folders.add(dirname(input.file));

  const outcomes = new Map<number, Outcome & { pending?: Record<string, string>; binary?: string[] }>();
  const usage = new Set<number>();
  const extra = new Map<number, Diagnostic[]>();
  const note = (id: number, diagnostic: Diagnostic) => extra.set(id, [...(extra.get(id) ?? []), diagnostic]);

  // What earlier runs left (killed before they cleaned up): only files their tokens prove a CLI run on this host made,
  // for a process that isn't running.
  const firstIn = new Map<string, number>();
  for (const input of inputs) if (!firstIn.has(dirname(input.file))) firstIn.set(dirname(input.file), input.id);
  for (const problem of cleanFiles(state.folders, (owner) => stale(owner))) {
    note(firstIn.get(problem.folder) ?? inputs[0].id, cliDiagnostic("cleanup", "warning", `Couldn't delete ${displayPath(cwd, problem.file)}, left by an earlier run: ${problem.message}`));
  }

  // A JavaScript template beside its TypeScript twin: tsx would load the twin for it.
  const runnable: Input[] = [];
  for (const input of inputs) {
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
      outcomes.set(input.id, { file: input.display, root: result.root, status: result.status, outputs: [], diagnostics: result.diagnostics, formatted: result.formatted, error: result.error, pending: result.outputs, binary: result.binary });
      return;
    }
    if (ended?.reason === "timeout") {
      outcomes.set(input.id, {
        file: input.display,
        root: null,
        status: "error",
        outputs: [],
        diagnostics: [cliDiagnostic("timeout", "error", `Its group of templates didn't finish within ${args.timeout} ms: the process running it was ended`, "make the template finish sooner, or give a longer --timeout")],
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
    const report = await runChild(args.command, group.inputs, false, args, props, token, io);
    if (report.reacts) {
      // More than one React in the group's process: each template again, alone, so only one that itself loads two fails.
      lateFrom(group.group, report, group.inputs);
      for (const input of group.inputs) {
        const alone = await runChild(args.command, [input], true, args, props, token, io);
        settle(input, alone.results.get(input.id), alone.ended);
        lateFrom(group.group, alone, [input]);
      }
      continue;
    }
    for (const input of group.inputs) settle(input, report.results.get(input.id), report.ended);
    lateFrom(group.group, report, group.inputs);
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
  const errors = all.filter((o) => o.status === "error").length;
  const warnings = all.reduce((n, o) => n + o.diagnostics.filter((d) => d.severity === "warning").length, 0);
  const skipped = all.filter((o) => o.status === "skipped").length;
  const exitCode: 0 | 1 | 2 = usage.size || late.length ? 2 : errors || (args.maxWarnings !== undefined && warnings > args.maxWarnings) ? 1 : 0;
  const summary: SummaryLine = { version: 1, summary: { templates: all.length, errors, warnings, skipped, late }, exitCode };

  if (args.json) {
    await io.stdout(all.map((outcome) => `${JSON.stringify(inputLine(args.command, outcome))}\n`).join("") + `${JSON.stringify(summary)}\n`);
  } else if (args.command === "outline" || args.stdout) {
    // stdout holds the outline or the HTML alone; what the run says goes to stderr.
    const said = all.filter((outcome) => args.command !== "outline" || outcome.status !== "ok" || outcome.diagnostics.length).map(inputText).join("");
    if (said) io.stderr(said);
    if (args.command !== "outline" || exitCode !== 0) io.stderr(summaryText(summary));
    if (stdoutText !== undefined) await io.stdout(stdoutText);
  } else {
    await io.stdout(all.map(inputText).join("") + summaryText(summary));
  }
  if (args.maxWarnings !== undefined && warnings > args.maxWarnings && !args.json) {
    io.stderr(`✗ ${warnings} warnings, more than --max-warnings ${args.maxWarnings}\n`);
  }
  return exitCode;
}
