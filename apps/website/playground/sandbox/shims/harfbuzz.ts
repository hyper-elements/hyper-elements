// harfbuzzjs (Satori shapes text with it) for the sandbox: its WebAssembly module from bytes in this bundle, where
// the package's own entry fetches hb.wasm from beside its script (the sandbox has no network).
import createHarfBuzz from "real:harfbuzzjs/hb.js";
import wasmBinary from "real:harfbuzzjs/hb.wasm";
import hbjs from "real:harfbuzzjs/hbjs.js";

export default createHarfBuzz({ wasmBinary }).then(hbjs);
