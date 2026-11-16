/**
 * `describe [Element]`, in the parent: what every element (or one) takes, from describeElements() or
 * describeElement(), with `--root` narrowing it to what a root takes. No template is loaded: a child loads Elements
 * through a loader module in the current folder, as a template there would, so the project's Elements answers. With
 * `--json`, one line: the result as it is, with its own `version`. Exit 2 where no Elements resolves, or for a
 * element or root there isn't.
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

interface Element {
  type: string;
  description?: string;
  roots?: string[];
  properties?: Property[];
  children?: { text?: boolean; types?: string[] };
}

export async function runDescribe(args: Args, io: Io, state: RunState): Promise<number> {
  const { cwd } = io;
  // A module in the current folder, as a template there would be: its package's type, its tsconfig.
  const file = join(cwd, "describe.ts");
  const input: Input = { id: 0, file, real: file, display: "." };
  const token = ownToken();
  state.token = token;
  state.folders.add(cwd);
  const report = await runChild("describe", [input], true, args, undefined, token, io, { element: args.positional[0], root: args.root });
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
  const described = result.described as { roots?: string[]; elements?: Element[]; conditions?: Array<{ name: string; on: string; roots: string[] }> } & Element;
  await io.stdout(described.elements ? describeAllText(described as Required<typeof described>) : elementText(described));
  return 0;
}

function elementText(element: Element): string {
  const lines = [`${element.type}${element.roots?.length ? ` (${element.roots.join(", ")})` : ""}${element.description ? `: ${element.description}` : ""}`];
  const groups = new Map<string, string[]>();
  for (const property of element.properties ?? []) {
    const dot = property.path.indexOf(".");
    const group = dot < 0 ? "" : property.path.slice(0, dot);
    const name = dot < 0 ? property.path : property.path.slice(dot + 1);
    const notes = [property.kind, ...(property.required ? ["required"] : []), ...(property.default !== undefined && property.default !== null ? [`default ${JSON.stringify(property.default)}`] : [])];
    groups.set(group, [...(groups.get(group) ?? []), `${name} (${notes.join(", ")})`]);
  }
  for (const [group, names] of groups) lines.push(`    ${group || "props"}: ${names.join(", ")}`);
  const children = element.children;
  if (children) {
    const takes = [...(children.text ? ["text"] : []), ...(children.types ?? [])];
    lines.push(`    children: ${takes.length ? takes.join(", ") : "none"}`);
  }
  return `${lines.join("\n")}\n`;
}

function describeAllText(described: { roots: string[]; elements: Element[]; conditions: Array<{ name: string; on: string; roots: string[] }> }): string {
  let text = `Roots: ${described.roots.join(", ")}\n\n`;
  text += described.elements.map(elementText).join("\n");
  if (described.conditions.length) text += `\nStyle blocks: ${described.conditions.map((c) => `${c.name} (${c.on}; ${c.roots.join(", ")})`).join(", ")}\n`;
  return text;
}
