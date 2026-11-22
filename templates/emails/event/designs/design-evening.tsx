import { Column, Heading, List, ListItem, Text, token } from "@hyper-elements/react";
import Event from "../template";

export const meta = { label: "Design Systems Evenings, online" };

export default function DesignEvening() {
  return (
    <Event
      name="Design Systems Evenings"
      tagline="Two evenings of short talks on keeping a design system alive, streamed live with questions from the chat."
      attendance="online"
      date="September 23"
      endDate="September 24"
      time="6:00 PM to 8:00 PM Eastern"
      joinLink="https://orbit.example/live/design-systems-evenings"
      registerLink="https://orbit.example/events/design-systems-evenings"
      schedule={[
        { time: "6:00 PM", title: "First evening: tokens, and the people who name them" },
        { time: "7:15 PM", title: "Questions for the speakers, from the chat" },
        { time: "6:00 PM", title: "Second evening: docs that stay up to date" },
        { time: "7:15 PM", title: "Open panel, and what we'd do differently" },
      ]}
      details={
        <Column style={{ gap: token("spacing.sm") }}>
          <Heading level={2}>Before you join</Heading>
          <Text>The stream opens ten minutes early. Every talk is recorded, and the recordings go to everyone who registers.</Text>
          <List>
            <ListItem>A browser is all you need: there's nothing to install.</ListItem>
            <ListItem>Captions are on for every talk.</ListItem>
          </List>
        </Column>
      }
    />
  );
}
