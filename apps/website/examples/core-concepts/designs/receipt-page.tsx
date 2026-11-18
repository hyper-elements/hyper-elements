import { Page } from "@hyper-elements/react";
import { ReceiptContent, receipt } from "./_parts/receipt";

export default function ReceiptPage() {
  return (
    <Page title="Your receipt" width={600} style={{ backgroundColor: "#f4f4f5" }}>
      <ReceiptContent receipt={receipt} />
    </Page>
  );
}
