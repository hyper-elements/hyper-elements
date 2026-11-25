import { writeFile } from "node:fs/promises";
import { renderPdf } from "@hyper-elements/react/pdf";
import ReceiptDocument from "../../designs/receipt-document";

const { pdf, diagnostics } = await renderPdf(<ReceiptDocument />);
for (const { code, message } of diagnostics) console.warn(code, message);
await writeFile("receipt.pdf", pdf);
