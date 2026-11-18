import { Column, Email, Text } from "@hyper-elements/react";

export default function Example() {
  return (
    <Email width={600} style={{ backgroundColor: "#f4f4f5" }}>
      <Column style={{ backgroundColor: "#ffffff", padding: 24, gap: 8 }}>
        <Text>Your order has shipped.</Text>
        <Text id="desktop" hidden={{ mobile: true }}>Desktop detail: track it on the web.</Text>
        <Text id="phone" hidden={{ desktop: true }}>Phone detail: track it in the app.</Text>
      </Column>
    </Email>
  );
}
