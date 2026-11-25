import { Button, Column, Email, Heading, Text } from "@hyper-elements/react";

export default function Welcome({ name }: { name: string }) {
  return (
    <Email
      lang="en"
      previewText="Your Acme account is ready. Create your first project."
      style={{ backgroundColor: "#f4f4f5" }}
    >
      <Column
        style={{
          backgroundColor: "#ffffff",
          padding: 32,
          gap: 16,
          borderRadius: 8,
        }}
      >
        <Heading level={1} style={{ fontSize: 24 }}>
          Welcome, {name}
        </Heading>
        <Text>Your account is ready.</Text>
        <Button href="https://example.com/new">Create a project</Button>
      </Column>
    </Email>
  );
}
Welcome.PreviewProps = { name: "Ada" };
