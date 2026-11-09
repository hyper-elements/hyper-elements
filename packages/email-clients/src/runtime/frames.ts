/**
 * The frames a preview draws in, and waiting for what they show: sandboxed (no scripts, forms, popups or navigation
 * run in them; allow-same-origin lets the shell measure them), each at the client's width and as tall as its content.
 * Every wait stops at the preview's deadline.
 */

/** Resolves when `promise` does, or with `fallback` at the deadline. */
export function until<T>(promise: Promise<T>, deadline: number, fallback: T): Promise<T> {
  const left = deadline - performance.now();
  if (left <= 0) return Promise.resolve(fallback);
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), left))]);
}

/**
 * A sandboxed frame of `width` showing `html`, once it has loaded (or at the deadline), `height` tall while it loads
 * and is measured (a window's height, for what's sized by it), as tall as its content once grown.
 */
export async function frame(html: string, width: number, height: number, title: string, deadline: number): Promise<HTMLIFrameElement> {
  const el = document.createElement("iframe");
  el.setAttribute("sandbox", "allow-same-origin");
  el.setAttribute("title", title);
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
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
 * of its size: the same <img>, its source a gray SVG, so its layout (and classic Outlook's rules, which size images
 * as Word does) stay as they were. Returns their sources.
 */
export async function settleImages(doc: Document, deadline: number): Promise<string[]> {
  const images = [...doc.images];
  // Every image loads, as in the client's view of the message: one loading="lazy" below the frame's window wouldn't.
  for (const img of images) if (img.loading === "lazy") img.loading = "eager";
  const done = (img: HTMLImageElement) => img.complete || new Promise<void>((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  });
  await until(Promise.all(images.map(done)), deadline, []);
  const missing: string[] = [];
  const replaced: HTMLImageElement[] = [];
  for (const img of images) {
    if (img.complete && img.naturalWidth > 0) continue;
    missing.push(img.getAttribute("src") ?? "");
    const rect = img.getBoundingClientRect();
    const width = Number(img.getAttribute("width")) || Math.round(rect.width) || 1;
    const height = Number(img.getAttribute("height")) || Math.round(rect.height) || 1;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#d0d7de"/></svg>`;
    img.setAttribute("data-email-client-missing", img.getAttribute("src") ?? "");
    img.setAttribute("src", `data:image/svg+xml,${encodeURIComponent(svg)}`);
    replaced.push(img);
  }
  await until(Promise.all(replaced.map((img) => img.decode().catch(() => undefined))), deadline, []);
  return missing;
}

/**
 * The email's own web fonts (its @font-face rules the client kept, not a stand-in) that its text asked for and that
 * failed, or are still loading at the deadline. A face nothing uses isn't fetched, as in the client, and isn't listed.
 */
export async function missingAuthorFonts(doc: Document, standIns: ReadonlySet<string>, deadline: number): Promise<Array<{ family: string; src: string }>> {
  const rules: Array<{ family: string; src: string; face: string }> = [];
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
      const face = faceKey(family, style.getPropertyValue("font-style"), style.getPropertyValue("font-weight"));
      rules.push({ family, src: style.getPropertyValue("src").match(/url\(["']?([^"')]+)/)?.[1] ?? "", face });
    }
  }
  if (!rules.length) return [];
  await until(doc.fonts.ready.then(() => undefined), deadline, undefined);
  // Each face by its family, style and weight, so a failed italic is listed with its own file, not its regular's.
  const failed = new Set([...doc.fonts].filter((face) => face.status === "error" || face.status === "loading").map((face) => faceKey(face.family, face.style, face.weight)));
  return rules
    .filter((rule) => failed.has(rule.face))
    .filter((rule, i, all) => all.findIndex((r) => r.face === rule.face) === i)
    .map(({ family, src }) => ({ family, src }));
}

/** A face's family, style and weight, as one key: the descriptors as written in CSS or as a FontFace gives them. */
function faceKey(family: string, style: string, weight: string): string {
  const weights: Record<string, string> = { "": "400", normal: "400", bold: "700" };
  return [family.replace(/^["']|["']$/g, ""), style.trim() || "normal", weights[weight.trim()] ?? weight.trim()].join("|");
}
