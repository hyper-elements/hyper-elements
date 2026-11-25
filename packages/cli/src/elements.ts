/**
 * What the child loads through a template's loader module: Elements' entries, React, and email-clients where the
 * project has it. Typed loosely: they're the project's copies, of any version the CLI supports.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic } from "./protocol";

/** The Elements versions this CLI renders with: the peer range in its package.json. */
export const ELEMENTS_RANGE = ">=0.4.0 <0.6.0";
/** The release of @hyper-elements/react that adds templates (/template): values files and template modules need it. */
export const TEMPLATES_RELEASE = "0.5.0";

export interface ElementsMain {
  render(element: unknown, options?: Record<string, unknown>): Promise<{ html: string; text: string; diagnostics: Diagnostic[] }>;
  validate(element: unknown, options?: Record<string, unknown>): { valid: boolean; diagnostics: Diagnostic[] };
  outline(element: unknown): string;
  formatDiagnostics(diagnostics: readonly Diagnostic[]): string;
}

export interface ElementsInspect {
  inspect(element: unknown): { root: string | null; valid: boolean; diagnostics: Diagnostic[] };
  /** Elements before `describeElements()` had these alone; they're kept, deprecated, after it. */
  describeComponents(options?: { root?: string }): { version: number; roots: string[]; components: Array<{ type: string }> };
  describeComponent(type: string, options?: { root?: string }): { version: number; type: string } | undefined;
  describeElements?(options?: { root?: string }): { version: number; roots: string[]; elements: Array<{ type: string }> };
  describeElement?(type: string, options?: { root?: string }): { version: number; type: string } | undefined;
}

/** `@hyper-elements/react/template`, as the project has it (0.5): what values files and template modules are read with. */
export interface TemplateModule {
  readValuesFile(file: unknown, template: unknown): { values?: Record<string, unknown>; migrated?: Record<string, unknown>; formats?: string[]; assets: Record<string, unknown>; diagnostics: Diagnostic[] };
  toValuesFile(template: unknown, values: unknown, options: { module: string; formats?: string[]; sha256?: string; assets?: Record<string, unknown> }): Record<string, unknown>;
  checkLayout(template: unknown, values: unknown, options: Record<string, unknown>): { regions: Record<string, unknown>; fits: unknown[]; rules: unknown[]; diagnostics: Diagnostic[] };
  sniffImage(bytes: Uint8Array): { width: number; height: number; type: string; alpha: boolean } | undefined;
  templateOf(value: unknown): TemplateObject | undefined;
}

/** A template object (`template()`), as the CLI reads it. */
export interface TemplateObject {
  id: string;
  version: string;
  root: string;
  formats?: Record<string, { scale?: number }>;
  fields: Record<string, unknown>;
  example: Record<string, unknown>;
  check(values: unknown, options?: { format?: string; fragments?: Record<string, unknown> }): {
    valid: boolean;
    values?: Record<string, unknown>;
    diagnostics: Diagnostic[];
    review: Array<{ field?: string; template?: string; guidance: string }>;
    rules: Array<{ rule: string; source: string; format?: string; status: string; diagnostics: Diagnostic[] }>;
    snapshots: Record<string, unknown>;
    template: { id: string; version: string };
  };
  update(values: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>;
  describe(): unknown;
}

export interface ReactModule {
  createElement(type: unknown, props?: Record<string, unknown> | null): unknown;
  isValidElement?(value: unknown): boolean;
}

export interface EmailClientsModule {
  emailClients(options?: { clients?: readonly string[] }): Promise<unknown>;
  renderInEmailClients?(
    element: unknown,
    options?: { emailClients?: readonly string[]; dark?: boolean; fonts?: "url" | "inline" },
  ): Promise<{
    previews: Array<{ id: string; client: string; filename: string; html: string }>;
    skipped: Array<{ client: string; dark: boolean; reason: string }>;
    diagnostics: Diagnostic[];
  }>;
}

/** A module loaded with import() or require(): its exports, through a CommonJS module's default where that's them. */
export function exportsOf<T>(mod: unknown, key: string): T {
  const value = mod as Record<string, unknown> | undefined;
  if (value && key in value) return value as T;
  const inner = value?.default as Record<string, unknown> | undefined;
  if (inner && key in inner) return inner as T;
  return value as T;
}

/** A specifier resolved by the loader module (a file URL or a path), as a path. */
export function resolvedPath(resolved: string): string {
  return resolved.startsWith("file:") ? fileURLToPath(resolved) : resolved;
}

/** The version of the package `name` whose file this is: the nearest package.json above it with that name. */
export function packageVersion(file: string, name: string): string | undefined {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        const json = JSON.parse(readFileSync(manifest, "utf8"));
        if (json.name === name) return typeof json.version === "string" ? json.version : undefined;
      } catch {
        // keep looking
      }
    }
    if (dirname(dir) === dir) return undefined;
  }
}

/** Whether `version` is in the range this CLI supports (pre-releases by their numbers). */
export function supported(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const [major, minor] = [Number(match[1]), Number(match[2])];
  return major === 0 && (minor === 4 || minor === 5);
}
