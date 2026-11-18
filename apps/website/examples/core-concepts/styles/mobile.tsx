import { Column, Email, Heading, Text } from "@hyper-elements/react";

export default function Example() {
  return (
    <Email width={600}>
      <Column id="card" style={{ padding: 32, gap: 8, mobile: { padding: 16 } }}>
        <Heading
          id="heading"
          level={1}
          style={{ fontSize: 32, mobile: { fontSize: 24, textAlign: "center" } }}
        >
          Welcome
        </Heading>
        <Text id="text">Your account is ready.</Text>
      </Column>
    </Email>
  );
}
