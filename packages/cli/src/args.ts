/**
 * The command line: a command, the files and folders it's given, and its options.
 */
import type { Command } from "./protocol";

export const USAGE = `Render and check Hyper Elements templates.

Usage:
  hyper-elements render <files or folders...> [options]
  hyper-elements check <files or folders...> [options]
  hyper-elements outline <file> [options]

A template is a module whose default export is a component that renders an
<Email>, a <Page>, a <Document> or a <Canvas>. Its props are, first to last:
--props, the component's PreviewProps, {}. A folder is searched for templates,
leaving out node_modules, build output, and folders whose name starts with
"." or "_".

render   writes each template's output under --out, its path relative to the
         folder holding every input: an Email's HTML and plain text
         (name.html, name.txt), a Page's HTML (name.html), a Document's PDF
         (name.pdf), a Canvas's image (name.png). A Document's and a Canvas's
         fonts and images are loaded from what the template names: data: URIs,
         files relative to the template, /paths from --public, and http(s)
         URLs, fetched once and cached.
check    validates each template (with @hyper-elements/email-clients' email
         client checks where the project has it) and writes nothing.
outline  prints a template laid out: each block with its width.

Options:
  --out <dir>           Where render writes (default: out)
  --props <file.json>   Props for every template given, over PreviewProps
  --json                One JSON line per template, then a summary line
  --stdout              render: write the one template's HTML, PDF or image
                        to stdout
  --pretty              render: indent the HTML
  --html                render: also write a Document's print HTML
  --format <png|svg>    render: a Canvas's image format (default: png)
  --scale <n>           render: a Canvas's pixels per px (default: 1)
  --public <dir>        render: where /paths are read from (default: the
                        first public/ beside a package.json, from the
                        template's folder up to the workspace root)
  --refresh             render: fetch http(s) fonts and images again
  --offline             render: fetch nothing; a URL not in the cache fails
  --clients <a,b>       check: the email clients to check for
  --max-warnings <n>    check: fail (exit 1) with more than n warnings
  --rendered            check: also render, for the checks only the written
                        HTML has (Gmail's size limit)
  --timeout <seconds>   How long a group of templates may take (default: 60)
  -h, --help            Show this help
  -v, --version         Show the version

Exit codes: 0 when every template rendered or checked without errors, 1 when
a template has errors or failed, 2 when the run couldn't do what it was asked.
Runs on Node.js 20.6 or later (npx hyper-elements), or Bun 1.3 or later
(bunx --bun hyper-elements; a Document's PDF is written on Node only).
`;

export interface Args {
  command: Command;
  positional: string[];
  out: string;
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
  /** Milliseconds. */
  timeout: number;
}

export class UsageError extends Error {}

const COMMANDS: Command[] = ["render", "check", "outline"];
/** The options each command takes, and whether each takes a value. */
const OPTIONS: Record<string, { value: boolean; commands: Command[] }> = {
  out: { value: true, commands: ["render"] },
  props: { value: true, commands: ["render", "check", "outline"] },
  json: { value: false, commands: ["render", "check", "outline"] },
  stdout: { value: false, commands: ["render"] },
  pretty: { value: false, commands: ["render"] },
  html: { value: false, commands: ["render"] },
  format: { value: true, commands: ["render"] },
  scale: { value: true, commands: ["render"] },
  public: { value: true, commands: ["render"] },
  refresh: { value: false, commands: ["render"] },
  offline: { value: false, commands: ["render"] },
  clients: { value: true, commands: ["check"] },
  "max-warnings": { value: true, commands: ["check"] },
  rendered: { value: false, commands: ["check"] },
  timeout: { value: true, commands: ["render", "check", "outline"] },
};

/** `--timeout`: seconds, or a number with `ms` or `s`. */
function duration(text: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s)?$/.exec(text.trim());
  if (!match || Number(match[1]) <= 0) throw new UsageError(`--timeout takes a number of seconds (or 500ms), not ${JSON.stringify(text)}`);
  return Math.round(Number(match[1]) * (match[2] === "ms" ? 1 : 1000));
}

export function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command as Command)) {
    throw new UsageError(command === undefined ? "Give a command: render, check or outline." : `Unknown command ${JSON.stringify(command)}: use render, check or outline.`);
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
  };
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
  if (!positional.length) throw new UsageError(`Give ${command} the templates: files or folders.`);
  if (args.command === "outline" && args.json) throw new UsageError("outline is text only: it has no --json.");
  if (args.command === "outline" && positional.length > 1) throw new UsageError("outline takes one template.");
  if (args.stdout && args.json) throw new UsageError("--stdout and --json both write to stdout: give one.");
  if (positional.includes("-")) throw new UsageError("Reading a template from stdin isn't supported: give its file.");
  return args;
}
