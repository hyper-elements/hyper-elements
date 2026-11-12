/**
 * `dev`'s watcher. It doesn't follow imports; it watches:
 *
 * - the project's source: the folder of the nearest package.json above each template (the template's own folder
 *   where there's none), for files by the extensions a template can have (`MODULE`), leaving out the folders `walk()` leaves out
 *   (`node_modules`, `dist`, `build`, `out`, …, and those starting with `.`) and the CLI's loader modules;
 * - every workspace package the project depends on (a dependency whose version is `workspace:` or `link:`, or that
 *   resolves through a symbolic link to a folder outside `node_modules`), and theirs, whole: `dist` and `build`
 *   included, `node_modules` left out. A package whose runtime is its built `dist/index.js` is seen when it's rebuilt.
 *
 * Each folder is watched on its own (`fs.watch`, not recursive), so a folder left out costs nothing, and one made
 * later (a rebuild's `dist`) is watched once it appears.
 */
import { existsSync, lstatSync, readdirSync, readFileSync, statSync, watch, type Dirent, type FSWatcher } from "node:fs";
import { dirname, join, sep } from "node:path";
import { IGNORED, realpathOr } from "@unlayer-internal/template-loader";
import { MODULE } from "../inputs";
import { packageFolder } from "../inputs";
import { LOADER_NAME } from "../loader-module";

export interface WatchRoot {
  folder: string;
  /** A workspace package: every file in it counts (but node_modules). */
  whole: boolean;
}

const FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** The installed folder of `name` as `from` resolves it (a node_modules at or above it), as written (links not followed). */
function installed(from: string, name: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    const path = join(dir, "node_modules", ...name.split("/"));
    if (existsSync(path)) return path;
    if (dirname(dir) === dir) return undefined;
  }
}

/** Whether a path, or a folder on the way to it from `node_modules`, is a symbolic link. */
function linked(path: string): boolean {
  for (let current = path; !current.endsWith(`${sep}node_modules`) && dirname(current) !== current; current = dirname(current)) {
    try {
      if (lstatSync(current).isSymbolicLink()) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** The workspace packages a package depends on, as real paths. */
export function workspacePackages(pkg: string): string[] {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const field of FIELDS) {
    const deps = manifest[field];
    if (!deps || typeof deps !== "object") continue;
    for (const [name, version] of Object.entries(deps as Record<string, unknown>)) {
      const spec = typeof version === "string" ? version : "";
      const path = installed(pkg, name);
      if (!path) {
        // Not installed (yet): a link: version still names its folder.
        if (spec.startsWith("link:")) found.push(realpathOr(join(pkg, spec.slice(5))));
        continue;
      }
      const real = realpathOr(path);
      const outside = !real.split(sep).includes("node_modules");
      if (/^(workspace|link):/.test(spec) || (outside && linked(path))) found.push(real);
    }
  }
  return found;
}

/** What `dev` watches for these templates: each one's project, and the workspace packages they depend on (and theirs). */
export function watchRoots(files: string[]): WatchRoot[] {
  const roots = new Map<string, WatchRoot>();
  const add = (folder: string, whole: boolean) => {
    const real = realpathOr(folder);
    const had = roots.get(real);
    roots.set(real, { folder: real, whole: whole || !!had?.whole });
  };
  const queue: string[] = [];
  for (const file of files) {
    const pkg = packageFolder(dirname(file));
    add(pkg ?? dirname(file), false);
    if (pkg) queue.push(pkg);
  }
  const seen = new Set<string>();
  for (let pkg = queue.shift(); pkg !== undefined; pkg = queue.shift()) {
    const real = realpathOr(pkg);
    if (seen.has(real)) continue;
    seen.add(real);
    for (const dep of workspacePackages(real)) {
      add(dep, true);
      queue.push(dep);
    }
  }
  return [...roots.values()];
}

export class Watcher {
  private watchers = new Map<string, { watcher: FSWatcher; ino: number; files: Map<string, string> }>();
  private wholes = new Set<string>();

  /** `changed` is called with each path that changed (a file, or a folder made or removed). */
  constructor(private changed: (path: string) => void) {}

  /** Watches these roots too (what's watched already stays watched). */
  update(roots: WatchRoot[]): void {
    for (const root of roots) if (root.whole) this.wholes.add(root.folder);
    for (const root of roots) this.watchTree(root.folder);
  }

  close(): void {
    for (const { watcher } of this.watchers.values()) watcher.close();
    this.watchers.clear();
  }

  /** Whether a path is in a workspace package (where every file counts). */
  private whole(path: string): boolean {
    for (const root of this.wholes) if (path === root || path.startsWith(root + sep)) return true;
    return false;
  }

  /** Whether a folder in `parent` is left out. */
  private skipFolder(path: string, name: string): boolean {
    if (name === "node_modules") return true;
    if (this.whole(path)) return name === ".git";
    return name.startsWith(".") || IGNORED.has(name);
  }

  /** Whether a change to this file counts. */
  private counts(path: string, name: string): boolean {
    if (LOADER_NAME.test(name)) return false;
    if (this.whole(path)) return true;
    return !name.startsWith(".") && MODULE.test(name);
  }

  /** Whether a path is under a folder left out (from the nearest watched folder up). */
  private underSkipped(path: string): boolean {
    return path.split(sep).includes("node_modules");
  }

  private watchTree(dir: string): void {
    if (this.watchers.has(dir) || this.underSkipped(dir)) return;
    let entries;
    let ino: number;
    try {
      const stat = statSync(dir);
      if (!stat.isDirectory()) return;
      ino = stat.ino;
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    let watcher: FSWatcher;
    try {
      watcher = watch(dir, { persistent: true }, (_event, name) => this.event(dir, name === null || name === undefined ? undefined : String(name)));
    } catch {
      return;
    }
    watcher.on("error", () => this.forget(dir));
    this.watchers.set(dir, { watcher, ino, files: this.files(dir, entries) });
    for (const entry of entries) {
      if (entry.isDirectory() && !this.skipFolder(join(dir, entry.name), entry.name)) this.watchTree(join(dir, entry.name));
    }
  }

  /** The files in a folder that count, each with its modification time and size. */
  private files(dir: string, entries: Dirent[]): Map<string, string> {
    const files = new Map<string, string>();
    for (const entry of entries) {
      if (entry.isDirectory() || !this.counts(join(dir, entry.name), entry.name)) continue;
      try {
        const stat = statSync(join(dir, entry.name));
        files.set(entry.name, `${stat.mtimeMs}:${stat.size}`);
      } catch {
        // Gone already.
      }
    }
    return files;
  }

  /** The files that count in a watched folder made, changed or removed since it was last looked at. */
  private changes(dir: string): string[] {
    const watched = this.watchers.get(dir);
    if (!watched) return [];
    let files: Map<string, string>;
    try {
      files = this.files(dir, readdirSync(dir, { withFileTypes: true }));
    } catch {
      return [];
    }
    const before = watched.files;
    watched.files = files;
    const changed: string[] = [];
    for (const [name, stamp] of files) if (before.get(name) !== stamp) changed.push(join(dir, name));
    for (const name of before.keys()) if (!files.has(name)) changed.push(join(dir, name));
    return changed;
  }

  /** Stops watching a folder and the folders in it. */
  private forget(dir: string): void {
    for (const [path, { watcher }] of this.watchers) {
      if (path === dir || path.startsWith(dir + sep)) {
        watcher.close();
        this.watchers.delete(path);
      }
    }
  }

  private event(dir: string, name: string | undefined): void {
    // What changed is what the folder holds now against what it held when last looked at, whatever the event names:
    // events can be merged, Bun may report a change to a source file under the name of another file changed in that
    // folder just before (a loader module), or only the name a file renamed over it had (an atomic save); and an event
    // that comes again, or late, for a change already seen changes nothing.
    for (const path of this.changes(dir)) this.changed(path);
    if (name === undefined) return;
    const path = join(dir, name);
    const leaf = name.split(/[\\/]/).pop()!;
    let folder: number | undefined;
    try {
      const stat = statSync(path);
      folder = stat.isDirectory() ? stat.ino : undefined;
    } catch {
      folder = undefined;
    }
    if (folder !== undefined) {
      if (this.skipFolder(path, leaf) || this.watchers.get(path)?.ino === folder) return;
      // Made, or moved in, or made again (a rebuild's new dist): watched afresh, and what's in it counts as changed.
      this.forget(path);
      this.watchTree(path);
      return this.changed(path);
    }
    if (this.watchers.has(path)) {
      // A watched folder removed (a rebuild clearing dist).
      this.forget(path);
      return this.changed(path);
    }
  }
}
