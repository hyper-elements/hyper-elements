/**
 * The command line: a command, the files and folders it's given, and its options.
 */
import { existsSync } from "node:fs";
import type { Command } from "./protocol";

export const USAGE = `Render and check Hyper Elements designs.

Usage:
  hyper-elements render <files or folders...> [options]
  hyper-elements check <files or folders...> [options]
  hyper-elements outline <file> [options]
  hyper-elements preview <files or folders...> [options]
  hyper-elements inspect <files or folders...> [options]
  hyper-elements describe [Element | template.tsx] [--root Email] [--json]
  hyper-elements design new <template> -o <name.values.json> [--values f] [--set k=v]
  hyper-elements design set <name.values.json> <field>=<value>...
  hyper-elements template extract <design.tsx> --id <id> --field <id>... -o <file>
  hyper-elements dev <files or folders...> [options]
  hyper-elements migrate [migrate's arguments...]

A design file is a module whose default export is a component that renders an
<Email>, a <Page>, a <Document> or a <Canvas>. Its props are, first to last:
--props, the component's PreviewProps, {}. A folder is searched for designs,
leaving out node_modules, build output, and folders whose name starts with
"." or "_".

render   writes each design's output under --out, at its path relative to
         the current folder (or --base): an Email's HTML and plain text
         (name.html, name.txt), a Page's HTML (name.html), a Document's PDF
         (name.pdf), a Canvas's image (name.png). A Document's and a Canvas's
         fonts and images are loaded from what the design names: data: URIs,
         files relative to the design, /paths from --public, and http(s)
         URLs, fetched once and cached.
check    validates each design (with @hyper-elements/email-clients' email
         client checks where the project has it, and @hyper-elements/lint's
         checks of an Email or a Page) and writes nothing. Given an HTML email
         (a .html or .htm file by name, or - for stdin), it runs the email
         client checks and lint's HTML checks on it.
outline  prints a design laid out: each block with its width.
preview  writes each Email as the email clients draw it, one file per client
         and variant (with @hyper-elements/email-clients), under
         out/clients/<its path>/<name>/, its path relative to the current
         folder (or --base). --findings opens each in Chromium and reports
         what it found. An HTML email (a .html or .htm file, or - for stdin,
         under out/clients/stdin/) is previewed as it is.
inspect  lists what a design holds: each element, what it's given,
         whether its root takes it, and the problems found on it.
describe lists the elements a design can use (or one), with their props
         and styles; --root narrows it to what a root takes. Given a
         template module, what it opens: its formats, fields, slots, rules.
design   new writes a values file from a template and values (--values, a
         JSON file, and --set field=value; --draft writes it with what's
         missing); set changes some of a values file's fields
         (features[1]=..., a value as JSON or text, an image as @path, its
         --source path=source.json), checked by the template in each format:
         the file is written only if they pass.
template extract writes a template from a design a person approved: each
         --field names an id in it, whose literal text or image becomes a
         field (ids name-0, name-1, ... a list) and its example. Then add
         its rules and formats, set its version, and check it.
migrate  runs @hyper-elements/migrate (the project's, else npx's) with the
         arguments given.
dev      serves a page on 127.0.0.1 showing each design (an Email or a Page
         at desktop and phone widths, a Document's PDF, a Canvas's image, the
         diagnostics, and the email client previews where the project has
         @hyper-elements/email-clients), rendered again when the project's
         source or a workspace package it depends on changes, until Ctrl-C.

A values file (name.values.json) is a design as data: its template, the
formats wanted, and the values. render, check, inspect and outline take one
as one input per format (name.<format>.png); a template module itself is
checked with its example in each format.

Options:
  --out <dir>           Where render and preview write (default: out)
  --base <dir>          render, preview: outputs keep their path relative to
                        this folder (default: the current folder)
  --props <file.json>   Props for every design given, instead of PreviewProps
  --json                One JSON line per design, then a summary line
  --stdout              render: write the one design's HTML, PDF or image
                        to stdout
  --pretty              render: indent the HTML
  --html                render: also write a Document's print HTML
  --format <png|svg>    render: a Canvas's image format (default: png)
  --scale <n>           render, check: a Canvas's pixels per px (default: 1,
                        or the template format's)
  --template-format <f> render, check, outline, inspect: only this format of
                        each values file, template module or template design
  --require-template [id]
                        render, check: fail (exit 1) every input that isn't
                        a design a template checked (or this template's)
  --public <dir>        render, check, dev: where /paths are read from
                        (default: the first public/ beside a package.json,
                        from the design's folder up to the workspace root)
  --refresh             render, check: fetch http(s) fonts and images again
  --offline             render, check, dev: fetch nothing; a URL not in the
                        cache fails
  --clients <a,b>       render, check, preview, dev: the email clients to
                        check for, or to preview
  --no-lint             render, check, dev: leave out @hyper-elements/lint's
                        checks (on by default for an Email, a Page and an
                        HTML email; its options are "hyperElements": { "lint":
                        { "rules": {…}, "kind": "marketing" } } in the nearest
                        package.json)
  --max-warnings <n>    check: fail (exit 1) with more than n warnings
  --rendered            check: also render, for the checks only the written
                        HTML has (Gmail's size limit)
  --dark                preview, dev: also the dark previews, where measured
  --fonts <url|inline>  preview, dev: where a preview's stand-in fonts come
                        from (default: url, from jsDelivr; inline: in each
                        file)
  --findings            preview: open each preview in Chromium and report what
                        it found (CHROME_PATH, Playwright's Chromium, Chrome,
                        then Edge: the first that starts)
  --screenshots         preview: also a PNG of each drawn preview, beside it
                        (draws them, as --findings does)
  --serve               preview: serve the previews on 127.0.0.1 until Ctrl-C
  --install-browser     preview: download Playwright's Chromium, and exit
                        (--findings, --screenshots and this need
                        playwright-core installed beside the CLI)
  --port <n>            dev: the port to serve on, on 127.0.0.1 (default: a
                        free one)
  -o, --output <file>   design new: the values file to write
  --values <file.json>  design new: the values, as a JSON object
  --from <design.tsx>   design new: the values of a TSX design made from the
                        template (its slots captured)
  --set <field=value>   design new: one value (repeatable; JSON, else text;
                        @path for an image file, its size read from it)
  --source <f=file>     design: where an image came from, as JSON
                        ({"kind":"generated",…}), kept in assets
  --draft               design: write the file even if values are missing or
                        wrong, as a draft (render refuses it)
  --id <id>             template extract: the template's id (acme.Launch)
  --field <id>          template extract: an id in the design that becomes a
                        field (repeatable)
  --label <text>        template extract: its label (default: from its id)
  --force               template extract: replace the -o file if it's there
  --root <root>         describe: only what this root takes (Email, Page,
                        Document or Canvas)
  --timeout <seconds>   How long a process rendering designs may run: past
                        it, the design it's on fails and the rest go on in
                        a new one (default: 60)
  -h, --help            Show this help
  -v, --version         Show the version

Exit codes: 0 when every design rendered or checked without errors, 1 when
a design has errors or failed, 2 when the run couldn't do what it was asked.
Runs on Node.js 20.6 or later (npx hyper-elements), or Bun 1.3 or later
(bunx --bun hyper-elements; a Document's PDF is written on Node only).
`;

export interface Args {
  command: Command;
  /** The files and folders given; `describe`'s element; every argument after `migrate`, unchanged. */
  positional: string[];
  out: string;
  /** render, preview: the folder outputs keep their path relative to (the current folder where it isn't given). */
  base?: string;
  props?: string;
  json: boolean;
  stdout: boolean;
  pretty: boolean;
  /** render: a Document's print HTML too. */
  html: boolean;
  /** render: a Canvas's image format. */
  format: "png" | "svg";
  /** render: a Canvas's pixels per px. */
  scale?: number;
  /** render: where root-relative fonts and images are read from. */
  public?: string;
  refresh: boolean;
  offline: boolean;
  clients?: string[];
  maxWarnings?: number;
  rendered: boolean;
  /** preview: the dark previews too. */
  dark: boolean;
  /** preview: where the stand-in fonts come from. */
  fonts?: "url" | "inline";
  /** preview: draw each preview in a browser (also set by `--screenshots`). */
  findings: boolean;
  screenshots: boolean;
  serve: boolean;
  installBrowser: boolean;
  /** describe: only what this root takes. */
  root?: string;
  /** A values file's or a template module's format. */
  templateFormat?: string;
  /** check, render: every input must be a template's design (true), or this template's (its id). */
  requireTemplate?: true | string;
  /** template extract: the template's id, the fields (ids in the design), its label, where it's written. */
  extract?: { id: string; fields: string[]; label?: string; output: string; force: boolean };
  /** design: new or set, and what each takes. */
  design?: { action: "new" | "set"; output?: string; values?: string; from?: string; draft: boolean; sets: Array<{ path: string; value: string }>; sources: Array<{ path: string; value: string }> };
  /** dev: the port to serve on. */
  port?: number;
  /** Milliseconds. */
  timeout: number;
  /** render, check, dev: @hyper-elements/lint's checks (`--no-lint` turns them off). */
  lint: boolean;
}

export class UsageError extends Error {}

/** A template's id, as --require-template takes one: dotted names (acme.Newsletter). */
const TEMPLATE_ID = /^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)+$/;

const COMMANDS: Command[] = ["render", "check", "outline", "preview", "inspect", "describe", "migrate", "dev", "design", "template"];
/** The options each command takes, and whether each takes a value. */
const OPTIONS: Record<string, { value: boolean; commands: Command[] }> = {
  out: { value: true, commands: ["render", "preview"] },
  base: { value: true, commands: ["render", "preview"] },
  props: { value: true, commands: ["render", "check", "outline", "preview", "inspect"] },
  json: { value: false, commands: ["render", "check", "outline", "preview", "inspect", "describe", "design", "template"] },
  stdout: { value: false, commands: ["render"] },
  pretty: { value: false, commands: ["render"] },
  html: { value: false, commands: ["render"] },
  format: { value: true, commands: ["render"] },
  scale: { value: true, commands: ["render", "check"] },
  public: { value: true, commands: ["render", "check"] },
  refresh: { value: false, commands: ["render", "check"] },
  offline: { value: false, commands: ["render", "check"] },
  "template-format": { value: true, commands: ["render", "check", "outline", "inspect"] },
  output: { value: true, commands: ["design", "template"] },
  id: { value: true, commands: ["template"] },
  field: { value: true, commands: ["template"] },
  label: { value: true, commands: ["template"] },
  force: { value: false, commands: ["template"] },
  values: { value: true, commands: ["design"] },
  draft: { value: false, commands: ["design"] },
  source: { value: true, commands: ["design"] },
  set: { value: true, commands: ["design"] },
  from: { value: true, commands: ["design"] },
  "require-template": { value: false, commands: ["render", "check"] },
  clients: { value: true, commands: ["render", "check", "preview"] },
  "max-warnings": { value: true, commands: ["check"] },
  "no-lint": { value: false, commands: ["render", "check", "dev"] },
  rendered: { value: false, commands: ["check"] },
  dark: { value: false, commands: ["preview"] },
  fonts: { value: true, commands: ["preview"] },
  findings: { value: false, commands: ["preview"] },
  screenshots: { value: false, commands: ["preview"] },
  serve: { value: false, commands: ["preview"] },
  "install-browser": { value: false, commands: ["preview"] },
  root: { value: true, commands: ["describe"] },
  port: { value: true, commands: ["dev"] },
  timeout: { value: true, commands: ["render", "check", "outline", "preview", "inspect", "describe", "design"] },
};

/** What `dev` takes: what it renders with (its own server, so not --serve; nothing written, so not --out). */
const DEV_OPTIONS = ["props", "clients", "dark", "fonts", "public", "offline", "timeout"];
for (const name of DEV_OPTIONS) OPTIONS[name].commands.push("dev");

const COMMAND_LIST = "render, check, outline, preview, inspect, describe, design, template, dev or migrate";

/** `--timeout`: seconds, or a number with `ms` or `s`. */
function duration(text: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s)?$/.exec(text.trim());
  if (!match || Number(match[1]) <= 0) throw new UsageError(`--timeout takes a number of seconds (or 500ms), not ${JSON.stringify(text)}`);
  return Math.round(Number(match[1]) * (match[2] === "ms" ? 1 : 1000));
}

export function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command as Command)) {
    throw new UsageError(command === undefined ? `Give a command: ${COMMAND_LIST}.` : `Unknown command ${JSON.stringify(command)}: use ${COMMAND_LIST}.`);
  }
  if (command === "migrate") {
    // Every argument is migrate's, unchanged (its own --help and options included).
    return { command, positional: rest, out: "out", json: false, stdout: false, pretty: false, html: false, format: "png", refresh: false, offline: false, rendered: false, timeout: 60_000, dark: false, findings: false, screenshots: false, serve: false, installBrowser: false, lint: false };
  }
  const values: Record<string, string | true> = {};
  /** The options given more than once on purpose: design's --set and --source. */
  const lists: Record<string, string[]> = { set: [], source: [], field: [] };
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--") {
      positional.push(...rest.slice(i + 1));
      break;
    }
    // design's and template's -o is their --output.
    if ((command === "design" || command === "template") && arg === "-o") {
      if ("output" in values) throw new UsageError("--output is given twice.");
      const value = rest[++i];
      if (value === undefined) throw new UsageError("-o needs a value: the values file to write.");
      values.output = value;
      continue;
    }
    if (!arg.startsWith("--") || arg === "-") {
      if (arg.startsWith("-") && arg !== "-") throw new UsageError(`Unknown option ${arg}.`);
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = arg.slice(2, eq < 0 ? undefined : eq);
    const option = OPTIONS[name];
    if (!option) throw new UsageError(`Unknown option --${name}.`);
    if (!option.commands.includes(command as Command)) throw new UsageError(`--${name} isn't an option of ${command}.`);
    if (name in values) throw new UsageError(`--${name} is given twice.`);
    // --require-template takes a template's id where one follows (acme.Newsletter), or --require-template=acme.X.
    if (name === "require-template") {
      const next = rest[i + 1];
      if (eq >= 0) values[name] = arg.slice(eq + 1) || true;
      else if (next !== undefined && TEMPLATE_ID.test(next) && !existsSync(next)) values[name] = rest[++i];
      else values[name] = true;
      continue;
    }
    if (option.value) {
      const value = eq >= 0 ? arg.slice(eq + 1) : rest[++i];
      if (value === undefined || (eq < 0 && value.startsWith("--"))) throw new UsageError(`--${name} needs a value.`);
      if (name in lists) lists[name].push(value);
      else values[name] = value;
    } else {
      if (eq >= 0) throw new UsageError(`--${name} takes no value.`);
      values[name] = true;
    }
  }
  const args: Args = {
    command: command as Command,
    positional,
    out: (values.out as string | undefined) ?? "out",
    ...(values.base !== undefined ? { base: values.base as string } : {}),
    props: values.props as string | undefined,
    json: values.json === true,
    stdout: values.stdout === true,
    pretty: values.pretty === true,
    html: values.html === true,
    format: "png",
    public: values.public as string | undefined,
    refresh: values.refresh === true,
    offline: values.offline === true,
    rendered: values.rendered === true,
    timeout: values.timeout === undefined ? 60_000 : duration(values.timeout as string),
    dark: values.dark === true,
    findings: values.findings === true || values.screenshots === true,
    screenshots: values.screenshots === true,
    serve: values.serve === true,
    installBrowser: values["install-browser"] === true,
    lint: (command === "render" || command === "check" || command === "dev") && values["no-lint"] !== true,
  };
  if (values.fonts !== undefined) {
    if (values.fonts !== "url" && values.fonts !== "inline") throw new UsageError(`--fonts takes url or inline, not ${JSON.stringify(values.fonts)}`);
    args.fonts = values.fonts;
  }
  if (values.root !== undefined) args.root = values.root as string;
  if (values["require-template"] !== undefined) args.requireTemplate = values["require-template"] === true ? true : (values["require-template"] as string);
  if (values["template-format"] !== undefined) {
    const name = values["template-format"] as string;
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new UsageError(`--template-format takes a format's name (lowercase letters, digits and -), not ${JSON.stringify(name)}`);
    args.templateFormat = name;
  }
  if (values.port !== undefined) {
    const text = values.port as string;
    const port = Number(text);
    if (!/^\d+$/.test(text) || port < 1 || port > 65535) throw new UsageError(`--port takes a port from 1 to 65535, not ${JSON.stringify(text)}`);
    args.port = port;
  }
  if (values.clients !== undefined) {
    const clients = (values.clients as string).split(",").map((c) => c.trim()).filter(Boolean);
    if (!clients.length) throw new UsageError("--clients takes a list of email clients: --clients gmail,outlook");
    args.clients = clients;
  }
  if (values.format !== undefined) {
    if (values.format !== "png" && values.format !== "svg") throw new UsageError(`--format takes png or svg, not ${JSON.stringify(values.format)}`);
    args.format = values.format;
  }
  if (values.scale !== undefined) {
    const text = values.scale as string;
    const scale = Number(text);
    if (!/^\d+(\.\d+)?$/.test(text.trim()) || !(scale > 0)) throw new UsageError(`--scale takes a number above 0, not ${JSON.stringify(text)}`);
    args.scale = scale;
  }
  if (args.refresh && args.offline) throw new UsageError("--refresh fetches again and --offline fetches nothing: give one.");
  if (values["max-warnings"] !== undefined) {
    const text = values["max-warnings"] as string;
    if (!/^\d+$/.test(text)) throw new UsageError(`--max-warnings takes a whole number, not ${JSON.stringify(text)}`);
    args.maxWarnings = Number(text);
  }
  if (args.installBrowser) {
    if (positional.length || Object.keys(values).some((name) => name !== "install-browser")) {
      throw new UsageError("--install-browser downloads Playwright's Chromium and exits: give it alone (hyper-elements preview --install-browser).");
    }
    return args;
  }
  if (args.command === "describe") {
    if (positional.length > 1) throw new UsageError("describe takes one element or template, or none for all the elements.");
    return args;
  }
  if (args.command === "template") {
    const [action, ...files] = positional;
    if (action !== "extract") throw new UsageError("template takes extract: template extract designs/orbit.tsx --id acme.Launch --field headline -o templates/launch.tsx");
    if (files.length !== 1) throw new UsageError("template extract takes one design: template extract designs/orbit.tsx --id acme.Launch --field headline -o templates/launch.tsx");
    if (typeof values.id !== "string" || !/^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)+$/.test(values.id)) throw new UsageError("template extract needs the template's --id, dotted (acme.LaunchGraphic).");
    if (!lists.field.length) throw new UsageError("template extract needs a --field for each id in the design that becomes a field (--field headline --field artwork).");
    if (typeof values.output !== "string") throw new UsageError("template extract writes a template module: give it with -o templates/name.tsx");
    if (!/\.(tsx|jsx)$/.test(values.output)) throw new UsageError(`A template module written from JSX is a .tsx or .jsx file, not ${JSON.stringify(values.output)}`);
    args.extract = { id: values.id, fields: lists.field, ...(typeof values.label === "string" ? { label: values.label } : {}), output: values.output, force: values.force === true };
    return args;
  }
  if (args.command === "design") {
    const [action, ...files] = positional;
    if (action !== "new" && action !== "set") throw new UsageError("design takes new (design new <template> -o <name.values.json>) or set (design set <name.values.json> field=value).");
    const pair = (text: string, what: string) => {
      const eq = text.indexOf("=");
      if (eq <= 0) throw new UsageError(`${what} takes field=value (features[1]=Faster, artwork=@art/waves.png), not ${JSON.stringify(text)}`);
      return { path: text.slice(0, eq), value: text.slice(eq + 1) };
    };
    let sets = lists.set.map((text) => pair(text, "--set"));
    if (action === "new") {
      if (files.length !== 1) throw new UsageError("design new takes one template module: design new templates/launch.tsx -o designs/launch.values.json");
      if (values.output === undefined) throw new UsageError("design new writes a values file: give it with -o designs/name.values.json");
      if (!/\.values\.json$/.test(values.output as string)) throw new UsageError(`A values file's name ends in .values.json, not ${JSON.stringify(values.output)}`);
    } else {
      if (values.output !== undefined || values.values !== undefined) throw new UsageError("design set changes the values file it's given: it takes field=value, not -o or --values.");
      if (files.length < 2 && !sets.length && !lists.source.length) throw new UsageError("design set takes a values file and at least one field=value: design set designs/launch.values.json launchDate=2026-12-10");
      sets = [...files.slice(1).map((text) => pair(text, "design set")), ...sets];
      positional.splice(2);
    }
    const sources = lists.source.map((text) => pair(text, "--source"));
    if (values.from !== undefined && action !== "new") throw new UsageError("--from is design new's: it writes a values file from a TSX design (design new <template> --from designs/launch.tsx -o launch.values.json).");
    if (values.from !== undefined && values.values !== undefined) throw new UsageError("design new takes its values from --from or --values, not both.");
    args.design = { action, ...(values.output !== undefined ? { output: values.output as string } : {}), ...(values.values !== undefined ? { values: values.values as string } : {}), ...(values.from !== undefined ? { from: values.from as string } : {}), draft: values.draft === true, sets, sources };
    return args;
  }
  if (!positional.length) throw new UsageError(`Give ${command} the designs: files or folders.`);
  if (args.command === "outline" && args.json) throw new UsageError("outline is text only: it has no --json.");
  if (args.command === "outline" && positional.length > 1) throw new UsageError("outline takes one design.");
  if (args.stdout && args.json) throw new UsageError("--stdout and --json both write to stdout: give one.");
  return args;
}
