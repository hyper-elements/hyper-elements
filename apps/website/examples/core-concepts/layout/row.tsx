import { Column, Email, Row, Text } from "@hyper-elements/react";

const box = {
  backgroundColor: "#eef2ff",
  padding: [16, 0],
  borderRadius: 8,
  textAlign: "center",
} as const;

export default function Example() {
  return (
    <Email width={600}>
      <Row id="row" style={{ gap: 16 }}>
        <Column id="fixed" style={{ ...box, width: 180 }}>
          <Text>Fixed</Text>
        </Column>
        <Column id="two" style={{ ...box, flex: 2 }}>
          <Text>Two shares</Text>
        </Column>
        <Column id="one" style={box}>
          <Text>One share</Text>
        </Column>
      </Row>
    </Email>
  );
}
