// Draws the image briefs' new pictures (abstract shapes: no faces, no words, since the checker reads words with OCR),
// copies the site's Orbit images, and writes MANIFEST.json with each file's sha256. The same bytes every time.
//   node suites/image/assets/make.mjs
import { createHash } from "node:crypto";
import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, "../../../../apps/website/public/img");

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));

/** A square picture: a diagonal two-color ground, then filled circles, each [cx, cy, r, color] in 0–1 units. */
function draw(size, from, to, circles) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = mix(hex(from), hex(to), (x + y) / (2 * size));
      for (const [cx, cy, r, color] of circles) {
        const d = Math.hypot(x / size - cx, y / size - cy);
        if (d < r) c = hex(color);
      }
      const i = (y * size + x) * 4;
      png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png, { colorType: 2 });
}

const files = {
  "avatar-maya.png": draw(256, "#f97316", "#db2777", [[0.5, 0.42, 0.2, "#fde68a"], [0.5, 1.02, 0.42, "#7c2d12"], [0.18, 0.16, 0.08, "#fb7185"]]),
  "avatar-daniel.png": draw(256, "#0ea5e9", "#4f46e5", [[0.5, 0.4, 0.19, "#a5f3fc"], [0.5, 1.0, 0.4, "#1e3a8a"], [0.84, 0.18, 0.07, "#22d3ee"]]),
  "podcast-cover.png": draw(600, "#7c3aed", "#0f766e", [[0.3, 0.32, 0.22, "#facc15"], [0.72, 0.62, 0.3, "#f43f5e"], [0.5, 0.5, 0.12, "#111827"], [0.85, 0.15, 0.08, "#ffffff"]]),
};
for (const [name, bytes] of Object.entries(files)) await writeFile(join(here, name), bytes);
// orbit-logo-white.png and orbit-card-bg.png are kept here: the site no longer has them (705f157f removed them).
for (const name of ["orbit-logo.png"]) await copyFile(join(site, name), join(here, name));

const manifest = {};
for (const name of (await readdir(here)).filter((f) => f.endsWith(".png")).sort()) {
  const bytes = await readFile(join(here, name));
  const { width, height } = PNG.sync.read(bytes);
  manifest[name] = { width, height, sha256: createHash("sha256").update(bytes).digest("hex") };
}
await writeFile(join(here, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(manifest);
