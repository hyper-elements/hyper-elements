/**
 * The frames a preview draws in, and waiting for what they show: sandboxed (no scripts, forms, popups or navigation
 * run in them; allow-same-origin lets the shell measure them), each at the client's width and as tall as its content.
 * Every wait stops at the preview's deadline.
 */

/** An element's computed style, from its own document's window. */
const styleOf = (el: Element) => el.ownerDocument.defaultView!.getComputedStyle(el);

/** Resolves when `promise` does, or with `fallback` at the deadline. */
export function until<T>(promise: Promise<T>, deadline: number, fallback: T): Promise<T> {
  const left = deadline - performance.now();
  if (left <= 0) return Promise.resolve(fallback);
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), left))]);
}

/** A sandboxed frame of `width` showing `html`, once it has loaded (or at the deadline). */
export async function frame(html: string, width: number, title: string, deadline: number): Promise<HTMLIFrameElement> {
  const el = document.createElement("iframe");
  el.setAttribute("sandbox", "allow-same-origin");
  el.setAttribute("title", title);
  el.style.width = `${width}px`;
  el.style.height = "0";
  const loaded = new Promise<void>((resolve) => el.addEventListener("load", () => resolve(), { once: true }));
  el.srcdoc = html;
  document.getElementById("frames")!.append(el);
  await until(loaded, deadline, undefined);
  return el;
}

/** `css` in `html`'s head, after what the client's processing wrote (so it's neither counted nor removed by it). */
export function withCss(html: string, css: string): string {
  if (!css) return html;
  const style = `<style>${css}</style>`;
  const head = html.search(/<\/head>/i);
  return head >= 0 ? html.slice(0, head) + style + html.slice(head) : style + html;
}

/** The frame as tall as what it shows. */
export function grow(el: HTMLIFrameElement): void {
  const doc = el.contentDocument;
  if (!doc) return;
  el.style.height = `${Math.ceil(Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0))}px`;
}

/** Loads each stand-in face (`"normal 400 16px Family"`) in the frame's document. */
export async function loadFaces(doc: Document, faces: readonly string[], deadline: number): Promise<void> {
  await until(Promise.all(faces.map((face) => doc.fonts.load(face).catch(() => []))), deadline, []);
}

/**
 * Waits for every image to load or fail; one that failed, or is still loading at the deadline, is drawn as a gray box
 * of its size. Returns their sources.
 */
export async function settleImages(doc: Document, deadline: number): Promise<string[]> {
  const images = [...doc.images];
  const done = (img: HTMLImageElement) => img.complete || new Promise<void>((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  });
  await until(Promise.all(images.map(done)), deadline, []);
  const missing: string[] = [];
  for (const img of images) {
    if (img.complete && img.naturalWidth > 0) continue;
    missing.push(img.getAttribute("src") ?? "");
    const box = doc.createElement("span");
    const rect = img.getBoundingClientRect();
    const width = img.getAttribute("width") ? `${img.getAttribute("width")}px` : `${Math.round(rect.width)}px`;
    const height = img.getAttribute("height") ? `${img.getAttribute("height")}px` : `${Math.round(rect.height)}px`;
    box.setAttribute("style", `${img.getAttribute("style") ?? ""};display:${styleOf(img).display === "inline" ? "inline-block" : styleOf(img).display};width:${width};max-width:100%;height:${height};background:#d0d7de`);
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", img.getAttribute("alt") ?? "");
    for (const name of ["data-el-path", "id", "class"]) if (img.hasAttribute(name)) box.setAttribute(name, img.getAttribute(name)!);
    img.replaceWith(box);
  }
  return missing;
}

/** The email's own web fonts (its @font-face rules the client kept, not a stand-in) that failed or are still loading. */
export async function missingAuthorFonts(doc: Document, standIns: ReadonlySet<string>, deadline: number): Promise<Array<{ family: string; src: string }>> {
  const rules: Array<{ family: string; src: string }> = [];
  for (const sheet of [...doc.styleSheets]) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of [...list]) {
      if (rule.constructor.name !== "CSSFontFaceRule") continue;
      const style = (rule as CSSFontFaceRule).style;
      const family = style.getPropertyValue("font-family").replace(/^["']|["']$/g, "");
      if (!family || standIns.has(family)) continue;
      rules.push({ family, src: style.getPropertyValue("src").match(/url\(["']?([^"')]+)/)?.[1] ?? "" });
    }
  }
  if (!rules.length) return [];
  const faces = [...doc.fonts].filter((face) => rules.some((rule) => rule.family === face.family.replace(/^["']|["']$/g, "")));
  await until(Promise.all(faces.map((face) => (face.status === "unloaded" ? face.load().catch(() => face) : face.loaded.catch(() => face)))), deadline, []);
  const failed = new Set(faces.filter((face) => face.status !== "loaded").map((face) => face.family.replace(/^["']|["']$/g, "")));
  return rules.filter((rule) => failed.has(rule.family)).filter((rule, i, all) => all.findIndex((r) => r.family === rule.family) === i);
}
