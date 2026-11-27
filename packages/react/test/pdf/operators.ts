/**
 * Each glyph a page of a PDF draws, read from its drawing operators with pdf.js: where it starts across the page, its
 * baseline, and its characters. Exact where pdf.js's text content (which shares a line's spacing out among its words)
 * isn't.
 */
import { OPS, type getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

type Matrix = number[];
const times = (m: Matrix, n: Matrix): Matrix => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];

/**
 * Each glyph a page of the PDF draws, from its drawing operators (pdf.js's operator list): where it starts across the page
 * and its baseline, in points from the page's top left, and the characters it's drawn for.
 */
export async function glyphs(page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>>): Promise<Array<{ x: number; baseline: number; text: string }>> {
  const height = page.view[3];
  const { fnArray, argsArray } = await page.getOperatorList();
  const out: Array<{ x: number; baseline: number; text: string }> = [];
  const matrix = (args: unknown[]): Matrix => Array.from((Array.isArray(args[0]) || ArrayBuffer.isView(args[0]) ? args[0] : args) as ArrayLike<number>);
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let text: Matrix = [1, 0, 0, 1, 0, 0];
  let size = 0;
  const saved: Matrix[] = [];
  fnArray.forEach((fn, i) => {
    const args = argsArray[i] as unknown[];
    if (fn === OPS.save) saved.push(ctm);
    else if (fn === OPS.restore) ctm = saved.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = times(ctm, matrix(args));
    else if (fn === OPS.setFont) size = args[1] as number;
    else if (fn === OPS.setTextMatrix) text = matrix(args);
    else if (fn === OPS.showText) {
      const m = times(ctm, text);
      let advance = 0;
      for (const glyph of args[0] as Array<number | { width: number; unicode: string }>) {
        if (typeof glyph === "number") advance -= (glyph * size) / 1000;
        else {
          out.push({ x: m[0] * advance + m[4], baseline: height - m[5], text: glyph.unicode });
          advance += (glyph.width * size) / 1000;
        }
      }
    }
  });
  return out;
}

/** Each image a page of the PDF draws (its unit square, transformed), in points from the page's top left. */
export async function images(page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>>): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  const height = page.view[3];
  const { fnArray, argsArray } = await page.getOperatorList();
  const out: Array<{ x: number; y: number; width: number; height: number }> = [];
  const matrix = (args: unknown[]): Matrix => Array.from((Array.isArray(args[0]) || ArrayBuffer.isView(args[0]) ? args[0] : args) as ArrayLike<number>);
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const saved: Matrix[] = [];
  fnArray.forEach((fn, i) => {
    const args = argsArray[i] as unknown[];
    if (fn === OPS.save) saved.push(ctm);
    else if (fn === OPS.restore) ctm = saved.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = times(ctm, matrix(args));
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) out.push({ x: ctm[4], y: height - ctm[5] - ctm[3], width: ctm[0], height: ctm[3] });
  });
  return out;
}
