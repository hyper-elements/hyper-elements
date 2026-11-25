import { Button, Column, Divider, Heading, List, ListItem, Text, token } from "@hyper-elements/react";
import StackOverflowTips from "../template";

export const meta = { label: "Search tips" };

const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.md"), 0] } as const;

export default function SearchTips() {
  return (
    <StackOverflowTips
      preview="Stack Overflow tips for searching"
      headline="Find what you want, faster"
      tagline="Tips and tricks for searching on Stack Overflow"
      art={{ src: "https://hyperelements.dev/generated/gallery/assets/companies/stack-overflow/header.png", width: 640, height: 374 }}
      body={
        <Column style={{ gap: token("spacing.md") }}>
          <Heading level={2}>Searching for solutions</Heading>
          <Text>With more than 18 million questions, it's possible that someone has already provided a solution to the problem you're facing.</Text>
          <Divider style={rule} />
          <Heading level={2}>Use the search bar at the top of the page to find what you need</Heading>
          <Text>Here are a few simple search tips to get you started:</Text>
          <List style={{ gap: token("spacing.md") }}>
            <ListItem>To find a specific phrase, enter it in quotes: "local storage"</ListItem>
            <ListItem>To search within specific tag(s), enter them in square brackets: [javascript]</ListItem>
            <ListItem>
              Combine them to get even more precise results - [javascript] "local storage" searches for the phrase “local storage” in questions that have the
              [javascript] tag
            </ListItem>
          </List>
          <Text>
            The more information you can put in the search bar, the more likely you will be to either find the answer you need or feel confident that no one
            else has asked the question before.
          </Text>
          <Divider style={rule} />
          <Heading level={2}>Take a break and read about the worst coder in the world</Heading>
          <Column style={{ padding: [token("spacing.sm"), 0, 0], alignItems: "start" }}>
            <Button
              href="https://stackoverflow.com/blog/code-review"
              style={{
                backgroundColor: token("colors.primary"),
                color: token("colors.primaryForeground"),
                fontSize: token("fontSizes.body"),
                lineHeight: token("lineHeights.heading"),
                padding: [token("spacing.md"), token("spacing.md")],
                borderRadius: token("radii.sm"),
              }}
            >
              I need a break
            </Button>
          </Column>
        </Column>
      }
    />
  );
}
