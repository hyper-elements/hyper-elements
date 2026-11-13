// The frames the playground shows HTML in. The HTML is whatever the sandbox answered with, so it's treated as written
// by a stranger: it's only ever the document of a sandboxed frame with an origin of its own, under a policy that runs
// one script (the page's own inspector, by a nonce made here) and reaches nothing but images, fonts and styles.
//
// The document is put together with a parser, never by searching the text: what a template writes can't move the
// policy, navigate the frame (no <meta refresh>, no <base>), or run before the policy is read.
import type { Preview, Result } from "../../playground/protocol";
import { base64 } from "./dom";

/** Scripts only: no same-origin access, no popups, no forms, no navigating the page. Links are opened by the page. */
const SANDBOX = "allow-scripts";

const policy = (nonce: string) =>
  [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline' https:",
    // The site's own images load from wherever it runs (the examples name them by its address).
    `img-src https: data: ${location.origin}`,
    "font-src https: data:",
    "media-src https:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

/** The sha256 (base64) of the two scripts an email client's preview file runs: its runtime and the email client models. */
export interface PreviewScripts {
  runtime: string;
  models: string;
}

/** The device as well as the client distinguishes desktop and phone previews. */
export function previewDevice(preview: Preview): string {
  if (preview.id.includes(".iphone")) return "iPhone";
  if (preview.client === "apple-mail") return "Mac";
  if (preview.client === "gmail-app") return "Android";
  return preview.computer === "mac" ? "Mac" : preview.computer === "windows" ? "Windows" : "";
}

/**
 * For an email client's preview file (@hyper-elements/email-clients): its own two scripts, by their sha256, and no
 * requests of their own. The file says as much in a policy of its own, but the file is what the sandbox answered, which
 * the code it ran can rewrite (a template can take over its worker's postMessage). So this policy is the page's, with
 * hashes the page read from the site (Sandbox.previewScripts): a script the package didn't write doesn't run.
 */
const previewFilePolicy = (scripts: PreviewScripts) =>
  [
    "default-src 'none'",
    `script-src 'sha256-${scripts.models}' 'sha256-${scripts.runtime}' 'wasm-unsafe-eval'`,
    "style-src 'unsafe-inline' https:",
    `img-src https: data: blob: ${location.origin}`,
    "font-src https: data:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

const random = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");

const PATH = "data-he-path";
const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The HTML with each block's path written into its outermost tag, at the block map's offsets (UTF-8 bytes). */
function mark(html: string, blocks: NonNullable<Result["blocks"]>): string {
  const bytes = new TextEncoder().encode(html);
  // One mark per element: where several blocks share one (a Section and its only Column), the innermost.
  const byOffset = new Map<number, string>();
  for (const block of blocks) if (block.offset > 0 && block.offset <= bytes.length) byOffset.set(block.offset, block.path);
  const offsets = [...byOffset.keys()].sort((a, b) => a - b);
  const decoder = new TextDecoder();
  let out = "";
  let from = 0;
  for (const offset of offsets) {
    out += `${decoder.decode(bytes.subarray(from, offset))} ${PATH}="${escapeAttribute(byOffset.get(offset)!)}"`;
    from = offset;
  }
  return out + decoder.decode(bytes.subarray(from));
}

const doctype = (doc: Document) => {
  const type = doc.doctype;
  if (!type) return "";
  const clean = (id: string) => id.replace(/[">]/g, "");
  return `<!DOCTYPE ${type.name.replace(/[^\w-]/g, "") || "html"}${type.publicId ? ` PUBLIC "${clean(type.publicId)}"` : ""}${type.systemId ? `${type.publicId ? "" : " SYSTEM"} "${clean(type.systemId)}"` : ""}>`;
};

/** A document from HTML the sandbox wrote: parsed (nothing in it runs or loads here), what could navigate the frame removed, the policy first in its head. */
function documentOf(html: string, contentPolicy: string, script?: { nonce: string; code: string }, decorate?: (doc: Document) => void): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  decorate?.(doc);
  for (const meta of doc.querySelectorAll("meta[http-equiv]")) if (/^\s*refresh\s*$/i.test(meta.getAttribute("http-equiv") ?? "")) meta.remove();
  for (const base of doc.querySelectorAll("base")) base.remove();
  const meta = doc.createElement("meta");
  meta.setAttribute("http-equiv", "Content-Security-Policy");
  meta.setAttribute("content", contentPolicy);
  const first: Element[] = [meta];
  if (script) {
    const element = doc.createElement("script");
    element.setAttribute("nonce", script.nonce);
    element.textContent = script.code;
    first.push(element);
  }
  doc.head.prepend(...first);
  return `${doctype(doc)}${doc.documentElement.outerHTML}`;
}

/**
 * The page's own script in a preview: which block the pointer is over or was clicked, the links clicked (the page
 * opens them, the frame can't), and an outline around the block the page names. It says only paths, addresses and
 * numbers, and the page checks them.
 */
const inspector = (token: string, inspect: boolean) => `(() => {
  const TOKEN = ${JSON.stringify(token)};
  let inspect = ${inspect};
  const send = (message) => parent.postMessage(Object.assign({ preview: TOKEN }, message), "*");
  const blockOf = (target) => (target && target.closest ? target.closest("[${PATH}]") : null);
  const find = (path) => { for (const el of document.querySelectorAll("[${PATH}]")) if (el.getAttribute("${PATH}") === path) return el; return null; };
  const box = document.createElement("div");
  const tag = document.createElement("div");
  let shown = null, hovered = null, pinned = null, tone = "hover";
  const TONES = { hover: "#ffffff", select: "#ffffff", error: "#ff7b6e", warning: "#f5b971", info: "#ffffff" };
  const draw = () => {
    // The block under the pointer; else the one the page names.
    const el = hovered || pinned;
    shown = el;
    if (!el || !el.isConnected) { box.style.display = "none"; tag.style.display = "none"; return; }
    if (!box.isConnected) (document.body || document.documentElement).append(box, tag);
    const r = el.getBoundingClientRect();
    const color = TONES[hovered ? "hover" : tone] || "#ffffff";
    const plain = color === "#ffffff";
    // A plain outline inverts what's under it, so it shows on any email; the label is a chip of its own beside it.
    box.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;box-sizing:border-box;border-radius:3px;" +
      "left:" + (r.left - 3) + "px;top:" + (r.top - 3) + "px;width:" + (r.width + 6) + "px;height:" + (r.height + 6) + "px;" +
      (plain ? "border:1.5px solid #fff;mix-blend-mode:difference;" : "border:1.5px solid " + color + ";box-shadow:0 0 0 3px " + color + "33;");
    tag.textContent = el.getAttribute("data-he-type") || "";
    const above = r.top > 30;
    tag.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;left:" + Math.max(4, Math.min(r.left - 3, innerWidth - 180)) + "px;" +
      "top:" + (above ? r.top - 27 : Math.min(r.bottom + 7, innerHeight - 24)) + "px;" +
      "font:500 10.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em;white-space:nowrap;padding:5px 7px;border-radius:5px;" +
      "background:#0a0a0a;color:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.22),0 6px 16px -6px rgba(0,0,0,.6);" + (tag.textContent ? "" : "display:none;");
  };
  let frame = 0;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); };
  document.addEventListener("mousemove", (event) => {
    if (!inspect) return;
    const el = blockOf(event.target);
    if (el === hovered) return;
    hovered = el;
    send({ type: "hover", path: el ? el.getAttribute("${PATH}") : null });
    redraw();
  }, true);
  document.addEventListener("mouseleave", () => { if (hovered) { hovered = null; send({ type: "hover", path: null }); redraw(); } }, true);
  document.addEventListener("click", (event) => {
    const link = event.target && event.target.closest ? event.target.closest("a[href], area[href]") : null;
    if (link) { event.preventDefault(); send({ type: "link", href: String(link.href).slice(0, 2000) }); }
    const el = inspect ? blockOf(event.target) : null;
    if (el) { event.preventDefault(); send({ type: "select", path: el.getAttribute("${PATH}") }); }
  }, true);
  document.addEventListener("submit", (event) => event.preventDefault(), true);
  addEventListener("scroll", () => { redraw(); send({ type: "scroll", y: Math.round(scrollY) }); }, { passive: true, capture: true });
  addEventListener("resize", redraw);
  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data || event.data.preview !== TOKEN) return;
    const data = event.data;
    if (data.type === "highlight") {
      pinned = typeof data.path === "string" ? find(data.path) : null;
      tone = data.tone;
      // Brought into view by scrolling this document only (scrollIntoView would scroll the page around the frame too).
      if (pinned && data.reveal) { const r = pinned.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) scrollTo({ top: Math.max(0, scrollY + r.top - (innerHeight - Math.min(r.height, innerHeight)) / 2), behavior: "smooth" }); }
      redraw();
    } else if (data.type === "inspect") { inspect = !!data.on; if (!inspect) { hovered = null; redraw(); } }
    else if (data.type === "scroll") scrollTo(0, Number(data.y) || 0);
  });
  const ready = () => send({ type: "ready", height: Math.round(document.documentElement.scrollHeight) });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();`;

export interface PreviewOptions {
  /** An Email's block map: each block's path at its place in the HTML. */
  blocks?: Result["blocks"];
  /** Each path's component, for the label over a block. */
  types?: Map<string, string>;
  inspect: boolean;
}

export interface PreviewEvents {
  hover(path: string | null): void;
  select(path: string): void;
  link(href: string): void;
}

/**
 * One HTML preview: two frames, one shown. A new document loads in the hidden one and takes over when it's drawn, at
 * the scroll position the last one was at, so the preview doesn't blink while the code is typed.
 */
export class PreviewFrame {
  private frames: HTMLIFrameElement[];
  private tokens = ["", ""];
  private front = 0;
  private scroll = 0;
  private swap: number | undefined;
  private inspect = false;

  constructor(
    private host: HTMLElement,
    title: string,
    private events: PreviewEvents,
  ) {
    this.frames = [0, 1].map((index) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", SANDBOX);
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.title = title;
      frame.className = "pg-preview-frame";
      frame.dataset.buffer = index === 0 ? "front" : "back";
      host.append(frame);
      return frame;
    });
    addEventListener("message", (event) => this.receive(event));
  }

  private receive(event: MessageEvent) {
    const index = this.frames.findIndex((frame) => frame.contentWindow === event.source);
    if (index === -1) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data !== "object" || data.preview !== this.tokens[index]) return;
    if (data.type === "ready" && index !== this.front) this.take(index);
    if (index !== this.front) return;
    if (data.type === "scroll" && typeof data.y === "number") this.scroll = Math.max(0, Math.min(data.y, 1e7));
    else if (data.type === "hover") this.events.hover(typeof data.path === "string" ? data.path.slice(0, 500) : null);
    else if (data.type === "select" && typeof data.path === "string") this.events.select(data.path.slice(0, 500));
    else if (data.type === "link" && typeof data.href === "string") this.events.link(data.href.slice(0, 2000));
  }

  /** The hidden frame's document is ready: it scrolls to where the shown one is, then they change places. */
  private take(index: number) {
    const frame = this.frames[index];
    frame.contentWindow?.postMessage({ preview: this.tokens[index], type: "scroll", y: this.scroll }, "*");
    clearTimeout(this.swap);
    // A beat for its first paint, so the old one isn't taken away from an empty frame.
    this.swap = window.setTimeout(() => {
      this.front = index;
      this.frames.forEach((each, i) => (each.dataset.buffer = i === index ? "front" : "back"));
      this.host.dataset.shown = "";
    }, 40);
  }

  show(html: string, options: PreviewOptions) {
    const index = 1 - this.front;
    const token = random();
    this.tokens[index] = token;
    this.inspect = options.inspect;
    let marked = options.blocks?.length ? mark(html, options.blocks) : html;
    marked = marked.replaceAll("https://hyperelements.dev/img/", `${location.origin}/img/`).replaceAll("https://www.hyperelements.dev/img/", `${location.origin}/img/`);
    const doc = documentOf(marked, policy(token), { nonce: token, code: inspector(token, options.inspect) }, (parsed) => {
      // Each block's component beside its path, for the inspector's label.
      for (const element of parsed.querySelectorAll(`[${PATH}]`)) {
        const type = options.types?.get(element.getAttribute(PATH) ?? "");
        if (type) element.setAttribute("data-he-type", type);
      }
    });
    this.frames[index].srcdoc = doc;
  }

  /** Nothing to show (a template that never rendered). */
  clear() {
    this.tokens = ["", ""];
    for (const frame of this.frames) frame.removeAttribute("srcdoc");
    delete this.host.dataset.shown;
    this.scroll = 0;
  }

  highlight(path: string | null, tone: "hover" | "select" | "error" | "warning" | "info" = "select", options: { reveal?: boolean } = {}) {
    this.frames[this.front].contentWindow?.postMessage({ preview: this.tokens[this.front], type: "highlight", path, tone, ...options }, "*");
  }

  setInspect(on: boolean) {
    this.inspect = on;
    this.frames[this.front].contentWindow?.postMessage({ preview: this.tokens[this.front], type: "inspect", on }, "*");
  }

  resetScroll() {
    this.scroll = 0;
  }
}

/**
 * An email client's preview file (@hyper-elements/email-clients), in a frame of its own. The file measures the email
 * in frames it makes and reads, so its own document can't be origin-sandboxed (their documents would be closed to
 * it). It's loaded from a data: URL instead, which always gets an origin of its own, never this page's: the file's
 * scripts reach its own frames and nothing here. The sandbox still takes away popups, forms, dialogs and navigating
 * the page, and the policy written into it takes away the network and every script but the package's two.
 *
 * Never give this frame its document as `srcdoc` or from a blob: URL: a srcdoc document has this page's origin, and
 * so has a blob this page made. With these flags its scripts would then have this page. A data: URL is the only
 * source this frame takes (scripts/check-playground.mjs holds it to that).
 *
 * False where the file is too long for a data: URL (browsers stop at about 2 MB): the caller says so.
 */
export function previewFile(frame: HTMLIFrameElement, html: string, scripts: PreviewScripts): boolean {
  const bytes = new TextEncoder().encode(documentOf(html, previewFilePolicy(scripts)));
  if (bytes.length > MAX_PREVIEW_FILE) return false;
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.src = `data:text/html;charset=utf-8;base64,${base64(bytes)}`;
  return true;
}
/** 1.1 MB of HTML is about 1.5 MB in base64, under the 2 MB a data: URL may be. */
const MAX_PREVIEW_FILE = 1_100_000;

/** Whether the page may open a link a preview reported: web and mail addresses only. */
export const opensSafely = (href: string): boolean => {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
};
