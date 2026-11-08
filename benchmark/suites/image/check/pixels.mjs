// Pixels for tools/check.mjs: PNG decoding, colors (CIELAB, ΔE76), the ink mask OCR reads, and finding an image by
// normalized cross-correlation.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const req = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"));
const { PNG } = req("pngjs");

/** A PNG as { width, height, rgb } (alpha composited over white). */
export function readPng(bytesOrPath) {
  const png = PNG.sync.read(typeof bytesOrPath === "string" ? readFileSync(bytesOrPath) : bytesOrPath);
  const { width, height, data } = png;
  const rgb = new Uint8Array(width * height * 3);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255;
    alpha[i] = data[i * 4 + 3];
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(data[i * 4 + c] * a + 255 * (1 - a));
  }
  return { width, height, rgb, alpha };
}

// ─── Colors ──────────────────────────────────────────────────────────────

const NAMES = { white: "#ffffff", black: "#000000", red: "#ff0000", blue: "#0000ff", transparent: null };

/** A CSS color as [r, g, b], or null. */
export function parseColor(value) {
  if (value === undefined || value === null) return null;
  let s = String(value).trim().toLowerCase();
  if (s in NAMES) s = NAMES[s];
  if (!s) return null;
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) return [m[1], m[2], m[3]].map((x) => Math.round(Number(x)));
  return null;
}

const lin = new Float64Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
export function lab([r, g, b]) {
  const R = lin[r], G = lin[g], B = lin[b];
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
export const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const hex = ([r, g, b]) => "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");

export const pixel = (img, x, y) => {
  const i = (Math.min(img.height - 1, Math.max(0, Math.round(y))) * img.width + Math.min(img.width - 1, Math.max(0, Math.round(x)))) * 3;
  return [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]];
};

/** The median color of a box's pixels (each channel's median). */
export function median(img, box) {
  const ch = [[], [], []];
  for (let y = Math.max(0, Math.floor(box.top)); y < Math.min(img.height, Math.ceil(box.bottom)); y++) {
    for (let x = Math.max(0, Math.floor(box.left)); x < Math.min(img.width, Math.ceil(box.right)); x++) {
      const i = (y * img.width + x) * 3;
      for (let c = 0; c < 3; c++) ch[c].push(img.rgb[i + c]);
    }
  }
  return ch.map((v) => { v.sort((a, b) => a - b); return v[v.length >> 1] ?? 0; });
}

/** The pixels between two boxes, `inner` inside `outer`. */
export function ring(img, inner, outer) {
  const out = [];
  for (let y = Math.max(0, Math.floor(outer.top)); y < Math.min(img.height, Math.ceil(outer.bottom)); y++) {
    for (let x = Math.max(0, Math.floor(outer.left)); x < Math.min(img.width, Math.ceil(outer.right)); x++) {
      if (x >= inner.left && x < inner.right && y >= inner.top && y < inner.bottom) continue;
      out.push(pixel(img, x, y));
    }
  }
  return out;
}

const labCache = new Map();
export function labOf(r, g, b) {
  const k = (r << 16) | (g << 8) | b;
  let v = labCache.get(k);
  if (!v) { v = lab([r, g, b]); labCache.set(k, v); }
  return v;
}

/**
 * The ink mask: 1 where a pixel is nearer one of `inks` than any of `grounds` (all [r, g, b]), and within `near` ΔE of it. Antialiased edges go
 * to whichever they're nearer, so a letter keeps its shape.
 */
export function inkMask(img, inks, grounds, near = 24) {
  const palette = [...inks.map((c) => ({ lab: lab(c), ink: 1 })), ...grounds.map((c) => ({ lab: lab(c), ink: 0 }))];
  const mask = new Uint8Array(img.width * img.height);
  const memo = new Map();
  for (let i = 0; i < mask.length; i++) {
    const r = img.rgb[i * 3], g = img.rgb[i * 3 + 1], b = img.rgb[i * 3 + 2];
    const k = (r << 16) | (g << 8) | b;
    let v = memo.get(k);
    if (v === undefined) {
      const L = labOf(r, g, b);
      let best = Infinity;
      v = 0;
      for (const p of palette) { const d = deltaE(L, p.lab); if (d < best) { best = d; v = p.ink; } }
      // Ink only near a text color: a blend of two grounds (a pill's antialiased edge) isn't text.
      if (best > near) v = 0;
      memo.set(k, v);
    }
    mask[i] = v;
  }
  return mask;
}

/** Up to n distinct colors of an image, sampled on a grid: the ground under text on a picture. */
export function sampleColors(img, n = 24) {
  const out = [];
  const step = Math.ceil(Math.sqrt((img.width * img.height) / (n * 4)));
  for (let y = step >> 1; y < img.height; y += step) {
    for (let x = step >> 1; x < img.width; x += step) {
      const c = pixel(img, x, y);
      if (!out.some((o) => deltaE(lab(o), lab(c)) < 6)) out.push(c);
    }
  }
  return out;
}

// ─── Finding an image ────────────────────────────────────────────────────

const gray = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** An image's gray values and mask at width w (area-averaged), the mask its opaque pixels (and a circle, if asked). */
function scaled(src, w, circle) {
  const h = Math.max(1, Math.round((src.height * w) / src.width));
  const g = new Float64Array(w * h), m = new Uint8Array(w * h), rgb = new Uint8Array(w * h * 3);
  const sx = src.width / w, sy = src.height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0, n = 0;
      const c = [0, 0, 0];
      for (let yy = Math.floor(y * sy); yy < Math.max(Math.floor(y * sy) + 1, Math.floor((y + 1) * sy)); yy++) {
        for (let xx = Math.floor(x * sx); xx < Math.max(Math.floor(x * sx) + 1, Math.floor((x + 1) * sx)); xx++) {
          const i = yy * src.width + xx;
          for (let k = 0; k < 3; k++) c[k] += src.rgb[i * 3 + k];
          a += src.alpha[i];
          n++;
        }
      }
      for (let k = 0; k < 3; k++) rgb[(y * w + x) * 3 + k] = Math.round(c[k] / n);
      g[y * w + x] = gray(c[0] / n, c[1] / n, c[2] / n);
      const inside = !circle || Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2) < Math.min(w, h) / 2 - 1;
      m[y * w + x] = a / n > 200 && inside ? 1 : 0;
    }
  }
  return { w, h, g, m, rgb };
}

/** How far the image's colors at (px, py) are from the template's: the mean ΔE over its opaque pixels. */
function colorDistance(img, t, px, py, step) {
  let sum = 0, n = 0;
  for (let y = 0; y < t.h; y += step) for (let x = 0; x < t.w; x += step) {
    const k = y * t.w + x;
    if (!t.m[k]) continue;
    const i = ((py + y) * img.width + px + x) * 3;
    sum += deltaE(labOf(img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]), labOf(t.rgb[k * 3], t.rgb[k * 3 + 1], t.rgb[k * 3 + 2]));
    n++;
  }
  return n ? sum / n : Infinity;
}

function grayOf(img, factor) {
  const w = Math.floor(img.width / factor), h = Math.floor(img.height / factor);
  const g = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let yy = 0; yy < factor; yy++) for (let xx = 0; xx < factor; xx++) {
      const i = ((y * factor + yy) * img.width + x * factor + xx) * 3;
      s += gray(img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]);
    }
    g[y * w + x] = s / (factor * factor);
  }
  return { w, h, g };
}

/** Masked normalized cross-correlation of template t at (px, py) in image g, over every `step`th template pixel. */
function ncc(img, t, px, py, step = 1) {
  let n = 0, si = 0, st = 0, sii = 0, stt = 0, sit = 0;
  for (let y = 0; y < t.h; y += step) {
    const row = (py + y) * img.w + px;
    for (let x = 0; x < t.w; x += step) {
      const k = y * t.w + x;
      if (!t.m[k]) continue;
      const a = img.g[row + x], b = t.g[k];
      n++; si += a; st += b; sii += a * a; stt += b * b; sit += a * b;
    }
  }
  if (n < 8) return -1;
  const cov = sit - (si * st) / n, vi = sii - (si * si) / n, vt = stt - (st * st) / n;
  if (vt < 1e-6) return -1;
  // A flat patch (a plain or smoothly shaded background) correlates with anything once normalized: not a match.
  if (vi / n < 16) return 0;
  return cov / Math.sqrt(vi * vt);
}

/**
 * Where an image (src, decoded with readPng) is drawn at about `width` px wide: { score, box }. Searched coarse
 * (downsampled) over the whole canvas, then refined at full size at scales within ±6%.
 */
export function findImage(img, src, width, { circle = false } = {}) {
  const factor = Math.max(1, Math.floor(width / 32));
  const coarse = grayOf(img, factor);
  const t = scaled(src, Math.max(4, Math.round(width / factor)), circle);
  const candidates = [];
  for (let y = 0; y + t.h <= coarse.h; y++) {
    for (let x = 0; x + t.w <= coarse.w; x++) {
      const s = ncc(coarse, t, x, y);
      candidates.push([s, x, y]);
    }
  }
  candidates.sort((a, b) => b[0] - a[0]);
  const picks = [];
  for (const c of candidates) {
    if (picks.length >= 20) break;
    if (picks.every((p) => Math.hypot(p[1] - c[1], p[2] - c[2]) > Math.max(t.w, t.h) / 2)) picks.push(c);
  }
  // Refined at full size, each candidate's best place (at the asked width), then its best scale near there; then the
  // best of those whose colors are the image's too (shapes alone can match another picture: a ring on a head).
  const full = grayOf(img, 1);
  const templates = new Map([0.94, 0.96, 0.98, 1, 1.02, 1.04, 1.06].map((s) => [s, scaled(src, Math.round(width * s), circle)]));
  const at = (tt, x, y) => (x < 0 || y < 0 || x + tt.w > img.width || y + tt.h > img.height ? -2 : ncc(full, tt, x, y, Math.max(1, Math.floor(tt.w / 64))));
  const refined = [];
  for (const [, cx, cy] of picks) {
    const t1 = templates.get(1);
    let best = { score: -2 };
    const r = factor * 2 + 2;
    for (let y = cy * factor - r; y <= cy * factor + r; y++) for (let x = cx * factor - r; x <= cx * factor + r; x++) {
      const s = at(t1, x, y);
      if (s > best.score) best = { score: s, t: t1, x, y };
    }
    const { x: bx, y: by } = best;
    for (const tt of templates.values()) {
      const d = Math.ceil(Math.abs(tt.w - t1.w) / 2) + 2;
      for (let y = by - d; y <= by + d; y++) for (let x = bx - d; x <= bx + d; x++) {
        const s = at(tt, x, y);
        if (s > best.score) best = { score: s, t: tt, x, y };
      }
    }
    if (best.score < -1) continue;
    const step = Math.max(1, Math.floor(best.t.w / 64));
    refined.push({
      score: best.score, t: best.t,
      box: { left: best.x, top: best.y, right: best.x + best.t.w, bottom: best.y + best.t.h, width: best.t.w, height: best.t.h },
      color: colorDistance(img, best.t, best.x, best.y, step),
    });
  }
  refined.sort((a, b) => b.score - a.score);
  const pick = refined.find((r) => r.color <= 15) ?? refined[0];
  return pick ? { score: pick.score, color: +pick.color.toFixed(1), colorOk: pick.color <= 15, box: pick.box } : { score: -1, box: null };
}

/** The asset's pixel at the place (x, y) of a box it's drawn in: what's there if the image is drawn square. */
export function assetPixel(src, box, x, y) {
  const sx = ((x - box.left) / box.width) * src.width, sy = ((y - box.top) / box.height) * src.height;
  return pixel(src, sx, sy);
}
