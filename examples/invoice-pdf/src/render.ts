import { mkdir, writeFile } from "node:fs/promises";
import { render } from "@hyper-elements/react";
import { invoiceDocument, sampleInvoice } from "./invoice.js";
import { htmlToPdf } from "./pdf.js";

await mkdir("output", { recursive: true });

// 1. Render the Document to print-ready HTML.
const { html } = await render(invoiceDocument(sampleInvoice));
await writeFile("output/invoice.document.html", html);
console.info("Wrote output/invoice.document.html");

// 2. Convert the HTML to a PDF via Chromium.
//    Requires: npx playwright install chromium
const pdf = await htmlToPdf(html);
await writeFile("output/invoice.pdf", pdf);
console.info("Wrote output/invoice.pdf");
