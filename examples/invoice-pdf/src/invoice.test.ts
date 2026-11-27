import assert from "node:assert/strict";
import { test } from "node:test";
import { render } from "@hyper-elements/react";
import { invoiceDocument, sampleInvoice } from "./invoice.js";
import { htmlToPdf } from "./pdf.js";

// ---------------------------------------------------------------------------
// HTML structure tests (no Chromium required)
// ---------------------------------------------------------------------------

test("Document root writes A4 @page CSS", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  // The Document writer emits the @page rule with the size and margins.
  assert.match(html, /@page\s*\{\s*size:\s*A4/);
});

test("HTML contains the invoice number and company names", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  assert.ok(html.includes("INV-0417"), "invoice number missing");
  assert.ok(html.includes("Orbit Studio LLC"), "issuer name missing");
  assert.ok(html.includes("Northwind Traders"), "billed-to name missing");
});

test("HTML contains all line item descriptions", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  for (const line of sampleInvoice.lines) {
    assert.ok(html.includes(line.description), `line description missing: ${line.description}`);
  }
});

test("HTML contains the subtotal, tax, and total amount", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  // Sample: 12×29 + 2×15 + 1×49 = 348+30+49 = 427 → tax 36.98 → total 463.98
  assert.ok(html.includes("427"), "subtotal missing");
  assert.ok(html.includes("36.98") || html.includes("36,98"), "tax amount missing");
  assert.ok(html.includes("463.98") || html.includes("463,98"), "total missing");
});

test("HTML contains a table header row (Description, Qty, Unit price, Amount)", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  assert.ok(html.includes("Description"), "table header 'Description' missing");
  assert.ok(html.includes("Qty"), "table header 'Qty' missing");
  assert.ok(html.includes("Unit price"), "table header 'Unit price' missing");
  assert.ok(html.includes("Amount"), "table header 'Amount' missing");
});

test("status badge shows 'Due' when paidOn is not set", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  assert.ok(html.includes("Due"), "status badge 'Due' missing");
});

test("status badge shows 'Paid' and hides payment link when paidOn is set", async () => {
  const paid = { ...sampleInvoice, paidOn: "March 15" };
  const { html } = await render(invoiceDocument(paid));
  assert.ok(html.includes("Paid"), "status badge 'Paid' missing");
  // Payment received message should appear
  assert.ok(html.includes("Payment received"), "payment received message missing");
  // Pay online link should not appear
  assert.ok(!html.includes("Pay online"), "pay-online text should be absent for paid invoices");
});

test("PO number appears when provided", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  assert.ok(html.includes("PO-77310"), "PO number missing");
});

test("note appears in the output", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  assert.ok(html.includes("Thank you for your business"), "note text missing");
});

// ---------------------------------------------------------------------------
// PDF bytes test (requires Chromium: npx playwright install chromium)
// ---------------------------------------------------------------------------

test("document HTML produces a real A4 PDF", async () => {
  const { html } = await render(invoiceDocument(sampleInvoice));
  const pdf = await htmlToPdf(html);

  // PDF files always start with the %PDF- header.
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-", "not a PDF file");
  assert.ok(pdf.length > 1000, "PDF is suspiciously small");

  // Exactly one page (A4): the Document root controls pagination.
  const pageMatches = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g);
  assert.equal(pageMatches?.length, 1, "expected exactly one page");

  // A4 MediaBox: ~595 × 842 pt (Chromium writes integers or decimals).
  assert.match(
    pdf.toString("latin1"),
    /\/MediaBox\s*\[0 0 59\d(\.\d+)? 84\d(\.\d+)?\]/,
    "A4 MediaBox not found",
  );
});
