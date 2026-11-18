import {
  Button,
  Column,
  Email,
  Heading,
  Image,
  Link,
  Row,
  Section,
  Text,
} from "@hyper-elements/react";

const logo = {
  src: "https://hyperelements.dev/img/orbit-logo.png",
  width: 252,
  height: 128,
};
const hero = {
  src: "https://hyperelements.dev/img/newsletter-hero.png",
  width: 1200,
  height: 500,
};
const quiet = { fontSize: 14, color: "#5b5870" };

export default function Newsletter() {
  return (
    <Email
      lang="en"
      title="The Weekly Signal"
      previewText="Release notes that write themselves, and two more things."
      style={{ backgroundColor: "#f6f2e9", color: "#15132e" }}
    >
      <Section style={{ padding: [20, 32] }}>
        <Row stackOnMobile={false} style={{ alignItems: "center" }}>
          <Image src={logo} alt="Orbit" style={{ width: 88 }} />
          <Text style={{ ...quiet, textAlign: "right" }}>Issue 42</Text>
        </Row>
      </Section>
      <Image src={hero} alt="The Weekly Signal" />
      <Column style={{ backgroundColor: "#ffffff", padding: 32, gap: 16 }}>
        <Heading level={1} style={{ fontSize: 28, lineHeight: 1.2 }}>
          Release notes that write themselves
        </Heading>
        <Text>
          Orbit 3.0 reads what your team merged and drafts the notes in your
          voice. Here is what shipped, and how three teams use it.
        </Text>
        <Button
          href="https://example.com/issues/42"
          style={{ backgroundColor: "#4f46e5", borderRadius: 8 }}
        >
          Read this issue
        </Button>
      </Column>
      <Section style={{ padding: [24, 32] }}>
        <Text style={{ ...quiet, textAlign: "center" }}>
          Orbit Inc., 1 Market St, San Francisco.{" "}
          <Link href="{{unsubscribe_url}}">Unsubscribe</Link>
        </Text>
      </Section>
    </Email>
  );
}
