import { Button, Column, Email, Heading, Image, Row, Text } from "@hyper-elements/react";

const logo = {
  src: "https://hyperelements.dev/img/orbit-logo.png",
  width: 252,
  height: 128,
};

export default function Example() {
  return (
    <Email width={600} style={{ gap: 24 }}>
      <Row id="row" style={{ gap: 16, alignItems: "center" }}>
        <Column style={{ width: 128 }}>
          <Image src={logo} alt="Orbit" style={{ width: 128 }} />
        </Column>
        <Column>
          <Text style={{ fontWeight: 700 }}>Ada Lovelace</Text>
          <Text>Commented on your design</Text>
        </Column>
      </Row>
      <Column id="column" style={{ alignItems: "center", textAlign: "center", gap: 12 }}>
        <Heading level={2}>Centered by textAlign</Heading>
        <Button href="https://example.com">Centered by alignItems</Button>
      </Column>
    </Email>
  );
}
