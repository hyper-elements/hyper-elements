import {
  Button,
  Column,
  Grid,
  Heading,
  Image,
  Menu,
  Page,
  Row,
  Section,
  Text,
} from "@hyper-elements/react";

const logo = {
  src: "https://hyperelements.dev/img/orbit-logo.png",
  width: 252,
  height: 128,
};
const app = {
  src: "https://hyperelements.dev/img/orbit-app.png",
  width: 1200,
  height: 700,
};
const features = [
  ["Drafted for you", "Orbit reads what you merged and writes the notes."],
  ["In your voice", "Friendly, brief or technical: set it once."],
  ["Everywhere at once", "Email, your site, Slack and the changelog."],
];

export default function Landing() {
  return (
    <Page
      lang="en"
      title="Orbit: release notes that write themselves"
      description="Orbit drafts your release notes from what you merged."
      width={1120}
      style={{ color: "#15132e", fontFamily: "Helvetica, Arial, sans-serif" }}
    >
      <Section style={{ padding: [18, 32] }}>
        <Row stackOnMobile={false} style={{ alignItems: "center", gap: 24 }}>
          <Image src={logo} alt="Orbit" style={{ width: 96 }} />
          <Menu
            items={[
              { text: "Product", href: "https://example.com/product" },
              { text: "Pricing", href: "https://example.com/pricing" },
              { text: "Docs", href: "https://example.com/docs" },
            ]}
            separator=""
            style={{ color: "#15132e", fontSize: 15, justifyContent: "end" }}
          />
          <Button
            href="https://example.com/start"
            style={{ backgroundColor: "#15132e", borderRadius: 8, flex: "none" }}
          >
            Start free
          </Button>
        </Row>
      </Section>
      <Section
        style={{
          backgroundColor: "#4f46e5",
          color: "#ffffff",
          padding: [72, 32, 0],
          gap: 24,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <Heading
          level={1}
          style={{ fontSize: 64, lineHeight: 1.05, mobile: { fontSize: 36 } }}
        >
          Release notes that write themselves
        </Heading>
        <Text style={{ fontSize: 20, color: "#e0e7ff" }}>
          Orbit reads what your team merged and drafts the notes, in your voice.
        </Text>
        <Button
          href="https://example.com/start"
          style={{
            backgroundColor: "#ffc93c",
            color: "#15132e",
            fontSize: 17,
            fontWeight: 700,
            padding: [14, 28],
            borderRadius: 10,
          }}
        >
          Start free
        </Button>
        <Image
          src={app}
          alt="Orbit's dashboard"
          style={{ width: 880, borderRadius: [14, 14, 0, 0] }}
        />
      </Section>
      <Section style={{ padding: [56, 32] }}>
        <Grid columns={3} style={{ gap: 32 }}>
          {features.map(([title, text]) => (
            <Column key={title} style={{ gap: 8 }}>
              <Heading level={2} style={{ fontSize: 22 }}>
                {title}
              </Heading>
              <Text style={{ color: "#5b5870" }}>{text}</Text>
            </Column>
          ))}
        </Grid>
      </Section>
    </Page>
  );
}
