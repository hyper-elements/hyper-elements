/**
 * What the child loads through a template's loader module: Elements' entries, React, and email-clients where the
 * project has it. Typed loosely: they're the project's copies, of any version the CLI supports.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic } from "./protocol";

/** The Elements versions this CLI renders with: the peer range in its package.json. */
export const ELEMENTS_RANGE = ">=0.4.0 <0.5.0";

export interface ElementsMain {
  render(element: unknown, options?: Record<string, unknown>): Promise<{ html: string; text: string; diagnostics: Diagnostic[] }>;
  validate(element: unknown, options?: Record<string, unknown>): { valid: boolean; diagnostics: Diagnostic[] };
  outline(element: unknown): string;
  formatDiagnostics(diagnostics: readonly Diagnostic[]): string;
}

export interface ElementsInspect {
  inspect(element: unknown): { root: string | null; diagnostics: Diagnostic[] };
}

export interface ReactModule {
  createElement(type: unknown, props?: Record<string, unknown> | null): unknown;
}

export interface EmailClientsModule {
  emailClients(options?: { clients?: readonly string[] }): Promise<unknown>;
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
  return major === 0 && minor === 4;
}
