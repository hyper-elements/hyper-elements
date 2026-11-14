/**
 * A shop's weekly email, written with the five components: a product, a coupon, a customer's words,
 * an order's progress and a ticket. It renders as it is, and it opens in the Unlayer editor with each component a
 * block of its own tool.
 */
import { Column, Email, Heading, Section, Text } from "@hyper-elements/react";
import { Coupon, INK, MUTED, OrderTracker, PAPER, ProductCard, SANS, Testimonial, Ticket } from "./components";

const SITE = "https://common-goods.example";
const IMG = "https://hyperelements.dev/img";

export default function Weekly() {
  return (
    <Email width={600} lang="en" title="This week at Common Goods" previewText="A new print, a thank-you code, and your order is on its way." style={{ backgroundColor: PAPER, color: INK, fontFamily: SANS, fontSize: 16, lineHeight: 1.5 }}>
      <Section style={{ padding: [40, 32, 48], gap: 24, mobile: { padding: [28, 16, 36], gap: 20 } }}>
        <Column style={{ gap: 10, padding: [0, 4, 8] }}>
          <Text style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>Common Goods</Text>
          <Heading level={1} style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.4, mobile: { fontSize: 32 } }}>
            Good things, this week.
          </Heading>
          <Text style={{ color: MUTED, fontSize: 17, lineHeight: 1.5 }}>A new print, a thank-you for coming back, and where your order is.</Text>
        </Column>

        <ProductCard
          photo={{ src: `${IMG}/gallery/saltworks/low-water.png`, width: 1200, height: 680 }}
          name="Low Water"
          description="A two-color print on cotton paper, 50 × 70 cm. Signed and numbered, in a run of 200."
          price={64}
          badge="new"
          href={`${SITE}/low-water`}
        />

        <Coupon code="WELCOME20" expires="Ends 30 November" href={SITE} />

        <Testimonial rating={5} quote="It arrived in two days, wrapped like a gift. I’ve already ordered a second one for my sister." name="Maren Achterberg" role="Customer since 2024" />

        <OrderTracker status="shipped" order="#10482" eta="Arrives Thursday, 19 November" href={`${SITE}/orders/10482`} />

        <Ticket event="Lumen Conf 2027" date="14 March" time="19:30" seat="Row F · 12" place="Pier 27, San Francisco" name="Maren Achterberg" code="LMN-27-0412" />
      </Section>
    </Email>
  );
}
