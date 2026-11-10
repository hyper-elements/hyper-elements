import { Button, Column, Email, Heading, Image, List, ListItem, MergeTag, Text } from "@hyper-elements/react";

export default function Welcome() {
  return (
    <Email previewText="Three steps to your first template." style={{ backgroundColor: "#f1f2f6", fontFamily: "Inter, Arial, sans-serif" }}>
      <Column style={{ backgroundColor: "#ffffff", padding: 32, gap: 16 }}>
        <Image src={{ src: "https://assets.orbit.dev/img/orbit-logo.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126 }} />
        <Heading level={1} style={{ fontSize: 26 }}>
          Welcome to Orbit, <MergeTag name="first_name" />
        </Heading>
        <Text>Here's how to send your first template in a few minutes:</Text>
        <List type="number">
          <ListItem>Pick a starter template.</ListItem>
          <ListItem>Change the words and colors to your own.</ListItem>
          <ListItem>Send yourself a test.</ListItem>
        </List>
        <Button href="https://orbit.dev/start" style={{ backgroundColor: "#6d5efc", color: "#ffffff", borderRadius: 6 }}>
          Get started
        </Button>
      </Column>
    </Email>
  );
}
