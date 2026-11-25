/**
 * What the load guard lets a template child load (Decision 31): the files the project's `hyperElements.templates`
 * holds, the listed packages' folders, anything inside an installed package (`node_modules`, by real path), the CLI's
 * own files, and the loader modules this child wrote, by exact path. Everything else is refused before it runs, naming
 * the chain of importers. Shared by the in-thread hooks (`guard.ts`) and the hooks thread (`guard-hooks.ts`).
 */
import { sep } from "node:path";

export interface GuardData {
  /** Real paths of the listed files. */
  files: string[];
  /** Real paths of folders whose files are trusted: listed packages, and the CLI's own. */
  folders: string[];
  /** Where the child lists the loader modules it wrote (one real path per line), for the hooks thread to read. */
  allowFile: string;
  /** Where a refusal is written, for the child to report it as the CLI's own diagnostic. */
  refusals: string;
}

export interface Refusal {
  file: string;
  chain: string[];
  message: string;
}

const NODE_MODULES = `${sep}node_modules${sep}`;

/** Why a file can't be loaded, or undefined where it may. `importers` maps each file loaded to the file that loaded it. */
export function decide(real: string, data: Omit<GuardData, "allowFile" | "refusals">, own: (path: string) => boolean, parent: string | undefined, importers: Map<string, string>): Refusal | undefined {
  if (data.files.includes(real) || real.includes(NODE_MODULES) || data.folders.some((folder) => real.startsWith(folder + sep)) || own(real)) return undefined;
  // The chain: who imported it, and who imported them, up to the loader module (or the first file not seen).
  const chain: string[] = [];
  for (let at = parent, steps = 0; at && steps < 32; at = importers.get(at), steps++) {
    if (own(at)) break;
    chain.push(at);
  }
  const via = chain.length ? `, imported by ${chain.join(", imported by ")}` : "";
  return {
    file: real,
    chain,
    message: `[hyper-elements cli/template-untrusted] ${real} isn't a trusted template file${via}: a template child loads only the files hyperElements.templates lists and installed packages`,
  };
}
