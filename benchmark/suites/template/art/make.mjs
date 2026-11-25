// Draws the launch task's pictures, standing in for a screenshot tool and an image provider (fixed files, so no
// model call varies): product screenshots (flat blocks of an app's interface, no words: the checker reads words with
// OCR) and abstract artworks (bands of violet and teal on navy). Writes MANIFEST.json with each file's sha256. The same
// bytes every time.
//   node suites/template/art/make.mjs
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function write(name, width, height, paint) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = paint(x, y);
      const i = (y * width + x) * 4;
      png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255;
    }
  }
  return writeFile(join(here, name), PNG.sync.write(png, { colorType: 2 }));
}

/** An app's screen: a top bar, a sidebar, and cards of colored blocks, laid out by `seed`. */
function screenshot(width, height, seed) {
  const rnd = (() => { let s = seed; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  const accents = ["#4f46e5", "#2dd4bf", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"].map(hex);
  const bar = Math.round(height * 0.08), side = Math.round(width * 0.18);
  const blocks = [];
  const cols = 3, rows = 2, gap = Math.round(width * 0.02);
  const cw = (width - side - gap * (cols + 1)) / cols, ch = (height - bar - gap * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const left = side + gap + c * (cw + gap), top = bar + gap + r * (ch + gap);
    blocks.push({ left, top, right: left + cw, bottom: top + ch, color: hex("#ffffff") });
    blocks.push({ left: left + cw * 0.08, top: top + ch * 0.12, right: left + cw * (0.3 + 0.5 * rnd()), bottom: top + ch * 0.3, color: accents[Math.floor(rnd() * accents.length)] });
    blocks.push({ left: left + cw * 0.08, top: top + ch * 0.45, right: left + cw * (0.5 + 0.4 * rnd()), bottom: top + ch * (0.55 + 0.35 * rnd()), color: accents[Math.floor(rnd() * accents.length)] });
  }
  const ground = hex("#eef1f7"), barColor = hex("#111827"), sideColor = hex("#1f2937");
  return (x, y) => {
    if (y < bar) return x > width * 0.03 && x < width * 0.12 && y > bar * 0.3 && y < bar * 0.7 ? hex("#2dd4bf") : barColor;
    if (x < side) return y > bar + (((y - bar) / 40) | 0) * 40 + 12 && y < bar + (((y - bar) / 40) | 0) * 40 + 24 && x > side * 0.15 && x < side * 0.8 ? hex("#6b7280") : sideColor;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (x >= b.left && x < b.right && y >= b.top && y < b.bottom) return b.color;
    }
    return ground;
  };
}

/** Abstract light waves: bands of violet and teal on deep indigo (not the card's navy, so it shows), in eight flat steps (so the file stays small). */
function artwork(width, height, phase) {
  const navy = hex("#1e1b4b"), violet = hex("#7c3aed"), teal = hex("#2dd4bf");
  return (x, y) => {
    const wave = Math.sin((x / width) * Math.PI * 3 + phase) * 0.18 + 0.5;
    const d = Math.abs(y / height - wave);
    const step = Math.min(7, Math.floor(d * 16));
    const t = 1 - step / 7;
    const tone = step % 2 ? violet : teal;
    return navy.map((n, i) => Math.round(n + (tone[i] - n) * t * 0.9));
  };
}

const shots = { "shot-launch.png": [1200, 750, 7], "shot-summit.png": [1260, 700, 11], "shot-pricing.png": [1100, 800, 13], "shot-inbox.png": [1200, 800, 17], "shot-hiring.png": [1280, 720, 19], "shot-wide.png": [1600, 400, 23] };
for (const [name, [w, h, seed]] of Object.entries(shots)) await write(name, w, h, screenshot(w, h, seed));
const arts = { "art-launch.png": 0, "art-summit.png": 1.1, "art-pricing.png": 2.3, "art-inbox.png": 3.4, "art-hiring.png": 4.6 };
for (const [name, phase] of Object.entries(arts)) await write(name, 1080, 680, artwork(1080, 680, phase));

const manifest = {};
for (const f of (await readdir(here)).filter((f) => f.endsWith(".png")).sort()) {
  const bytes = await readFile(join(here, f));
  manifest[f] = { sha256: createHash("sha256").update(bytes).digest("hex"), source: f.startsWith("shot") ? "drawn by make.mjs: a product screenshot" : "drawn by make.mjs: generated artwork" };
}
await writeFile(join(here, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
