// The sandbox's image bundle: @hyper-elements/react/image, with Satori and resvg's WebAssembly build
// (shims/resvg.ts). Loaded after core, when a Canvas's PNG or SVG is asked for.
import { renderImage } from "@hyper-elements/react/image";
import { loadResvg } from "./shims/resvg";

(globalThis as any).__HYPER_ELEMENTS_SANDBOX__.extras.image = { renderImage, loadResvg };
