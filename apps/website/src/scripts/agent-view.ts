// A template page's agent view: one design as you see it and as an agent sees it, side by side behind a divider you
// drag. On the agent's side, what the template lets an agent change is green ("Allowed to change"), and everything else
// is red ("Locked"). What's allowed comes from the template itself (templates/_scripts/agent-view.ts writes it into
// gallery.json): the fields and slots it binds, by each part's path, and each field's limits. An email's, a page's and
// a document's parts are found in its HTML by the paths its block map marked (a document's header and footer on every
// page); an image's are its boxes, from layoutImage().
import { draw } from "./gallery-images";

export interface FieldGuide {
  label: string;
  kind: string;
  limits: string;
}

export interface AgentViewOptions {
  /** The width the design is drawn at, before it's scaled to fit. */
  width: number;
  /** An email, a page or a document: its preview file, its HTML marked with each block's path. */
  preview?: string;
  /** An image: the design to draw (`images/og-card/launch`), its brand, its size and its parts' boxes. */
  image?: { draw: string; brand: string; size: [number, number]; boxes: Array<[string, number, number, number, number]> };
  areas: Array<{ path: string; field: string }>;
  guide: Record<string, FieldGuide>;
}

const OK = "#15803d";
const NO = "#b91c1c";
type Rect = { x: number; y: number; w: number; h: number };

const css = `
.av { position: relative; overflow: hidden; border-radius: 10px; margin: 0 auto; background: var(--bg-2, #f4f4f5); }
.av-scale { position: relative; transform-origin: 0 0; }
.av-layer { position: absolute; inset: 0; }
.av-layer.you { position: relative; }
.av-layer.agent { clip-path: inset(0 0 0 var(--split)); }
.av-layer iframe, .av-layer img { display: block; border: 0; }
.av-divider { position: absolute; top: 0; bottom: 0; left: calc(var(--split) - 12px); width: 24px; z-index: 3; cursor: ew-resize; touch-action: none; }
.av-divider::before { content: ""; position: absolute; top: 0; bottom: 0; left: 11px; width: 2px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.25); }
.av-handle { position: absolute; top: 96px; left: -6px; width: 36px; height: 36px; border-radius: 50%; background: #fff; color: #111; display: grid; place-items: center; font: 700 15px system-ui, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.3); user-select: none; }
.av-heads { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 8px 12px; margin: 0 auto 10px; max-width: 100%; }
.av-heads span { padding: 8px 16px; border-radius: 999px; font: 700 15px/1.2 system-ui, sans-serif; letter-spacing: -0.01em; box-shadow: 0 4px 14px rgba(0,0,0,.18); white-space: nowrap; }
.av-heads .agent { margin-left: auto; }
@media (max-width: 520px) { .av-heads span { padding: 6px 10px; font-size: 12.5px; } .av-heads { gap: 6px 8px; } }
.av-heads .you { background: var(--text, #111); color: var(--bg, #fff); }
.av-heads .agent { background: #7c3aed; color: #fff; }
.av-also { font-size: 13px; color: var(--text-2); margin: 12px auto 0; max-width: 680px; text-align: center; }
.av-also b { color: var(--text); font-weight: 600; }
`;

/**
 * A label for an area, where it covers no label already placed (`placed`, in the layer's coordinates): on the agent's
 * side first, at the area's right. Inside a tall area, at its top, or lower down; above a short one, or below it.
 * Then the same at the area's left, and none where every place is taken.
 */
function chip(doc: Document, layer: HTMLElement, size: { w: number; h: number }, r: Rect, ok: boolean, text: string, detail: string | undefined, placed: Rect[]): boolean {
  const c = doc.createElement("div");
  Object.assign(c.style, {
    position: "absolute",
    zIndex: "3",
    left: "0",
    top: "0",
    // One line each: near the layer's right edge a label would otherwise shrink and wrap.
    whiteSpace: "nowrap",
    padding: "4px 9px",
    borderRadius: "6px",
    background: ok ? OK : NO,
    color: "#fff",
    font: "600 12px/1.3 system-ui, sans-serif",
    boxShadow: "0 2px 8px rgba(0,0,0,.25)",
    pointerEvents: "none",
  });
  c.textContent = `${ok ? "✓" : "✗"} ${text}`;
  if (detail) {
    const small = doc.createElement("small");
    Object.assign(small.style, { display: "block", fontWeight: "400", opacity: "0.92" });
    small.textContent = detail;
    c.appendChild(small);
  }
  layer.appendChild(c);
  // Layout offsets, which a scaled view doesn't change.
  const w = c.offsetWidth;
  const h = c.offsetHeight;
  const covers = (a: Rect) => placed.filter((p) => a.x < p.x + p.w + 4 && p.x < a.x + a.w + 4 && a.y < p.y + p.h + 4 && p.y < a.y + a.h + 4);
  const sides = [Math.max(0, r.x + r.w + 3 - w), Math.max(0, Math.min(r.x - 3, size.w - w))];
  for (const x of sides) {
    const tops = r.h > 60 ? [r.y + 6] : [r.y - 3 - h, r.y + r.h + 3];
    for (let i = 0; i < tops.length && i < 6; i++) {
      const y = tops[i];
      if (y < 0 || y + h > size.h) continue;
      const box = { x, y, w, h };
      const hit = covers(box);
      if (hit.length === 0) {
        Object.assign(c.style, { left: `${x}px`, top: `${y}px` });
        placed.push(box);
        return true;
      }
      // Inside a tall area, a label can move down past the labels it would cover, while it stays in the area.
      if (r.h > 60) {
        const lower = Math.max(...hit.map((p) => p.y + p.h + 6));
        if (lower + h <= r.y + r.h - 6) tops.push(lower);
      }
    }
  }
  c.remove();
  return false;
}

/**
 * Paints the agent's side into `layer` (a box over the design, in its own coordinates): green over each area, red over
 * the rest, and a label on each area and on the larger locked parts, where they don't cover each other. An area's
 * field and limits also show on hovering it.
 */
function paint(doc: Document, layer: HTMLElement, size: { w: number; h: number }, paths: string[], rectsOf: (path: string) => Rect[], options: AgentViewOptions) {
  layer.replaceChildren();
  const holes: Rect[] = [];
  const labeled = new Set<string>();
  const editable: string[] = [];
  const placed: Rect[] = [];
  for (const { path, field } of options.areas) {
    // Each place it's drawn: a document's header and footer are on every page.
    const rects = rectsOf(path).filter((r) => r.w && r.h);
    if (!rects.length) continue;
    editable.push(path);
    const g = options.guide[field];
    const detail = [g?.label ?? field, g?.limits].filter(Boolean).join(" · ");
    for (const r of rects) {
      holes.push(r);
      const box = doc.createElement("div");
      Object.assign(box.style, { position: "absolute", zIndex: "2", left: `${r.x - 3}px`, top: `${r.y - 3}px`, width: `${r.w + 6}px`, height: `${r.h + 6}px`, borderRadius: "6px", background: "rgba(34,197,94,.24)", outline: `2px solid #16a34a`, pointerEvents: "auto" });
      box.title = `Allowed to change: ${detail}`;
      layer.appendChild(box);
      // One label for a field, however many times it's drawn (a list's rows, a document's pages).
      if (!labeled.has(field) && chip(doc, layer, size, r, true, "Allowed to change", detail, placed)) labeled.add(field);
    }
  }
  // Locked: each outermost part with nothing an agent may change (a slot's content is the agent's), labeled where
  // it's large enough and there's room.
  const holds = (p: string) => editable.some((e) => e === p || e.startsWith(`${p}.`));
  const parent = (p: string) => p.replace(/\.children\[\d+\]$/, "");
  for (const path of new Set(paths)) {
    if (path === "root" || holds(path) || !holds(parent(path)) || editable.some((e) => path.startsWith(`${e}.`))) continue;
    // One label for a part, on the first place it's drawn that's large enough.
    const r = rectsOf(path).find((each) => each.w > 120 && each.h > 30);
    if (r) chip(doc, layer, size, r, false, "Locked", undefined, placed);
  }
  const NS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("width", String(size.w));
  svg.setAttribute("height", String(size.h));
  Object.assign(svg.style, { position: "absolute", left: "0", top: "0", zIndex: "1", pointerEvents: "none" });
  const id = `av-holes-${Math.random().toString(36).slice(2)}`;
  svg.innerHTML =
    `<defs><mask id="${id}"><rect width="${size.w}" height="${size.h}" fill="white"/>` +
    holes.map((r) => `<rect x="${r.x - 3}" y="${r.y - 3}" width="${r.w + 6}" height="${r.h + 6}" rx="6" fill="black"/>`).join("") +
    `</mask></defs><rect width="${size.w}" height="${size.h}" fill="rgba(220,38,38,.22)" mask="url(#${id})"/>`;
  layer.appendChild(svg);
}

/** The fields an agent may change that aren't a part of the layout of their own: a subject, a link's address. */
function unbound(options: AgentViewOptions): string[] {
  const bound = new Set(options.areas.map((a) => a.field));
  const covered = (path: string) => [...bound].some((b) => path === b || path.startsWith(`${b}.`) || path.startsWith(`${b}[]`));
  return Object.entries(options.guide)
    .filter(([path, g]) => g.kind !== "object" && g.kind !== "list" && !covered(path))
    .map(([, g]) => (g.limits ? `${g.label} (${g.limits})` : g.label));
}

let styled = false;
/** Where you put the divider, kept for the next design or brand you look at. */
let yourSplit: number | undefined;

/** Shows the agent view of one design in `host`, replacing what was there. Returns a function that takes it down. */
export function mountAgentView(host: HTMLElement, options: AgentViewOptions): () => void {
  if (!styled) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    styled = true;
  }
  host.replaceChildren();
  const stage = document.createElement("div");
  stage.className = "av";
  stage.style.setProperty("--split", "100%");
  const scale = document.createElement("div");
  scale.className = "av-scale";
  const you = document.createElement("div");
  you.className = "av-layer you";
  const agent = document.createElement("div");
  agent.className = "av-layer agent";
  const divider = document.createElement("div");
  divider.className = "av-divider";
  divider.innerHTML = `<div class="av-handle" aria-hidden="true">⇆</div>`;
  divider.setAttribute("role", "slider");
  divider.setAttribute("aria-label", "How you see it, and how an agent sees it");
  divider.setAttribute("aria-valuenow", "100");
  divider.tabIndex = 0;
  stage.append(scale, divider);
  scale.append(you, agent);
  // Above the preview, at its two edges: which side is which.
  const heads = document.createElement("div");
  heads.className = "av-heads";
  heads.innerHTML = `<span class="you">← How you see it</span><span class="agent">How an agent sees it →</span>`;
  const also = unbound(options);
  const note = document.createElement("p");
  note.className = "av-also";
  if (also.length) note.innerHTML = `<b>✓ Also allowed to change</b>, not shown as a part of its own: `;
  note.append(also.join(", "));
  host.append(heads, stage, ...(also.length ? [note] : []));

  let size = { w: options.width, h: 600 };
  // The box is the design's size, scaled down to fit the space it has, so the divider and the split line up.
  const fit = () => {
    const pad = getComputedStyle(host);
    const room = host.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    const s = Math.min(1, room / size.w);
    Object.assign(scale.style, { width: `${size.w}px`, height: `${size.h}px`, transform: `scale(${s})` });
    Object.assign(stage.style, { width: `${size.w * s}px`, height: `${size.h * s}px` });
    heads.style.width = `${size.w * s}px`;
  };
  const cleanups: Array<() => void> = [];

  if (options.image) {
    // An image: the picture, drawn in the browser, twice; the parts' boxes from its layout.
    const { size: [w, h], boxes } = options.image;
    size = { w, h };
    const picture = (): HTMLImageElement => {
      const img = document.createElement("img");
      img.width = w;
      img.height = h;
      img.alt = "";
      img.dataset.draw = options.image!.draw;
      img.dataset.drawBrand = options.image!.brand;
      void draw(img);
      return img;
    };
    you.appendChild(picture());
    agent.appendChild(picture());
    const layer = document.createElement("div");
    Object.assign(layer.style, { position: "absolute", inset: "0" });
    agent.appendChild(layer);
    const byPath = new Map(boxes.map(([p, x, y, bw, bh]) => [p, { x, y, w: bw, h: bh }]));
    paint(document, layer, size, boxes.map(([p]) => p), (p) => (byPath.has(p) ? [byPath.get(p)!] : []), options);
    fit();
  } else if (options.preview) {
    // An email, a page or a document: its marked HTML, twice; each part measured in the agent's copy, and measured
    // again when it moves.
    const frame = (title: string) => {
      const f = document.createElement("iframe");
      f.title = title;
      f.scrolling = "no";
      f.width = String(options.width);
      f.src = options.preview!;
      return f;
    };
    const yours = frame("The design");
    const theirs = frame("The design, with what an agent may change");
    you.appendChild(yours);
    agent.appendChild(theirs);
    let loaded = 0;
    let queued = 0;
    const redraw = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => {
        const doc = theirs.contentDocument;
        if (!doc?.body) return;
        const h = Math.max(yours.contentDocument?.documentElement.scrollHeight ?? 0, doc.documentElement.scrollHeight);
        size = { w: options.width, h };
        yours.style.height = theirs.style.height = `${h}px`;
        let layer = doc.getElementById("av-layer");
        if (!layer) {
          layer = doc.createElement("div");
          layer.id = "av-layer";
          doc.body.style.position = "relative";
          doc.body.appendChild(layer);
        }
        Object.assign(layer.style, { position: "absolute", left: "0", top: "0", width: `${size.w}px`, height: `${h}px`, pointerEvents: "none", zIndex: "2147483000" });
        const view = doc.defaultView!;
        // Every element marked with a path: a document's header and footer are marked on each page.
        const rectsOf = (p: string): Rect[] =>
          [...doc.querySelectorAll(`[data-he-path="${CSS.escape(p)}"]`)].map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + view.scrollX, y: r.top + view.scrollY, w: r.width, h: r.height };
          });
        const paths = [...doc.querySelectorAll("[data-he-path]")].map((el) => el.getAttribute("data-he-path")!);
        paint(doc, layer, size, paths, rectsOf, options);
        fit();
      });
    };
    const ready = () => {
      if (++loaded < 2) return;
      redraw();
      theirs.contentWindow?.addEventListener("resize", redraw);
      theirs.contentDocument?.fonts?.ready.then(redraw);
      for (const img of theirs.contentDocument?.images ?? []) if (!img.complete) img.addEventListener("load", redraw, { once: true });
    };
    yours.addEventListener("load", ready);
    theirs.addEventListener("load", ready);
    cleanups.push(() => cancelAnimationFrame(queued));
  }

  // The divider: drag it, or use the arrow keys. Until then it shows itself off, sweeping from the whole design to
  // half and to a fifth, and back; with reduced motion, it rests at half. Where you put it stays, design to design.
  let at = 100;
  const set = (percent: number, byYou = false) => {
    at = Math.max(0, Math.min(100, percent));
    stage.style.setProperty("--split", `${at}%`);
    divider.setAttribute("aria-valuenow", String(Math.round(at)));
    if (byYou) yourSplit = at;
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame = 0;
  let timer = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
  const glide = (to: number, done: () => void) => {
    const from = at;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      set(from + (to - from) * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2));
      if (t < 1) frame = requestAnimationFrame(step);
      else done();
    };
    frame = requestAnimationFrame(step);
  };
  const sweep = (i: number) => glide(i % 2 ? 20 : 50, () => (timer = window.setTimeout(() => sweep(i + 1), 1600)));
  if (yourSplit !== undefined) set(yourSplit);
  else if (reduced) set(50);
  else {
    set(100);
    timer = window.setTimeout(() => sweep(0), 700);
  }
  cleanups.push(stop);
  const take = () => {
    stop();
    yourSplit ??= at;
  };
  let dragging = false;
  divider.addEventListener("pointerdown", (e) => {
    take();
    dragging = true;
    divider.setPointerCapture(e.pointerId);
  });
  divider.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const r = stage.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100, true);
  });
  // A drag ends when the pointer lifts, or when the browser takes the gesture or the capture is lost.
  for (const end of ["pointerup", "pointercancel", "lostpointercapture"]) divider.addEventListener(end, () => (dragging = false));
  divider.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    take();
    set(at + (e.key === "ArrowLeft" ? -5 : 5), true);
    e.preventDefault();
  });
  const onResize = () => fit();
  window.addEventListener("resize", onResize);
  cleanups.push(() => window.removeEventListener("resize", onResize));
  fit();
  return () => {
    cleanups.forEach((c) => c());
    host.replaceChildren();
  };
}
