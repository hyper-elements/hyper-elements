import { Email } from "@hyper-elements/react";
import { ReceiptContent, receipt } from "./_parts/receipt";

export default function ReceiptEmail() {
  return (
    <Email title="Your receipt" previewText="Your payment receipt is ready." style={{ backgroundColor: "#f4f4f5" }}>
      <ReceiptContent receipt={receipt} />
    </Email>
  );
}
