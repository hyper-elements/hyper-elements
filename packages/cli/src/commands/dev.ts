/**
 * `dev`: a page on 127.0.0.1 showing each template, rendered again when the project changes, until Ctrl-C (exit 0, no
 * summary).
 *
 * Each change runs `render`'s groups (a child process per package and tsconfig, on the runtime the CLI was started
 * with) in fresh processes: every import is fresh, a template that loops or leaks ends with its child (`--timeout`
 * applies), and template code never runs in this process, which alone holds the server. The groups run at once (a
 * few at a time), each child started ahead of the change (run.ts's spares: a process that has loaded only the CLI's
 * own modules), so a change is shown as soon as the slowest group is done. The children send what they render
 * (dev/worker.ts); this process writes it in a temporary folder of its own (removed on exit), which the server serves
 * (dev/server.ts). The watcher (dev/watcher.ts) calls for a render after 100 ms of quiet; a render that's still running
 * then is ended, as its results are already out of date.
 */
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { projectConfig } from "@hyper-elements/template-loader";
import { UsageError, type Args } from "../args";
import { serveDev } from "../dev/server";
import { watchRoots, Watcher } from "../dev/watcher";
import { errorLine } from "../errors";
import { displayPath, findInputs, packageFolder, typeScriptTwin, type Input } from "../inputs";
import { cleanFiles, ownToken, parseToken, stale } from "../loader-module";
import { inputText, type Outcome } from "../output";
import type { Diagnostic, Group, Late, ResultMessage, Root } from "../protocol";
import { keepSpareChildren, readProps, runChild, unfinished, type ChildReport, type Io, type RunState } from "../run";
import { cliDiagnostic } from "./shared";

/** How long the project must be quiet before a render: a source change and the rebuild after it are each picked up. */
export const QUIET_MS = 100;
/** How many groups render at once. */
const PARALLEL = 4;

/** One template, as the page reads it. URLs are relative to the page. */
export interface DevTemplate {
  file: string;
  root: Root | null;
  status: "ok" | "error" | "skipped";
  error?: string;
  diagnostics: Diagnostic[];
  /** What was rendered, by extension (`html`, `txt`, `pdf`, `png`, `svg`). */
  files: Record<string, string>;
  /** An Email's previews in the email clients, where the project has @hyper-elements/email-clients. */
  previews: Array<{ id: string; client: string; url: string }>;
}

export interface DevState {
  /** Renders finished. */
  version: number;
  rendering: boolean;
  /** Why there's nothing to render (a folder with no template left, a file removed). */
  error: string | null;
  templates: DevTemplate[];
  late: Late[];
  /** How long the last render took. */
  ms: number;
  /** What changed for this render: the paths the watcher saw change (relative, with `/`); none for the first. */
  changed: string[];
  /** The last renders, oldest first: each one's version and what changed for it. */
  history: Array<{ version: number; changed: string[] }>;
}

/** A render's state, before what changed for it is added. */
type Rendered = Omit<DevState, "changed" | "history">;

/** How many renders `history` keeps. */
const HISTORY = 50;

/** The URL path of a file in `root`, relative to the page. */
const urlOf = (root: string, file: string) => relative(root, file).split(sep).map(encodeURIComponent).join("/");

export async function runDev(args: Args, io: Io, state: RunState): Promise<number> {
  const { cwd } = io;
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
  // What's given is checked once, as `render` checks it (a missing file, a folder with no template: exit 2).
  const first = await findInputs(args.positional, cwd);
  for (const link of first.links) io.stderr(`- ${displayPath(cwd, link)}: a symbolic link to a folder, not followed (give the folder itself to include what's in it)\n`);

  // The folder the server serves: this process's alone, gone when it exits.
  const folder = realpathSync(mkdtempSync(join(tmpdir(), "hyper-elements-dev-")));
  process.on("exit", () => rmSync(folder, { recursive: true, force: true }));
  const token = ownToken();
  state.token = token;
  const own = parseToken(`// ${token}`)!;
  const mine = (owner: ReturnType<typeof parseToken>) => !!owner && owner.host === own.host && owner.pid === own.pid && owner.random === own.random;

  let server: Awaited<ReturnType<typeof serveDev>>;
  try {
    server = await serveDev(folder, args.port);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (args.port !== undefined && (code === "EADDRINUSE" || code === "EACCES")) {
      throw new UsageError(`--port ${args.port} ${code === "EADDRINUSE" ? "is in use" : "can't be opened by this user"}: give another, or leave --port out for a free one.`);
    }
    throw error;
  }
  let current: DevState = { version: 0, rendering: true, error: null, templates: [], late: [], ms: 0, changed: [], history: [] };
  server.publish(current);
  state.serving = true;
  await io.stdout(`Serving the templates at ${server.base} until Ctrl-C\n`);

  const extra = {
    public: args.public === undefined ? undefined : resolve(cwd, args.public),
    offline: args.offline || undefined,
    dark: args.dark || undefined,
    fonts: args.fonts,
  };

  /** One render of every template: undefined where a newer change ended it. */
  const render = async (n: number, abort: AbortSignal): Promise<Rendered | undefined> => {
    const started = Date.now();
    let inputs: Input[];
    try {
      inputs = (await findInputs(args.positional, cwd)).inputs;
    } catch (error) {
      // Nothing to render now (a template removed): said on the page, and the watcher keeps watching.
      return { version: n, rendering: false, error: error instanceof UsageError ? error.message : errorLine(error), templates: [], late: [], ms: Date.now() - started };
    }
    watcher.update(watchRoots(inputs.map((input) => input.file)));
    for (const input of inputs) state.folders.add(dirname(input.file));
    // What earlier runs left (killed before they cleaned up), as `render` deletes it.
    cleanFiles(state.folders, (owner) => stale(owner));

    const outcomes = new Map<number, Outcome & { pending?: ResultMessage }>();
    const groups = new Map<string, { group: Group; inputs: Input[] }>();
    for (const input of inputs) {
      const twin = typeScriptTwin(input.file);
      if (twin) {
        outcomes.set(input.id, {
          file: input.display,
          root: null,
          status: "error",
          outputs: [],
          diagnostics: [cliDiagnostic("ts-twin", "error", `${input.display} has a TypeScript twin, ${displayPath(cwd, twin)}: an import of the JavaScript file loads the TypeScript one, so this template can't be loaded as itself`, "rename one of the two files")],
        });
        continue;
      }
      const pkg = packageFolder(dirname(input.file));
      const config = projectConfig(dirname(input.file)) ?? null;
      const key = `${pkg ?? ""}\0${config ?? ""}`;
      let group = groups.get(key);
      if (!group) {
        group = { group: { package: pkg === null ? null : displayPath(cwd, pkg), tsconfig: config === null ? null : displayPath(cwd, config) }, inputs: [] };
        groups.set(key, group);
      }
      group.inputs.push(input);
    }

    const late: Late[] = [];
    const settle = (input: Input, result: ResultMessage | undefined, ended: ChildReport["ended"]) => {
      if (result) {
        outcomes.set(input.id, { file: input.display, root: result.root, status: result.status, outputs: [], diagnostics: result.diagnostics, formatted: result.formatted, error: result.error, pending: result });
      } else if (ended?.reason === "timeout") {
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
    const lateFrom = (group: Group, report: ChildReport, inputs: Input[]) => {
      for (const message of report.late) late.push({ kind: "throw", group, message });
      if (!report.done && report.ended && !report.reacts && inputs.every((input) => report.results.has(input.id))) {
        late.push({ kind: "child", group, reason: report.ended.reason, detail: report.ended.detail });
      }
    };
    const runGroup = async ({ group, inputs }: { group: Group; inputs: Input[] }) => {
      let members = inputs;
      while (members.length) {
        if (abort.aborted) return;
        const report = await runChild("dev", members, false, args, props, token, io, extra, abort);
        if (report.reacts) {
          // More than one React in the group's process: each template again, alone, as `render` does.
          lateFrom(group, report, members);
          for (const input of members) {
            if (abort.aborted) return;
            const alone = await runChild("dev", [input], true, args, props, token, io, extra, abort);
            settle(input, alone.results.get(input.id), alone.ended);
            lateFrom(group, alone, [input]);
          }
          return;
        }
        // Past --timeout, the template the child was on fails, and the ones after it run in a new child, as `render`'s.
        const rest = unfinished(report, members);
        const ran = members.filter((input) => !rest.includes(input));
        for (const input of ran) settle(input, report.results.get(input.id), report.ended);
        lateFrom(group, report, ran);
        members = rest;
      }
    };
    // The groups at once (a few at a time), each in its own child, so a change is shown as soon as the slowest is done.
    const queue = [...groups.values()];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await runGroup(next);
    };
    try {
      await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));
    } finally {
      // Loader modules and tsconfigs a child ended early left.
      cleanFiles(state.folders, mine);
    }
    // As many children started ahead of the next change as this one had groups.
    keepSpareChildren(cwd, Math.max(1, Math.min(PARALLEL, groups.size)));
    if (abort.aborted) return undefined;

    // What each child sent, written in this render's own folder (the last one's stays until this one's is shown).
    const out = join(folder, String(n));
    const templates: DevTemplate[] = [];
    for (const input of inputs) {
      const outcome = outcomes.get(input.id)!;
      const result = outcome.pending;
      const template: DevTemplate = { file: outcome.file, root: outcome.root, status: outcome.status, diagnostics: outcome.diagnostics, files: {}, previews: [], ...(outcome.error !== undefined ? { error: outcome.error } : {}) };
      templates.push(template);
      if (!result) continue;
      const dir = join(out, String(input.id));
      const name = input.real.split(sep).pop()!.replace(/\.[^.]+$/, "");
      const binary = new Set(result.binary ?? []);
      try {
        for (const [extension, data] of Object.entries(result.outputs ?? {})) {
          const file = join(dir, `${name}.${extension}`);
          mkdirSync(dir, { recursive: true });
          writeFileSync(file, binary.has(extension) ? Buffer.from(data, "base64") : data);
          template.files[extension] = urlOf(folder, file);
        }
        for (const preview of result.previews ?? []) {
          const file = join(dir, "clients", preview.filename);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, preview.html);
          template.previews.push({ id: preview.id, client: preview.client, url: urlOf(folder, file) });
        }
      } catch (error) {
        template.status = "error";
        template.error = `couldn't write ${file(error)}: ${errorLine(error)}`;
      }
    }
    return { version: n, rendering: false, error: null, templates, late, ms: Date.now() - started };
  };

  /** Renders until no change is waiting; a change while one runs ends it and starts again. */
  let wanted = true;
  let looping = false;
  let controller: AbortController | undefined;
  let renders = 0;
  const loop = async () => {
    looping = true;
    while (wanted) {
      wanted = false;
      controller = new AbortController();
      if (!current.rendering) {
        current = { ...current, rendering: true };
        server.publish(current);
      }
      // What changed for this render; a render a newer change ends gives what it was for to the next.
      const cause = [...changes];
      changes.clear();
      let next: Rendered | undefined;
      try {
        next = await render(renders + 1, controller.signal);
      } catch (error) {
        next = { version: renders + 1, rendering: false, error: `The render stopped: ${errorLine(error)}`, templates: [], late: [], ms: 0 };
      }
      if (!next || controller.signal.aborted) {
        for (const path of cause) changes.add(path);
        continue;
      }
      renders++;
      const changed = cause.map((path) => displayPath(cwd, path));
      current = { ...next, version: renders, rendering: wanted, changed, history: [...current.history, { version: renders, changed }].slice(-HISTORY) };
      server.publish(current);
      report(current);
      // Older renders' files: the page has this one's.
      for (const name of readdirSync(folder)) if (Number(name) < renders - 1) rmSync(join(folder, name), { recursive: true, force: true });
    }
    looping = false;
    if (current.rendering) {
      current = { ...current, rendering: false };
      server.publish(current);
    }
  };
  const request = () => {
    wanted = true;
    controller?.abort();
    if (!looping) void loop();
  };
  /** What a render says in the terminal: each template with a problem, and a line. */
  const report = (shown: DevState) => {
    if (shown.error) return io.stderr(`✗ ${shown.error}\n`);
    const said = shown.templates.filter((t) => t.status === "error" || t.diagnostics.some((d) => d.severity !== "info"));
    const errors = shown.templates.filter((t) => t.status === "error").length;
    io.stderr(
      said.map((t) => inputText({ file: t.file, root: t.root, status: t.status, outputs: [], diagnostics: t.diagnostics, ...(t.error !== undefined ? { error: t.error } : {}) })).join("") +
        `Rendered ${shown.templates.length} template${shown.templates.length === 1 ? "" : "s"} in ${shown.ms} ms${errors ? `: ${errors} with errors` : ""}${after(shown.changed)}\n`,
    );
  };

  let quiet: NodeJS.Timeout | undefined;
  /** The paths changed since the last render started. */
  const changes = new Set<string>();
  const watcher = new Watcher((path) => {
    changes.add(path);
    clearTimeout(quiet);
    quiet = setTimeout(request, QUIET_MS);
  });
  watcher.update(watchRoots(first.inputs.map((input) => input.file)));
  keepSpareChildren(cwd, 1);
  request();
  return new Promise<number>(() => undefined);
}

/** What changed for a render, as the terminal says it: `, after a change to src/word.ts` (three named at most). */
function after(changed: string[]): string {
  if (!changed.length) return "";
  const named = changed.slice(0, 3).join(", ");
  return `, after a change to ${named}${changed.length > 3 ? ` and ${changed.length - 3} more` : ""}`;
}

/** The path a write failed on, as the error names it. */
function file(error: unknown): string {
  return (error as NodeJS.ErrnoException)?.path ?? "a file";
}
