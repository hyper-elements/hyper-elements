// OCR for tools/check.mjs: Tesseract (tesseract.js, WebAssembly), offline, from node_modules. The checker gives it a
// mask (black where a text color is drawn, white elsewhere) so it always reads dark words on a light ground.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(join(here, "..", "package.json"));

let worker = null;
async function getWorker() {
  if (worker) return worker;
  const { createWorker, OEM, PSM } = req("tesseract.js");
  const langPath = join(dirname(req.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");
  worker = await createWorker("eng", OEM.LSTM_ONLY, { langPath, cacheMethod: "none", gzip: true, logger: () => {}, errorHandler: () => {} });
  // A set resolution, so Tesseract doesn't estimate one (and print that it did).
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1", user_defined_dpi: "72" });
  return worker;
}

export async function closeOcr() {
  if (worker) await worker.terminate();
  worker = null;
}

/**
 * Reads a mask (width × height, 1 where ink) and returns its words, each with its text, confidence, box (in the
 * image's pixels) and line (words on one line share it). `scale` draws the mask smaller or larger first.
 */
export async function readWords(mask, width, height, scale = 1, pass = "") {
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Area sample: a pixel is ink when half the mask pixels under it are.
      const x0 = Math.floor(x / scale), x1 = Math.max(x0 + 1, Math.floor((x + 1) / scale));
      const y0 = Math.floor(y / scale), y1 = Math.max(y0 + 1, Math.floor((y + 1) / scale));
      let ink = 0, n = 0;
      for (let yy = y0; yy < Math.min(y1, height); yy++) for (let xx = x0; xx < Math.min(x1, width); xx++) { ink += mask[yy * width + xx]; n++; }
      const v = n && ink / n >= 0.5 ? 0 : 255;
      const i = (y * w + x) * 4;
      png.data[i] = png.data[i + 1] = png.data[i + 2] = v;
      png.data[i + 3] = 255;
    }
  }
  const ocr = await getWorker();
  const { data } = await ocr.recognize(PNG.sync.write(png), {}, { blocks: true, text: false });
  const words = [];
  let line = 0;
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const l of para.lines ?? []) {
        line++;
        for (const word of l.words ?? []) {
          const b = word.bbox;
          words.push({
            text: word.text, confidence: word.confidence, line: `${pass}${line}`,
            box: { left: b.x0 / scale, top: b.y0 / scale, right: b.x1 / scale, bottom: b.y1 / scale },
          });
        }
      }
    }
  }
  return words;
}
