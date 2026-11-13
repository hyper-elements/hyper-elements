// The playground's page: the editor, the root switch, the output's views and the checks, around a sandbox that runs
// the code (sandbox.ts). What the sandbox answers is data: text is written as text, HTML goes into sandboxed frames
// (preview.ts), a PDF or an image into a file of the type this page says it is.
import type { Diagnostic, FontNeed, Request, Result, RootName } from "../../playground/protocol";
import { installAgentPaths } from "./agent";
import { fetchAssets } from "./assets";
import { Checks, clientName, type Pick } from "./checks";
import { $, $$, bytes, copy, download, h, plural } from "./dom";
import { Templates, type StarterInfo } from "./templates";
import { opensSafely, previewDevice, previewFile, PreviewFrame } from "./preview";
import { rootsIn, ROOTS, switchRoot, type Stash } from "./roots";
import { Sandbox, SUPERSEDED, type Bundle } from "./sandbox";
import { readHash, shareUrl } from "./share";

export type View = "preview" | "clients" | "html" | "text" | "pdf" | "png" | "svg";
type Device = "desktop" | "phone";
type Layout = "split" | "code" | "preview";

interface Boot {
  starter: StarterInfo & { source: string };
  starters: StarterInfo[];
  engine: string;
  build: string;
}

// The editor (CodeMirror) is most of this page's script: a file of its own, fetched beside this one.
const { Editor } = await import("./editor");

const boot = JSON.parse($("#playground-boot").textContent ?? "{}") as Boot;
const page = $("[data-playground]");
const bench = $("[data-bench]");
const stage = $("[data-stage]");
const veil = $("[data-veil]");

// ─── What the views are ────────────────────────────────────────────────────

const VIEWS: Record<RootName, View[]> = {
  Email: ["preview", "clients", "html", "text"],
  Page: ["preview", "html", "text"],
  Document: ["preview", "pdf", "html", "text"],
  Canvas: ["png", "svg", "html", "text"],
};
const VIEW_NAMES: readonly View[] = ["preview", "clients", "html", "text", "pdf", "png", "svg"];

// What the bar above the stage shows: a tab for each slot the root has, and where a slot shows one of two formats
// (the source as HTML or plain text, a Document as its pages or its PDF), a switch beside them. A Canvas's preview is
// its PNG; its SVG is a link's or an agent's (`view=svg`), and the Export menu's.
type Slot = "preview" | "clients" | "source";
const SLOTS: Record<RootName, Slot[]> = {
  Email: ["preview", "clients", "source"],
  Page: ["preview", "source"],
  Document: ["preview", "source"],
  Canvas: ["preview", "source"],
};
const SLOT_LABELS: Record<Slot, string> = { preview: "Preview", clients: "Email clients", source: "Source" };
const slotOf = (view: View): Slot => (view === "clients" ? "clients" : view === "html" || view === "text" ? "source" : "preview");
function formatsOf(root: RootName | null, slot: Slot): View[] {
  if (slot === "source") return ["html", "text"];
  if (slot === "preview" && root === "Document") return ["preview", "pdf"];
  return [];
}
const FORMAT_LABELS: Partial<Record<View, [string, string]>> = {
  html: ["HTML", "The HTML render() writes"],
  text: ["Plain text", "The plain text render() writes"],
  preview: ["Pages", "The print HTML render() writes, as pages"],
  pdf: ["PDF", "The PDF renderPdf() writes"],
};
const FILE_TYPES = { pdf: "application/pdf", png: "image/png", svg: "image/svg+xml" } as const;
type FileKind = keyof typeof FILE_TYPES;
const isFile = (view: View): view is FileKind => view === "pdf" || view === "png" || view === "svg";

// ─── State ─────────────────────────────────────────────────────────────────

const STORE = "hyper-elements-playground";
interface Saved {
  /** The visitor's draft: code they changed here. A link's or an agent's code isn't one until they change it. */
  code?: string;
  /** Where a draft's code first came from, where it wasn't typed here or a starter's. */
  from?: "link" | "agent";
  starter?: string;
  x?: number;
  y?: number;
  inspect?: boolean;
  /** Code the visitor changed under another root than the one that's up, kept for when they pick that root again. */
  drafts?: Partial<Record<RootName, Draft>>;
}
interface Draft {
  code: string;
  from?: "link" | "agent";
  starter?: string;
}
const saved: Saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Saved;
  } catch {
    return {};
  }
})();
let saving: number | undefined;
function save(patch: Saved) {
  Object.assign(saved, patch);
  clearTimeout(saving);
  saving = window.setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {
      // Storage is off or full: the page works without it.
    }
  }, 400);
}

const state = {
  /** Where the code came from: a starter, a link, this browser's last visit, or an agent. */
  origin: "starter" as "starter" | "link" | "saved" | "agent",
  starter: boot.starter.id as string | null,
  root: boot.starter.root as RootName | null,
  view: "preview" as View,
  device: "desktop" as Device,
  layout: "split" as Layout,
  inspect: saved.inspect ?? true,
  /** Whether the visitor has changed the code that's up (since it was a starter's, a link's or an agent's). */
  changed: false,
  /** The latest answer, and the latest that rendered: its output stays up while the code is being fixed. */
  result: null as Result | null,
  good: null as Result | null,
  /** The code `good` was rendered from. */
  goodCode: "",
  /** The block picked in the preview, a diagnostic or the outline. */
  selected: null as string | null,
};

const sandbox = new Sandbox({ base: "/playground/runtime", version: boot.build });
const stash: Stash = {};

// ─── The editor ────────────────────────────────────────────────────────────

let typing: number | undefined;
const editor = new Editor({
  parent: $("[data-editor]"),
  code: boot.starter.source,
  onChange(code) {
    // Changed here, so it's the visitor's draft now, kept for their next visit. A link's or an agent's code that
    // they changed still says where it came from.
    const from = state.origin === "link" || state.origin === "agent" ? state.origin : undefined;
    if (!from) state.origin = "saved";
    state.changed = true;
    save({ code, from, starter: state.starter ?? undefined });
    clearTimeout(typing);
    typing = window.setTimeout(() => void render(), 260);
  },
  onCursor(line) {
    if (!editor.view.hasFocus) return;
    const node = nodeAt(line);
    if (node && state.view === "preview") preview.highlight(node, "select");
  },
  onRun() {
    clearTimeout(typing);
    void render();
  },
});

// ─── Where things are in the code ──────────────────────────────────────────

/** The line of the component at `path`, or of the nearest one that holds it. */
function lineOf(path: string | undefined, result = state.result): number | undefined {
  if (!path || !result) return undefined;
  const lines = new Map(result.nodes.map((node) => [node.path, node.line]));
  for (let at = path; at; at = at.slice(0, Math.max(at.lastIndexOf("."), 0))) if (lines.get(at)) return lines.get(at);
  return undefined;
}

/** The component the code's `line` is in: the last one that starts at or before it. */
function nodeAt(line: number): string | undefined {
  if (editor.code !== state.goodCode) return undefined;
  let found: string | undefined;
  let best = 0;
  for (const node of state.good?.nodes ?? []) {
    if (node.line && node.line <= line && node.line >= best) {
      best = node.line;
      found = node.path;
    }
  }
  return found;
}

// ─── The preview ───────────────────────────────────────────────────────────

const linkbar = $("[data-linkbar]");
let linkTimer: number | undefined;
const preview = new PreviewFrame($("[data-preview]"), "The template, rendered", {
  hover(path) {
    checks.mark(path);
    editor.pointAt(path ? (lineOf(path, state.good) ?? null) : null);
  },
  select(path) {
    state.selected = path;
    const line = lineOf(path, state.good);
    if (line) editor.goTo(line, 1, false);
    checks.mark(path);
    if (state.view === "html") drawSource();
  },
  link(href) {
    // The frame can't open anything. The page shows where the link goes, and opens a web or mail address when asked.
    $("[data-linkbar-href]").textContent = href;
    const open = $<HTMLAnchorElement>("[data-linkbar-open]");
    open.hidden = !opensSafely(href);
    if (opensSafely(href)) open.href = href;
    else open.removeAttribute("href");
    linkbar.hidden = false;
    clearTimeout(linkTimer);
    linkTimer = window.setTimeout(() => (linkbar.hidden = true), 6000);
  },
});

/** The sheet's width: the stage's, or, where the stage is narrower than the template's desktop layout, that layout scaled to fit. */
function fitDevice() {
  const device = $("[data-device-frame]");
  const across = stage.clientWidth;
  if (!across) return;
  const narrow = matchMedia("(max-width: 860px)").matches;
  let width: number;
  let scale = 1;
  if (state.device === "phone") {
    // A phone's width; on a phone, the screen's own.
    width = narrow ? Math.min(across - 16, 430) : Math.min(395, across - 20);
    device.style.removeProperty("--pg-device-h");
    device.style.removeProperty("bottom");
  } else {
    const available = across - (narrow ? 16 : 28);
    // An email keeps its desktop layout down to its own width; a document its page. A Page is a web page: it reflows.
    const own = Number(/^\w+ (\d+)px/.exec(state.good?.outline ?? "")?.[1]) || 600;
    const least = state.root === "Email" ? own + 40 : state.root === "Document" ? own + 140 : state.root === "Canvas" ? own : 0;
    scale = least > available ? available / least : 1;
    width = Math.round(available / scale);
    device.style.setProperty("--pg-device-h", `${Math.round((stage.clientHeight - (narrow ? 10 : 14)) / scale)}px`);
    device.style.bottom = "auto";
  }
  device.style.setProperty("--pg-device-w", `${width}px`);
  device.style.setProperty("--pg-device-scale", String(scale));
  device.style.setProperty("--pg-device-x", `${Math.round((across - width * scale) / 2)}px`);
}
new ResizeObserver(fitDevice).observe(stage);

// ─── The checks ────────────────────────────────────────────────────────────

const checks = new Checks(
  { diagnostics: $("[data-diagnostics]"), outline: $("[data-outline]"), console: $("[data-console]") },
  {
    point(pick) {
      const line = pick ? (pick.line ?? lineOf(pick.path)) : undefined;
      editor.pointAt(line ?? null, pick?.tone === "error" ? "error" : pick?.tone === "warning" ? "warning" : "plain");
      if (state.view === "preview") preview.highlight(pick?.path ?? null, pick?.tone ?? "info", { reveal: true });
    },
    go(pick: Pick) {
      const line = pick.line ?? lineOf(pick.path);
      if (pick.path) state.selected = pick.path;
      if (line) {
        if (matchMedia("(max-width: 860px)").matches) showPane("code");
        editor.goTo(line);
      }
      if (state.view === "html") drawSource();
    },
  },
);
/** What the PDF or the image of the current code added to its diagnostics. */
let fileDiagnostics: Diagnostic[] = [];

// ─── Rendering ─────────────────────────────────────────────────────────────

let sequence = 0;
let shownRoot: RootName | null = null;
let sawEmail = boot.starter.root === "Email";
let settle: Array<(result: Result) => void> = [];

// An Email is always checked against the email clients; the other roots have no clients to check.
const wantsClients = (code: string) => sawEmail || /<Email[\s/>]/.test(code);

/** Render the editor's code. Resolves with the answer to the latest call: an earlier one is dropped. */
export async function render(): Promise<Result> {
  const mine = ++sequence;
  const code = editor.code;
  setStatus("rendering");
  sandbox.cancel("editor");
  const needs: Bundle[] = wantsClients(code) ? ["clients"] : [];
  let result = await sandbox.run({ kind: "render", code, checks: true }, needs, "editor");
  if (mine !== sequence) return new Promise((resolve) => settle.push(resolve));
  if (result.root === "Email" && !needs.includes("clients")) {
    // An Email the code's text didn't give away: again, with its client checks.
    sawEmail = true;
    result = await sandbox.run({ kind: "render", code, checks: true }, ["clients"], "editor");
    if (mine !== sequence) return new Promise((resolve) => settle.push(resolve));
  }
  sawEmail = result.root === "Email";
  apply(result, code);
  for (const resolve of settle.splice(0)) resolve(result);
  return result;
}

function apply(result: Result, code: string) {
  state.result = result;
  fileDiagnostics = [];
  if (result.ok) {
    state.good = result;
    state.goodCode = code;
    stage.dataset.hasOutput = "";
    if (state.selected && !result.nodes.some((node) => node.path === state.selected)) state.selected = null;
  }
  if (result.root) state.root = result.root;
  if (result.ok && result.root !== shownRoot) {
    // Another root than the one on show: its output arrives, rather than replacing the last in place.
    if (shownRoot) {
      stage.dataset.arriving = "";
      window.setTimeout(() => delete stage.dataset.arriving, 520);
    }
    shownRoot = result.root;
  }
  drawRoots();
  drawViews();
  drawProblems();
  checks.show(result);
  drawCounts();
  if (result.ok) {
    showOutput();
    hideVeil();
    delete stage.dataset.stale;
  } else if (state.good) {
    stage.dataset.stale = "";
    hideVeil();
  } else {
    showVeil("block", "error", "This template doesn't render yet", firstProblem(result), "See what to fix");
  }
  setStatus(result.ok ? "ok" : "error");
}

const firstProblem = (result: Result): string => {
  if (result.error && result.error.kind !== "template") return `${result.error.line ? `Line ${result.error.line}: ` : ""}${result.error.message}`;
  const error = result.diagnostics.find((d) => d.severity === "error");
  return error ? `${error.code}: ${error.message}` : (result.error?.message ?? "");
};

/** The editor's marks: the code's own error, and each diagnostic on the line it's about. */
function drawProblems() {
  const result = state.result;
  if (!result) return;
  const problems = result.diagnostics.filter((d) => d.line).map((d) => ({ line: d.line!, severity: d.severity, message: d.fix ? `${d.message}\n${d.fix}` : d.message, source: d.code }));
  if (result.error?.line && result.error.kind !== "template") problems.unshift({ line: result.error.line, severity: "error", message: result.error.message, source: result.error.kind });
  editor.setProblems(problems);
}

function drawCounts() {
  const counts = checks.counts();
  const total = counts.error + counts.warning + counts.info;
  const tone = counts.error ? "error" : counts.warning ? "warning" : "";
  for (const badge of $$("[data-count='diagnostics'], [data-count='problems']")) {
    const loud = badge.dataset.count === "problems" ? counts.error + counts.warning : total;
    badge.hidden = !loud;
    badge.textContent = String(loud);
    badge.dataset.tone = tone;
  }
  const logs = state.result?.logs.length ?? 0;
  const badge = $("[data-count='console']");
  badge.hidden = !logs;
  badge.textContent = String(logs);
  // The console's tab is there while the code logs something (or while it's open).
  const tab = $("[data-check='console']");
  tab.hidden = !logs && tab.getAttribute("aria-selected") !== "true";
}

function setStatus(status: "loading" | "rendering" | "ok" | "error") {
  page.dataset.status = status;
  document.documentElement.dataset.renderStatus = status === "loading" ? "rendering" : status;
  const text = $("[data-status-text]");
  const meta = $("[data-status-meta]");
  const result = state.result;
  if (status === "rendering" || status === "loading" || !result) return;
  if (result.ok) {
    const counts = checks.counts();
    const notes = [counts.warning && plural(counts.warning, "warning"), counts.info && plural(counts.info, "note")].filter(Boolean).join(", ");
    text.textContent = `Rendered in ${result.ms} ms${notes ? ` · ${notes}` : ""}`;
    meta.textContent = [result.html && `${bytes(new Blob([result.html]).size)} HTML`, plural(result.nodes.length, "component")].filter(Boolean).join(" · ");
  } else {
    const errors = result.diagnostics.filter((d) => d.severity === "error").length;
    text.textContent = result.error?.kind === "template" ? `${plural(errors || 1, "error")} to fix: each says what to write instead` : result.error?.kind === "syntax" ? `Syntax error${result.error.line ? ` on line ${result.error.line}` : ""}` : (result.error?.message ?? "Didn't render");
    meta.textContent = state.good ? "showing the last render that worked" : "";
  }
}

// ─── The stage's veil ──────────────────────────────────────────────────────

function showVeil(mode: "block" | "working", tone: "plain" | "error", title: string, note = "", action = "") {
  veil.dataset.on = mode;
  veil.dataset.tone = tone;
  $("[data-veil-title]").textContent = title;
  $("[data-veil-note]").textContent = note;
  veil.querySelector("button")?.remove();
  if (action) $(".pg-veil-card").append(h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => showChecks("diagnostics") }, action));
}
function hideVeil() {
  working = null;
  delete veil.dataset.on;
}

/** What the stage says it's working on (a file being drawn, the client previews), and for whom: only they take it down. */
let working: object | null = null;
function showWorking(owner: object, title: string) {
  working = owner;
  showVeil("working", "plain", title);
}
function doneWorking(owner: object) {
  if (working === owner && veil.dataset.on === "working") hideVeil();
}

// ─── Roots ─────────────────────────────────────────────────────────────────

const rootsHost = $("[data-roots]");
function drawRoots() {
  for (const button of $$<HTMLButtonElement>("[data-root]", rootsHost)) {
    const on = button.dataset.root === state.root;
    button.setAttribute("aria-checked", String(on));
    button.tabIndex = on || !state.root ? 0 : -1;
    if (on) {
      // The thumb goes under it.
      rootsHost.style.setProperty("--pg-thumb-x", `${button.offsetLeft}px`);
      rootsHost.style.setProperty("--pg-thumb-w", `${button.offsetWidth}px`);
      rootsHost.style.setProperty("--pg-thumb-on", "1");
    }
  }
  if (!state.root) rootsHost.style.setProperty("--pg-thumb-on", "0");
}

/** Rewrite the code's root, and render it: an agent's and a link's (`root=`). False where the code's root can't be switched. */
export function setRoot(to: RootName): boolean {
  if (rootsIn(editor.code)[0] === to) return true;
  const switched = switchRoot(editor.code, to, stash);
  if (switched.code === editor.code) return false;
  state.root = to;
  state.selected = null;
  // The new root's first view: an image for a Canvas, the preview for the rest.
  state.view = VIEWS[to].includes(state.view) && !isFile(state.view) && state.view !== "clients" ? state.view : VIEWS[to][0];
  preview.resetScroll();
  drawRoots();
  drawViews();
  const at = switched.at ?? 0;
  editor.setCode(switched.code, { flash: { from: at + 1, to: at + 1 + to.length } });
  return true;
}

// The root picker: each root has a template of its own, one of its starters until the visitor changes it. Picking a
// root puts the code that's up by, with the root it was (changed code is kept for this browser's next visit too), and
// brings back what the picked root had, or its first starter.
interface Left {
  code: string;
  origin: typeof state.origin;
  starter: string | null;
  view: View;
  changed: boolean;
}
const left: Partial<Record<RootName, Left>> = {};
for (const [root, draft] of Object.entries(saved.drafts ?? {}) as Array<[RootName, Draft]>) {
  if (ROOTS.includes(root) && typeof draft?.code === "string") left[root] = { code: draft.code, origin: draft.from ?? "saved", starter: draft.starter ?? null, view: VIEWS[root][0], changed: true };
}
let picks = 0;
/** The root whose template is on its way: until it's in, the code that's up isn't its. */
let arriving: RootName | null = null;

export async function pickRoot(to: RootName): Promise<Result | undefined> {
  if (to === state.root && !arriving) return undefined;
  const mine = ++picks;
  const from = state.root;
  if (from && from !== arriving) {
    left[from] = { code: editor.code, origin: state.origin, starter: state.starter, view: state.view, changed: state.changed };
    const drafts = { ...saved.drafts };
    if (state.changed) drafts[from] = { code: editor.code, from: state.origin === "link" || state.origin === "agent" ? state.origin : undefined, starter: state.starter ?? undefined };
    else delete drafts[from];
    save({ drafts });
  }
  // Shown as picked at once; its template follows.
  arriving = to;
  state.root = to;
  drawRoots();
  const next = left[to] ?? (await firstStarter(to));
  // Another root was picked meanwhile: that pick shows its own.
  if (mine !== picks) return undefined;
  arriving = null;
  if (!next) return undefined;
  delete left[to];
  if (saved.drafts?.[to]) {
    const { [to]: _, ...rest } = saved.drafts;
    save({ drafts: rest });
  }
  state.view = next.view;
  return setCode(next.code, next.origin, next.starter, { changed: next.changed });
}

/** The template a root starts with: its first in the Template menu. */
async function firstStarter(root: RootName): Promise<Left | undefined> {
  const info = boot.starters.find((starter) => starter.root === root);
  const starter = info && (await templates.find(info.id));
  return starter ? { code: starter.source, origin: "starter", starter: starter.id, view: VIEWS[root][0], changed: false } : undefined;
}
rootsHost.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-root]");
  if (button) void pickRoot(button.dataset.root as RootName);
});
rootsHost.addEventListener("keydown", (event) => {
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!step || !state.root) return;
  event.preventDefault();
  const to = ROOTS[(ROOTS.indexOf(state.root) + step + ROOTS.length) % ROOTS.length];
  void pickRoot(to);
  $(`[data-root="${to}"]`, rootsHost).focus();
});

// ─── Views ─────────────────────────────────────────────────────────────────

const viewsHost = $("[data-views]");
/** The view the stage last showed. */
let viewShown: View = "preview";
function drawViews() {
  const views = state.root ? VIEWS[state.root] : (["preview", "html", "text"] as View[]);
  if (!views.includes(state.view)) state.view = views[0];
  if (state.view !== viewShown) {
    // The view that was open is left: what was being made for it is stopped, and the stage stops saying it's working on it.
    if (isFile(viewShown)) {
      fileSequence++;
      sandbox.cancel("editor-file");
    } else if (viewShown === "clients") {
      clientsSequence++;
      sandbox.cancel("editor-clients");
    }
    if (veil.dataset.on === "working") hideVeil();
    viewShown = state.view;
  }
  const slot = slotOf(state.view);
  lastIn[slot] = state.view;
  viewsHost.replaceChildren(
    ...slotsOf(state.root).map((each) =>
      h("button", { type: "button", role: "tab", "aria-selected": String(each === slot), tabindex: each === slot ? 0 : -1, "data-slot": each, onclick: () => setSlot(each) }, SLOT_LABELS[each]),
    ),
  );
  const formats = formatsOf(state.root, slot);
  const formatsHost = $("[data-formats]");
  formatsHost.hidden = formats.length < 2;
  formatsHost.setAttribute("aria-label", slot === "source" ? "Source" : "Pages or PDF");
  formatsHost.replaceChildren(
    ...formats.map((view) =>
      h("button", { type: "button", role: "radio", "aria-checked": String(view === state.view), title: FORMAT_LABELS[view]![1], "data-view-tab": view, onclick: () => setView(view) }, FORMAT_LABELS[view]![0]),
    ),
  );
  stage.dataset.view = state.view;
  for (const pane of $$("[data-view-pane]", stage)) pane.hidden = pane.dataset.viewPane !== state.view;
  const sheet = state.view === "preview";
  const fileTools = $("[data-file-tools]");
  fileTools.hidden = !isFile(state.view);
  if (fileTools.dataset.for !== state.view) fileTools.replaceChildren();
  fileTools.dataset.for = state.view;
  $("[data-devices]").hidden = !(sheet && (state.root === "Email" || state.root === "Page"));
  $("[data-inspect]").hidden = !(sheet && state.root === "Email");
  if (!(state.root === "Email" || state.root === "Page") && state.device === "phone") setDevice("desktop");
}
viewsHost.addEventListener("keydown", (event) => {
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  const slots = slotsOf(state.root);
  if (!step) return;
  event.preventDefault();
  const to = slots[(slots.indexOf(slotOf(state.view)) + step + slots.length) % slots.length];
  setSlot(to);
  $(`[data-slot="${to}"]`, viewsHost).focus();
});

function slotsOf(root: RootName | null): Slot[] {
  return root ? SLOTS[root] : ["preview", "source"];
}
/** The view each slot showed last (the source as plain text stays plain text), for when it's opened again. */
const lastIn: Partial<Record<Slot, View>> = {};
function setSlot(slot: Slot): boolean {
  const views = state.root ? VIEWS[state.root] : (["preview", "html", "text"] as View[]);
  const last = lastIn[slot];
  const to = last && views.includes(last) ? last : (views.find((view) => slotOf(view) === slot) ?? views[0]);
  return setView(to);
}

export function setView(view: View): boolean {
  if (state.root && !VIEWS[state.root].includes(view)) return false;
  state.view = view;
  drawViews();
  showOutput();
  return true;
}

export function setDevice(device: Device) {
  state.device = device;
  stage.dataset.animate = "";
  stage.dataset.device = device;
  for (const button of $$("[data-device]")) button.setAttribute("aria-checked", String(button.dataset.device === device));
  fitDevice();
  window.setTimeout(() => delete stage.dataset.animate, 600);
}
for (const button of $$("[data-device]")) button.addEventListener("click", () => setDevice(button.dataset.device as Device));

const inspectButton = $("[data-inspect]");
function setInspect(on: boolean) {
  state.inspect = on;
  inspectButton.setAttribute("aria-pressed", String(on));
  preview.setInspect(on);
  if (!on) {
    preview.highlight(null);
    editor.pointAt(null);
  }
  save({ inspect: on });
}
inspectButton.addEventListener("click", () => setInspect(!state.inspect));
inspectButton.setAttribute("aria-pressed", String(state.inspect));

/** Put the last good render's output in the view that's open. */
function showOutput() {
  const good = state.good;
  if (!good) return;
  if (state.view === "preview") {
    if (shownHtml !== good.html || shownInspect !== state.inspect) {
      shownHtml = good.html;
      shownInspect = state.inspect;
      const types = new Map((good.blocks ?? []).map((block) => [block.path, `${block.type}${lineOf(block.path, good) ? ` · line ${lineOf(block.path, good)}` : ""}`]));
      if (good.html) preview.show(good.html, { blocks: good.blocks, types, inspect: state.inspect && good.root === "Email" });
    }
    fitDevice();
  } else if (state.view === "html" || state.view === "text") drawSource();
  else if (state.view === "clients") void drawClients();
  else if (isFile(state.view)) void drawFile(state.view);
}
let shownHtml: string | undefined;
let shownInspect = true;

// The HTML as text, the block that's picked marked in it (an Email's block map says where each one is).
function drawSource() {
  const good = state.good;
  if (!good) return;
  if (state.view === "text") {
    $("[data-source='text']").textContent = good.text ?? "";
    return;
  }
  const host = $("[data-source='html']");
  const html = good.html ?? "";
  const block = state.selected ? good.blocks?.find((each) => each.path === state.selected) : undefined;
  if (!block) {
    host.replaceChildren(...markup(html));
    return;
  }
  // The block map counts UTF-8 bytes; the text here is in characters.
  const at = new TextDecoder().decode(new TextEncoder().encode(html).subarray(0, block.offset)).length;
  const start = html.lastIndexOf("<", at);
  const end = html.indexOf(">", at) + 1;
  if (start === -1 || end === 0) {
    host.replaceChildren(...markup(html));
    return;
  }
  const marked = h("mark", { title: `${block.type} at ${block.path}` }, ...markup(html.slice(start, end)));
  host.replaceChildren(...markup(html.slice(0, start)), marked, ...markup(html.slice(end)));
  // Into view inside this pane (scrollIntoView would scroll the page too).
  host.scrollTop = Math.max(0, marked.offsetTop - host.clientHeight / 2);
}

/** HTML as text in the editor's colors: tags, attributes, their values, comments dim. */
function markup(html: string): Node[] {
  const out: Node[] = [];
  const span = (cls: string, text: string) => h("span", { class: cls }, text);
  for (const chunk of html.match(/<!--[\s\S]*?-->|<[^<>]+>|[^<]+|</g) ?? []) {
    if (chunk.startsWith("<!--")) out.push(span("c", chunk));
    else if (chunk.length > 1 && chunk[0] === "<") {
      const [, open, rest] = /^(<\/?[\w:!-]*)([\s\S]*)$/.exec(chunk) ?? [null, chunk, ""];
      out.push(span("t", open as string));
      for (const part of (rest as string).match(/"[^"]*"|'[^']*'|[^\s"'=<>\/]+|[\s=\/>]+/g) ?? []) {
        out.push(/^["']/.test(part) ? span("s", part) : /^[\s=\/>]+$/.test(part) ? span("p", part) : span("a", part));
      }
    } else out.push(document.createTextNode(chunk));
  }
  return out;
}

// ─── A PDF, a PNG, an SVG ──────────────────────────────────────────────────

interface Drawn {
  key: string;
  url: string;
  bytes: Uint8Array;
  size?: { width: number; height: number };
}
const files: Partial<Record<FileKind, Drawn>> = {};
const SIGNATURES: Record<FileKind, (file: Uint8Array) => boolean> = {
  pdf: (file) => new TextDecoder().decode(file.subarray(0, 5)) === "%PDF-",
  png: (file) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => file[i] === byte),
  svg: (file) => /^\s*<(\?xml|svg)[\s>]/.test(new TextDecoder().decode(file.subarray(0, 200))),
};
let fileSequence = 0;

/**
 * Where the page shows a file from. A PDF and a PNG are blobs of their own type: neither runs anything. An SVG can hold
 * a script, and a blob this page makes has its origin, so an SVG opened on its own ("Open image in new tab") would run
 * on the site. An SVG is a data: URL instead, whose document never has this page's origin. (Read by a FileReader, so a
 * large file doesn't hold up the page.)
 */
function fileUrl(kind: FileKind, bytes: Uint8Array): Promise<string> {
  const blob = new Blob([bytes as BlobPart], { type: FILE_TYPES[kind] });
  if (kind !== "svg") return Promise.resolve(URL.createObjectURL(blob));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The file of the last good render, drawn by the sandbox with the fonts and images this page fetched for it. */
async function fileOf(kind: FileKind, code = state.goodCode, needs: { fonts: FontNeed[]; images: string[] } | undefined = state.good?.assets, group = "editor-file", scale = 1): Promise<{ drawn?: Drawn; result: Result; missing: string[] }> {
  if (kind !== "png") scale = 1;
  const key = `${kind}|${scale}|${code}`;
  if (group === "editor-file" && files[kind]?.key === key) return { drawn: files[kind], result: state.good!, missing: [] };
  const assets = await fetchAssets(needs, { fallback: kind !== "pdf" });
  const request: Request = kind === "pdf" ? { kind: "pdf", code, fonts: assets.fonts, images: assets.images } : { kind: "image", code, format: kind, scale, fonts: assets.fonts, images: assets.images };
  const result = await sandbox.run(request, [kind === "pdf" ? "pdf" : "image"], group);
  if (!result.ok || !result.bytes) return { result, missing: assets.missing };
  // It says it's a PDF (a PNG, an SVG): it's kept only if its first bytes agree, as a file of that type and no other.
  if (!SIGNATURES[kind](result.bytes)) return { result: { ...result, ok: false, error: { kind: "internal", message: `The sandbox answered with something that isn't ${kind === "svg" ? "an SVG" : `a ${kind.toUpperCase()}`}` } }, missing: assets.missing };
  const drawn: Drawn = { key, bytes: result.bytes, url: await fileUrl(kind, result.bytes), size: result.size };
  if (group === "editor-file") {
    if (files[kind]?.url.startsWith("blob:")) URL.revokeObjectURL(files[kind]!.url);
    files[kind] = drawn;
  }
  return { drawn, result, missing: assets.missing };
}

async function drawFile(kind: FileKind) {
  const host = $(`[data-file="${kind}"]`);
  const mine = ++fileSequence;
  const owner = {};
  // Still what the stage is showing: not once another file is asked for, or the visitor has moved to another view.
  const wanted = () => mine === fileSequence && state.view === kind;
  const notice = window.setTimeout(() => wanted() && showWorking(owner, kind === "pdf" ? "Writing the PDF…" : `Drawing the ${kind.toUpperCase()}…`), 120);
  sandbox.cancel("editor-file");
  const { drawn, result, missing } = await fileOf(kind);
  clearTimeout(notice);
  doneWorking(owner);
  if (!wanted()) return;
  if (!drawn) {
    if (result.error?.message === SUPERSEDED) return;
    host.replaceChildren(h("div", { class: "pg-file-card" }, h("strong", null, kind === "pdf" ? "The PDF wasn't written" : "The image wasn't drawn"), firstProblem(result)));
    // The bar says nothing about a file there isn't (not the size of the last one that was).
    $("[data-file-tools]").replaceChildren();
    fileDiagnostics = result.diagnostics;
    checks.show(state.result, fileDiagnostics);
    drawCounts();
    return;
  }
  fileDiagnostics = [...result.diagnostics, ...missing.map((what): Diagnostic => ({ code: "playground/not-fetched", severity: "info", message: `The playground couldn't fetch the ${what}, so the ${kind === "pdf" ? "PDF" : "image"} is drawn without it. In your own code you give renderPdf() and renderImage() the file`, path: "root" }))];
  checks.show(state.result, fileDiagnostics);
  drawCounts();
  // What the file is, in the bar above the stage. It's kept from the Export menu.
  const tools = $("[data-file-tools]");
  if (kind === "pdf") {
    const pages = (new TextDecoder("latin1").decode(drawn.bytes).match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    tools.replaceChildren(h("span", { class: "pg-file-facts" }, `${pages ? `${plural(pages, "page")} · ` : ""}${bytes(drawn.bytes.length)}`));
    if ((navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === false) {
      // A browser that shows no PDFs in a page (most phones): the file is there to open or save.
      host.replaceChildren(
        h(
          "div",
          { class: "pg-file-card" },
          h("strong", null, "The PDF is written"),
          `${pages ? `${plural(pages, "page")}, ` : ""}${bytes(drawn.bytes.length)}. This browser doesn't show a PDF inside a page: open it, or download it.`,
          h("a", { class: "btn btn-primary btn-sm", href: drawn.url, target: "_blank", rel: "noopener" }, "Open the PDF"),
        ),
      );
      return;
    }
    // The browser's own PDF viewer draws it (it doesn't load in a sandboxed frame): a file of this page's making, typed as a PDF.
    host.replaceChildren(h("iframe", { title: "The template as a PDF", src: `${drawn.url}#toolbar=0&navpanes=0&view=FitH` }));
  } else {
    tools.replaceChildren(h("span", { class: "pg-file-facts" }, `${kind.toUpperCase()} · ${drawn.size ? `${drawn.size.width} × ${drawn.size.height} · ` : ""}${bytes(drawn.bytes.length)}`));
    // An image element draws a PNG or an SVG without running anything in it.
    host.replaceChildren(h("img", { src: drawn.url, alt: `The template as ${kind === "svg" ? "an SVG" : "a PNG"}`, style: drawn.size ? `aspect-ratio:${drawn.size.width}/${drawn.size.height}` : undefined }));
  }
}

// ─── Email clients ─────────────────────────────────────────────────────────

let clientsKey = "";
let clientsSequence = 0;
async function drawClients() {
  const code = state.goodCode;
  if (clientsKey === code) return;
  const mine = ++clientsSequence;
  const owner = {};
  const tabs = $("[data-clients-tabs]");
  const host = $("[data-clients-stage]");
  showWorking(owner, "Drawing it as each client does…");
  sandbox.cancel("editor-clients");
  // The scripts a preview may run come from the site, not with the previews: without them, no preview is shown.
  const [result, scripts] = await Promise.all([sandbox.run({ kind: "previews", code, dark: true }, ["clients"], "editor-clients"), sandbox.previewScripts().catch((error: Error) => error)]);
  doneWorking(owner);
  if (mine !== clientsSequence || state.view !== "clients") return;
  if (!result.ok || !result.previews?.length || scripts instanceof Error) {
    if (result.error?.message === SUPERSEDED) return;
    tabs.replaceChildren();
    const problem = scripts instanceof Error ? `The playground's runtime didn't load (${scripts.message}). Check your connection and try again` : firstProblem(result) || "The email client models didn't load.";
    host.replaceChildren(h("div", { class: "pg-file-card", style: "position:absolute;inset:0;margin:auto;height:max-content;color:#525252" }, h("strong", { style: "color:#0a0a0a" }, "No client previews"), problem));
    return;
  }
  clientsKey = code;
  const frames = result.previews.map((each, index) => {
    const device = previewDevice(each);
    const on = device ? ` on ${device}` : "";
    const frame = h("iframe", { title: `As ${clientName(each.client, result.clientNames)}${on} draws it${each.dark ? ", in dark mode" : ""}`, hidden: index !== 0 });
    if (previewFile(frame, each.html, scripts)) return frame;
    return h("div", { class: "pg-file-card", hidden: index !== 0, style: "position:absolute;inset:0;margin:auto;height:max-content;color:#525252" }, h("strong", { style: "color:#0a0a0a" }, "Too large to preview here"), "This email's preview file is longer than a browser shows this way. renderInEmailClients() writes the same file in your own project.");
  });
  const select = (index: number) => {
    frames.forEach((frame, i) => (frame.hidden = i !== index));
    [...tabs.children].forEach((tab, i) => tab.setAttribute("aria-selected", String(i === index)));
  };
  tabs.replaceChildren(
    ...result.previews.map((each, index) =>
      h(
        "button",
        { type: "button", role: "tab", "aria-selected": String(index === 0), onclick: () => select(index) },
        clientName(each.client, result.clientNames),
        // Name the computer or phone so every variant has a distinct tab.
        previewDevice(each) ? h("small", null, previewDevice(each)) : null,
        each.dark ? h("small", null, "dark") : null,
        // (An approximate preview, classic Outlook's, says so in the preview itself.)
      ),
    ),
  );
  host.replaceChildren(...frames);
}

// ─── Checks tabs, panes, splitters ─────────────────────────────────────────

function showChecks(tab: string) {
  for (const button of $$("[data-check]")) button.setAttribute("aria-selected", String(button.dataset.check === tab));
  for (const pane of $$("[data-check-pane]")) pane.hidden = pane.dataset.checkPane !== tab;
  drawCounts();
  if (matchMedia("(max-width: 860px)").matches) showPane("checks");
}
for (const button of $$("[data-check]")) button.addEventListener("click", () => showChecks(button.dataset.check!));

/** On a phone, one panel at a time. */
function showPane(pane: string) {
  page.dataset.pane = pane;
  for (const button of $$("[data-show]")) button.setAttribute("aria-selected", String(button.dataset.show === pane));
  if (pane === "output") {
    drawRoots();
    fitDevice();
  }
  // The editor was laid out while it wasn't shown: it measures its lines again now that it is.
  if (pane === "code") editor.view.requestMeasure();
}
for (const button of $$("[data-show]")) button.addEventListener("click", () => showPane(button.dataset.show!));

export function setLayout(layout: Layout) {
  state.layout = layout;
  page.dataset.layout = layout;
  drawRoots();
  fitDevice();
}

if (saved.x) bench.style.setProperty("--pg-x", `${saved.x}%`);
if (saved.y) bench.style.setProperty("--pg-y", `${saved.y}%`);
for (const split of $$("[data-split]")) {
  const axis = split.dataset.split as "x" | "y";
  const set = (value: number) => {
    const clamped = Math.min(axis === "x" ? 72 : 70, Math.max(axis === "x" ? 24 : 12, value));
    bench.style.setProperty(`--pg-${axis}`, `${clamped}%`);
    save({ [axis]: Math.round(clamped * 10) / 10 });
    if (axis === "x") drawRoots();
  };
  split.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    split.setPointerCapture(event.pointerId);
    split.dataset.dragging = "";
    page.dataset.dragging = axis;
    const box = bench.getBoundingClientRect();
    const move = (moved: PointerEvent) => set(axis === "x" ? ((moved.clientX - box.left) / box.width) * 100 : ((box.bottom - moved.clientY) / box.height) * 100);
    const up = () => {
      delete split.dataset.dragging;
      delete page.dataset.dragging;
      split.removeEventListener("pointermove", move);
      split.removeEventListener("pointerup", up);
      split.removeEventListener("pointercancel", up);
    };
    split.addEventListener("pointermove", move);
    split.addEventListener("pointerup", up);
    split.addEventListener("pointercancel", up);
  });
  split.addEventListener("dblclick", () => {
    bench.style.removeProperty(`--pg-${axis}`);
    save({ [axis]: undefined });
  });
  split.addEventListener("keydown", (event) => {
    const step = axis === "x" ? (event.key === "ArrowRight" ? 2 : event.key === "ArrowLeft" ? -2 : 0) : event.key === "ArrowUp" ? 2 : event.key === "ArrowDown" ? -2 : 0;
    if (!step) return;
    event.preventDefault();
    const box = bench.getBoundingClientRect();
    const now = axis === "x" ? ($("[data-panel='code']").offsetWidth / box.width) * 100 : ($("[data-panel='checks']").offsetHeight / box.height) * 100;
    set(now + step);
  });
}

// ─── Toast, menus ──────────────────────────────────────────────────────────

const toastElement = $("[data-toast]");
let toastTimer: number | undefined;
export function toast(message: string) {
  toastElement.textContent = message;
  toastElement.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastElement.hidden = true), 2600);
}

const exportMenu = $("[data-menu='export']");
const exportButton = $("[data-menu-button]", exportMenu);
const exportList = $("[data-menu-list]", exportMenu);
function closeMenu() {
  exportList.hidden = true;
  exportButton.setAttribute("aria-expanded", "false");
}
exportButton.addEventListener("click", () => {
  if (!exportList.hidden) return closeMenu();
  const good = state.good;
  const item = (label: string, note: string, run: () => void | Promise<void>, enabled = true) =>
    h("button", { type: "button", role: "menuitem", disabled: !enabled, onclick: () => (closeMenu(), void run()) }, label, h("small", null, note));
  const fileItem = (kind: FileKind, label: string, scale = 1) =>
    item(label, kind === "pdf" ? "renderPdf()" : "renderImage()", async () => {
      toast(kind === "pdf" ? "Writing the PDF…" : "Drawing the image…");
      // At 1× it's the file the stage shows (drawn once); at 2× a file of its own, which leaves the stage's be.
      const { drawn, result } = await fileOf(kind, undefined, undefined, scale > 1 ? "export" : "editor-file", scale);
      if (drawn) download(`template${scale > 1 ? `@${scale}x` : ""}.${kind}`, drawn.bytes as BlobPart, FILE_TYPES[kind]);
      else toast(firstProblem(result) || "That didn't render");
    }, Boolean(good));
  // What the root writes, and nothing it doesn't: an Email's plain text, a Document's PDF, a Canvas's images.
  const stale = good && state.result && !state.result.ok ? " (last render that worked)" : "";
  const root = good?.root ?? state.root;
  const print = root === "Document" ? "print " : "";
  const copyHtml = item(`Copy ${print}HTML${stale}`, good?.html ? bytes(new Blob([good.html]).size) : "", async () => toast((await copy(good!.html!)) ? "HTML copied" : "Couldn't copy"), Boolean(good?.html));
  const downloadHtml = item(`Download ${print}HTML`, ".html", () => download("template.html", good!.html!, "text/html"), Boolean(good?.html));
  const own =
    root === "Canvas"
      ? [fileItem("png", "Download PNG"), fileItem("png", "Download PNG at 2×", 2), fileItem("svg", "Download SVG")]
      : root === "Document"
        ? [fileItem("pdf", "Download PDF"), h("hr"), copyHtml, downloadHtml]
        : root === "Email"
          ? [copyHtml, downloadHtml, item("Copy plain text", ".txt", async () => toast((await copy(good!.text ?? "")) ? "Plain text copied" : "Couldn't copy"), Boolean(good?.text))]
          : [copyHtml, downloadHtml];
  exportList.replaceChildren(...own, h("hr"), item("Copy the code", "template.tsx", async () => toast((await copy(editor.code)) ? "Code copied" : "Couldn't copy")));
  exportList.hidden = false;
  exportButton.setAttribute("aria-expanded", "true");
});
document.addEventListener("click", (event) => !exportMenu.contains(event.target as Node) && closeMenu());
document.addEventListener("keydown", (event) => event.key === "Escape" && closeMenu());

export const linkTo = () => shareUrl(editor.code, { view: state.view === (state.root ? VIEWS[state.root][0] : "preview") ? undefined : state.view, device: state.device === "phone" ? "phone" : undefined });
$("[data-share]").addEventListener("click", async () => {
  const url = await linkTo();
  history.replaceState(null, "", url);
  toast((await copy(url)) ? "Link copied: it carries this code" : "The link is in the address bar");
});

// ─── Starters, and where the code came from ────────────────────────────────

const originChip = $("[data-origin]");
function drawOrigin() {
  $("[data-starter-name]").textContent = state.origin === "link" ? "From a link" : state.origin === "agent" ? "From an agent" : (boot.starters.find((each) => each.id === state.starter)?.title ?? "Your template");
  originChip.hidden = state.origin !== "link";
  if (state.origin === "link") originChip.replaceChildren("Code from a link: read it before you export what it makes");
}

/** Replace the code: a starter's, a link's, an agent's. The editor's own typing doesn't come through here. */
export function setCode(code: string, origin: typeof state.origin, starter: string | null = null, options: { changed?: boolean } = {}): Promise<Result> {
  state.origin = origin;
  state.starter = starter;
  state.changed = options.changed ?? false;
  state.selected = null;
  for (const root of ROOTS) delete stash[root];
  preview.resetScroll();
  clearTimeout(typing);
  editor.setCode(code, { silent: true });
  // A starter the visitor picked replaces their draft. A link's or an agent's code is only shown: the draft they had
  // is still theirs, and is what the next plain visit opens.
  if (origin === "starter") save({ code: undefined, from: undefined, starter: starter ?? undefined });
  // Code the visitor changed, brought back (from another root): their draft again.
  else if (state.changed) save({ code, from: origin === "link" || origin === "agent" ? origin : undefined, starter: starter ?? undefined });
  drawOrigin();
  drawRoots();
  return render();
}

const templates = new Templates(
  $("[data-menu='templates']"),
  boot.starters,
  () => ({ current: state.origin === "starter" ? state.starter : null, root: state.root }),
  (starter) => {
    state.view = VIEWS[starter.root][0];
    void setCode(starter.source, "starter", starter.id);
  },
);

export async function loadStarter(id: string): Promise<Result | undefined> {
  const starter = await templates.find(id);
  if (!starter) return undefined;
  state.view = VIEWS[starter.root][0];
  return setCode(starter.source, "starter", starter.id);
}

// ─── Start ─────────────────────────────────────────────────────────────────

/** What the link says: its code (text for the editor), and how to show it. */
async function applyHash(): Promise<boolean> {
  const link = await readHash(location.hash);
  if (link.layout === "preview" || link.layout === "code" || link.layout === "split") setLayout(link.layout);
  if (link.device === "phone" || link.device === "mobile") setDevice("phone");
  if (link.problem) toast(link.problem);
  let loaded = false;
  if (link.code !== undefined) {
    await setCode(link.code, "link");
    loaded = true;
  } else if (link.starter && (await loadStarter(link.starter))) loaded = true;
  if (link.root) {
    const root = ROOTS.find((each) => each.toLowerCase() === link.root);
    if (root) setRoot(root);
  }
  if (link.view && (VIEW_NAMES as readonly string[]).includes(link.view)) setView(link.view as View);
  return loaded;
}

async function start() {
  // On a phone the preview is a phone's: the template's phone layout, at the screen's own width.
  if (matchMedia("(max-width: 860px)").matches) setDevice("phone");
  drawRoots();
  drawViews();
  drawOrigin();
  checks.show(null);
  setStatus("loading");
  showVeil("block", "plain", "Loading the engine", `Hyper Elements ${boot.engine}, into a sandbox in this tab.`);
  sandbox.preload(["clients"]);
  if (await applyHash()) return;
  // The draft from this browser's last visit, said to be a link's or an agent's where it began as one.
  if (saved.code && saved.code !== boot.starter.source) {
    await setCode(saved.code, saved.from === "link" || saved.from === "agent" ? saved.from : "saved", saved.starter ?? null, { changed: true });
    return;
  }
  // No draft that's up, but one under the first starter's root (left there when another root was picked).
  const draft = left[boot.starter.root];
  if (draft) {
    delete left[boot.starter.root];
    const { [boot.starter.root]: _, ...rest } = saved.drafts ?? {};
    save({ drafts: rest });
    await setCode(draft.code, draft.origin, draft.starter, { changed: true });
    return;
  }
  await render();
}

addEventListener("hashchange", () => void applyHash());
// The thumb under the root that's on is placed by measuring: again once the fonts are in.
void document.fonts?.ready.then(drawRoots);
addEventListener("resize", drawRoots);

const started = start();
// Once it's up, what the editor completes: each component, its props and its styles, as the engine's definitions say.
void started.then(async () => {
  const described = await sandbox.run({ kind: "describe", code: "" }, [], "describe");
  if (described.components) editor.setVocabulary({ components: described.components });
});

installAgentPaths({
  engine: boot.engine,
  starters: boot.starters,
  ready: () => started.then(() => undefined),
  sandbox,
  editor,
  state,
  render,
  setCode: (code) => setCode(code, "agent"),
  setRoot,
  setView,
  setDevice,
  setLayout,
  loadStarter,
  linkTo,
  fileOf: (kind, code, needs) => fileOf(kind, code, needs, "agent"),
  views: () => (state.root ? VIEWS[state.root] : []),
});
