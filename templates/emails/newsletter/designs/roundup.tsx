import { Button, Column, Heading, Image, Link, List, ListItem, Text, token } from "@hyper-elements/react";
import Newsletter from "../template";

export const meta = { label: "Community roundup" };

export default function Roundup() {
  return (
    <Newsletter
      subject="The best of the community this month"
      preview="A template library from our users, three talks worth your lunch break, and the next meetup"
      issue="Roundup · Spring edition"
      body={
        <Column style={{ gap: token("spacing.lg") }}>
          <Image
            src={{ src: "https://hyperelements.dev/generated/gallery/assets/images/shapes.png", width: 1600, height: 1200 }}
            alt=""
            style={{ borderRadius: token("radii.sm") }}
          />
          <Column style={{ gap: token("spacing.md") }}>
            <Heading level={1}>A shared library of 200 templates</Heading>
            <Text>
              Teams have been posting the templates they use every week. Browse them by job, copy one into your workspace, and make it yours in a minute.
            </Text>
            <Button href="https://orbit.example/community/templates">Browse the template library</Button>
          </Column>
          <Column style={{ gap: token("spacing.sm") }}>
            <Heading level={2}>Three talks worth your lunch break</Heading>
            <List>
              <ListItem>Planning a launch with a team of three</ListItem>
              <ListItem>Writing for readers who skim</ListItem>
              <ListItem>What a hundred onboarding emails taught us</ListItem>
            </List>
            <Text>
              <Link href="https://orbit.example/community/talks">Watch the talks from the last meetup</Link>
            </Text>
          </Column>
          <Column style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), padding: token("spacing.lg"), gap: token("spacing.sm") }}>
            <Heading level={3}>Meet us in person</Heading>
            <Text>The next meetup is an evening of short talks and good snacks. Seats go quickly.</Text>
            <Button href="https://orbit.example/community/meetups">Save a seat at the meetup</Button>
          </Column>
        </Column>
      }
    />
  );
}
