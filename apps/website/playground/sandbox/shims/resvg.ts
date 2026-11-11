// @resvg/resvg-js (a native Node module) for a browser: resvg's WebAssembly build, which has the same Resvg class
// once its module is loaded (image.ts loads it before anything is drawn).
import { initWasm, Resvg as WasmResvg } from "@resvg/resvg-wasm";

export const loadResvg = (wasm: WebAssembly.Module | ArrayBuffer) => initWasm(wasm);

type Options = ConstructorParameters<typeof WasmResvg>[1] & { font?: { loadSystemFonts?: boolean } };

export class Resvg extends WasmResvg {
  constructor(svg: string | Uint8Array, options?: Options) {
    // There are no system fonts to load here, and the WebAssembly build has no option for them.
    const { font, ...rest } = options ?? {};
    const { loadSystemFonts: _none, ...fontRest } = font ?? {};
    super(svg, { ...rest, ...(Object.keys(fontRest).length ? { font: fontRest } : {}) });
  }
}
