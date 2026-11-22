import { Column, Link, Text, token } from "@hyper-elements/react";
import CodepenChallenges from "../template";

export const meta = { label: "Patterns" };

const challenge = "https://codepen.io/challenges/patterns";

export default function Patterns() {
  return (
    <CodepenChallenges
      preview="#CodePenChallenge: Patterns. The last week of the Shape challenge is here."
      topic="Patterns"
      challenge={challenge}
      body={
        <Column style={{ gap: token("spacing.md") }}>
          <Text>The Shape challenge wraps up this week.</Text>
          <Text>
            After rounds, cubes and triangles, it's time to put them all together. The Pens from last week are in our{" "}
            <Link href="https://codepen.io/collection/challenge-triangles">#CodePenChallenge: Triangles</Link> collection.
          </Text>
          <Text>This week is about patterns: one shape, repeated, until it becomes something new.</Text>
          <Text>
            A pattern can be a tiled background, a grid of shapes that shift as you move the mouse, or a single motif that rotates and multiplies. CSS grid,
            conic gradients and SVG are all good places to start.
          </Text>
        </Column>
      }
      task={{ text: "create a Pen with a repeating pattern.", link: `${challenge}/starter` }}
      tag="cpc-patterns"
      ideas={[
        [
          { text: "Start with a single tile and repeat it with " },
          { text: "CSS grid", href: `${challenge}/css-grid` },
          { text: ". Change one property per tile, a color, a turn or a size, and see how far the pattern drifts." },
        ],
        [
          { text: "Patterns don't have to sit still. Try a grid of shapes that " },
          { text: "follow the pointer", href: `${challenge}/follow-the-pointer` },
          { text: ", or tiles that flip one after another." },
        ],
      ]}
      resources={[
        [
          { text: "A " },
          { text: "guide to conic gradients", href: `${challenge}/conic-gradients` },
          { text: " shows how far one line of CSS can go, from checkerboards to starbursts." },
        ],
        [
          { text: "For something hand-drawn, see how " },
          { text: "SVG patterns", href: `${challenge}/svg-patterns` },
          { text: " tile any shape you can draw, and browse " },
          { text: "Pattern Library", href: `${challenge}/pattern-library` },
          { text: " for ideas." },
        ],
      ]}
    />
  );
}
