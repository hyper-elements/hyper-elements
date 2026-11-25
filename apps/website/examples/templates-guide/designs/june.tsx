// designs/june.tsx
import { Button, Column, Heading, Text } from "@hyper-elements/react";
import Newsletter from "../templates/newsletter";

export default () => (
  <Newsletter
    subject="What's new in Orbit this June"
    preview="Release notes in your voice, faster exports, and an invitation to our open house"
    body={
      <Column>
        <Heading level={2}>Release notes in your voice</Heading>
        <Text>Orbit now learns how your team writes from the notes you've already published, and drafts the next ones the same way.</Text>
        <Heading level={2}>Faster exports</Heading>
        <Text>Exports finish in half the time, with no settings to change.</Text>
        <Button href="https://orbit.example/changelog">Read the changelog</Button>
      </Column>
    }
  />
);
