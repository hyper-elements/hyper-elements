import { Column, Divider, Document, Heading, Image, PageFooter, PageNumber, Row, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Trip receipt",
  category: "receipt",
  description: "A stay's receipt as a PDF: the logo and receipt ID, where and when, the guests, the price night by night with fees and taxes, how it was paid, and the cancellation policy",
  recreates: { company: "airbnb", what: "trip receipt", original: "https://www.airbnb.com/help/article/2491" },
};

const PRICES = [
  ["$148.00 x 3 nights", "$444.00"],
  ["Cleaning fee", "$65.00"],
  ["Service fee", "$71.86"],
  ["Occupancy taxes", "$52.18"],
];

export default function AirbnbReceipt({ brand }: { brand: Brand }) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") } } as const;
  const line = (label: string, value: string, strong = false) => (
    <Row key={label} stackOnMobile={false} style={{ padding: [token("spacing.xs"), 0] }}>
      <Text style={{ flex: 1, ...(strong ? { fontWeight: 700 } : {}) }}>{label}</Text>
      <Text style={{ width: 120, textAlign: "right", ...(strong ? { fontWeight: 700 } : {}) }}>{value}</Text>
    </Row>
  );
  const fact = (label: string, value: string) => (
    <Column style={{ gap: 2 }}>
      <Text style={small}>{label}</Text>
      <Text style={{ fontWeight: 700 }}>{value}</Text>
    </Column>
  );
  return (
    <Document
      size="A4"
      margin={[56, 64, 64, 64]}
      title={`Your receipt from ${brand.name}`}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ fontSize: 13, lineHeight: token("lineHeights.body"), color: token("colors.foreground") }}
    >
      <Document.Page style={{ gap: token("spacing.lg") }}>
        <Image
          src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
          alt={brand.logo.alt}
          style={{ width: Math.min(150, Math.round((36 * brand.logo.width) / brand.logo.height)) }}
        />
        <Column style={{ gap: token("spacing.xs") }}>
          <Heading level={1}>Your receipt from {brand.name}</Heading>
          <Text style={small}>Receipt ID: RCMJ9HJ4K2 · March 18</Text>
        </Column>
        <Divider style={rule} />
        <Row stackOnMobile={false} style={{ gap: token("spacing.xl"), alignItems: "start" }}>
          <Column style={{ gap: token("spacing.md") }}>
            <Heading level={2}>Lisbon</Heading>
            <Text>Sunny loft with a view of the river, entire rental unit hosted by Inês</Text>
            <Row stackOnMobile={false} style={{ gap: token("spacing.lg") }}>
              {fact("Check-in", "Apr 3")}
              {fact("Checkout", "Apr 6")}
            </Row>
            {fact("Guests", "2 adults")}
            <Text style={small}>Confirmation code: HMXK4RT2ZQ</Text>
          </Column>
          <Column style={{ gap: token("spacing.sm"), padding: token("spacing.lg"), backgroundColor: token("colors.surface"), borderRadius: token("radii.md") }}>
            <Heading level={2}>Price breakdown</Heading>
            {PRICES.map(([label, value]) => line(label, value))}
            <Divider style={rule} />
            {line("Total (USD)", "$633.04", true)}
          </Column>
        </Row>
        <Divider style={rule} />
        <Column style={{ gap: token("spacing.sm") }}>
          <Heading level={2}>Payment</Heading>
          {line("Visa •••• 7461, March 18", "$633.04")}
          {line("Amount paid (USD)", "$633.04", true)}
        </Column>
        <Divider style={rule} />
        <Column style={{ gap: token("spacing.sm") }}>
          <Heading level={2}>Cancellation policy</Heading>
          <Text>
            Free cancellation before Mar 27. Cancel before check-in on Apr 3 for a partial refund: the first night and the service fee aren't refunded.
          </Text>
        </Column>
        <Column style={{ gap: token("spacing.xs") }}>
          <Text style={small}>
            Have a question? Visit the Help Center at {new URL(brand.links.site).host.replace(/^www\./, "")}/help, or message your host from your trip.
          </Text>
          {brand.address ? <Text style={small}>{brand.name}, {brand.address}</Text> : null}
        </Column>
      </Document.Page>
      <PageFooter>
        <Text style={{ ...small, padding: [token("spacing.sm"), 0, 0], border: { top: { width: 1, style: "solid", color: token("colors.border") } } }}>
          {"Receipt RCMJ9HJ4K2 · Page "}
          <PageNumber />
          {" of "}
          <PageNumber total={true} />
        </Text>
      </PageFooter>
    </Document>
  );
}
