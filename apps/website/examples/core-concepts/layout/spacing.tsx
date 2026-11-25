import { Button, Column, Email, Heading, Text } from "@hyper-elements/react";

export default function Example() {
  return (
    <Email width={600} style={{ backgroundColor: "#f4f4f5" }}>
      <Column id="card" style={{ backgroundColor: "#ffffff", padding: 32, gap: 16 }}>
        <Heading id="heading" level={2}>Your order</Heading>
        <Text id="text">Ships tomorrow.</Text>
        <Button id="button" href="https://example.com/orders/10482">Track it</Button>
      </Column>
    </Email>
  );
}
