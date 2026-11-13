/**
 * `describe [Component]`, in the parent: what every component (or one) takes, from describeComponents() or
 * describeComponent(), with `--root` narrowing it to what a root takes. No template is loaded: a child loads Elements
 * through a loader module in the current folder, as a template there would, so the project's Elements answers. With
 * `--json`, one line: the result as it is, with its own `version`. Exit 2 where no Elements resolves, or for a
 * component or root there isn't.
 */
import { join } from "node:path";
import type { Args } from "../args";
import type { Input } from "../inputs";
import { cleanFiles, ownToken, parseToken } from "../loader-module";
import { formatDiagnostics } from "../output";
import { runChild, type Io, type RunState } from "../run";

interface Property {
  path: string;
  kind: string;
  required?: boolean;
  default?: unknown;
  roots?: string[];
}

interface Component {
  type: string;
  description?: string;
  roots?: string[];
  properties?: Property[];
  children?: { text?: boolean; categories?: string[]; types?: string[] };
}

/** A category of children, in the words the package's own guide uses for it (packages/react's reference.ts). */
const CATEGORY: Record<string, string> = { section: "sections", layout: "layout", block: "blocks", inline: "inline", shape: "shapes" };

export async function runDescribe(args: Args, io: Io, state: RunState): Promise<number> {
  const { cwd } = io;
  // A module in the current folder, as a template there would be: its package's type, its tsconfig.
  const file = join(cwd, "describe.ts");
  const input: Input = { id: 0, file, real: file, display: "." };
  const token = ownToken();
  state.token = token;
  state.folders.add(cwd);
  const report = await runChild("describe", [input], true, args, undefined, token, io, { component: args.positional[0], root: args.root });
  const own = parseToken(`// ${token}`)!;
  cleanFiles(state.folders, (owner) => !!owner && owner.host === own.host && owner.pid === own.pid && owner.random === own.random);
  const result = report.results.get(0);
  if (!result || result.status !== "ok" || result.described === undefined) {
    const said = result?.diagnostics.length ? formatDiagnostics(result.diagnostics) : (result?.error ?? report.ended?.error ?? "describe didn't finish");
    io.stderr(`✗ describe: ${said}\n`);
    return 2;
  }
  if (args.json) {
    await io.stdout(`${JSON.stringify(result.described)}\n`);
    return 0;
  }
  const described = result.described as { roots?: string[]; components?: Component[]; conditions?: Array<{ name: string; on: string; roots: string[] }> } & Component;
  await io.stdout(described.components ? describeAllText(described as Required<typeof described>) : componentText(described));
  return 0;
}

function componentText(component: Component): string {
  const lines = [`${component.type}${component.roots?.length ? ` (${component.roots.join(", ")})` : ""}${component.description ? `: ${component.description}` : ""}`];
  const groups = new Map<string, string[]>();
  for (const property of component.properties ?? []) {
    const dot = property.path.indexOf(".");
    const group = dot < 0 ? "" : property.path.slice(0, dot);
    const name = dot < 0 ? property.path : property.path.slice(dot + 1);
    const notes = [property.kind, ...(property.required ? ["required"] : []), ...(property.default !== undefined && property.default !== null ? [`default ${JSON.stringify(property.default)}`] : [])];
    groups.set(group, [...(groups.get(group) ?? []), `${name} (${notes.join(", ")})`]);
  }
  for (const [group, names] of groups) lines.push(`    ${group || "props"}: ${names.join(", ")}`);
  const children = component.children;
  if (children) {
    // A container holds whole categories, not named types: without them a Section, a Row and a Column each said
    // "children: none", the one line an agent reads to find out what goes inside one.
    const takes = [...(children.text ? ["text"] : []), ...(children.categories ?? []).map((category) => CATEGORY[category] ?? category), ...(children.types ?? [])];
    lines.push(`    children: ${takes.length ? takes.join(", ") : "none"}`);
  }
  return `${lines.join("\n")}\n`;
}

function describeAllText(described: { roots: string[]; components: Component[]; conditions: Array<{ name: string; on: string; roots: string[] }> }): string {
  let text = `Roots: ${described.roots.join(", ")}\n\n`;
  text += described.components.map(componentText).join("\n");
  if (described.conditions.length) text += `\nStyle blocks: ${described.conditions.map((c) => `${c.name} (${c.on}; ${c.roots.join(", ")})`).join(", ")}\n`;
  return text;
}
