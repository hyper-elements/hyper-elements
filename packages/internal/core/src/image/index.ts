/**
 * What the image output of `@hyper-elements/react/image` is made of: a Canvas as an image to draw (the writer), and
 * the Satori and resvg adapter that draws it. This entry is separate from the core's main one so that nothing that
 * imports the core loads Satori or resvg.
 */
export * from "./model";
// What the entry's reader (src/image in @hyper-elements/react) takes from the core too, so its bundle holds one copy of it.
export { assetParts, fontStack, LAYOUT_VERSION, lineHeightPx, type Asset, type FontFace } from "../index";
export { satoriLayout, satoriMissing, satoriResvg, satoriWidest, satoriWords, type LaidOutBox } from "./satori";
export { drawnText, writeCanvas, type WriteContext } from "./write";
// What emailImages() names its drawer by (each picture's file is named by it): the core's hash, so its bundle has one.
export { sha256Hex } from "../writers/shared/sha256";
export { utf8Encode } from "../writers/shared/bytes";
