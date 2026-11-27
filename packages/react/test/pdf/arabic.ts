/**
 * A font with Arabic letters, for tests of text written right to left, with no binary fixture in the repo: Noto Sans
 * Arabic (SIL Open Font License 1.1), as HarfBuzz's tests ship it in harfbuzzjs, which Satori (a dev dependency here,
 * this package's image engine) depends on. Its Latin letters are drawn in Helvetica, the PDF's fallback.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const harfbuzz = dirname(createRequire(require.resolve("satori/package.json")).resolve("harfbuzzjs/package.json"));

export const arabic = new Uint8Array(readFileSync(join(harfbuzz, "test/fonts/noto/NotoSansArabic-Variable.ttf")));

/** The font as the PDF writer is given it (its family lowercased, as renderPdf() gives it), and as renderPdf() is. */
export const arabicFonts = [{ family: "noto arabic", data: arabic, weight: 400, style: "normal" as const }];
export const arabicGiven = [{ family: "Noto Arabic", src: arabic }];

/** Arabic sentences, numbered, with a comma and brackets: "This is a long sentence in Arabic, number i, in the paragraph (an example)." */
export const arabicSentences = (count: number, from = 1) => Array.from({ length: count }, (_, i) => `هذه جملة طويلة باللغة العربية، رقم ${from + i} في الفقرة (مثال).`).join(" ");
