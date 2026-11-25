// designs/launch-week.tsx
import { Button, Column, Divider, Heading, List, ListItem, Row, Text } from "@hyper-elements/react";
import BrandEmail from "../templates/brand-email";

const stat = (figure: string, label: string) => (
  <Column style={{ backgroundColor: "#f3f4ff", borderRadius: 12, padding: 16, gap: 4 }}>
    <Text style={{ fontSize: 26, fontWeight: 700, color: "#4f46e5" }}>{figure}</Text>
    <Text style={{ fontSize: 14, color: "#3b4254" }}>{label}</Text>
  </Column>
);

export default () => (
  <BrandEmail
    preview="Launch week in numbers, what shipped, and what's next for Orbit"
    body={
      <Column style={{ gap: 20 }}>
        <Heading level={1} style={{ fontSize: 28, color: "#0b1020" }}>Launch week, in numbers</Heading>
        <Row style={{ gap: 12 }}>
          {stat("1,204", "teams joined")}
          {stat("38k", "notes drafted")}
          {stat("4.8", "average rating")}
        </Row>
        <Divider style={{ borderTop: "1px solid #e2e5ee" }} />
        <Heading level={2} style={{ fontSize: 18, color: "#0b1020" }}>What shipped</Heading>
        <List style={{ color: "#3b4254" }}>
          <ListItem>Release notes in your team's voice</ListItem>
          <ListItem>Exports in half the time</ListItem>
          <ListItem>Publishing to Slack and email</ListItem>
        </List>
        <Button href="https://orbit.example/changelog" style={{ backgroundColor: "#0b1020", color: "#ffffff", borderRadius: 8, padding: [12, 20], fontWeight: 700 }}>Read the changelog</Button>
      </Column>
    }
  />
);
