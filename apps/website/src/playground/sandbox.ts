// The page's side of the playground's sandbox (playground/README.md): a hidden frame with an origin of its own and no
// network, which runs the code and answers with data. This file makes the frame, hands it the runtime as text, sends
// requests and reads each answer as something the code could have written: only the fields a result has, each of the
// type and size it should be.
import type { Diagnostic, PlaygroundError, Preview, Request, Result, RootName, SourceNode } from "../../playground/protocol";

export type Bundle = "core" | "pdf" | "image" | "clients";

/** The frame runs scripts and nothing else of the page's: no same-origin access, no forms, no popups, no navigation of the page. */
const SANDBOX = "allow-scripts";
/** Inside it: nothing loads from the network. Scripts are the runner (inline) and the workers it makes from text. */
const POLICY = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; worker-src blob:; child-src blob:";

const TIMEOUTS: Record<Request["kind"], number> = { render: 8000, pdf: 25000, image: 25000, previews: 25000, describe: 8000 };
/** How long after the frame's own timeout the page gives up on the frame and makes another. */
const GRACE = 2500;

const ROOTS: readonly string[] = ["Email", "Page", "Document", "Canvas"];
const KINDS: readonly string[] = ["syntax", "import", "export", "runtime", "template", "internal", "timeout"];
const SEVERITIES: readonly string[] = ["error", "warning", "info"];
const LEVELS: readonly string[] = ["log", "info", "warn", "error"];

// ─── Reading an answer ─────────────────────────────────────────────────────

const text = (value: unknown, limit: number): string | undefined => (typeof value === "string" ? (value.length > limit ? value.slice(0, limit) : value) : undefined);
const count = (value: unknown, max = 1e7): number | undefined => (typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), max) : undefined);
const list = (value: unknown, limit: number): unknown[] => (Array.isArray(value) ? value.slice(0, limit) : []);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

function diagnostic(value: unknown): Diagnostic | undefined {
  const d = record(value);
  const code = text(d.code, 120);
  const message = text(d.message, 4000);
  if (!code || message === undefined) return undefined;
  const see = text(d.see, 500);
  return {
    code,
    message,
    severity: (SEVERITIES.includes(d.severity as string) ? d.severity : "info") as Diagnostic["severity"],
    path: text(d.path, 500) ?? "",
    nodeId: text(d.nodeId, 200),
    clients: Array.isArray(d.clients) ? list(d.clients, 40).flatMap((c) => text(c, 60) ?? []) : undefined,
    fix: text(d.fix, 4000),
    // Shown as a link: an https address only.
    see: see && /^https:\/\//.test(see) ? see : undefined,
    node: text(d.node, 500),
    line: count(d.line, 1e6),
  };
}

function failure(value: unknown): PlaygroundError | undefined {
  const e = record(value);
  const message = text(e.message, 4000);
  if (message === undefined) return undefined;
  return { kind: (KINDS.includes(e.kind as string) ? e.kind : "runtime") as PlaygroundError["kind"], message, line: count(e.line, 1e6), column: count(e.column, 1e6) };
}

/** A result with only what a result has. Anything else the sandbox sent is dropped here. */
function read(value: unknown, kind: Request["kind"]): Result {
  const r = record(value);
  const size = record(r.size);
  const theme = record(r.theme);
  const assets = record(r.assets);
  const bytes = r.bytes instanceof Uint8Array && r.bytes.length <= 40e6 ? r.bytes : undefined;
  const result: Result = {
    ok: r.ok === true,
    kind,
    root: (ROOTS.includes(r.root as string) ? r.root : null) as RootName | null,
    error: failure(r.error),
    diagnostics: list(r.diagnostics, 500).flatMap((d) => diagnostic(d) ?? []),
    nodes: list(r.nodes, 5000).flatMap((n): SourceNode[] => {
      const node = record(n);
      const path = text(node.path, 500);
      const type = text(node.type, 80);
      return path && type ? [{ path, type, line: count(node.line, 1e6) }] : [];
    }),
    logs: list(r.logs, 50).flatMap((l) => {
      const log = record(l);
      const message = text(log.message, 2000);
      return message === undefined ? [] : [{ level: (LEVELS.includes(log.level as string) ? log.level : "log") as Result["logs"][number]["level"], message }];
    }),
    ms: count(r.ms, 1e6) ?? 0,
    html: text(r.html, 6e6),
    text: text(r.text, 2e6),
    outline: text(r.outline, 2e6),
    outlinePaths: Array.isArray(r.outlinePaths) ? list(r.outlinePaths, 20000).map((p) => text(p, 500) ?? "") : undefined,
    blocks: Array.isArray(r.blocks)
      ? list(r.blocks, 20000).flatMap((b) => {
          const block = record(b);
          const path = text(block.path, 500);
          const offset = count(block.offset, 1e8);
          return path && offset !== undefined ? [{ path, type: text(block.type, 80) ?? "", offset }] : [];
        })
      : undefined,
    theme: r.theme ? { tokens: count(theme.tokens) ?? 0, styles: list(theme.styles, 200).flatMap((s) => text(s, 80) ?? []), variants: list(theme.variants, 200).flatMap((s) => text(s, 120) ?? []) } : undefined,
    size: count(size.width, 20000) && count(size.height, 20000) ? { width: count(size.width, 20000)!, height: count(size.height, 20000)! } : undefined,
    assets: r.assets
      ? {
          fonts: list(assets.fonts, 24).flatMap((f) => {
            const font = record(f);
            const family = text(font.family, 80);
            return family ? [{ family, weight: count(font.weight, 1000) ?? 400, style: font.style === "italic" ? ("italic" as const) : ("normal" as const) }] : [];
          }),
          images: list(assets.images, 24).flatMap((u) => text(u, 2000) ?? []),
        }
      : undefined,
    bytes,
    previews: Array.isArray(r.previews)
      ? list(r.previews, 12).flatMap((p): Preview[] => {
          const preview = record(p);
          const html = text(preview.html, 12e6);
          const id = text(preview.id, 80);
          return html && id ? [{ id, client: text(preview.client, 80) ?? id, dark: preview.dark === true, width: count(preview.width, 4000) ?? 600, approximate: preview.approximate === true, html }] : [];
        })
      : undefined,
    skipped: Array.isArray(r.skipped) ? list(r.skipped, 40).map((s) => ({ client: text(record(s).client, 80) ?? "", reason: text(record(s).reason, 500) ?? "" })) : undefined,
    clientNames: r.clientNames && typeof r.clientNames === "object" ? Object.fromEntries(Object.entries(record(r.clientNames)).slice(0, 60).flatMap(([id, name]) => (/^[a-z0-9-]{1,40}$/.test(id) && text(name, 80) ? [[id, text(name, 80)!]] : []))) : undefined,
    components: Array.isArray(r.components)
      ? list(r.components, 200).flatMap((c) => {
          const component = record(c);
          const name = text(component.name, 60);
          const named = (value: unknown) => list(value, 200).flatMap((p) => (text(record(p).name, 60) ? [{ name: text(record(p).name, 60)!, detail: text(record(p).detail, 200) ?? "" }] : []));
          return name && /^[A-Z][\w.]*$/.test(name) ? [{ name, summary: text(component.summary, 400) ?? "", props: named(component.props), styles: named(component.styles) }] : [];
        })
      : undefined,
  };
  // A result that says it's fine and carries an error isn't.
  if (result.error) result.ok = false;
  return result;
}

const failed = (kind: Request["kind"], error: PlaygroundError): Result => ({ ok: false, kind, root: null, error, diagnostics: [], nodes: [], logs: [], ms: 0 });

// ─── The frame ─────────────────────────────────────────────────────────────

export interface SandboxFiles {
  /** Where the runtime is served: `${base}/${name}.js`, and `${base}/resvg.wasm`. */
  base: string;
  /** Added to each URL, so a new build of the site isn't served an old runtime from the cache. */
  version: string;
}

export class Sandbox {
  private frame: HTMLIFrameElement | undefined;
  private starting: Promise<void> | undefined;
  private sent = new Set<string>();
  private sequence = 0;
  private pending = new Map<number, { resolve: (result: Result) => void; kind: Request["kind"]; timer: number; group?: string }>();
  private texts = new Map<string, Promise<string>>();
  private wasm: Promise<ArrayBuffer> | undefined;

  constructor(private files: SandboxFiles) {
    addEventListener("message", (event) => this.receive(event));
  }

  private url(file: string) {
    return `${this.files.base}/${file}?v=${encodeURIComponent(this.files.version)}`;
  }

  private bundle(name: string): Promise<string> {
    if (!this.texts.has(name)) {
      const loading = fetch(this.url(`${name}.js`)).then((response) => {
        if (!response.ok) throw new Error(`${name}.js: ${response.status}`);
        return response.text();
      });
      // A failed download is tried again by the next request.
      loading.catch(() => this.texts.delete(name));
      this.texts.set(name, loading);
    }
    return this.texts.get(name)!;
  }

  /** The runtime downloaded ahead of the first request that needs it. */
  preload(names: Bundle[]) {
    for (const name of names) void this.bundle(name).catch(() => undefined);
    if (names.includes("image")) void this.resvg().catch(() => undefined);
  }

  private resvg(): Promise<ArrayBuffer> {
    this.wasm ??= fetch(this.url("resvg.wasm")).then((response) => {
      if (!response.ok) throw new Error(`resvg.wasm: ${response.status}`);
      return response.arrayBuffer();
    });
    this.wasm.catch(() => (this.wasm = undefined));
    return this.wasm;
  }

  /** The frame made and its runtime loaded. */
  ready(): Promise<void> {
    this.starting ??= this.start();
    this.starting.catch(() => (this.starting = undefined));
    return this.starting;
  }

  private async start(): Promise<void> {
    const [runner, core] = await Promise.all([this.bundle("runner"), this.bundle("core")]);
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", SANDBOX);
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.title = "The playground's sandbox";
    frame.hidden = true;
    frame.dataset.playgroundSandbox = "";
    // The whole document is written here: nothing a visitor wrote is ever part of it.
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${POLICY}"></head><body><script>${runner.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
    this.frame = frame;
    this.sent = new Set();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("The sandbox didn't start")), 20000);
      const listen = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow) return;
        if (event.data?.type === "loaded") this.post({ type: "bundle", name: "core", code: core });
        if (event.data?.type === "ready") {
          clearTimeout(timer);
          removeEventListener("message", listen);
          resolve();
        }
      };
      addEventListener("message", listen);
      document.body.append(frame);
    });
    this.sent.add("core");
  }

  private post(message: unknown, transfer: Transferable[] = []) {
    // The frame's origin is opaque, so it can't be named: "*" reaches only this frame's window.
    this.frame?.contentWindow?.postMessage(message, "*", transfer);
  }

  private receive(event: MessageEvent) {
    if (!this.frame || event.source !== this.frame.contentWindow) return;
    const { type, id, result } = record(event.data);
    if (type !== "result" || typeof id !== "number") return;
    const waiting = this.pending.get(id);
    if (!waiting) return;
    this.pending.delete(id);
    clearTimeout(waiting.timer);
    waiting.resolve(read(result, waiting.kind));
  }

  /** The frame thrown away with everything in it; the next request makes another. */
  private restart(reason: string) {
    this.frame?.remove();
    this.frame = undefined;
    this.starting = undefined;
    for (const [, waiting] of this.pending) {
      clearTimeout(waiting.timer);
      waiting.resolve(failed(waiting.kind, { kind: "timeout", message: reason }));
    }
    this.pending.clear();
  }

  /** One request, answered once. Never rejects: what went wrong is the result's `error`. */
  async run(request: Request, needs: Bundle[] = [], group?: string): Promise<Result> {
    try {
      await this.ready();
      for (const name of needs) {
        if (this.sent.has(name)) continue;
        const code = await this.bundle(name);
        if (this.sent.has(name)) continue;
        this.sent.add(name);
        this.post({ type: "bundle", name, code });
        if (name === "image") {
          const bytes = await this.resvg();
          this.post({ type: "wasm", bytes: bytes.slice(0) });
        }
      }
    } catch (error) {
      return failed(request.kind, { kind: "internal", message: `The playground's runtime didn't load (${(error as Error).message}). Check your connection and try again` });
    }
    const id = ++this.sequence;
    const timeout = TIMEOUTS[request.kind];
    return new Promise<Result>((resolve) => {
      const timer = window.setTimeout(() => {
        if (this.pending.has(id)) this.restart(`Stopped after ${Math.round(timeout / 1000)} seconds: the sandbox stopped answering`);
      }, timeout + GRACE);
      this.pending.set(id, { resolve, kind: request.kind, timer, group });
      this.post({ type: "run", id, request, needs, timeout });
    });
  }

  /** Requests that are no longer wanted (the code changed under them): their workers are stopped, and they're answered as superseded. */
  cancel(group: string) {
    for (const [id, waiting] of this.pending) {
      if (waiting.group !== group) continue;
      this.post({ type: "cancel", id });
      clearTimeout(waiting.timer);
      this.pending.delete(id);
      waiting.resolve(failed(waiting.kind, { kind: "internal", message: SUPERSEDED }));
    }
  }
}

/** The message of a result whose request was cancelled. */
export const SUPERSEDED = "superseded";
