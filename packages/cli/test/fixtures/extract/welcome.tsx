// A welcome email a person approved: its title and button have ids, and a link jumps to the button.
import { Button, Email, Heading, Link, Section, Text } from "@hyper-elements/react";

const footer = "Acme, 1 Main Street";

const Welcome = () => (
  <Email lang="en" previewText="Your Acme account is ready to use, starting today">
    <Section style={{ padding: 24 }}>
      <Heading id="title" level={1}>Welcome to Acme</Heading>
      <Text>
        Your account is ready. <Link href="#cta">Jump to the button</Link>.
      </Text>
      <Button id="cta" href="https://acme.example/start">Create a project</Button>
      <Text style={{ fontSize: 14 }}>{footer}</Text>
    </Section>
  </Email>
);

export default Welcome;
