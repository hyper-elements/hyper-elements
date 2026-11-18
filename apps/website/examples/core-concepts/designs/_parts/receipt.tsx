import { Button, Column, Heading, Span, Text } from "@hyper-elements/react";

export interface Receipt {
  number: string;
  customer: string;
  total: string;
  url: string;
}

export const receipt: Receipt = {
  number: "INV-1001",
  customer: "Ada Lovelace",
  total: "$49.00",
  url: "https://example.com/invoices/INV-1001",
};

export function ReceiptContent({ receipt }: { receipt: Receipt }) {
  return (
    <Column style={{ backgroundColor: "#ffffff", padding: 32, gap: 16 }}>
      <Heading level={1} style={{ fontSize: 28 }}>Payment receipt</Heading>
      <Text>
        Invoice <Span style={{ fontWeight: 700 }}>{receipt.number}</Span>
      </Text>
      <Text>
        Thank you, {receipt.customer}. You paid {receipt.total}.
      </Text>
      <Button href={receipt.url}>View invoice</Button>
    </Column>
  );
}
