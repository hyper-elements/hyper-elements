import { Column, Link, Text, token } from "@hyper-elements/react";
import CodepenChallenges from "../template";

export const meta = { label: "Cubes" };

const challenge = "https://codepen.io/challenges/cubes";

export default function Cubes() {
  return (
    <CodepenChallenges
      preview="#CodePenChallenge: Cubes. The Shape challenge continues!"
      topic="Cubes"
      challenge={challenge}
      body={
        <Column style={{ gap: token("spacing.md") }}>
          <Text>The Shape challenge continues!</Text>
          <Text>
            Last week, we kicked things off with round shapes. We "rounded" up the Pens from week one in our{" "}
            <Link href="https://codepen.io/collection/challenge-round">#CodePenChallenge: Round</Link> collection.
          </Text>
          <Text>This week, we move on to cubes 🧊</Text>
          <Text>
            Creating cubes in the browser is all about mastery of illusion. Take control of perspective and shadows and you can make the magic of 3D on a flat
            screen 🧙
          </Text>
          <Text>This week is a fun chance to work on your CSS shape-building skills, or dig into a 3D JavaScript library like Three.js.</Text>
          <Text>
            This week's starter template features an ice cube emoji to help inspire a "cool" idea for your Pen. As always, the template is just a jumping off
            point. Feel free to incorporate the 🧊 in your creation, add more elements, or freeze it out completely and start over from scratch!
          </Text>
        </Column>
      }
      task={{ text: "create a Pen that includes cube shapes.", link: `${challenge}/starter` }}
      picture={{ src: "https://hyperelements.dev/generated/gallery/assets/companies/codepen/cube.png", width: 1200, height: 800 }}
      pictureAlt="A cube puzzle on a yellow background"
      tag="cpc-cubes"
      ideas={[
        [
          { text: "This week we move from 2 dimensions to three! Maybe you could exercise your " },
          { text: "perspective", href: `${challenge}/perspective` },
          { text: " in CSS to create a 3D cube. Or, you can try out creating 3D shapes in JavaScript, using " },
          { text: "WebGL", href: `${challenge}/webgl` },
          { text: " or building a " },
          { text: "Three.js scene", href: `${challenge}/three-js` },
          { text: "." },
        ],
        [
          { text: "There's more to cubes than just six square sides. There are variations on the cube that could be fun to play with this week: " },
          { text: "cuboid shapes", href: `${challenge}/cuboids` },
          { text: " are hexahedrons with faces that aren't always squares. And if you want to really push the boundaries of shape, consider the 4 dimensional " },
          { text: "tesseract!", href: `${challenge}/tesseract` },
        ],
        [
          { text: "Here's a mind-bending idea that can combine the round shapes from week one with this week's cube theme: " },
          { text: "Spherical Cubes", href: `${challenge}/spherical-cubes` },
          {
            text: " 😳 Solving longstanding mathematical mysteries is probably outside the scope of a CodePen challenge, but you could use front-end tools to explore fitting spheres into cubes, or vice-versa.",
          },
        ],
      ]}
      resources={[
        [
          { text: "Learn all about " },
          { text: "How CSS Perspective Works", href: `${challenge}/css-perspective` },
          { text: " and how to build a 3D CSS cube from scratch in an in-depth tutorial for CSS-Tricks. Or, check out stunning examples of WebGL cubes: " },
          { text: "Just Ice", href: `${challenge}/just-ice` },
          { text: " and " },
          { text: "Posing", href: `${challenge}/posing` },
          { text: "." },
        ],
        [
          { text: "Want to go beyond the square cube? Draw inspiration from Pens like " },
          { text: "Pulsating Tesseract", href: `${challenge}/pulsating-tesseract` },
          { text: ", " },
          { text: "Rainbow Cuboid Loader", href: `${challenge}/rainbow-cuboid-loader` },
          { text: ", or " },
          { text: "Pure CSS cuboid jellyfish", href: `${challenge}/cuboid-jellyfish` },
          { text: "." },
        ],
        [
          { text: "Did that spherical cubes concept pique your interest? Explore " },
          { text: "Cube Sphere", href: `${challenge}/cube-sphere` },
          { text: ", " },
          { text: "3D Sphere to Cube Animation With Virtual Trackball", href: `${challenge}/sphere-to-cube` },
          { text: " and " },
          { text: "Infinitely unpack prism", href: `${challenge}/unpack-prism` },
          { text: " for more mindbending cube concepts that test the boundaries of how shapes interact with each other." },
        ],
      ]}
    />
  );
}
