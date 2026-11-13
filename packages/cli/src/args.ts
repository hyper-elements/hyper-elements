/**
 * The command line: a command, the files and folders it's given, and its options.
 */
import type { Command } from "./protocol";

export const USAGE = `Render and check Hyper Elements templates.

Usage:
  hyper-elements render <files or folders...> [options]
  hyper-elements check <files or folders...> [options]
  hyper-elements outline <file> [options]
  hyper-elements preview <files or folders...> [options]
  hyper-elements inspect <files or folders...> [options]
  hyper-elements describe [Component] [--root Email] [--json]
  hyper-elements dev <files or folders...> [options]
  hyper-elements migrate [migrate's arguments...]

A template is a module whose default export is a component that renders an
<Email>, a <Page>, a <Document> or a <Canvas>. Its props are, first to last:
--props, the component's PreviewProps, {}. A folder is searched for templates,
leaving out node_modules, build output, and folders whose name starts with
"." or "_".

render   writes each template's output under --out, at its path relative to
         the current folder (or --base): an Email's HTML and plain text
         (name.html, name.txt), a Page's HTML (name.html), a Document's PDF
         (name.pdf), a Canvas's image (name.png). A Document's and a Canvas's
         fonts and images are loaded from what the template names: data: URIs,
         files relative to the template, /paths from --public, and http(s)
         URLs, fetched once and cached.
check    validates each template (with @hyper-elements/email-clients' email
         client checks where the project has it, and @hyper-elements/lint's
         checks of an Email or a Page) and writes nothing. Given an HTML email
         (a .html or .htm file by name, or - for stdin), it runs the email
         client checks and lint's HTML checks on it.
outline  prints a template laid out: each block with its width.
preview  writes each Email as the email clients draw it, one file per client
         and variant (with @hyper-elements/email-clients), under
         out/clients/<its path>/<name>/, its path relative to the current
         folder (or --base). --findings opens each in Chromium and reports
         what it found. An HTML email (a .html or .htm file, or - for stdin,
         under out/clients/stdin/) is previewed as it is.
inspect  lists what a template holds: each component, what it's given,
         whether its root takes it, and the problems found on it.
describe lists the components a template can use (or one), with their props
         and styles; --root narrows it to what a root takes.
migrate  runs @hyper-elements/migrate (the project's, else npx's) with the
         arguments given.
dev      serves a page on 127.0.0.1 showing each template (an Email or a Page
         at desktop and phone widths, a Document's PDF, a Canvas's image, the
         diagnostics, and the email client previews where the project has
         @hyper-elements/email-clients), rendered again when the project's
         source or a workspace package it depends on changes, until Ctrl-C.

Options:
  --out <dir>           Where render and preview write (default: out)
  --base <dir>          render, preview: outputs keep their path relative to
                        this folder (default: the current folder)
  --props <file.json>   Props for every template given, over PreviewProps
  --json                One JSON line per template, then a summary line
  --stdout              render: write the one template's HTML, PDF or image
                        to stdout
  --pretty              render: indent the HTML
  --html                render: also write a Document's print HTML
  --format <png|svg>    render: a Canvas's image format (default: png)
  --scale <n>           render: a Canvas's pixels per px (default: 1)
  --public <dir>        render, dev: where /paths are read from (default: the
                        first public/ beside a package.json, from the
                        template's folder up to the workspace root)
  --refresh             render: fetch http(s) fonts and images again
  --offline             render, dev: fetch nothing; a URL not in the cache
                        fails
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
  --root <root>         describe: only what this root takes (Email, Page,
                        Document or Canvas)
  --timeout <seconds>   How long a process rendering templates may run: past
                        it, the template it's on fails and the rest go on in
                        a new one (default: 60)
  -h, --help            Show this help
  -v, --version         Show the version

Exit codes: 0 when every template rendered or checked without errors, 1 when
a template has errors or failed, 2 when the run couldn't do what it was asked.
Runs on Node.js 20.6 or later (npx hyper-elements), or Bun 1.3 or later
(bunx --bun hyper-elements; a Document's PDF is written on Node only).
`;

export interface Args {
  command: Command;
  /** The files and folders given; `describe`'s component; every argument after `migrate`, unchanged. */
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
  /** dev: the port to serve on. */
  port?: number;
  /** Milliseconds. */
  timeout: number;
  /** render, check, dev: @hyper-elements/lint's checks (`--no-lint` turns them off). */
  lint: boolean;
}

export class UsageError extends Error {}

const COMMANDS: Command[] = ["render", "check", "outline", "preview", "inspect", "describe", "migrate", "dev"];
/** The options each command takes, and whether each takes a value. */
const OPTIONS: Record<string, { value: boolean; commands: Command[] }> = {
  out: { value: true, commands: ["render", "preview"] },
  base: { value: true, commands: ["render", "preview"] },
  props: { value: true, commands: ["render", "check", "outline", "preview", "inspect"] },
  json: { value: false, commands: ["render", "check", "outline", "preview", "inspect", "describe"] },
  stdout: { value: false, commands: ["render"] },
  pretty: { value: false, commands: ["render"] },
  html: { value: false, commands: ["render"] },
  format: { value: true, commands: ["render"] },
  scale: { value: true, commands: ["render"] },
  public: { value: true, commands: ["render"] },
  refresh: { value: false, commands: ["render"] },
  offline: { value: false, commands: ["render"] },
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
  timeout: { value: true, commands: ["render", "check", "outline", "preview", "inspect", "describe"] },
};

/** What `dev` takes: what it renders with (its own server, so not --serve; nothing written, so not --out). */
const DEV_OPTIONS = ["props", "clients", "dark", "fonts", "public", "offline", "timeout"];
for (const name of DEV_OPTIONS) OPTIONS[name].commands.push("dev");

const COMMAND_LIST = "render, check, outline, preview, inspect, describe, dev or migrate";

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
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--") {
      positional.push(...rest.slice(i + 1));
      break;
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
    if (option.value) {
      const value = eq >= 0 ? arg.slice(eq + 1) : rest[++i];
      if (value === undefined || (eq < 0 && value.startsWith("--"))) throw new UsageError(`--${name} needs a value.`);
      values[name] = value;
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
    if (positional.length > 1) throw new UsageError("describe takes one component, or none for all of them.");
    return args;
  }
  if (!positional.length) throw new UsageError(`Give ${command} the templates: files or folders.`);
  if (args.command === "outline" && args.json) throw new UsageError("outline is text only: it has no --json.");
  if (args.command === "outline" && positional.length > 1) throw new UsageError("outline takes one template.");
  if (args.stdout && args.json) throw new UsageError("--stdout and --json both write to stdout: give one.");
  return args;
}
