/**
 * A shipping notice. Its logo, its headings, the button's words and its footer (the company's address and links to its
 * site and help) are locked: a design fills the order's number, when it should arrive, who's carrying it and its
 * tracking number, the page that tracks it, and what's in the box. It's made from a brand (`shipping(brand)`), which sets its colors, fonts,
 * logo and company details, and the domains its links may go to: the brand's, and the main carriers' for tracking.
 */
import { Button, Column, Email, Heading, Image, Link, Row, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** A date with no year and no weekday, so it reads the same any time: March 13. */
const DATE = "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)(?![\\s\\S]*\\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\\b)[\\s\\S]{3,20}$";
/** The carriers whose own tracking pages a tracking link may go to. */
const CARRIERS = ["ups.com", "fedex.com", "usps.com", "dhl.com"].flatMap((host) => [host, `*.${host}`]);

const fields = {
  order: prop.text({ label: "Order number", required: true, pattern: "^[A-Za-z0-9][A-Za-z0-9-]{0,15}$", guidance: "Letters, digits and dashes: 10482" }),
  arrivesBy: prop.text({ label: "Arrives by", required: true, pattern: DATE, guidance: "The day and month, with no year or weekday: March 13" }),
  carrier: prop.text({ label: "Carrier", required: true, maxLength: 60, guidance: "Who's carrying it: Parcel Post" }),
  trackingNumber: prop.text({ label: "Tracking number", pattern: "^[A-Z0-9-]{6,40}$", guidance: "The carrier's number for the parcel, in capitals and digits: 1Z999AA10123456784" }),
  trackingLink: prop.link({
    label: "Tracking page",
    required: true,
    guidance: "The page that tracks the parcel: on your site, or the carrier's (UPS, FedEx, USPS or DHL)",
  }),
  items: prop.list(
    prop.object(
      {
        name: prop.text({ label: "Item", required: true, maxLength: 100, guidance: "The product and its option: Field notebook, dot grid" }),
        quantity: prop.number({ label: "Quantity", required: true, integer: true, min: 1, max: 99 }),
      },
      { label: "Item" },
    ),
    { label: "In the box", min: 1, max: 10 },
  ),
};

export function shipping(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  return template({
    id: "emails.Shipping",
    version: "1.0.0",
    label: "Shipping",
    description: "An order on its way: when it should arrive, who's carrying it, a button to track it, and what's in the box",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains, ...CARRIERS] },
    },
    example: {
      order: "10001",
      arrivesBy: "January 12",
      carrier: "Parcel Post",
      trackingNumber: "PP-10001-0001",
      trackingLink: `${brand.links.site}/orders/10001/track`,
      items: [{ name: "Field notebook, dot grid", quantity: 1 }],
    },
    render: (v) => (
      <Email
        width={560}
        title={`Your ${brand.name} order ${v.order} is on its way`}
        previewText={`It should arrive by ${v.arrivesBy}, with ${v.carrier}.`}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{ backgroundColor: token("colors.surface"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
      >
        <Column style={{ padding: [token("spacing.xl"), token("spacing.md"), token("spacing.lg")], gap: token("spacing.lg") }}>
          <Column style={{ alignItems: "center" }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 150 }} />
          </Column>
          <Column
            style={{
              backgroundColor: token("colors.background"),
              borderRadius: token("radii.md"),
              border: { width: 1, style: "solid", color: token("colors.border") },
            }}
          >
            <Column
              style={{
                backgroundColor: token("colors.primary"),
                color: token("colors.primaryForeground"),
                padding: [token("spacing.xl"), token("spacing.xl"), token("spacing.lg")],
                gap: token("spacing.sm"),
                borderRadius: { topLeft: token("radii.md"), topRight: token("radii.md") },
              }}
            >
              <Text
                style={{
                  fontSize: token("fontSizes.small"),
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: token("colors.primaryForeground"),
                }}
              >
                On its way
              </Text>
              <Heading level={1} style={{ color: token("colors.primaryForeground") }}>Your order has shipped</Heading>
            </Column>
            <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
              <Column style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), padding: token("spacing.lg"), gap: 2 }}>
                <Text style={small}>Arrives by</Text>
                <Text field="arrivesBy" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25 }}>{v.arrivesBy}</Text>
                <Text field="carrier" style={{ color: token("colors.muted") }}>{`With ${v.carrier}, order ${v.order}`}</Text>
                {v.trackingNumber && (
                  <Text field="trackingNumber" style={{ color: token("colors.muted") }}>{`Tracking number ${v.trackingNumber}`}</Text>
                )}
              </Column>
              <Button
                field="trackingLink"
                href={v.trackingLink}
                style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
              >
                Track your parcel
              </Button>
              <Column style={{ gap: token("spacing.xs"), padding: [token("spacing.sm"), 0, 0] }}>
                <Text style={{ fontWeight: 700 }}>In the box</Text>
                {v.items.map((item, i) => (
                  <Row key={i} stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                    <Column>
                      <Text field={`items[${i}].name`}>{item.name}</Text>
                    </Column>
                    <Column style={{ width: 60 }}>
                      <Text field={`items[${i}].quantity`} style={{ color: token("colors.muted"), textAlign: "right" }}>{`× ${item.quantity}`}</Text>
                    </Column>
                  </Row>
                ))}
              </Column>
            </Column>
          </Column>
          <Column style={{ gap: token("spacing.xs") }}>
            <Text style={{ ...small, textAlign: "center" }}>{brand.address ? `${brand.name} · ${brand.address}` : brand.name}</Text>
            {brand.support && (brand.support.phone || brand.support.hours) && (
              <Text style={{ ...small, textAlign: "center" }}>
                {[brand.support.phone && `Call ${brand.support.phone}`, brand.support.hours].filter(Boolean).join(", ")}
              </Text>
            )}
            <Text style={{ ...small, textAlign: "center" }}>
              <Link href={`${brand.links.site}/`}>Visit {brand.name}</Link>
              {" · "}
              <Link href={brand.links.help}>Get help from {brand.name}</Link>
            </Text>
          </Column>
        </Column>
      </Email>
    ),
  });
}

export default shipping(brand);
