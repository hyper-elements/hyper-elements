/**
 * A child process: it loads, renders and checks one group's templates (one package, one tsconfig) and sends each
 * input's result to the parent over IPC, outputs included; the parent alone writes files and stdout. Its own stdout
 * and stderr are pipes the parent copies to its stderr, so nothing a template writes reaches the parent's stdout.
 *
 * On Node, tsx is registered once, for the group's tsconfig (one tsconfig per process: tsx's registers share one
 * config). On Bun, which compiles TSX and reads the template's tsconfig itself, nothing is registered.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { defaultExport, guard, projectTsconfig, templateComponent } from "@hyper-elements/template-loader";
import { checkTemplate } from "./commands/check";
import { inspectTemplate } from "./commands/inspect";
import { previewTemplate } from "./commands/preview";
import { outlineTemplate } from "./commands/outline";
import { renderTemplate } from "./commands/render";
import { devTemplate } from "./dev/worker";
import { cliDiagnostic, elementsErrorDiagnostics, hasErrors, UsageFailure, type CommandResult, type TemplateContext } from "./commands/shared";
import { ELEMENTS_RANGE, exportsOf, packageVersion, resolvedPath, supported, type ElementsInspect, type ElementsMain, type EmailClientsModule, type ReactModule } from "./elements";
import { errorLine, errorText, messageOf, notFound } from "./errors";
import { formatDiagnostic } from "./format";
import { packageFolder } from "./inputs";
import { elementsLoaderText, loaderModulePath, loaderModuleText, parseToken } from "./loader-module";
import type { ChildInput, ChildMessage, Diagnostic, ResultMessage, Root, StartMessage } from "./protocol";
import { killTree } from "./kill";
import { isOptionsError, LINT, lintUsage, ownLint, type LintCopy, type LintModule } from "./lint";
import { importFinds, installedAbove } from "./packages";
import { parentGone } from "./parent";
import { reactCopies } from "./react-copies";

const guarded = guard();
const bun = typeof (process.versions as Record<string, string | undefined>).bun === "string";
const ROOTS = new Set(["Email", "Page", "Document", "Canvas"]);
const ELEMENT = new Set([Symbol.for("react.element"), Symbol.for("react.transitional.element")]);

function send(message: ChildMessage): Promise<void> {
  return new Promise((resolve) => {
    if (!process.send) return resolve();
    process.send(message, undefined, {}, () => resolve());
  });
}

const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// On Node, what every group loads before its templates (tsx's register, and TypeScript for the group's tsconfig) starts
// loading now, while the child waits for its start message (`dev` starts one ahead of the next change).
if (!bun) {
  void import("typescript").catch(() => undefined);
  void import("tsx/esm/api").catch(() => undefined);
}

/** The files this child wrote beside the templates (loader modules, a tsconfig): removed when it's done. */
const written = new Set<string>();

/**
 * The parent's gone without ending this child (it was killed, or on Windows ended by another process, which leaves its
 * children running): there's nothing to report to. The child removes what it wrote and ends with every process it
 * started, its group (on Windows, its tree), as the parent would have ended them. A child whose template blocks it
 * is ended the same way by its watchdog.
 */
function orphaned(): never {
  for (const file of written) {
    try {
      rmSync(file, { force: true });
    } catch {
      // the next run removes it (it carries this run's token)
    }
  }
  killTree(process.pid);
  return guarded.exit(0);
}

// Its end of the channel closes; and in case that's never said (a spare waits with nothing else to do), the parent's
// checked every 500 ms.
const parent = process.ppid;
process.on("disconnect", orphaned);
setInterval(() => {
  if (parentGone(parent)) orphaned();
}, 500).unref();

process.once("message", (message: StartMessage) => {
  start(message).catch(async (error) => {
    // A failure of the child itself, not of a template: the parent reports the inputs it didn't get.
    process.stderr.write(`hyper-elements: the child process failed: ${errorLine(error)}\n`);
    guarded.exit(70);
  });
});

async function start(message: StartMessage): Promise<void> {
  const worker = new Worker(new URL("./watchdog.js", import.meta.url), {
    workerData: { parent: process.ppid, pid: process.pid, deadline: message.deadline },
  });
  worker.unref();
  const cleanups: Diagnostic[] = [];
  if (!bun && message.tsconfig) {
    const folders = [...new Set(message.inputs.map((input) => dirname(input.file)))];
    const config = await projectTsconfig(message.inputs[0].file, { cwd: message.cwd, include: folders, file: message.tsconfig, header: message.token });
    written.add(config.file);
    const { register } = await import("tsx/esm/api");
    register({ tsconfig: config.file });
    if (message.inputs.some((input) => input.format === "cjs")) {
      // tsx's CommonJS register reads its tsconfig only from this variable, when it registers.
      const previous = process.env.TSX_TSCONFIG_PATH;
      process.env.TSX_TSCONFIG_PATH = config.file;
      try {
        (await import("tsx/cjs/api")).register();
      } finally {
        if (previous === undefined) delete process.env.TSX_TSCONFIG_PATH;
        else process.env.TSX_TSCONFIG_PATH = previous;
      }
    }
  }
  const session = new Session(message, written);
  for (const input of message.inputs) {
    const result = await session.run(input);
    if (result === "reacts") {
      await send({ type: "reacts" });
      break;
    }
    await send(result);
  }
  // What a template scheduled (a timer, a promise it didn't wait for) has two turns to throw.
  await turn();
  await turn();
  for (const file of written) {
    try {
      rmSync(file, { force: true });
    } catch (error) {
      cleanups.push(cliDiagnostic("cleanup", "warning", `Couldn't delete ${file}: ${errorLine(error)}`));
    }
  }
  if (cleanups.length) process.stderr.write(cleanups.map((d) => `warning ${d.code}: ${d.message}\n`).join(""));
  await send({ type: "done", late: guarded.late() });
}

/** Elements' entries, email-clients and lint, as loaded for one template (each template loads its own). */
interface Loaded {
  elements: ElementsMain;
  inspect: ElementsInspect;
  react: ReactModule;
  emailClients?: EmailClientsModule;
  /** The project's copy of lint, else the CLI's own: where the command lints (render, check, dev, without --no-lint). */
  lint?: LintCopy<LintModule>;
}

class Session {
  private sequence: number;
  /** email-clients' plugin, per copy of email-clients and set of clients. */
  private plugins = new Map<unknown, Promise<unknown>>();
  /** lint's plugin, per copy of lint (the options are the run's). */
  private linters = new Map<unknown, unknown>();

  constructor(
    private message: StartMessage,
    private written: Set<string>,
  ) {
    this.sequence = message.sequence;
  }

  private result(input: ChildInput, fields: Partial<ResultMessage> & Pick<ResultMessage, "status">, loaded?: Loaded): ResultMessage {
    const diagnostics = fields.diagnostics ?? [];
    let formatted: string | undefined;
    try {
      // Each by the template's Elements, but one at no path (the CLI's own) by the CLI, which says no place for it.
      formatted = loaded ? diagnostics.map((d) => (d.path ? loaded.elements.formatDiagnostics([d]) : formatDiagnostic(d))).join("\n") : undefined;
    } catch {
      formatted = undefined;
    }
    return { type: "result", id: input.id, root: null, ...fields, diagnostics, ...(formatted !== undefined ? { formatted } : {}) };
  }

  async run(input: ChildInput): Promise<ResultMessage | "reacts"> {
    const folder = dirname(input.file);
    // The loader module: never over a file (the next name where one's there).
    let path: string | undefined;
    // `describe` loads no template: its loader module loads Elements as a module in the current folder would.
    const text = this.message.command === "describe" ? elementsLoaderText(this.message.token, input.format, bun) : loaderModuleText(input.file, this.message.token, input.format, bun);
    // Named for the process whose token it carries (the parent: while it runs, its files are its own).
    const owner = parseToken(`// ${this.message.token}`)!.pid;
    for (let attempt = 0; attempt < 1000 && !path; attempt++) {
      const candidate = loaderModulePath(folder, input.file, owner, this.sequence++);
      try {
        writeFileSync(candidate, text, { flag: "wx" });
        path = candidate;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "EEXIST") continue;
        if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
          const where = relative(this.message.cwd, folder) || ".";
          return this.result(input, {
            status: "error",
            diagnostics: [cliDiagnostic("read-only", "error", `Can't write in ${where}: the CLI loads a template through a module it writes beside it (and deletes once it's loaded)`, `make ${where} writable`)],
          });
        }
        return this.result(input, { status: "error", error: errorLine(error) });
      }
    }
    if (!path) return this.result(input, { status: "error", error: "no free name for the loader module" });
    this.written.add(path);
    const notes: Diagnostic[] = [];
    let mod: Record<string, unknown>;
    try {
      mod = input.format === "cjs" && !bun ? createRequire(path)(path) : await import(pathToFileURL(path).href);
    } catch (error) {
      return this.loadFailure(input, error);
    } finally {
      try {
        rmSync(path, { force: true });
        this.written.delete(path);
      } catch (error) {
        notes.push(cliDiagnostic("cleanup", "warning", `Couldn't delete ${path}: ${errorLine(error)}`));
      }
    }
    const loader = exportsOf<{ template: Record<string, unknown>; load(specifier: string): unknown; resolve(specifier: string): string }>(mod, "template");
    let loaded: Loaded;
    try {
      const failure = this.checkElements(input, loader.resolve);
      if (failure) return failure;
      if (this.message.command === "describe") return await this.describe(input, loader.load);
      const elements = exportsOf<ElementsMain>(await loader.load("@hyper-elements/react"), "render");
      const inspect = exportsOf<ElementsInspect>(await loader.load("@hyper-elements/react/inspect"), "inspect");
      const react = exportsOf<ReactModule>(await loader.load("react"), "createElement");
      let emailClients: EmailClientsModule | undefined;
      if (this.message.command === "render" || this.message.command === "check" || this.message.command === "preview" || this.message.command === "dev") {
        try {
          emailClients = exportsOf<EmailClientsModule>(await loader.load("@hyper-elements/email-clients"), "emailClients");
        } catch (error) {
          if (!notFound(error, "@hyper-elements/email-clients")) throw error;
        }
      }
      let lint: LintCopy<LintModule> | undefined;
      let lintFrom: string | undefined;
      if (this.message.options.lint) {
        // Bun resolves a package no node_modules above the template holds (the CLI's own, from its store): not the project's.
        let failure: string | undefined;
        if (!bun || installedAbove(dirname(input.file), LINT)) {
          try {
            const module = exportsOf<LintModule>(await loader.load(LINT), "lint");
            if (typeof module?.lint !== "function") throw new Error("it has no lint()");
            lintFrom = resolvedPath(loader.resolve(LINT));
            lint = { module, version: packageVersion(lintFrom, LINT) ?? "of an unknown version", own: false };
          } catch (error) {
            // Not there: the CLI's own. There but broken: the CLI's own too, saying why (lint never stops a render).
            if (!notFound(error, LINT)) failure = errorLine(error);
          }
        }
        lint ??= await ownLint(failure);
      }
      loaded = { elements, inspect, react, emailClients, lint };
      if (process.env.HYPER_ELEMENTS_CLI_PROBE) {
        // For the CLI's own tests: whether what the template imports is what the CLI renders with.
        const own = exportsOf<Record<string, unknown>>(loader.template, "render");
        process.stderr.write(
          `[probe] ${JSON.stringify({ file: input.file, sameRender: "render" in own ? own.render === elements.render : null, sameReact: "React" in own ? exportsOf<ReactModule>(own.React, "createElement").createElement === react.createElement : null, ...(lint ? { lint: lint.own ? "cli" : "project", lintVersion: lint.version, lintFrom: lintFrom } : {}) })}\n`,
        );
      }
    } catch (error) {
      if (notFound(error, "@hyper-elements/react")) return this.elementsMissing(input);
      return this.loadFailure(input, error);
    }
    // Every React the process has loaded, now that the template, Elements and react-dom/server are.
    const copies = reactCopies();
    if (copies.length > 1) {
      if (!this.message.alone) return "reacts";
      const cwd = this.message.cwd;
      const list = copies
        .map((copy) => `${relative(cwd, copy.folder) || "."}${copy.version ? ` (${copy.version})` : ""}, ${copy.requiredBy.length ? `required by ${copy.requiredBy.map((f) => relative(cwd, f)).join(", ")}` : "imported by an ES module"}`)
        .join("; ");
      return this.result(input, {
        status: "error",
        diagnostics: [cliDiagnostic("two-reacts", "error", `This template loads ${copies.length} copies of React: ${list}. Hooks and context don't work across copies`, "install one React for the template, Elements and the packages it imports (one version, deduplicated)")],
      }, loaded);
    }
    const value = defaultExport(loader.template);
    if (value && typeof value === "object" && ELEMENT.has((value as { $$typeof?: symbol }).$$typeof!)) {
      return this.result(input, { status: "skipped", notTemplate: true, diagnostics: [cliDiagnostic("element-export", "info", "Export the component, not an element")] }, loaded);
    }
    let template;
    try {
      template = templateComponent(value);
    } catch (error) {
      return this.result(input, { status: "error", error: errorText(error, this.message.cwd) }, loaded);
    }
    if (!template) {
      return this.result(input, { status: "skipped", notTemplate: true, diagnostics: [cliDiagnostic("not-a-template", "info", "Its default export isn't a component: not a template")] }, loaded);
    }
    const props = this.message.options.props ?? template.props;
    try {
      const element = loaded.react.createElement(template.exported, props);
      const inspection = loaded.inspect.inspect(element);
      const root = inspection.root && ROOTS.has(inspection.root) ? (inspection.root as Root) : null;
      if (!root && !hasErrors(inspection.diagnostics)) {
        return this.result(input, { status: "skipped", notTemplate: true, diagnostics: [cliDiagnostic("not-a-template", "info", "It renders no root Elements knows (Email, Page, Document or Canvas): not a template")] }, loaded);
      }
      const context: TemplateContext = {
        element,
        root,
        elements: loaded.elements,
        options: this.message.options,
        file: input.file,
        cwd: this.message.cwd,
        load: async (specifier) => await loader.load(specifier),
        resolve: (specifier) => loader.resolve(specifier),
        plugins: () => this.pluginsFor(loaded, root),
        emailClients: loaded.emailClients,
        inspection,
      };
      const run = { render: renderTemplate, check: checkTemplate, outline: outlineTemplate, preview: previewTemplate, inspect: inspectTemplate, dev: devTemplate }[this.message.command as "render"];
      const command: CommandResult = await run(context);
      return this.result(input, { ...command, root, diagnostics: [...command.diagnostics, ...notes] }, loaded);
    } catch (error) {
      const diagnostics = elementsErrorDiagnostics(error);
      if (diagnostics) return this.result(input, { status: "error", diagnostics }, loaded);
      const refused = this.commonJsImport(input, error, loaded);
      if (refused) return refused;
      return this.result(input, { status: "error", error: errorText(error, this.message.cwd), usage: exitCalled(error) || error instanceof UsageFailure || undefined, diagnostics: notes }, loaded);
    }
  }

  /**
   * The plugins a template is checked with: email-clients' (where the project has it), then lint's (for an Email or a
   * Page, unless --no-lint), with what the CLI says about them.
   */
  private async pluginsFor(loaded: Loaded, root: Root | null): Promise<{ plugins: unknown[]; diagnostics: Diagnostic[]; ran: Diagnostic[] }> {
    const { plugin, diagnostics } = await this.plugin(loaded);
    const plugins: unknown[] = plugin ? [plugin] : [];
    const ran: Diagnostic[] = [];
    const copy = loaded.lint;
    if (copy && (root === "Email" || root === "Page")) {
      let made = this.linters.get(copy.module);
      if (!made) {
        try {
          made = copy.module.lint(this.message.options.lint || {});
        } catch (error) {
          // Options this copy of lint doesn't take: what the run was asked can't be done.
          if (isOptionsError(error)) throw new UsageFailure(lintUsage(error, copy));
          throw error;
        }
        this.linters.set(copy.module, made);
      }
      plugins.push(made);
      // Said of a template core ran the plugins' checks on.
      if (copy.note) ran.push(copy.note);
    }
    return { plugins, diagnostics, ran };
  }

  /** email-clients' plugin for the clients asked for, made once per copy of email-clients. */
  private async plugin(loaded: Loaded): Promise<{ plugin?: unknown; diagnostics: Diagnostic[] }> {
    const clients = this.message.options.clients;
    if (!loaded.emailClients) {
      return {
        diagnostics: clients
          ? [cliDiagnostic("email-clients", "warning", "--clients asks for email client checks, which come from @hyper-elements/email-clients: it isn't installed where this template is", "npm i -D @hyper-elements/email-clients")]
          : [],
      };
    }
    let made = this.plugins.get(loaded.emailClients);
    if (!made) {
      made = loaded.emailClients.emailClients(clients ? { clients } : {});
      this.plugins.set(loaded.emailClients, made);
    }
    try {
      return { plugin: await made, diagnostics: [] };
    } catch (error) {
      // An email client it doesn't know (--clients): what the run was asked can't be done.
      if (clients && error instanceof TypeError) throw new UsageFailure(errorLine(error).replace(/^\[Elements\] /, "").replace("emailClients({ clients })", "--clients"));
      throw error;
    }
  }

  /** Elements as the template's folder resolves it: missing, or outside the range this CLI supports, stops the run. */
  private checkElements(input: ChildInput, resolve: (specifier: string) => string): ResultMessage | undefined {
    let file: string;
    try {
      file = resolvedPath(resolve("@hyper-elements/react"));
    } catch {
      return this.elementsMissing(input);
    }
    const version = packageVersion(file, "@hyper-elements/react");
    if (version && supported(version)) return undefined;
    return this.result(input, {
      status: "error",
      usage: true,
      diagnostics: [
        cliDiagnostic(
          "elements-version",
          "error",
          `This template's @hyper-elements/react is ${version ?? "of an unknown version"}; the CLI renders with ${ELEMENTS_RANGE}`,
          "install a version of @hyper-elements/react the CLI supports, or a CLI that supports yours",
        ),
      ],
    });
  }

  /** `describe`: describeComponents() or describeComponent(), from Elements as the current folder loads it. */
  private async describe(input: ChildInput, load: (specifier: string) => unknown): Promise<ResultMessage> {
    const inspect = exportsOf<ElementsInspect>(await load("@hyper-elements/react/inspect"), "describeComponents");
    const { component, root } = this.message.options;
    const usage = (message: string) => this.result(input, { status: "error", usage: true, diagnostics: [cliDiagnostic("describe", "error", message)] });
    const all = inspect.describeComponents();
    if (root !== undefined && !all.roots.includes(root)) return usage(`--root takes ${all.roots.join(", ")}, not ${JSON.stringify(root)}`);
    const options = root ? { root } : {};
    if (component === undefined) return this.result(input, { status: "ok", described: inspect.describeComponents(options) });
    const described = inspect.describeComponent(component, options);
    if (described) return this.result(input, { status: "ok", described });
    const types = all.components.map((c) => c.type);
    return usage(types.includes(component) ? `${root} doesn't take ${component}` : `There's no component ${JSON.stringify(component)}: the components are ${types.join(", ")}`);
  }

  private elementsMissing(input: ChildInput): ResultMessage {
    return this.result(input, {
      status: "error",
      usage: true,
      diagnostics: [cliDiagnostic("elements-missing", "error", this.message.command === "describe"
        ? `@hyper-elements/react isn't installed where this command runs: describe reads the project's (${ELEMENTS_RANGE}), run it in the project's folder`
        : `@hyper-elements/react isn't installed where this template is: the CLI renders with the project's (${ELEMENTS_RANGE})`, "npm i @hyper-elements/react react react-dom")],
    });
  }

  /**
   * React isn't installed beside the template. A project with the CLI alone fails on the first template it loads,
   * at `react/jsx-runtime` (what the JSX compiles to), which says nothing about what to install.
   */
  private reactMissing(input: ChildInput): ResultMessage {
    return this.result(input, {
      status: "error",
      usage: true,
      diagnostics: [
        cliDiagnostic("react-missing", "error", "React isn't installed where this template is: a template is a React component, and the CLI renders it with the project's React", "npm i @hyper-elements/react react react-dom"),
      ],
    });
  }

  /**
   * A package only an `import` loads, imported where the template loads as CommonJS. A template in a package without
   * `"type": "module"` (what `npm init` writes) is loaded through tsx's CommonJS register, which compiles every file
   * it loads to CommonJS, a dependency's ES modules among them, and each `import` in one into a `require()`. Node
   * refuses a `require()` of a package whose "exports" names an `import` condition and no `require` one
   * (ERR_PACKAGE_PATH_NOT_EXPORTED), with an error that names nothing to change. react-pdf's text engine imports one,
   * so every Document's PDF failed this way. Loaded as an ES module, the template's imports are Node's own and the
   * package is found.
   */
  private commonJsImport(input: ChildInput, error: unknown, loaded?: Loaded): ResultMessage | undefined {
    if (bun || input.format !== "cjs" || (error as NodeJS.ErrnoException | null)?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") return undefined;
    // Node names the package.json and the subpath: `No "exports" main defined in <file>` (the package's own name),
    // `Package subpath './x' is not defined by "exports" in <file>`.
    const message = messageOf(error);
    const manifest = /\bin (.+?package\.json)(?: imported from |$)/m.exec(message)?.[1];
    const subpath = /\bPackage subpath '([^']+)'/.exec(message)?.[1] ?? (/\bNo "exports" main defined\b/.test(message) ? "." : undefined);
    let pkg: { name?: unknown; exports?: unknown };
    try {
      pkg = JSON.parse(readFileSync(manifest ?? "", "utf8"));
    } catch {
      return undefined;
    }
    // Only where an import would find the subpath: one the package doesn't export at all (a name mistyped) is the same
    // error from Node, and an ES module wouldn't help it, though the package's other entries have `import` conditions.
    if (subpath === undefined || !importFinds(pkg.exports, subpath)) return undefined;
    const name = typeof pkg.name === "string" ? pkg.name : "A package this template imports";
    const cwd = this.message.cwd;
    const extension = /\.c([jt])s$/.exec(input.file)?.[1];
    const folder = packageFolder(dirname(input.file));
    const fix = extension
      ? `rename ${relative(cwd, input.file)} to .m${extension}s, so it loads as an ES module`
      : folder
        ? `add "type": "module" to ${relative(cwd, join(folder, "package.json")) || "package.json"}, so the template loads as an ES module (or put the templates in a folder with a package.json of {"type": "module"})`
        : `add a package.json with {"type": "module"} beside the template, so it loads as an ES module`;
    return this.result(input, {
      status: "error",
      usage: true,
      diagnostics: [
        cliDiagnostic(
          "commonjs-import",
          "error",
          `${name} can only be imported, not required, and this template loads as CommonJS, where each import is compiled to a require(): ${errorLine(error)}`,
          fix,
        ),
      ],
    }, loaded);
  }

  private loadFailure(input: ChildInput, error: unknown): ResultMessage {
    if (notFound(error, "@hyper-elements/react")) return this.elementsMissing(input);
    if (notFound(error, "react") || notFound(error, "react-dom")) return this.reactMissing(input);
    const refused = this.commonJsImport(input, error);
    if (refused) return refused;
    return this.result(input, { status: "error", error: errorText(error, this.message.cwd), ...(exitCalled(error) ? { usage: true } : {}) });
  }
}


function exitCalled(error: unknown): boolean {
  return /^a template called process\.exit\(/.test(messageOf(error));
}
