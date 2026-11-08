/**
 * A template file loaded as its project runs it: bundled with esbuild (JSX and TypeScript, no tsconfig needed), each
 * package it imports the file its project resolves, so it renders with the project's React and Hyper Elements, one
 * copy of each.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

/** What the CLI uses of `@hyper-elements/react`, as the project has it. */
export interface Engine {
  version: string;
  render: (element: unknown, options?: Record<string, unknown>) => Promise<{ html: string; text: string; diagnostics: Diagnostic[] }>;
  prepare: (element: unknown) => { root: { type: string; props: Record<string, unknown> } | null; diagnostics: Diagnostic[] };
  outline: (element: unknown) => string;
  validate: (element: unknown, options?: Record<string, unknown>) => { valid: boolean; diagnostics: Diagnostic[] };
  createElement: (type: unknown, props?: Record<string, unknown> | null) => unknown;
  isValidElement: (value: unknown) => boolean;
  /** Where the project's package is: the starters ship in it. */
  root: string;
}

export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path: string;
  /** What to change, where the problem says (email client and design problems). */
  fix?: string;
}

export class UsageError extends Error {}

/** `@hyper-elements/react` and React as the template's project has them; a UsageError saying how to install them if not. */
export async function engineFor(from: string): Promise<Engine> {
  const require = createRequire(join(from, "noop.js"));
  let manifest: string;
  try {
    manifest = require.resolve("@hyper-elements/react/package.json");
  } catch {
    throw new UsageError(`@hyper-elements/react isn't installed where ${from} can find it. Install it in the template's project:\n  npm install @hyper-elements/react react react-dom`);
  }
  let react: string;
  try {
    react = require.resolve("react");
  } catch {
    throw new UsageError(`React isn't installed where ${from} can find it. Install it beside Hyper Elements:\n  npm install react react-dom`);
  }
  const root = dirname(manifest);
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  const main = await import(pathToFileURL(require.resolve("@hyper-elements/react")).href);
  const React = await import(pathToFileURL(react).href);
  const R = React.default ?? React;
  return { version: pkg.version, render: main.render, prepare: main.prepare, outline: main.outline, validate: main.validate, createElement: R.createElement, isValidElement: R.isValidElement, root };
}

/** The template a file exports: its default export (a component or an element), else its one exported component. */
export async function loadTemplate(file: string, engine: Engine, props: Record<string, unknown> | undefined): Promise<{ element: unknown; name: string }> {
  const path = resolve(file);
  if (!existsSync(path)) throw new UsageError(`${file} doesn't exist.`);
  const esbuild = await import("esbuild");
  // Each package the template imports is the file its own folder resolves, imported by URL: the same React and Hyper
  // Elements this CLI renders with. The bundle itself goes in a temporary folder, not the project's.
  const resolver = createRequire(join(dirname(path), "noop.js"));
  const projectPackages = {
    name: "project-packages",
    setup(build: { onResolve: (options: { filter: RegExp }, callback: (args: { path: string }) => { path: string; external: boolean } | undefined) => void }) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.path.startsWith("node:") || builtinModules.includes(args.path.split("/")[0])) return { path: args.path, external: true };
        try {
          return { path: pathToFileURL(resolver.resolve(args.path)).href, external: true };
        } catch {
          return undefined; // esbuild says it can't be found
        }
      });
    },
  };
  const cache = join(tmpdir(), "hyper-elements-preview");
  mkdirSync(cache, { recursive: true });
  const id = createHash("sha256").update(path).update(String(Date.now())).update(String(Math.random())).digest("hex").slice(0, 12);
  const outfile = join(cache, `${basename(path).replace(/\.[^.]+$/, "")}-${id}.mjs`);
  try {
    await esbuild.build({ entryPoints: [path], bundle: true, platform: "node", format: "esm", target: "node20", jsx: "automatic", plugins: [projectPackages], outfile, logLevel: "silent", write: true });
  } catch (error) {
    const errors = (error as { errors?: Array<{ text: string; location?: { file: string; line: number } }> }).errors ?? [];
    throw new UsageError(`${file} doesn't compile:\n${errors.map((e) => `  ${e.location ? `${e.location.file}:${e.location.line}: ` : ""}${e.text}`).join("\n") || `  ${String(error)}`}`);
  }
  const mod = await import(pathToFileURL(outfile).href);
  const given = mod.default ?? Object.entries(mod).find(([key, value]) => /^[A-Z]/.test(key) && typeof value === "function")?.[1];
  if (given === undefined) throw new UsageError(`${file} exports no template. Export it as the default: export default function Welcome() { return <Email>…</Email>; }`);
  const element = engine.isValidElement(given) ? given : engine.createElement(given, props ?? mod.previewProps ?? null);
  return { element, name: basename(path).replace(/\.[^.]+$/, "") };
}

/** The props a `--props` JSON file gives. */
export function readProps(file: string | undefined): Record<string, unknown> | undefined {
  if (!file) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new UsageError(`--props ${file} isn't a JSON file: ${(error as Error).message}`);
  }
}

export function write(file: string, content: string | Uint8Array): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
