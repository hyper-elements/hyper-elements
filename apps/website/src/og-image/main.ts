// The Open Graph image generator's page (src/pages/tools/open-graph-image-generator.astro): the form, the preview,
// the network previews and the downloads. The drawing is the worker's (worker.ts). The visitor's photo and logo are
// read here, made smaller where they're large, and sent to the worker only: nothing leaves the browser.
import type { DrawReply, DrawRequest, Problem } from "./protocol";

interface Field {
  path: string;
  kind: string;
  label: string;
  required: boolean;
  default?: unknown;
}
interface Design {
  name: string;
  id: string;
  label: string;
  description: string;
  fields: Field[];
}
interface Picture {
  src: string;
  width: number;
  height: number;
  bytes?: ArrayBuffer;
  /** The file's own name, shown beside its button. */
  name?: string;
}

const SAMPLE: Picture = { src: "https://hyperelements.dev/tools/og-image/sample.jpg", width: 1800, height: 1200 };
const [WIDTH, HEIGHT] = [1200, 630];

function start(root: HTMLElement) {
  const designs: Design[] = JSON.parse(root.dataset.designs ?? "[]");
  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const $$ = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll<T>(selector)];

  const form = $<HTMLFormElement>("#og-form");
  const text = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const preview = $<HTMLImageElement>("#og-image");
  const stage = $("#og-stage");
  const status = $("#og-status");
  const problems = $("#og-problems");
  const accent = $<HTMLInputElement>("#og-accent");
  const count = $("#og-count");

  const state = {
    design: designs[0]?.name ?? "clean",
    photo: SAMPLE as Picture | null,
    logo: null as Picture | null,
    /** The color the visitor picked: until then, each design's own. */
    accent: null as string | null,
    image: null as string | null,
    ok: false,
  };
  const designOf = () => designs.find((d) => d.name === state.design) ?? designs[0];
  const takes = (path: string) => designOf().fields.some((f) => f.path === path);
  const defaultAccent = () => String(designOf().fields.find((f) => f.path === "accent")?.default ?? "#4f46e5");

  // ─── The worker ──────────────────────────────────────────────────────────────────────────────────────────────
  let worker: Worker | undefined;
  let next = 0;
  const waiting = new Map<number, (reply: DrawReply) => void>();
  const workerOf = () => {
    if (!worker) {
      worker = new Worker(root.dataset.runtime ?? "/tools/og-image/runtime.js");
      worker.onmessage = (event: MessageEvent<DrawReply>) => {
        waiting.get(event.data.id)?.(event.data);
        waiting.delete(event.data.id);
      };
      worker.onerror = () => {
        for (const [id, done] of waiting) done({ id, ok: false, problems: [{ code: "og/worker", severity: "error", message: "The image engine didn't load. Reload the page to try again." }] });
        waiting.clear();
        worker = undefined;
      };
    }
    return worker;
  };
  const ask = (format: "svg" | "png") =>
    new Promise<DrawReply>((resolve) => {
      const request = requestOf(++next, format);
      waiting.set(request.id, resolve);
      workerOf().postMessage(request);
    });

  /** What the worker is asked to draw: the fields this design takes, with what's filled in. */
  function requestOf(id: number, format: "svg" | "png"): DrawRequest {
    const values: Record<string, unknown> = {};
    const uploads: Record<string, ArrayBuffer> = {};
    for (const name of ["headline", "site", "author", "date"]) {
      const value = text(name).value.trim();
      if (value && takes(name)) values[name] = value;
    }
    if (takes("accent")) values.accent = state.accent ?? defaultAccent();
    for (const [name, picture] of [["photo", state.photo], ["logo", state.logo]] as const) {
      if (!picture || !takes(name)) continue;
      values[name] = { src: picture.src, width: picture.width, height: picture.height };
      if (picture.bytes) uploads[picture.src] = picture.bytes.slice(0);
    }
    return { id, design: state.design, values, uploads, format };
  }

  // ─── Drawing ─────────────────────────────────────────────────────────────────────────────────────────────────
  let timer: number | undefined;
  let latest = 0;
  const schedule = (wait = 140) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(redraw, wait);
  };

  async function redraw() {
    const mine = ++latest;
    stage.dataset.status = "drawing";
    const started = performance.now();
    const reply = await ask("svg");
    if (mine !== latest) return;
    showProblems(reply.problems);
    state.ok = reply.ok;
    $$<HTMLButtonElement>("[data-download]").forEach((b) => (b.disabled = !reply.ok));
    if (!reply.ok) {
      stage.dataset.status = "failed";
      status.textContent = "Not drawn: see below.";
      return;
    }
    state.image = `data:image/svg+xml;base64,${base64(new Uint8Array(reply.image))}`;
    preview.src = state.image;
    $$<HTMLImageElement>("[data-share-image]").forEach((img) => (img.src = state.image!));
    status.textContent = `Drawn in your browser in ${Math.round(performance.now() - started)} ms`;
    stage.dataset.status = "drawn";
  }

  const LABELS: Record<string, string> = { headline: "Headline", site: "Site name", author: "Author", date: "Date", photo: "Photo", logo: "Logo", accent: "Color" };
  function showProblems(list: Problem[]) {
    problems.replaceChildren(
      ...list.map((p) => {
        const item = document.createElement("li");
        item.className = `og-problem ${p.severity}`;
        const message = p.message.replace(/ \(required by og\.\w+\)$/, "");
        const label = p.field ? (LABELS[p.field] ?? p.field) : "";
        // "This Heading doesn't fit: …" reads better as "Headline doesn't fit: …".
        item.textContent = label && /^This \w+ doesn't fit: /.test(message) ? message.replace(/^This \w+/, label) : label ? `${label}: ${message}` : message;
        return item;
      }),
    );
    problems.hidden = list.length === 0;
  }

  // ─── The form ────────────────────────────────────────────────────────────────────────────────────────────────
  function syncDesign() {
    const design = designOf();
    $$<HTMLButtonElement>("[data-design]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.design === design.name)));
    $$("[data-field]").forEach((el) => (el.hidden = !takes(el.dataset.field!)));
    $$("[data-for-design]").forEach((el) => (el.hidden = el.dataset.forDesign !== design.name));
    $("#og-design-note").textContent = design.description;
    accent.value = state.accent ?? defaultAccent();
    syncSwatches();
    syncMeta();
  }
  function syncSwatches() {
    const current = (state.accent ?? defaultAccent()).toLowerCase();
    $$<HTMLButtonElement>("[data-swatch]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.swatch!.toLowerCase() === current)));
  }

  $$<HTMLButtonElement>("[data-design]").forEach((button) =>
    button.addEventListener("click", () => {
      state.design = button.dataset.design!;
      syncDesign();
      schedule(0);
    }),
  );
  form.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    if (target === accent) {
      state.accent = accent.value;
      syncSwatches();
    }
    if ((target as HTMLInputElement).name === "headline") count.textContent = `${text("headline").value.length} / 140`;
    syncMeta();
    schedule();
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  $$<HTMLButtonElement>("[data-swatch]").forEach((button) =>
    button.addEventListener("click", () => {
      const color = button.dataset.swatch!;
      state.accent = color;
      accent.value = color;
      syncSwatches();
      schedule(0);
    }),
  );

  // Pictures: read on the page, never uploaded.
  for (const name of ["photo", "logo"] as const) {
    const input = $<HTMLInputElement>(`#og-${name}`);
    const label = $(`#og-${name}-name`);
    const remove = $<HTMLButtonElement>(`[data-remove="${name}"]`);
    const sample = root.querySelector<HTMLButtonElement>(`[data-sample="${name}"]`);
    const show = () => {
      const picture = state[name];
      label.textContent = !picture ? "None" : picture === SAMPLE ? "Sample photo" : (picture.name ?? `${picture.width} × ${picture.height}`);
      label.title = picture?.name ? `${picture.name}, ${picture.width} × ${picture.height}` : "";
      remove.hidden = !picture;
      if (sample) sample.hidden = picture === SAMPLE;
    };
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      label.textContent = "Reading…";
      try {
        state[name] = await readPicture(file, name);
        show();
        schedule(0);
      } catch (error) {
        show();
        showProblems([{ code: "og/file", severity: "error", message: error instanceof Error ? error.message : String(error) }]);
      }
    });
    remove.addEventListener("click", () => {
      state[name] = null;
      show();
      schedule(0);
    });
    sample?.addEventListener("click", () => {
      state[name] = SAMPLE;
      show();
      schedule(0);
    });
    show();
  }

  // ─── The previews and the meta tags ──────────────────────────────────────────────────────────────────────────
  const domain = $<HTMLInputElement>("#og-domain");
  function syncMeta() {
    const title = text("headline").value.trim() || "Your headline";
    const host = domain.value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "example.com";
    $$("[data-share-title]").forEach((el) => (el.textContent = title));
    $$("[data-share-domain]").forEach((el) => (el.textContent = el.dataset.shareDomain === "upper" ? host.toUpperCase() : host));
    $("#og-meta").textContent = metaTags(title, host);
  }
  domain.addEventListener("input", syncMeta);

  $$<HTMLButtonElement>("[data-network]").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$<HTMLButtonElement>("[data-network]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      $$("[data-network-panel]").forEach((panel) => (panel.hidden = panel.dataset.networkPanel !== tab.dataset.network));
    }),
  );
  $<HTMLInputElement>("#og-crop").addEventListener("change", (event) => (stage.dataset.crop = String((event.target as HTMLInputElement).checked)));

  // ─── The code tabs ───────────────────────────────────────────────────────────────────────────────────────────
  $$<HTMLButtonElement>("[data-code-tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$<HTMLButtonElement>("[data-code-tab]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      $$("[data-code-panel]").forEach((panel) => (panel.hidden = panel.dataset.codePanel !== tab.dataset.codeTab));
    }),
  );
  $<HTMLButtonElement>("[data-copy-meta]").addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText($("#og-meta").textContent ?? "");
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select and copy";
    }
    window.setTimeout(() => (button.textContent = "Copy"), 1600);
  });

  // ─── Downloads ───────────────────────────────────────────────────────────────────────────────────────────────
  $$<HTMLButtonElement>("[data-download]").forEach((button) =>
    button.addEventListener("click", async () => {
      const type = button.dataset.download === "jpg" ? "image/jpeg" : "image/png";
      const label = button.textContent;
      button.disabled = true;
      button.textContent = "Saving…";
      try {
        const blob = await fileOf(type);
        save(blob, `${slug(text("headline").value) || "og-image"}.${button.dataset.download}`);
      } catch (error) {
        showProblems([{ code: "og/download", severity: "error", message: error instanceof Error ? error.message : String(error) }]);
      } finally {
        button.textContent = label;
        button.disabled = !state.ok;
      }
    }),
  );

  /** The image as a PNG or JPEG file: the SVG drawn on a canvas, or, where the browser won't, a PNG from the worker. */
  async function fileOf(type: "image/png" | "image/jpeg"): Promise<Blob> {
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = [WIDTH, HEIGHT];
    const context = canvas.getContext("2d")!;
    try {
      if (!state.image) throw new Error("Nothing is drawn yet");
      const img = new Image();
      img.src = state.image;
      await img.decode();
      if (type === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, WIDTH, HEIGHT);
      }
      context.drawImage(img, 0, 0, WIDTH, HEIGHT);
      return await blobOf(canvas, type);
    } catch {
      const reply = await ask("png");
      if (!reply.ok) throw new Error(reply.problems[0]?.message ?? "The image didn't draw");
      const png = new Blob([reply.image], { type: "image/png" });
      if (type === "image/png") return png;
      const bitmap = await createImageBitmap(png);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.drawImage(bitmap, 0, 0);
      return blobOf(canvas, type);
    }
  }

  // Start: the form as the page wrote it, drawn once the browser is idle.
  text("headline").dispatchEvent(new Event("input", { bubbles: true }));
  syncDesign();
  schedule(0);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A photo or logo the visitor picked, as the designs take it: a JPEG (a photo, at most 2000px wide) or a PNG (a logo,
 * at most 800px wide), whatever the file was, so every browser's formats work and a large photo stays quick to draw.
 */
async function readPicture(file: File, kind: "photo" | "logo"): Promise<Picture> {
  if (file.size > 25 * 1024 * 1024) throw new Error("That file is over 25 MB. Pick a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error(`This browser can't open ${file.name}. Try a JPG or PNG.`);
    }
    const [w, h] = [img.naturalWidth || 600, img.naturalHeight || 600];
    const max = kind === "photo" ? 2000 : 800;
    const scale = Math.min(1, max / Math.max(w, h));
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
    const context = canvas.getContext("2d")!;
    if (kind === "photo") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = kind === "photo" ? "image/jpeg" : "image/png";
    const blob = await blobOf(canvas, type);
    return { src: kind === "photo" ? "./photo.jpg" : "./logo.png", width: canvas.width, height: canvas.height, bytes: await blob.arrayBuffer(), name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const blobOf = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The browser didn't make the file"))), type, 0.9));

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function metaTags(title: string, host: string): string {
  const image = `https://${host}/og/${slug(title) || "og-image"}.png`;
  return [
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join("\n");
}

// Last, so every helper above is defined before the page starts.
const root = document.querySelector<HTMLElement>("[data-og-tool]");
if (root) start(root);
