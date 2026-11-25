// designs/welcome.tsx
import { Button, Column, Heading, Text } from "@hyper-elements/react";
import BrandEmail from "../templates/brand-email";

export default () => (
  <BrandEmail
    preview="Your workspace is ready: here's how to publish your first release notes"
    body={
      <Column style={{ gap: 16 }}>
        <Heading level={1} style={{ fontSize: 28, color: "#0b1020" }}>Welcome to Orbit</Heading>
        <Text style={{ color: "#3b4254" }}>Your workspace is ready. Connect a repository, and Orbit drafts release notes from the pull requests you merge.</Text>
        <Button href="https://orbit.example/start" style={{ backgroundColor: "#4f46e5", color: "#ffffff", borderRadius: 8, padding: [12, 20], fontWeight: 700 }}>Connect a repository</Button>
      </Column>
    }
  />
);
