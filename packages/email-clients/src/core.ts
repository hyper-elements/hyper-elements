/**
 * What this package needs of core (@hyper-elements/react), checked on each call before anything is rendered: core is
 * imported as a namespace, so a core without one of these is found here, with the command to install a matching pair,
 * not when the module is linked.
 */
import * as installed from "@hyper-elements/react";

/** The `blocks` formats (core's BLOCK_MAP_VERSION) this package reads. */
export const BLOCK_MAP_VERSIONS: readonly number[] = [1];

/** The core releases this package works with: its peer dependency on @hyper-elements/react. */
export const CORE_RANGE = "^0.3.1";

/** The command that installs a core and this package that work together. */
export const INSTALL = `npm i @hyper-elements/react@${CORE_RANGE} @hyper-elements/email-clients@^0.3`;

/** What's used of core, by name. */
export type Core = typeof installed;

/**
 * `core`, checked: render(), prepare(), EMAIL_CLIENTS and ElementsError exist and BLOCK_MAP_VERSION is a format this
 * package reads. Otherwise an Error named `email-clients/version-mismatch` (core's ElementsError may be what's missing).
 */
export function checkCore(core: Record<string, unknown> = installed as unknown as Record<string, unknown>): Core {
  const missing = ["render", "prepare", "ElementsError"].filter((name) => typeof core[name] !== "function");
  if (!core.EMAIL_CLIENTS || typeof core.EMAIL_CLIENTS !== "object") missing.push("EMAIL_CLIENTS");
  const version = core.BLOCK_MAP_VERSION;
  if (typeof version !== "number") missing.push("BLOCK_MAP_VERSION (render()'s blockMap)");
  else if (!BLOCK_MAP_VERSIONS.includes(version)) missing.push(`a blockMap format it reads (this core's is ${version}, it reads ${BLOCK_MAP_VERSIONS.join(", ")})`);
  if (missing.length) {
    const error = new Error(`@hyper-elements/email-clients needs @hyper-elements/react ${CORE_RANGE}; the one installed has no ${missing.join(", ")}. Install a matching pair: ${INSTALL}`);
    error.name = "email-clients/version-mismatch";
    throw error;
  }
  return core as unknown as Core;
}
