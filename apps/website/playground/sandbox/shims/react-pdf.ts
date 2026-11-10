// @react-pdf/renderer for a browser: its browser build, with the renderToBuffer() the PDF writer calls (Node's own in
// the package) made from pdf().toBlob(), which the browser build has.
import { pdf } from "real:@react-pdf/renderer";

export * from "real:@react-pdf/renderer";

export async function renderToBuffer(element: Parameters<typeof pdf>[0]): Promise<Uint8Array> {
  const blob = await pdf(element).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
