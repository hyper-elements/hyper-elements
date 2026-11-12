// The script of the playground's sandboxed frame (see ../README.md). The frame has an origin of its own and no
// network, so the page hands it the bundles as text. It runs each request in a Web Worker made from them and stops a
// worker that takes too long: the code a visitor wrote runs only in those workers, never in this document.
//
// A worker answers one request and is then closed, so nothing one run changed reaches the next. One more is always
// kept ready, already loaded, so the next request doesn't wait for it.
import type { Request, Result } from "../protocol";

type Bundle = "core" | "pdf" | "image" | "clients";
type FromPage =
  | { type: "bundle"; name: Bundle; code: string }
  | { type: "wasm"; bytes: ArrayBuffer }
  | { type: "run"; id: number; request: Request; needs: Bundle[]; timeout: number }
  | { type: "cancel"; id: number };

const page = window.parent;
const bundles: Partial<Record<Bundle, string>> = {};
let coreUrl: string | undefined;
let resvg: Promise<WebAssembly.Module> | undefined;

/** The worker kept ready, and the bundles it was loaded with (those the last request needed). */
let standby: Worker | undefined;
let warmWith: Bundle[] = [];

const MAX_RUNNING = 3;
const running = new Map<number, { worker: Worker; timer: number }>();
const waiting: Array<Extract<FromPage, { type: "run" }>> = [];

const extras = (names: Bundle[]) => names.filter((name) => name !== "core" && bundles[name]).map((name) => ({ name, code: bundles[name] as string }));

function spawn(): Worker {
  const worker = new Worker(coreUrl as string, { name: "hyper-elements-playground" });
  worker.postMessage({ type: "warm", extras: extras(warmWith) });
  return worker;
}

const answer = (id: number, result: Partial<Result>, transfer: Transferable[] = []) => page.postMessage({ type: "result", id, result }, "*", transfer);

const failed = (kind: "timeout" | "internal", message: string, request: Request): Partial<Result> => ({ ok: false, kind: request.kind, root: null, diagnostics: [], nodes: [], logs: [], ms: 0, error: { kind, message } });

function finish(id: number) {
  const run = running.get(id);
  if (!run) return;
  clearTimeout(run.timer);
  // Closed whatever it answered: the next request gets a worker nothing has run in.
  run.worker.terminate();
  running.delete(id);
  standby ??= spawn();
  const next = waiting.shift();
  if (next) start(next);
}

async function start(run: Extract<FromPage, { type: "run" }>) {
  if (running.size >= MAX_RUNNING) {
    waiting.push(run);
    return;
  }
  const { id, request, needs, timeout } = run;
  warmWith = needs;
  const worker = standby ?? spawn();
  standby = undefined;
  const timer = window.setTimeout(() => {
    answer(id, failed("timeout", `Stopped after ${Math.round(timeout / 1000)} seconds. Check the code for a loop that never ends`, request));
    finish(id);
  }, timeout);
  running.set(id, { worker, timer });
  worker.addEventListener("message", (event: MessageEvent<{ id?: unknown; result?: Result }>) => {
    // One answer per request: anything else a worker sends is dropped, and the worker with it.
    if (!running.has(id)) return;
    const { result } = event.data ?? {};
    if (event.data?.id === id && result && typeof result === "object") answer(id, result, result.bytes instanceof Uint8Array ? [result.bytes.buffer] : []);
    else answer(id, failed("internal", "The sandbox answered with something else than a result", request));
    finish(id);
  });
  worker.addEventListener("error", (event) => {
    if (!running.has(id)) return;
    answer(id, failed("internal", `The sandbox's worker failed: ${event.message || "unknown error"}`, request));
    finish(id);
  });
  let wasm: WebAssembly.Module | undefined;
  if (needs.includes("image") && resvg) {
    try {
      wasm = await resvg;
    } catch {
      // The image writer says it has no resvg.
    }
  }
  if (running.has(id)) worker.postMessage({ type: "run", id, request, extras: extras(needs), wasm });
}

addEventListener("message", (event: MessageEvent<FromPage>) => {
  if (event.source !== page) return;
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "bundle") {
    bundles[message.name] = message.code;
    if (message.name === "core") {
      coreUrl = URL.createObjectURL(new Blob([message.code], { type: "text/javascript" }));
      standby = spawn();
      page.postMessage({ type: "ready" }, "*");
    }
  } else if (message.type === "wasm") {
    resvg = WebAssembly.compile(message.bytes);
    resvg.catch(() => undefined);
  } else if (message.type === "run") {
    if (!coreUrl) answer(message.id, failed("internal", "The sandbox has no runtime yet", message.request));
    else void start(message);
  } else if (message.type === "cancel") {
    const index = waiting.findIndex((run) => run.id === message.id);
    if (index !== -1) waiting.splice(index, 1);
    finish(message.id);
  }
});

page.postMessage({ type: "loaded" }, "*");
