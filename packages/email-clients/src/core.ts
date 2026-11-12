/**
 * What this package needs of core (@hyper-elements/react), checked on each call that renders a template: core is loaded
 * when it's first needed, as a namespace, so a core that's missing, or lacks one of these, is found here, with the command
 * to install a matching pair, not when the module is linked. HTML a caller gives needs no core: nothing loads it.
 */
import type * as CoreModule from "@hyper-elements/react";
import { peerDependencies, version } from "../package.json";

/** The plugin contract (core's PLUGIN_API) this package's plugin is written for. */
export const PLUGIN_APIS: readonly number[] = [1];

// The models' protocol check lives apart: the HTML a caller gives is previewed without loading core.
export { checkProtocol, MODEL_PROTOCOLS } from "./protocol";

/** The `blocks` formats (core's BLOCK_MAP_VERSION) this package reads: 2, whose entries say their component (1 doesn't). */
export const BLOCK_MAP_VERSIONS: readonly number[] = [2];

/** The core releases this package works with: its peer dependency on @hyper-elements/react, as package.json says it. */
export const CORE_RANGE: string = peerDependencies["@hyper-elements/react"];

/** The command that installs a core and this package that work together: this package's own line (it follows core's minor). */
export const INSTALL = `npm i @hyper-elements/react@${CORE_RANGE} @hyper-elements/email-clients@^${version.split(".").slice(0, 2).join(".")}`;

/** What's used of core, by name. */
export type Core = typeof CoreModule;

/** Set by the build (tsup.config.ts): true in the CommonJS build. Unset (tests, a bundle of the source): false. */
declare const __CJS__: boolean | undefined;

let loading: Promise<Record<string, unknown>> | undefined;

/**
 * Core (@hyper-elements/react), loaded on first use in the module format of this build: require() in the CommonJS
 * build, import() in the ES module one, so a caller's core and this package's are the same copy (one ElementsError).
 * A core that isn't installed is an Error named `email-clients/version-mismatch`, with the command to install it.
 */
export function loadCore(): Promise<Record<string, unknown>> {
  return (loading ??= (async () => {
    try {
      if (typeof __CJS__ !== "undefined" && __CJS__) return require("@hyper-elements/react") as Record<string, unknown>;
      return (await import("@hyper-elements/react")) as unknown as Record<string, unknown>;
    } catch (error) {
      loading = undefined;
      const code = (error as { code?: unknown } | null)?.code;
      if (code !== "ERR_MODULE_NOT_FOUND" && code !== "MODULE_NOT_FOUND") throw error;
      const missing = new Error(`@hyper-elements/email-clients needs @hyper-elements/react ${CORE_RANGE} to preview a template, and it isn't installed. Install it: ${INSTALL} (HTML needs none: pass the email's HTML as a string)`);
      missing.name = "email-clients/version-mismatch";
      throw missing;
    }
  })());
}

/** What's missing for the plugin: a core whose PLUGIN_API is one it's written for. */
function pluginApi(core: Record<string, unknown>): string[] {
  const api = core.PLUGIN_API;
  if (typeof api !== "number") return ["PLUGIN_API (plugins)"];
  return PLUGIN_APIS.includes(api) ? [] : [`a plugin api it's written for (this core's is ${api}, it's written for ${PLUGIN_APIS.join(", ")})`];
}

/** For emailClients(): core takes plugins this package's plugin is written for. */
export function checkPlugins(core: Record<string, unknown>): void {
  const missing = pluginApi(core);
  if (missing.length) throw versionMismatch(missing);
}

/**
 * `core`, checked: render(), prepare() and ElementsError exist, PLUGIN_API is one the plugin is written for, and
 * BLOCK_MAP_VERSION is a format this package reads. Otherwise an Error named `email-clients/version-mismatch` (core's
 * ElementsError may be what's missing).
 */
export function checkCore(core: Record<string, unknown>): Core {
  const missing = ["render", "prepare", "ElementsError"].filter((name) => typeof core[name] !== "function");
  missing.push(...pluginApi(core));
  const version = core.BLOCK_MAP_VERSION;
  if (typeof version !== "number") missing.push("BLOCK_MAP_VERSION (render()'s blockMap)");
  else if (!BLOCK_MAP_VERSIONS.includes(version)) missing.push(`a blockMap format it reads (this core's is ${version}, it reads ${BLOCK_MAP_VERSIONS.join(", ")})`);
  if (missing.length) throw versionMismatch(missing);
  return core as unknown as Core;
}

/** The Error for a core that lacks what's `missing`, with the command to install a matching pair. */
export function versionMismatch(missing: readonly string[]): Error {
  const error = new Error(`@hyper-elements/email-clients needs @hyper-elements/react ${CORE_RANGE}; the one installed has no ${missing.join(", ")}. Install a matching pair: ${INSTALL}`);
  error.name = "email-clients/version-mismatch";
  return error;
}
