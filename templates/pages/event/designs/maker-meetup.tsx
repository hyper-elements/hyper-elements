import { Column, Heading, List, ListItem, Text, token } from "@hyper-elements/react";
import Event from "../template";

export const meta = { label: "Maker Meetup, hybrid, with a waitlist" };

const ASSETS = "https://hyperelements.dev/generated/gallery/assets/";

export default function MakerMeetup() {
  return (
    <Event
      name="Maker Meetup"
      tagline="An evening of show and tell for people who build small tools, with demos, snacks and plenty of time to talk."
      attendance="hybrid"
      status="waitlist"
      date="October 8"
      time="6:00 PM to 9:30 PM"
      venue="Harbor Hall"
      address={["9 Quay Street", "Halifax, NS B3J 1A1", "Canada"]}
      joinLink="https://orbit.example/live/maker-meetup"
      tickets="$15, with supper; free to watch online"
      registerLink="https://orbit.example/events/maker-meetup"
      schedule={[
        { time: "6:00 PM", title: "Doors open, with supper from the food carts" },
        { time: "6:45 PM", title: "Demos: ten tools in ten minutes each" },
        { time: "8:30 PM", title: "Open tables, to try the tools yourself" },
      ]}
      speakers={[
        {
          name: "Tova Brennick",
          role: "Toolmaker, Small Batch Labs",
          talk: "A command-line tool a week for a year",
          photo: { src: `${ASSETS}images/speaker.jpg`, width: 800, height: 800 },
        },
        {
          name: "Ilan Marsh",
          role: "Engineer, Kettle & Co",
          talk: "Plugins that never break on update",
          photo: { src: `${ASSETS}images/recipient.jpg`, width: 600, height: 600 },
        },
        { name: "Priya Castellan", role: "Designer, Loomwork", talk: "Small tools with a big welcome" },
      ]}
      about={
        <Column style={{ gap: token("spacing.sm") }}>
          <Heading level={2}>What to expect</Heading>
          <Text>Every demo runs ten minutes, and the makers stay for the evening to answer questions at their tables.</Text>
          <List>
            <ListItem>Bring a laptop if you'd like to try the tools yourself.</ListItem>
            <ListItem>The demos stream live, with questions from the chat read out on stage.</ListItem>
          </List>
        </Column>
      }
    />
  );
}
