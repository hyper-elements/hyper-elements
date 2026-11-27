/**
 * The versions of the packages that draw an image (satori, @resvg/resvg-js) and of this one, as this module loads
 * them: they're optional peers, so the app installs them, and another version can draw other pixels. emailImages()
 * puts them in its drawer's key, so each picture's file's name changes with them (a file is cached for good).
 */
declare const module: { require(id: string): unknown } | undefined;
/** Whether this is the CommonJS build (set when it's built; undefined in the sources). */
declare const __HYPER_ELEMENTS_CJS__: boolean | undefined;

/** A package's version, "unknown" where it can't be read. */
export function installedVersion(name: string): string {
  const node = (globalThis as { process?: { argv?: string[]; cwd?(): string; getBuiltinModule?(id: string): { createRequire(from: string): (id: string) => unknown } | undefined } }).process;
  const requirers: Array<() => ((id: string) => unknown) | undefined> = [
    // The require CommonJS loads this module with (`module`'s, read so that a bundler doesn't take it for one).
    () => {
      const own = (typeof __HYPER_ELEMENTS_CJS__ === "boolean" ? __HYPER_ELEMENTS_CJS__ : true) && typeof module === "object" ? Reflect.get(module ?? {}, "require") : undefined;
      return typeof own === "function" ? (id: string) => own.call(module, id) : undefined;
    },
    // From this module's URL (as a stack names it: webpack 4 can't parse the syntax for it; Bun's stacks name paths,
    // not file:// URLs, so there it's the next), the app's script, then the folder it started in.
    ...[/file:\/\/\S+?(?=:\d+:\d+)/.exec(String(new Error().stack))?.[0], node?.argv?.[1], `${node?.cwd?.()}/`].map((from) => () => (from ? node?.getBuiltinModule?.("module")?.createRequire(from) : undefined)),
  ];
  for (const requirer of requirers) {
    try {
      const version = (requirer()?.(`${name}/package.json`) as { version?: unknown } | undefined)?.version;
      if (typeof version === "string") return version;
    } catch {
      // Not there, or it can't load here: the next one.
    }
  }
  return "unknown";
}
