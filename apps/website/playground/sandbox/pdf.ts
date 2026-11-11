// The sandbox's PDF bundle: @hyper-elements/react/pdf, with react-pdf's browser build (shims/react-pdf.ts). Loaded
// after core, when a Document's PDF is asked for.
import { renderPdf } from "@hyper-elements/react/pdf";

(globalThis as any).__HYPER_ELEMENTS_SANDBOX__.extras.pdf = { renderPdf };
