import { Button, Column, Divider, Heading, List, ListItem, Text, token } from "@hyper-elements/react";
import StackOverflowTips from "../template";

export const meta = { label: "Asking tips" };

const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.md"), 0] } as const;

export default function AskingTips() {
  return (
    <StackOverflowTips
      preview="How to write a question that gets a good answer, quickly"
      headline="Ask a question people can answer"
      tagline="A few habits that get your questions answered sooner"
      art={{ src: "https://hyperelements.dev/generated/gallery/assets/images/shapes.png", width: 1600, height: 1200 }}
      body={
        <Column style={{ gap: token("spacing.md") }}>
          <Heading level={2}>Start with a clear title</Heading>
          <Text>A good title says what's wrong in one line. Someone scanning the list should know whether they can help before they open your question.</Text>
          <Divider style={rule} />
          <Heading level={2}>Show what you tried</Heading>
          <Text>Before you post, add these to your question:</Text>
          <List style={{ gap: token("spacing.md") }}>
            <ListItem>The smallest piece of code that shows the problem, as text rather than a screenshot</ListItem>
            <ListItem>What you expected to happen, and what happened instead</ListItem>
            <ListItem>The exact error message, and the version of the language or library you're using</ListItem>
          </List>
          <Text>Questions with a short example that others can run get answered far more often than ones without.</Text>
          <Divider style={rule} />
          <Heading level={2}>Ready to ask?</Heading>
          <Column style={{ padding: [token("spacing.sm"), 0, 0], alignItems: "start" }}>
            <Button
              href="https://stackoverflow.com/questions/ask"
              style={{
                backgroundColor: token("colors.primary"),
                color: token("colors.primaryForeground"),
                fontSize: token("fontSizes.body"),
                lineHeight: token("lineHeights.heading"),
                padding: [token("spacing.md"), token("spacing.md")],
                borderRadius: token("radii.sm"),
              }}
            >
              Ask a question
            </Button>
          </Column>
        </Column>
      }
    />
  );
}
