/**
 * `describe [Element]`, in the parent: what every element (or one) takes, from describeElements() or
 * describeElement(), with `--root` narrowing it to what a root takes. No template is loaded: a child loads Elements
 * through a loader module in the current folder, as a template there would, so the project's Elements answers. With
 * `--json`, one line: the result as it is, with its own `version`. Exit 2 where no Elements resolves, or for a
 * element or root there isn't.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { UsageError } from "../args";
import type { Args } from "../args";
import type { Input } from "../inputs";
import { cleanFiles, ownToken, parseToken } from "../loader-module";
import { formatDiagnostics } from "../output";
import { runChild, templateChildOptions, type Io, type RunState } from "../run";
import { readTrust, trusted, untrusted } from "../trust";

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

/** describe's argument is a template module where it has a path separator or a module's extension; else a component. */
export const isModulePath = (given: string) => /[\\/]/.test(given) || /\.(tsx|ts|jsx|js|mts|mjs|cts|cjs)$/.test(given);

export async function runDescribe(args: Args, io: Io, state: RunState): Promise<number> {
  const { cwd } = io;
  const given = args.positional[0];
  const template = given !== undefined && isModulePath(given);
  if (template && args.root !== undefined) throw new UsageError("--root narrows the elements described: a template has one root of its own.");
  if (template && !existsSync(resolve(cwd, given))) throw new UsageError(`${given} doesn't exist: describe takes a component's name, or a template module.`);
  // A template module, loaded as any design is; else a module in the current folder, as a template there would be: its
  // package's type, its tsconfig.
  const file = template ? resolve(cwd, given) : join(cwd, "describe.ts");
  const input: Input = { id: 0, file, real: file, display: template ? given : "." };
  const token = ownToken();
  state.token = token;
  state.folders.add(template ? resolve(file, "..") : cwd);
  // A template is loaded in a template child, guarded where the project lists its trusted templates (Decision 31).
  const trust = template ? readTrust(cwd) : {};
  if (template && trust.list && !trusted(file, trust.list)) {
    io.stderr(`✗ describe: ${untrusted(given, trust).message}\n`);
    return 2;
  }
  const report = await runChild("describe", [input], true, args, undefined, token, io, template ? { describeTemplate: true, ...templateChildOptions(trust, [file]) } : { element: given, root: args.root });
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
  if (template) {
    await io.stdout(templateText(result.described as Described));
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

interface Described {
  id: string;
  templateVersion: string;
  label: string;
  root: string;
  guidance?: string;
  description?: string;
  formats?: Record<string, { width?: number; height?: number; scale?: number }>;
  fields: Array<{
    path: string;
    kind: string;
    label: string;
    required: boolean;
    guidance?: string;
    default?: unknown;
    regions?: Record<string, { box: [number, number]; pixels: [number, number] } | string>;
    suggested?: { width: number; height: number };
    allow?: string[] | "all";
    allowed?: string[];
  }>;
  rules: { lint: Array<{ id: string }>; core: Array<{ code: string }>; root?: string[] };
  fixed: string;
}

/** A template's description, as text: what it is, its formats, each field and its rules (--json has all of it). */
function templateText(d: Described): string {
  let text = `${d.label} (${d.id} ${d.templateVersion}, ${/^[AEIOU]/.test(d.root) ? "an" : "a"} ${d.root})${d.description ? `: ${d.description}` : ""}\n`;
  if (d.guidance) text += `  ${d.guidance}\n`;
  const formats = Object.entries(d.formats ?? {});
  if (formats.length) text += `  formats: ${formats.map(([name, f]) => `${name}${f.width ? ` ${f.width}×${f.height}` : ""}${f.scale ? ` at ${f.scale}×` : ""}`).join(", ")}\n`;
  text += "\nFields:\n";
  for (const field of d.fields) {
    const notes = [field.kind, ...(field.required ? ["required"] : []), ...(field.default !== undefined ? [`default ${JSON.stringify(field.default)}`] : [])];
    text += `  ${field.path} (${notes.join(", ")}): ${field.label}\n`;
    if (field.guidance) text += `      ${field.guidance}\n`;
    for (const [format, region] of Object.entries(field.regions ?? {})) {
      text += `      ${format}: ${typeof region === "string" ? region : `${region.box.join("×")}, needs ${region.pixels.map(Math.round).join("×")}px`}\n`;
    }
    if (field.suggested) text += `      suggested: ${field.suggested.width}×${field.suggested.height}\n`;
    if (field.allow) text += `      allows: ${field.allow === "all" ? (field.allowed ?? []).join(", ") : field.allow.join(", ")}\n`;
  }
  const rules = [...d.rules.lint.map((r) => r.id), ...d.rules.core.map((r) => r.code), ...(d.rules.root ?? []).map((prop) => `root.${prop}`)];
  if (rules.length) text += `\nRules: ${rules.join(", ")}\n`;
  text += `\n${d.fixed}\n`;
  return text;
}
