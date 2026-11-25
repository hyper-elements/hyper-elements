/**
 * A stay's receipt as Airbnb's PDFs lay it out. The logo, its headings, the total, the cancellation policies' wording,
 * the help line, the company's address and the footer's shape are locked; a design fills the receipt's ID and date,
 * where and when the stay is, the guests, the price line by line, how it was paid, and which cancellation policy
 * applies. The template adds the price up, in the brand's currency, and where the price is long, puts the payment and
 * the policy on a second page. It's made from a brand (`airbnbReceipt(brand)`), Airbnb's by default, which sets its
 * colors, fonts, logo and company details.
 */
import { Column, Divider, Document, Heading, Image, Link, PageFooter, PageNumber, Row, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/airbnb";

export const meta = {
  recreates: { company: "airbnb", what: "trip receipt", original: "https://www.airbnb.com/help/article/2491" },
};

/** A day, with no year, so it reads the same any time. */
const date = (label: string, guidance: string) => prop.text({ label, required: true, pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,12}$", guidance });
const code = (label: string, guidance: string) => prop.text({ label, required: true, pattern: "^[A-Z0-9]{6,12}$", guidance });

/** What each cancellation policy says, as Airbnb's standard policies put it. */
const POLICIES = {
  flexible: "Cancel at least 24 hours before check-in for a full refund. After that, the first night and the service fee aren't refunded.",
  moderate: "Cancel at least 5 days before check-in for a full refund. After that, cancel before check-in for a refund of the nights not stayed, minus the first night and the service fee.",
  strict: "Cancel within 48 hours of booking, and at least 14 days before check-in, for a full refund. Cancel at least 7 days before check-in for a 50% refund. After that, nothing is refunded.",
} as const;

const fields = {
  receiptId: code("Receipt ID", "Capital letters and digits: RCMJ9HJ4K2"),
  date: date("Date", "The day the receipt is issued, with no year or weekday: March 18"),
  city: prop.text({ label: "City", required: true, maxLength: 20 }),
  listing: prop.text({ label: "Listing", required: true, pattern: "^[\\s\\S]{10,90}$", guidance: "The listing's title, what kind of place it is, and its host: Sunny loft with a view of the river, entire rental unit hosted by Inês" }),
  checkIn: date("Check-in", "The day the stay starts, with no year or weekday: Apr 3"),
  checkout: date("Checkout", "The day the stay ends, with no year or weekday: Apr 6"),
  guests: prop.text({ label: "Guests", required: true, maxLength: 24, guidance: "Who's staying: 2 adults" }),
  confirmationCode: code("Confirmation code", "Capital letters and digits: HMXK4RT2ZQ"),
  prices: prop.list(
    prop.object(
      {
        label: prop.text({ label: "Label", required: true, maxLength: 40, guidance: "The nightly rate times the nights, or a fee, a discount or a tax: $148.00 x 3 nights" }),
        amount: prop.number({ label: "Amount", required: true, min: -100000, max: 100000, guidance: "In the brand's currency, as a number: 444, or -106 for a discount" }),
      },
      { label: "Price line" },
    ),
    { label: "Price breakdown", required: true, min: 1, max: 10 },
  ),
  paidWith: prop.text({
    label: "Paid with",
    required: true,
    // Never a card's number: five digits in a row are refused.
    pattern: "^(?![\\s\\S]*(?:\\d[\\s-]?){5})[\\s\\S]{3,40}$",
    guidance: "The card, never its full number, and the day it was charged: Visa •••• 7461, March 18",
  }),
  cancellation: prop.choice(["flexible", "moderate", "strict"], {
    label: "Cancellation policy",
    required: true,
    guidance: "The listing's policy: flexible (a full refund up to a day before), moderate (up to 5 days before) or strict (up to 14 days before)",
  }),
};

const round = (n: number) => Math.round(n * 100) / 100;

/** A character's width in Inter, in ems, by its kind: a little over, so text is never thought shorter than it is. */
const em = (ch: string) => (/[mwMW@%]/.test(ch) ? 0.95 : /[A-Z0-9#$&€£]/.test(ch) ? 0.7 : /[ijlrtfI.,;:'|!()[\] ]/.test(ch) ? 0.34 : 0.58);

/** How many lines a text takes at `size` px in a column `width` px wide, broken at its spaces (an estimate). */
function linesOf(text: string, width: number, size: number): number {
  const space = 0.34 * size;
  let lines = 1;
  let x = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = [...word].reduce((sum, ch) => sum + em(ch), 0) * size;
    if (x > 0 && x + space + w > width) {
      lines += 1;
      x = 0;
    }
    if (x === 0 && w > width) {
      // A word wider than the column breaks inside it.
      lines += Math.ceil(w / width) - 1;
      x = w - (Math.ceil(w / width) - 1) * width;
    } else x += (x > 0 ? space : 0) + w;
  }
  return lines;
}

// The page, in px: A4 inside its margins.
const PAGE = { width: 666, height: 1002 };
const BODY = 13;
const VALUE = 110;

export function airbnbReceipt(brand: Brand) {
  const theme = brand.theme as unknown as { spacing: Record<string, number>; fontSizes: Record<string, number>; lineHeights: Record<string, number> };
  const { xs, sm, md, lg, xl } = theme.spacing as Record<"xs" | "sm" | "md" | "lg" | "xl", number>;
  const smallSize = theme.fontSizes.small!;
  const leading = theme.lineHeights.body!;
  const lineOf = (size: number) => size * leading;
  // A heading's size and line height at a level, from the brand's theme.
  const level = (n: 1 | 2) => {
    const own = (brand.theme.elements?.Heading as { by?: { level?: Record<number, { fontSize?: number; lineHeight?: number }> } } | undefined)?.by?.level?.[n];
    const size = own?.fontSize ?? (n === 1 ? 40 : 32);
    return { size, line: size * (own?.lineHeight ?? theme.lineHeights.heading ?? 1.3) };
  };
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  const logoWidth = Math.min(150, Math.round((36 * brand.logo.width) / brand.logo.height));
  const logoHeight = (width: number) => (width * brand.logo.height) / brand.logo.width;
  const help = brand.links.help;
  const helpText = brand.links.help.replace(/^https?:\/\/(www\.)?/, "");
  const phone = brand.support?.phone ? `, call ${brand.support.phone}${brand.support.hours ? ` (${brand.support.hours})` : ""}` : "";

  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") } } as const;
  const line = (label: string, value: string, fields: { label?: string; value?: string }, strong = false, key?: string | number) => (
    <Row key={key} stackOnMobile={false} style={{ padding: [token("spacing.xs"), 0], gap: token("spacing.sm") }}>
      <Text field={fields.label} style={{ flex: 1, ...(strong ? { fontWeight: 700 } : {}) }}>{label}</Text>
      <Text field={fields.value} style={{ width: VALUE, textAlign: "right", ...(strong ? { fontWeight: 700 } : {}) }}>{value}</Text>
    </Row>
  );
  const fact = (label: string, value: string, field: string) => (
    <Column style={{ gap: 2 }}>
      <Text style={small}>{label}</Text>
      <Text field={field} style={{ fontWeight: 700 }}>{value}</Text>
    </Column>
  );
  return template({
    id: "documents.AirbnbReceipt",
    version: "1.0.0",
    label: "Trip receipt",
    description: "A stay's receipt as a PDF: the logo and receipt ID, where and when, the guests, the price night by night with fees and taxes, how it was paid, and the cancellation policy",
    root: "Document",
    fields,
    rules: {
      require: { core: ["layout/overflow", "document/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      receiptId: "RCAB12CD34",
      date: "January 8",
      city: "Porto",
      listing: "Bright studio near the river, entire rental unit hosted by Rui",
      checkIn: "Feb 2",
      checkout: "Feb 4",
      guests: "1 adult",
      confirmationCode: "HMAB12CD34",
      prices: [
        { label: "$90.00 x 2 nights", amount: 180 },
        { label: "Service fee", amount: 25.4 },
      ],
      paidWith: "Visa •••• 1881, January 8",
      cancellation: "flexible",
    },
    render: (v) => {
      const total = round(v.prices.reduce((sum, price) => sum + round(price.amount), 0));
      const policy = POLICIES[v.cancellation];
      const helpLine = `Have a question? Visit the Help Center at ${helpText}${phone}, or message your host from your trip.`;

      // What each part takes, in px, estimated from the brand's sizes (a little over, never under).
      const footer = lineOf(smallSize) + sm + 1;
      const room = PAGE.height - footer;
      const half = (PAGE.width - xl) / 2;
      const header = logoHeight(logoWidth) + lg + linesOf(`Your receipt from ${brand.name}`, PAGE.width, level(1).size) * level(1).line + xs + lineOf(smallSize) + lg + 1;
      const stay =
        linesOf(v.city, half, level(2).size) * level(2).line +
        md +
        linesOf(v.listing, half, BODY) * lineOf(BODY) +
        md +
        lineOf(smallSize) +
        2 +
        lineOf(BODY) +
        md +
        lineOf(smallSize) +
        2 +
        linesOf(v.guests, half, BODY * 1.08) * lineOf(BODY) +
        md +
        linesOf(`Confirmation code: ${v.confirmationCode}`, half, smallSize) * lineOf(smallSize);
      const priceRow = (label: string, value: string, width = PAGE.width) => Math.max(linesOf(label, width - VALUE - sm, BODY * 1.08), linesOf(value, VALUE, BODY * 1.08)) * lineOf(BODY) + 2 * xs;
      const prices = (width: number) =>
        2 * lg +
        level(2).line +
        sm +
        v.prices.reduce((h, price) => h + priceRow(price.label, money(price.amount), width - 2 * lg) + sm, 0) +
        1 +
        sm +
        priceRow(`Total (${brand.currency})`, money(total), width - 2 * lg);
      // The price beside the stay; under it where beside it the page is too short for it; or on the next page.
      const continued = Math.max(logoHeight(logoWidth), lineOf(smallSize)) + lg + 1;
      const beside = header + lg + Math.max(stay, prices(half));
      const under = header + lg + stay + xl + prices(PAGE.width);
      const layout = beside <= room ? "beside" : under <= room ? "under" : "next";
      const used = layout === "beside" ? beside : layout === "under" ? under : continued + lg + prices(PAGE.width);
      const rest =
        lg +
        1 +
        lg +
        level(2).line +
        sm +
        priceRow(v.paidWith, money(total)) +
        sm +
        priceRow(`Amount paid (${brand.currency})`, money(total)) +
        lg +
        1 +
        lg +
        level(2).line +
        sm +
        linesOf(policy, PAGE.width, BODY) * lineOf(BODY) +
        lg +
        linesOf(helpLine, PAGE.width, smallSize) * lineOf(smallSize) +
        xs +
        lineOf(smallSize);
      // Where the price is long, the payment and the policy go on the next page.
      const split = used + rest > room;

      const payment = (
        <>
          <Column style={{ gap: token("spacing.sm") }}>
            <Heading level={2}>Payment</Heading>
            {line(v.paidWith, money(total), { label: "paidWith" })}
            {line(`Amount paid (${brand.currency})`, money(total), {}, true)}
          </Column>
          <Divider style={rule} />
          <Column style={{ gap: token("spacing.sm") }}>
            <Heading level={2}>Cancellation policy</Heading>
            <Text field="cancellation">{policy}</Text>
          </Column>
          <Column style={{ gap: token("spacing.xs") }}>
            <Text style={small}>
              {"Have a question? Visit the Help Center at "}
              <Link href={help}>{helpText}</Link>
              {phone}, or message your host from your trip.
            </Text>
            {brand.address ? <Text style={small}>{brand.name}, {brand.address}</Text> : null}
          </Column>
        </>
      );

      const stayDetails = (
        <Column style={{ gap: token("spacing.md") }}>
            <Heading field="city" level={2}>{v.city}</Heading>
            <Text field="listing">{v.listing}</Text>
            <Row stackOnMobile={false} style={{ gap: token("spacing.lg") }}>
              {fact("Check-in", v.checkIn, "checkIn")}
              {fact("Checkout", v.checkout, "checkout")}
            </Row>
            {fact("Guests", v.guests, "guests")}
            <Text field="confirmationCode" style={small}>Confirmation code: {v.confirmationCode}</Text>
        </Column>
      );
      const price = (
        <Column style={{ gap: token("spacing.sm"), padding: token("spacing.lg"), backgroundColor: token("colors.surface"), borderRadius: token("radii.md") }}>
          <Heading level={2}>Price breakdown</Heading>
          {v.prices.map((price, i) => line(price.label, money(price.amount), { label: `prices[${i}].label`, value: `prices[${i}].amount` }, false, i))}
          <Divider style={rule} />
          {line(`Total (${brand.currency})`, money(total), {}, true)}
        </Column>
      );
      const continuedHeader = (
        <>
          <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
            <Column>
              <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: logoWidth }} />
            </Column>
            <Column>
              <Text style={{ ...small, textAlign: "right" }}>Receipt {v.receiptId}, continued</Text>
            </Column>
          </Row>
          <Divider style={rule} />
        </>
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
          style={{ fontSize: BODY, lineHeight: token("lineHeights.body"), color: token("colors.foreground") }}
        >
          <Document.Page style={{ gap: token("spacing.lg") }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: logoWidth }} />
            <Column style={{ gap: token("spacing.xs") }}>
              <Heading level={1}>Your receipt from {brand.name}</Heading>
              <Text field="receiptId" style={small}>Receipt ID: {v.receiptId} · {v.date}</Text>
            </Column>
            <Divider style={rule} />
            {layout === "beside" ? (
              <Row stackOnMobile={false} style={{ gap: token("spacing.xl"), alignItems: "start" }}>
                {stayDetails}
                {price}
              </Row>
            ) : layout === "under" ? (
              <Column style={{ gap: token("spacing.xl") }}>
                {stayDetails}
                {price}
              </Column>
            ) : (
              stayDetails
            )}
            {layout !== "next" && !split ? <Divider style={rule} /> : null}
            {layout !== "next" && !split ? payment : null}
          </Document.Page>
          {layout === "next" ? (
            <Document.Page style={{ gap: token("spacing.lg") }}>
              {continuedHeader}
              {price}
              {split ? null : <Divider style={rule} />}
              {split ? null : payment}
            </Document.Page>
          ) : null}
          {split ? (
            <Document.Page style={{ gap: token("spacing.lg") }}>
              {continuedHeader}
              {payment}
            </Document.Page>
          ) : null}
          <PageFooter>
            <Text style={{ ...small, padding: [token("spacing.sm"), 0, 0], border: { top: { width: 1, style: "solid", color: token("colors.border") } } }}>
              {`Receipt ${v.receiptId} · Page `}
              <PageNumber />
              {" of "}
              <PageNumber total={true} />
            </Text>
          </PageFooter>
        </Document>
      );
    },
  });
}

export default airbnbReceipt(brand);
