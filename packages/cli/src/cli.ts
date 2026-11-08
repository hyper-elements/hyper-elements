/**
 * The `hyper-elements` command:
 *
 *   hyper-elements preview email.tsx   renders it, takes desktop and phone screenshots, and checks its design
 *   hyper-elements new                 lists the starter templates
 *   hyper-elements new receipt order.tsx   copies one to start from
 *
 * A template is a .tsx file whose default export is a component (or an element) with an Email, Page, Document or
 * Canvas root. No tsconfig, no "type": "module" and no tsx needed: the file is bundled with esbuild and rendered with
 * the project's own Hyper Elements and React.
 */
import { copyFileSync, existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { engineFor, loadTemplate, readProps, UsageError, write, type Diagnostic } from "./load";
import { screenshots } from "./shots";
import { starters } from "./starters";

export interface Io {
  cwd: string;
  out: { write: (text: string) => unknown };
  err: { write: (text: string) => unknown };
}

const HELP = `Usage:
  hyper-elements preview <template.tsx> [--out <dir>] [--props <file.json>] [--no-screenshots]
      Renders the template, writes its HTML and plain text, takes desktop (800px) and phone (375px)
      screenshots, and checks its design. Everything goes in <dir> (preview/<name> beside the template),
      with report.txt listing every problem found.
  hyper-elements new [<starter> [<file>]]
      Lists the starter templates, or copies one to <file> to start from.

A template's default export is a component (export default function Welcome() { return <Email>…</Email>; }).
Its props come from --props, or from \`export const previewProps = { … }\` in the file.`;

const VALUE = new Set(["--out", "--props", "--desktop", "--phone"]);

function parse(argv: string[]): { positional: string[]; options: Record<string, string | true> } {
  const positional: string[] = [];
  const options: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) positional.push(arg);
    else if (VALUE.has(arg)) {
      if (argv[i + 1] === undefined) throw new UsageError(`${arg} needs a value.`);
      options[arg] = argv[++i];
    } else if (arg === "--no-screenshots" || arg === "--help") options[arg] = true;
    else throw new UsageError(`Unknown option ${arg}.\n\n${HELP}`);
  }
  return { positional, options };
}

const line = (d: Diagnostic) => `  ${d.severity === "error" ? "error " : ""}${d.code} at ${d.path}: ${d.message}`;

async function preview(file: string, options: Record<string, string | true>, io: Io): Promise<number> {
  const path = resolve(io.cwd, file);
  const engine = await engineFor(dirname(path));
  const props = readProps(typeof options["--props"] === "string" ? resolve(io.cwd, options["--props"]) : undefined);
  const { element, name } = await loadTemplate(path, engine, props);
  const out = typeof options["--out"] === "string" ? resolve(io.cwd, options["--out"]) : join(dirname(path), "preview", name);
  const shown = (p: string) => relative(io.cwd, p) || p;

  const prepared = engine.prepare(element);
  if (!prepared.root) {
    const errors = prepared.diagnostics.filter((d) => d.severity === "error");
    io.err.write(`${file} has ${errors.length} error${errors.length === 1 ? "" : "s"}:\n${errors.map(line).join("\n")}\n`);
    write(join(out, "report.txt"), prepared.diagnostics.map(line).join("\n") + "\n");
    return 1;
  }
  const root = prepared.root.type;
  let rendered: { html: string; text: string; diagnostics: Diagnostic[] };
  try {
    rendered = await engine.render(element);
  } catch (error) {
    const diagnostics = (error as { diagnostics?: Diagnostic[] }).diagnostics;
    io.err.write(`${file} doesn't render:\n${diagnostics ? diagnostics.map(line).join("\n") : `  ${String(error)}`}\n`);
    return 1;
  }
  const html = join(out, `${name}.html`);
  const text = join(out, `${name}.txt`);
  write(html, rendered.html);
  write(text, rendered.text);
  const design = engine.check ? engine.check(element).diagnostics : [];

  // Screenshots: an Email or a Page at a desktop and a phone width; a Document or a Canvas at its own width.
  const width = Number(prepared.root.props.width) || undefined;
  const desktop = Number(options["--desktop"]) || 800;
  const phone = Number(options["--phone"]) || 375;
  const jobs = root === "Email" || root === "Page"
    ? [{ html, png: join(out, "desktop.png"), width: desktop }, { html, png: join(out, "phone.png"), width: phone }]
    : [{ html, png: join(out, `${root === "Canvas" ? "image" : "page"}.png`), width: root === "Canvas" && width ? width : 900 }];
  const taken = options["--no-screenshots"] ? { shots: [] as Array<{ file: string; width: number }>, problem: undefined } : await screenshots(jobs);

  const warnings = [...rendered.diagnostics.filter((d) => d.severity === "warning"), ...design];
  const notes = rendered.diagnostics.filter((d) => d.severity === "info");
  const report = [
    `${file}: ${root}${width ? `, ${width}px wide` : ""} (@hyper-elements/react ${engine.version})`,
    "",
    `To fix (${warnings.length}):`,
    ...(warnings.length ? warnings.map(line) : ["  nothing"]),
    "",
    `Notes, nothing to fix (${notes.length}):`,
    ...(notes.length ? notes.map(line) : ["  none"]),
    ...(engine.check ? [] : ["", "This version of @hyper-elements/react has no design checks (@hyper-elements/react/check): update it to get them."]),
  ].join("\n");
  write(join(out, "report.txt"), report + "\n");

  const counts = new Map<string, number>();
  for (const note of notes) counts.set(note.code, (counts.get(note.code) ?? 0) + 1);
  io.out.write(
    [
      `Rendered ${basename(file)}: ${root}${width ? `, ${width}px wide` : ""}`,
      `  ${shown(html)}`,
      `  ${shown(text)}`,
      ...taken.shots.map((shot) => `  ${shown(shot.file)} (${shot.width}px wide)`),
      ...(taken.problem ? [`  ${taken.problem}`] : []),
      warnings.length ? `To fix (${warnings.length}):\n${warnings.map(line).join("\n")}` : "Nothing to fix.",
      ...(notes.length ? [`Notes, nothing to fix: ${[...counts].map(([code, n]) => `${code} ×${n}`).join(", ")} (${shown(join(out, "report.txt"))})`] : []),
      ...(engine.check ? [] : ["No design checks: this @hyper-elements/react has no /check entry."]),
    ].join("\n") + "\n",
  );
  return 0;
}

async function create(args: string[], io: Io): Promise<number> {
  const engine = await engineFor(io.cwd);
  const all = starters(engine.root);
  if (!all.length) throw new UsageError(`This version of @hyper-elements/react (${engine.version}) ships no starter templates: update it to get them.`);
  const [name, target] = args;
  if (!name) {
    io.out.write(`Starter templates (hyper-elements new <name> <file>):\n${all.map((s) => `  ${s.name.padEnd(24)} ${s.root.padEnd(9)} ${s.description}`).join("\n")}\n`);
    return 0;
  }
  const starter = all.find((s) => s.name === name);
  if (!starter) throw new UsageError(`No starter named ${name}. These are: ${all.map((s) => s.name).join(", ")}.`);
  const destination = resolve(io.cwd, target ?? `${name}.tsx`);
  if (existsSync(destination)) throw new UsageError(`${relative(io.cwd, destination)} already exists: give another file name.`);
  write(destination, "");
  copyFileSync(starter.file, destination);
  io.out.write(`Wrote ${relative(io.cwd, destination)} from the ${name} starter (${starter.description}). Preview it: npx hyper-elements preview ${relative(io.cwd, destination)}\n`);
  return 0;
}

/** Runs the command; resolves to its exit code. */
export async function main(argv: string[], io: Io): Promise<number> {
  try {
    const { positional, options } = parse(argv);
    const [command, ...rest] = positional;
    if (options["--help"] || !command) {
      io.out.write(HELP + "\n");
      return command || options["--help"] ? 0 : 1;
    }
    if (command === "preview") {
      if (!rest[0]) throw new UsageError(`preview needs a template file.\n\n${HELP}`);
      return await preview(rest[0], options, io);
    }
    if (command === "new") return await create(rest, io);
    throw new UsageError(`Unknown command ${command}.\n\n${HELP}`);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err.write(error.message + "\n");
      return 1;
    }
    throw error;
  }
}
