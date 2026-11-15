// Recreated from https://examples.unlayer.com/examples/elements-playground/.
// The original copy and six images are retained; every block is a Hyper Elements component.
import { Button, Column, Divider, Email, Heading, Image, LineBreak, Link, Menu, Section, Span, Text } from "@hyper-elements/react";

const ASSETS = "https://www.hyperelements.dev/img/email-testing/macbook-pro";
const WHITE = "#f5f5f7";
const MUTED = "#86868b";
const BLUE = "#2997ff";
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const cards = [
  {
    label: "Apple Trade In", title: "Get credit toward a new Mac.",
    body: "Trade in your eligible Mac and put credit toward a new one. It’s good for you and the planet.",
    link: "Find your trade-in value ›", href: "https://www.apple.com/shop/trade-in",
    image: "trade-in.jpg", alt: "Trade in", width: 712, height: 550, shown: "75%",
  },
  {
    label: "Apple Card", title: "Pay monthly at 0%\u00a0APR.",
    body: "Pay over time, interest-free, when you check out with Apple Card Monthly Installments.",
    link: "Learn more ›", href: "https://www.apple.com/apple-card/",
    image: "apple-card.jpg", alt: "Apple Card", width: 700, height: 390, shown: "100%",
  },
  {
    label: "Education", title: "Save with education pricing.",
    body: "Students and educators get special pricing on a new Mac.",
    link: "Shop ›", href: "https://www.apple.com/us-edu/store",
    image: "education.jpg", alt: "Education pricing", width: 700, height: 390, shown: "100%",
  },
  {
    label: "Personal Setup", title: "Shop one on one with a Specialist.",
    body: "Our Specialists can help you choose, configure, and buy the perfect Mac.",
    link: "Find a store ›", href: "https://www.apple.com/retail/",
    image: "specialist.jpg", alt: "Mac Specialist", width: 712, height: 550, shown: "75%",
  },
] as const;

export default function MacBookProEmail() {
  return (
    <Email width={700} lang="en" title="MacBook Pro" previewText="MacBook Pro. Mover. Maker. Boundary breaker."
      style={{ backgroundColor: "#000000", fontFamily: FONT, fontSize: 14, lineHeight: 1.4, textAlign: "center", color: WHITE }}>
      <Section style={{ padding: [48, 20, 8], mobile: { padding: [48, 0, 8] } }}>
        <Column style={{ padding: [0, 0, 20], alignItems: "center" }}>
          <Image src={{ src: `${ASSETS}/apple-logo.png`, width: 116, height: 116 }} alt="Apple" style={{ width: "11%" }} />
        </Column>
        <Text style={{ fontSize: 17, fontWeight: 600, color: "#f56300", padding: [0, 0, 4] }}>New</Text>
        <Heading level={1} style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.08, letterSpacing: -0.4 }}>MacBook Pro</Heading>
        <Heading level={2} style={{ fontSize: 21, fontWeight: 400, lineHeight: 1.2, padding: [8, 0, 0] }}>Mover. Maker. Boundary breaker.</Heading>
        <Text style={{ fontSize: 17, color: MUTED, padding: [12, 0, 0] }}>From $1999 or $166.58/mo. for 12 mo.</Text>
      </Section>

      <Section style={{ padding: [22, 0, 0], alignItems: "center", mobile: { padding: [22, 24, 0] } }}>
        <Button href="https://www.apple.com/shop/buy-mac/macbook-pro"
          style={{ backgroundColor: "#0071e3", color: "#ffffff", fontSize: 17, lineHeight: 1.2, padding: [11, 22], borderRadius: 980, hover: { backgroundColor: "#0077ed" } }}>Buy</Button>
        <Text style={{ fontSize: 17, padding: [14, 0, 0] }}><Link href="https://www.apple.com/macbook-pro/" style={{ color: BLUE, textDecoration: "none" }}>Learn more ›</Link></Text>
      </Section>

      <Section style={{ padding: [24, 0, 56] }}>
        <Column style={{ padding: [0, 0, 40] }}>
          <Image src={{ src: `${ASSETS}/macbook-pro-hero.jpg`, width: 701, height: 433 }} alt="MacBook Pro" style={{ width: "100%" }} />
        </Column>
        <Column style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3, color: MUTED }}>
          <Text style={{ padding: [5, 20] }}>Supercharged by <Span style={{ color: WHITE }}>{"M5\u00a0Pro\u00a0and\u00a0M5\u00a0Max"}</Span>.</Text>
          <Text style={{ padding: [5, 20] }}>Up to <Span style={{ color: WHITE }}>{"22\u00a0hours"}</Span> of battery life.</Text>
          <Text style={{ padding: [5, 20] }}>A stunning <Span style={{ color: WHITE }}>{"Liquid\u00a0Retina\u00a0XDR"}</Span> display.</Text>
          <Text style={{ padding: [5, 20] }}>All the ports you need and <Span style={{ color: WHITE }}>{"faster\u00a0Wi-Fi\u00a06E"}</Span>.</Text>
        </Column>
      </Section>

      <Section style={{ backgroundColor: "#161617", padding: [64, 0, 32], mobile: { padding: [64, 20, 32] } }}>
        <Heading level={2} style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.125, letterSpacing: -0.3 }}>Why Apple is the best place to buy{"\u00a0"}Mac.</Heading>
      </Section>
      {cards.map((card, index) => (
        <Section key={card.label} style={{ backgroundColor: "#161617", padding: [0, 0, index === cards.length - 1 ? 64 : 20] }}>
          <Column style={{ backgroundColor: "#000000", borderRadius: 24, padding: [40, 24, 32] }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: MUTED, padding: [0, 0, 6] }}>{card.label}</Text>
            <Heading level={3} style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.17, letterSpacing: -0.2 }}>{card.title}</Heading>
            <Text style={{ fontSize: 15, lineHeight: 1.47, color: MUTED, padding: [10, 8, 0] }}>{card.body}</Text>
            <Text style={{ fontSize: 15, padding: [10, 0, 24] }}><Link href={card.href} style={{ color: BLUE, textDecoration: "none" }}>{card.link}</Link></Text>
            <Image src={{ src: `${ASSETS}/${card.image}`, width: card.width, height: card.height }} alt={card.alt} style={{ width: card.shown, alignSelf: "center" }} />
          </Column>
        </Section>
      ))}

      <Section style={{ backgroundColor: "#161617", padding: [0, 0, 48], mobile: { padding: [0, 20, 48] } }}>
        <Menu items={[
          { text: "Shop Online", href: "https://www.apple.com/" },
          { text: "Find a Store", href: "https://www.apple.com/retail/" },
          { text: "1-800-MY-APPLE", href: "tel:18006927753" },
          { text: "Get the Apple Store App", href: "https://www.apple.com/apple-store-app/" },
        ]} style={{ fontSize: 12, color: "#d2d2d7", padding: [4, 10], justifyContent: "center" }} />
        <Divider style={{ borderTop: "1px solid #424245", padding: [16, 0] }} />
        <Text style={{ fontSize: 12, lineHeight: 1.6, color: MUTED, textAlign: "left" }}>
          If you reside in the U.S. territories, please call Goldman Sachs at 877-255-5923 with questions about Apple Card.<LineBreak />
          TM and © 2026 Apple Inc. One Apple Park Way, MS 96-DM, Cupertino, CA 95014.<LineBreak />
          <Link href="https://www.apple.com/legal/" style={{ color: "#d2d2d7", textDecoration: "none" }}>All Rights Reserved</Link>{" | "}
          <Link href="https://www.apple.com/legal/privacy/" style={{ color: "#d2d2d7", textDecoration: "none" }}>Privacy Policy</Link>{" | "}
          <Link href="https://appleid.apple.com/" style={{ color: "#d2d2d7", textDecoration: "none" }}>My Apple Account</Link>
        </Text>
      </Section>
    </Email>
  );
}
