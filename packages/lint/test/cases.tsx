/**
 * Templates for what the writers do differently on desktop and on phones, with the size each run of text is shown at
 * (null where it's hidden). tree.test.tsx holds tree.ts to these; they were checked against Chromium's computed styles
 * of the rendered HTML when tree.ts was written.
 */
import type { ReactElement } from "react";
import { Column, Email, Image, Layer, Link, ListItem, List, Page, Section, Span, Table, TableCell, TableRow, Text } from "@hyper-elements/react";

export interface Case {
  name: string;
  template: ReactElement;
  /** Each run, by its text: its size on desktop and on phones, null where it's hidden. */
  runs: Record<string, [number | null, number | null]>;
}

const SRC = { src: "https://example.test/hills.jpg", width: 1200, height: 600 };

export const cases: Case[] = [
  {
    name: "a block hidden on desktop, with a phone size (Email)",
    template: (
      <Email width={600} lang="en">
        <Text style={{ fontSize: 16, mobile: { fontSize: 13 } }}>Shown on both</Text>
        <Column hidden={{ desktop: true }}>
          <Text style={{ fontSize: 16, mobile: { fontSize: 12 } }}>Phones only</Text>
        </Column>
        <Text hidden={{ mobile: true }} style={{ fontSize: 15 }}>Desktop only</Text>
      </Email>
    ),
    runs: { "Shown on both": [16, 13], "Phones only": [null, 12], "Desktop only": [15, null] },
  },
  {
    name: "a Span repeating its Text's desktop size, under the Text's phone size (Email and Page)",
    template: (
      <Email width={600} lang="en">
        <Text style={{ fontSize: 16, mobile: { fontSize: 13 } }}>
          Around <Span style={{ fontSize: 16 }}>the same size</Span> and <Span style={{ fontSize: 18 }}>larger</Span>
        </Text>
      </Email>
    ),
    runs: { Around: [16, 13], "the same size": [16, 13], larger: [18, 18] },
  },
  {
    name: "a Span repeating its Text's desktop size, under the Text's phone size (Page)",
    template: (
      <Page width={600} lang="en" title="t">
        <Text style={{ fontSize: 16, mobile: { fontSize: 13 } }}>
          Around <Span style={{ fontSize: 16 }}>the same size</Span> and <Span style={{ fontSize: 18 }}>larger</Span>
        </Text>
      </Page>
    ),
    runs: { Around: [16, 13], "the same size": [16, 13], larger: [18, 18] },
  },
  {
    name: "a Page Text repeating its Section's size, under the Section's phone size",
    template: (
      <Page width={600} lang="en" title="t">
        <Section style={{ fontSize: 17, mobile: { fontSize: 12 } }}>
          <Text style={{ fontSize: 17 }}>Repeats the size</Text>
          <Text style={{ fontSize: 15 }}>Its own size</Text>
        </Section>
      </Page>
    ),
    runs: { "Repeats the size": [17, 12], "Its own size": [15, 15] },
  },
  {
    name: "an Email Section's phone size, cut off by a Text's own size",
    template: (
      <Email width={600} lang="en">
        <Section style={{ fontSize: 17, mobile: { fontSize: 12 } }}>
          <Text>Inherits the size</Text>
          <Text style={{ fontSize: 17 }}>Sets the size</Text>
        </Section>
      </Email>
    ),
    runs: { "Inherits the size": [17, 12], "Sets the size": [17, 17] },
  },
  {
    name: "an inline and a block Email Link",
    template: (
      <Email width={600} lang="en">
        <Column style={{ fontSize: 16, mobile: { fontSize: 12 } }}>
          <Text>
            Before <Link href="https://example.test/a">the inline link</Link> and{" "}
            <Link href="https://example.test/b" style={{ fontSize: 18 }}>
              a larger one
            </Link>
          </Text>
          <Link href="https://example.test/c">The block link</Link>
        </Column>
      </Email>
    ),
    runs: { Before: [16, 12], "the inline link": [16, 12], "a larger one": [18, 18], "The block link": [16, 12] },
  },
  {
    name: "a raised and a lowered Span repeating their Text's size, and one with its own phone size",
    template: (
      <Email width={600} lang="en">
        <Text style={{ fontSize: 18, mobile: { fontSize: 15 } }}>
          Base <Span style={{ verticalAlign: "super" }}>raised</Span> <Span style={{ verticalAlign: "sub" }}>lowered</Span>{" "}
          <Span style={{ verticalAlign: "super", mobile: { fontSize: 11 } }}>own phone size</Span>
        </Text>
      </Email>
    ),
    runs: { Base: [18, 15], raised: [15, 12.5], lowered: [15, 12.5], "own phone size": [15, 11] },
  },
  {
    name: "a raised Span on a Page, with a Span inside it",
    template: (
      <Page width={600} lang="en" title="t">
        <Text style={{ fontSize: 18, mobile: { fontSize: 15 } }}>
          Base <Span style={{ verticalAlign: "super" }}>raised <Span style={{ color: "#333333" }}>inside it</Span></Span>
        </Text>
      </Page>
    ),
    runs: { Base: [18, 15], raised: [15, 12.5], "inside it": [15, 12.5] },
  },
  {
    name: "a Page root's phone size (not written), and a Section's",
    template: (
      <Page width={600} lang="en" title="t" style={{ fontSize: 16, mobile: { fontSize: 12 } }}>
        <Text>The root's size</Text>
        <Section style={{ mobile: { fontSize: 13 } }}>
          <Text>The Section's phone size</Text>
        </Section>
      </Page>
    ),
    runs: { "The root's size": [16, 16], "The Section's phone size": [16, 13] },
  },
  {
    name: "an Email root's phone size, written and inherited",
    template: (
      <Email width={600} lang="en" style={{ fontSize: 16, mobile: { fontSize: 13 } }}>
        <Text>The root's phone size</Text>
      </Email>
    ),
    runs: { "The root's phone size": [16, 13] },
  },
  {
    name: "an Email TableCell marked hidden (shown: Email doesn't hide a cell)",
    template: (
      <Email width={600} lang="en">
        <Table>
          <TableRow>
            <TableCell hidden={{ mobile: true }}>A hidden cell</TableCell>
            <TableCell>A cell</TableCell>
          </TableRow>
        </Table>
      </Email>
    ),
    runs: { "A hidden cell": [16, 16], "A cell": [16, 16] },
  },
  {
    name: "a list item's text and its nested list",
    template: (
      <Email width={600} lang="en">
        <List style={{ fontSize: 15, mobile: { fontSize: 13 } }}>
          <ListItem>
            The item <Span style={{ fontSize: 15 }}>and a span</Span>
            <List>
              <ListItem>Nested</ListItem>
            </List>
          </ListItem>
        </List>
      </Email>
    ),
    runs: { "The item": [15, 13], "and a span": [15, 13], Nested: [15, 13] },
  },
];

/** Layers over an image: where the image is drawn under the words, at each width. */
export const layers = {
  /** An Email draws its image on desktop whatever its hidden says, and on phones unless it's hidden there. */
  emailHiddenOnDesktop: (
    <Email width={600} lang="en">
      <Layer style={{ height: 300 }}>
        <Image src={SRC} alt="Hills" hidden={{ desktop: true }} style={{ width: "100%" }} />
        <Text style={{ color: "#ffffff" }}>Over the image</Text>
      </Layer>
    </Email>
  ),
  emailHiddenOnPhones: (
    <Email width={600} lang="en">
      <Layer style={{ height: 300 }}>
        <Image src={SRC} alt="Hills" hidden={{ mobile: true }} style={{ width: "100%" }} />
        <Text style={{ color: "#ffffff" }}>Over the image</Text>
      </Layer>
    </Email>
  ),
  pageHiddenOnPhones: (
    <Page width={600} lang="en" title="t">
      <Layer style={{ height: 300 }}>
        <Image src={SRC} alt="Hills" hidden={{ mobile: true }} style={{ width: "100%" }} />
        <Text style={{ color: "#ffffff" }}>Over the image</Text>
      </Layer>
    </Page>
  ),
  pageHiddenOnDesktop: (
    <Page width={600} lang="en" title="t">
      <Layer style={{ height: 300 }}>
        <Image src={SRC} alt="Hills" hidden={{ desktop: true }} style={{ width: "100%" }} />
        <Text style={{ color: "#ffffff" }}>Over the image</Text>
      </Layer>
    </Page>
  ),
};
