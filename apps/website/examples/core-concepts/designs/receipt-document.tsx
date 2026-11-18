import { Document } from "@hyper-elements/react";
import { ReceiptContent, receipt } from "./_parts/receipt";

export default function ReceiptDocument() {
  return (
    <Document title="Your receipt" size="A4" margin={48}>
      <ReceiptContent receipt={receipt} />
    </Document>
  );
}
