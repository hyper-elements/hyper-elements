import { Column, Heading, Page, Row, Section, Text } from "@hyper-elements/react";
import { brand } from "@/brand";

export default function Launch() {
  return (
    <Page title={`${brand.name} launch`}>
      <Section style={{ padding: 32, gap: 16 }}>
        <Heading level={1}>{brand.name} is live</Heading>
        <Row style={{ gap: 16 }}>
          <Column>
            <Text>Fast.</Text>
          </Column>
          <Column>
            <Text>Friendly.</Text>
          </Column>
        </Row>
      </Section>
    </Page>
  );
}
