/**
 * What this package needs of core (@hyper-elements/react), checked on each call before anything is rendered: core is
 * imported as a namespace, so a core without one of these is found here, with the command to install a matching pair,
 * not when the module is linked.
 */
import * as installed from "@hyper-elements/react";
import { peerDependencies, version } from "../package.json";

/** The plugin contract (core's PLUGIN_API) this package's plugin is written for. */
export const PLUGIN_APIS: readonly number[] = [1];

// The models' protocol check lives apart from this module, which imports core: the HTML entry uses it without core.
export { checkProtocol, MODEL_PROTOCOLS } from "./protocol";

/** The `blocks` formats (core's BLOCK_MAP_VERSION) this package reads: 2, whose entries say their component (1 doesn't). */
export const BLOCK_MAP_VERSIONS: readonly number[] = [2];

/** The core releases this package works with: its peer dependency on @hyper-elements/react, as package.json says it. */
export const CORE_RANGE: string = peerDependencies["@hyper-elements/react"];

/** The command that installs a core and this package that work together: this package's own line (it follows core's minor). */
export const INSTALL = `npm i @hyper-elements/react@${CORE_RANGE} @hyper-elements/email-clients@^${version.split(".").slice(0, 2).join(".")}`;

/** What's used of core, by name. */
export type Core = typeof installed;

/** What's missing for the plugin: a core whose PLUGIN_API is one it's written for. */
function pluginApi(core: Record<string, unknown>): string[] {
  const api = core.PLUGIN_API;
  if (typeof api !== "number") return ["PLUGIN_API (plugins)"];
  return PLUGIN_APIS.includes(api) ? [] : [`a plugin api it's written for (this core's is ${api}, it's written for ${PLUGIN_APIS.join(", ")})`];
}

/** For emailClients(): core takes plugins this package's plugin is written for. */
export function checkPlugins(core: Record<string, unknown> = installed as unknown as Record<string, unknown>): void {
  const missing = pluginApi(core);
  if (missing.length) throw versionMismatch(missing);
}

/**
 * `core`, checked: render(), prepare() and ElementsError exist, PLUGIN_API is one the plugin is written for, and
 * BLOCK_MAP_VERSION is a format this package reads. Otherwise an Error named `email-clients/version-mismatch` (core's
 * ElementsError may be what's missing).
 */
export function checkCore(core: Record<string, unknown> = installed as unknown as Record<string, unknown>): Core {
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
