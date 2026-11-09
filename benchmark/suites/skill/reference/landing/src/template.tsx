import { Button, Column, Grid, Heading, Link, Page, Section, Text } from "@hyper-elements/react";

const features = [
  ["Emails", "Table layouts every inbox reads."],
  ["Pages", "Responsive HTML for the web."],
  ["PDFs", "Print-ready documents from the same code."],
];

export default function Landing() {
  return (
    <Page width={1080} breakpoints={{ mobile: 640 }} style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      <Section style={{ backgroundColor: "#111827", color: "#ffffff", padding: [64, 24], gap: 16 }}>
        <Heading level={1} style={{ fontSize: 48 }}>Ship every surface from one template</Heading>
        <Text style={{ fontSize: 18 }}>Orbit renders your emails, pages and PDFs from the same components.</Text>
        <Button href="https://orbit.dev/signup" style={{ backgroundColor: "#6d5efc", color: "#ffffff", borderRadius: 6 }}>
          Start free
        </Button>
      </Section>
      <Section style={{ backgroundColor: "#f1f2f6", padding: [48, 24] }}>
        <Grid columns={3} style={{ gap: 24 }}>
          {features.map(([title, text]) => (
            <Column key={title} style={{ gap: 8 }}>
              <Heading level={2} style={{ fontSize: 22 }}>{title}</Heading>
              <Text>{text}</Text>
            </Column>
          ))}
        </Grid>
      </Section>
      <Section style={{ backgroundColor: "#ffffff", padding: [32, 24], gap: 8 }}>
        <Text style={{ color: "#6b7280" }}>Orbit Labs, 500 Market St, San Francisco</Text>
        <Text>
          <Link href="https://orbit.dev/docs" style={{ color: "#6d5efc", hover: { color: "#4c3df0" } }}>Docs</Link>
        </Text>
      </Section>
    </Page>
  );
}
