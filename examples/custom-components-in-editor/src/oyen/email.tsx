/**
 * Oyen's dispatch announcing FR-2: plain blocks (the masthead, the drawing, the footer) and Oyen's own components
 * (the announcement, the callouts, the spec sheet, the field note, the price band). It renders as it is (`render()`),
 * and it opens in the Unlayer editor with each component a block of its own tool (`toDesign(…, { customTools: true })`).
 */
import type { ReactNode } from "react";
import { Column, Email, Image, Link, Row, Section, Text } from "@hyper-elements/react";
import { Announcement, Callout, FieldNote, INK, label, PAPER, PriceBand, QUIET, SANS, Spec } from "./components";

const SITE = "https://oyen.example";

/** The rail: a part's label at the left, under a rule, and its content beside it (above it on phones). */
const railed = (name: string, content: ReactNode) => (
  <Row style={{ gap: 24, padding: [14, 0, 0], border: { top: `1px solid ${INK}` }, mobile: { gap: 20 } }}>
    <Column style={{ width: 136 }}>
      <Text style={{ ...label, color: INK }}>{name}</Text>
    </Column>
    <Column>{content}</Column>
  </Row>
);

export default function Dispatch() {
  return (
    <Email
      width={600}
      lang="en"
      title="FR-2 is here"
      previewText="A pocket recorder with capsules that turn, one dial, and nothing to set. €349, ships 2 December."
      fonts={[
        { family: "Geist", src: "https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFWNOITd.woff2", format: "woff2", weight: "100 900" },
        { family: "Geist Mono", src: "https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2", format: "woff2", weight: "100 900" },
      ]}
      style={{ backgroundColor: PAPER, color: INK, fontFamily: SANS, fontSize: 16, lineHeight: 1.6 }}
    >
      <Section style={{ padding: [36, 48, 72], gap: 64, mobile: { padding: [28, 24, 56], gap: 48 } }}>
        {/* Masthead */}
        <Row stackOnMobile={false} style={{ alignItems: "end", padding: [0, 0, 14], border: { bottom: `1px solid ${INK}` } }}>
          <Column style={{ width: 120 }}>
            <Text style={{ fontSize: 19, fontWeight: 700, letterSpacing: 5, lineHeight: "20px" }}>
              <Link href={SITE} style={{ color: INK, textDecoration: "none" }}>
                OYEN
              </Link>
            </Text>
          </Column>
          <Column>
            <Text style={{ ...label, lineHeight: "18px", textAlign: "right" }}>Dispatch 07 · Nov 2026</Text>
          </Column>
        </Row>

        <Announcement
          eyebrow="New instrument — FR-2"
          headline="Record the room you’re in."
          lede="FR-2 is a pocket recorder with two capsules that turn, one dial, and nothing to set before you press record."
          button="Pre-order FR-2"
          href={`${SITE}/fr-2`}
          price={349}
          ships="Ships 2 December"
        />

        {/* The drawing */}
        <Column style={{ gap: 12, mobile: { gap: 10 } }}>
          <Image
            src={{ src: "https://hyperelements.dev/img/gallery/oyen/fr2-drawing.png", width: 1020, height: 900 }}
            alt="A technical drawing of FR-2 from the front and the side: two capsules at 90 degrees on top, a display, a large dial, and play, stop and record buttons. It is 132 by 68 by 24 millimetres."
            style={{ width: "100%" }}
          />
          <Text style={label}>Fig. 1 — FR-2, front and side</Text>
        </Column>

        {railed(
          "What’s on it",
          <Column>
            <Callout number={1} rule={false} title="Capsules that turn" body="X/Y for the scene in front of you, A/B for the room around you. A quarter turn sets them, and they stay put." />
            <Callout number={2} title="A hold switch" body="Slide it and the buttons sleep while the recording carries on: thirty hours on a charge, on a card of up to 1 TB." />
            <Callout number={3} title="One dial" body="Headphone level, menus and markers. It clicks once per step, so you can work it by feel in the dark." />
            <Callout number={4} title="Record, always" body="It records in 32-bit float, so there’s no gain to set and nothing to clip. A whisper and a door slam both come home whole." />
          </Column>
        )}

        {railed(
          "Specifications",
          <Column>
            <Spec rule={false} name="Recording" value="32-bit float, up to 192 kHz" />
            <Spec name="Capsules" value="Two cardioids, X/Y or A/B" />
            <Spec name="Input" value="3.5 mm, line or plug-in power" />
            <Spec name="Battery" value="30 hours, USB-C charging" />
            <Spec name="Storage" value="microSD, up to 1 TB" />
            <Spec name="Size" value="132 × 68 × 24 mm, 186 g" />
          </Column>
        )}

        {railed("From the field", <FieldNote quote="I left it on a fence post through nine hours of rain. It kept recording, and so did the birds." name="Maren Achterberg" role="sound recordist" />)}
      </Section>

      <PriceBand eyebrow="First run · 2,000 instruments" price={349} note="Ships 2 December. Charged when it ships." button="Pre-order FR-2" href={`${SITE}/fr-2`} />

      {/* Footer */}
      <Section style={{ padding: [32, 48, 56], mobile: { padding: [28, 24, 44] } }}>
        <Row style={{ gap: 24, mobile: { gap: 12 } }}>
          <Column style={{ width: 136 }}>
            <Text style={{ fontSize: 13, fontWeight: 700, letterSpacing: 4 }}>OYEN</Text>
          </Column>
          <Column style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, lineHeight: 1.6, color: QUIET }}>
              Oyen Instruments AS, Møllergata 9, 0179 Oslo. You’re getting dispatches because you asked for them when you bought an Oyen instrument.
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 1.6, color: QUIET }}>
              <Link href={`${SITE}/dispatch/07`} style={{ color: INK }}>
                View online
              </Link>
              {"  ·  "}
              <Link href={`${SITE}/unsubscribe`} style={{ color: INK }}>
                Unsubscribe
              </Link>
            </Text>
          </Column>
        </Row>
      </Section>
    </Email>
  );
}
