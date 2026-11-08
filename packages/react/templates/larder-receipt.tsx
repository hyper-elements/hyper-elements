/**
 * Larder (a fictional kitchen shop) confirms an order: the receipt a customer keeps.
 *
 * A receipt is read for three things, in order: that the order went through, what it cost, and when it arrives.
 * So the total is the largest figure, each item is two columns (what it is, with its quantity and unit price under
 * its name, and what it cost) that read as well on a phone, and the delivery sits beside where it goes. System fonts
 * only: it looks the same everywhere and loads nothing.
 */
import { Button, Column, Email, Heading, Link, Row, Section, Span, Text } from "@hyper-elements/react";

export const meta = {
  title: "Larder order receipt",
  description: "An order confirmation: line items in two columns, the total as the largest figure, delivery and help.",
  root: "Email",
};

const PAPER = "#F3F1EC";
const CARD = "#FFFFFF";
const INK = "#1F2328";
const QUIET = "#5B616B";
const RULE = "#E4E1DA";
const OLIVE = "#4B5D2A";
const OLIVE_DOWN = "#3A4920";

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const ORDER = "LD-30417";
const SITE = "https://larder.example";

const label = { fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: QUIET } as const;

const ITEMS: Array<[name: string, detail: string, amount: string]> = [
  ["Cast-iron skillet, 26 cm", "Qty 1 × $64.00", "$64.00"],
  ["Linen tea towels, set of 3", "Qty 2 × $18.00", "$36.00"],
  ["Olive wood spoon", "Qty 1 × $14.50", "$14.50"],
];

const TOTALS: Array<[string, string]> = [
  ["Subtotal", "$114.50"],
  ["Shipping", "$6.00"],
  ["Tax", "$9.64"],
];

/** An item: what it is, with its quantity and unit price under its name, and what it cost, on the right. */
const item = ([name, detail, amount]: [string, string, string]) => (
  <Row key={name} stackOnMobile={false} style={{ gap: 16, padding: [14, 0], border: { top: `1px solid ${RULE}` }, alignItems: "start" }}>
    <Column style={{ gap: 2 }}>
      <Text style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{name}</Text>
      <Text style={{ fontSize: 14, color: QUIET }}>{detail}</Text>
    </Column>
    <Column style={{ width: 84 }}>
      <Text style={{ fontSize: 16, textAlign: "right" }}>{amount}</Text>
    </Column>
  </Row>
);

/** A line of the totals: a label and its amount. */
const total = ([name, amount]: [string, string]) => (
  <Row key={name} stackOnMobile={false} style={{ gap: 16 }}>
    <Text style={{ fontSize: 15, color: QUIET }}>{name}</Text>
    <Column style={{ width: 84 }}>
      <Text style={{ fontSize: 15, textAlign: "right", color: QUIET }}>{amount}</Text>
    </Column>
  </Row>
);

export default function LarderReceipt() {
  return (
    <Email width={600} previewText={`Order ${ORDER} is confirmed: arriving Thursday, November 12.`} style={{ backgroundColor: PAPER, fontFamily: SANS, color: INK, fontSize: 16, lineHeight: 1.5 }}>
      <Section style={{ padding: [32, 24, 16], mobile: { padding: [24, 16, 12] } }}>
        <Text style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>Larder</Text>
      </Section>

      <Section style={{ padding: [0, 24], mobile: { padding: [0, 12] } }}>
        <Column style={{ backgroundColor: CARD, padding: 32, gap: 24, borderRadius: 12, mobile: { padding: [24, 20] } }}>
          <Column style={{ gap: 8 }}>
            <Text style={label}>Order {ORDER} · November 3, 2026</Text>
            <Heading level={1} style={{ fontSize: 28, lineHeight: 1.2, mobile: { fontSize: 24 } }}>
              Thanks, Maya. Your order is confirmed.
            </Heading>
            <Text style={{ color: QUIET }}>We're packing it now and will email you when it ships.</Text>
          </Column>

          <Column>
            {ITEMS.map(item)}
            <Column style={{ gap: 6, padding: [16, 0], border: { top: `1px solid ${RULE}` } }}>{TOTALS.map(total)}</Column>
            <Row stackOnMobile={false} style={{ gap: 16, padding: [16, 0, 0], border: { top: `2px solid ${INK}` }, alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: 700 }}>Total paid</Text>
              <Column style={{ width: 120 }}>
                <Text style={{ fontSize: 26, fontWeight: 700, textAlign: "right" }}>$130.14</Text>
              </Column>
            </Row>
            <Text style={{ fontSize: 14, color: QUIET, textAlign: "right" }}>Visa ending 4242</Text>
          </Column>

          <Row style={{ gap: 24 }}>
            <Column style={{ gap: 4 }}>
              <Text style={label}>Arriving</Text>
              <Text style={{ fontWeight: 600 }}>Thursday, November 12</Text>
              <Text style={{ color: QUIET }}>Standard delivery</Text>
            </Column>
            <Column style={{ gap: 4 }}>
              <Text style={label}>Shipping to</Text>
              <Text>Maya Lindqvist, 418 Alder Street, Portland, OR 97205</Text>
            </Column>
          </Row>

          <Button href={`${SITE}/orders/${ORDER}`} style={{ backgroundColor: OLIVE, color: "#FFFFFF", fontWeight: 600, padding: [14, 24], borderRadius: 8, hover: { backgroundColor: OLIVE_DOWN }, mobile: { width: "100%" } }}>
            View your order
          </Button>
        </Column>
      </Section>

      <Section style={{ padding: [24, 24, 40], mobile: { padding: [20, 16, 32] } }}>
        <Column style={{ gap: 8 }}>
          <Text style={{ fontSize: 14, color: QUIET, textAlign: "center" }}>
            Questions? Reply to this email, or call <Span style={{ color: INK }}>+1&nbsp;(503)&nbsp;555&#8209;0187</Span>.{" "}
            <Link href={`${SITE}/returns`} style={{ color: OLIVE }}>Returns are free for 30 days.</Link>
          </Text>
          <Text style={{ fontSize: 13, color: QUIET, textAlign: "center" }}>Larder, 220 SE Ankeny St, Portland, OR 97214</Text>
        </Column>
      </Section>
    </Email>
  );
}
