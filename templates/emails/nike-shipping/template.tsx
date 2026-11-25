/**
 * An order that has shipped: the tracking number and a button in a gray band, the logo and a bold headline, where it's
 * going, each item with its picture, the order's number and date, picks for you, then help, the site's sections and
 * the footer. The logo, the help, the sections and the footer are the brand's; the words, the tracking, the address,
 * the items, the order and the picks are each send's.
 */
import { Fragment } from "react";
import { Button, Column, Divider, Email, Heading, Image, Link, Row, Section, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/nike";

/** Free text with no year, so it reads the same any time. */
const noYear = (min: number, max: number) => `^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{${min},${max}}$`;

const fields = {
  subject: prop.text({ label: "Subject", required: true, pattern: "^[\\s\\S]{5,70}$" }),
  preview: prop.text({ label: "Preview text", required: true, pattern: "^[\\s\\S]{30,120}$", guidance: "What the inbox shows after the subject: 30 to 120 characters" }),
  headline: prop.text({ label: "Headline", required: true, maxLength: 32 }),
  message: prop.list(prop.text({ label: "Paragraph", required: true, maxLength: 320 }), {
    label: "Message",
    required: true,
    min: 1,
    max: 3,
    guidance: "One to three short paragraphs under the headline: that the order is on its way and how to follow it, then anything else about it, like when the card is charged. No links: the tracking, the order and help have their own",
  }),
  trackingNumber: prop.text({ label: "Tracking number", required: true, pattern: "^[A-Z0-9]{8,30}$" }),
  trackingLink: prop.link({ label: "Tracking link", required: true }),
  carrier: prop.text({ label: "Carrier", maxLength: 24, guidance: "Who delivers it, shown with the tracking number: UPS" }),
  arrives: prop.text({ label: "Arrives", pattern: noYear(3, 30), guidance: "When it should arrive, with no year, shown with the tracking number: by Sep 27, or Sep 26–28" }),
  shipTo: prop.object(
    {
      name: prop.text({ label: "Name", required: true, maxLength: 60 }),
      address: prop.list(prop.text({ label: "Address line", required: true, maxLength: 80 }), {
        label: "Address",
        required: true,
        min: 1,
        max: 5,
        guidance: "One to five lines, or all of it on one: 2125 Chestnut St, San Francisco, CA 94123",
      }),
    },
    { label: "Shipping to", required: true },
  ),
  items: prop.list(
    prop.object(
      {
        image: field.image({ label: "Picture", required: true, aspect: { min: 0.75, max: 1 }, minWidth: 320, accepts: ["png", "jpeg"] }),
        name: prop.text({ label: "Product", required: true, maxLength: 100 }),
        details: prop.text({ label: "Size and color", maxLength: 40 }),
        link: prop.link({ label: "Product link", guidance: "The product's page: its name links there" }),
      },
      { label: "Item" },
    ),
    { label: "Items", required: true, min: 1, max: 4 },
  ),
  orderNumber: prop.text({ label: "Order number", required: true, pattern: "^[A-Z0-9]{6,16}$" }),
  orderDate: prop.text({ label: "Order date", required: true, pattern: noYear(3, 20), guidance: "The month and day, with no year: Sep 22" }),
  picks: prop.list(
    prop.object(
      {
        image: field.image({ label: "Picture", required: true, aspect: { min: 0.75, max: 0.85 }, minWidth: 320, accepts: ["png", "jpeg"] }),
        name: prop.text({ label: "Product", required: true, maxLength: 40 }),
        kind: prop.text({ label: "What it is", required: true, maxLength: 60 }),
        link: prop.link({ label: "Product link", guidance: "The product's page: its picture and name link there" }),
      },
      { label: "Pick" },
    ),
    { label: "Top picks", min: 0, max: 3, guidance: "Up to three products for the reader; with none, the section isn't shown" },
  ),
};

export const meta = {
  author: "zehfernandes",
  recreates: { company: "nike", what: "shipping confirmation", original: "https://reallygoodemails.com/search/emails/Nike" },
};

export function nikeShipping(brand: Brand) {
  const site = brand.links.site;
  const host = new URL(site).host.replace(/^www\./, "");
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") } } as const;
  const band = { padding: [token("spacing.md"), token("spacing.lg")], mobile: { padding: [token("spacing.md"), token("spacing.md")] } } as const;
  const muted = { color: token("colors.muted") } as const;
  const outline = {
    width: 220,
    padding: [10, 0],
    textAlign: "center",
    fontSize: 16,
    color: token("colors.foreground"),
    backgroundColor: token("colors.background"),
    border: { width: 1, style: "solid", color: token("colors.muted") },
    borderRadius: token("radii.sm"),
  } as const;
  const help = { color: token("colors.foreground"), textDecoration: "underline" } as const;
  const product = { color: token("colors.foreground"), textDecoration: "none" } as const;
  const asset = (name: string) => `https://hyperelements.dev/generated/gallery/assets/companies/nike/${name}`;
  return template({
    id: "emails.NikeShipping",
    version: "1.0.0",
    label: "It's on its way",
    description: "An order that has shipped: the tracking number and a button up top, a bold headline, where it's going, the item with its picture, picks for you, and help",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      subject: "It's On Its Way.",
      preview: "Get your order summary, estimated delivery date and more",
      headline: "It's On Its Way.",
      message: ["Your order is on its way. Use the link above to track its progress."],
      trackingNumber: "1ZV218970300071628",
      trackingLink: `${site}/orders/track`,
      shipTo: { name: "Sam Reader", address: ["1 Main Street, Springfield"] },
      items: [{ image: { src: asset("product.jpg"), width: 560, height: 560 }, name: "Stadium Away Soccer Jersey", details: "Size L" }],
      orderNumber: "C0106373851",
      orderDate: "Sep 22",
      picks: [
        { image: { src: asset("pick-1.jpg"), width: 320, height: 400 }, name: "Stadium Home", kind: "Soccer Jersey" },
        { image: { src: asset("pick-4.jpg"), width: 320, height: 400 }, name: "Track", kind: "Soccer Jacket" },
      ],
    },
    render: (v) => (
      <Email
        width={600}
        title={v.subject}
        previewText={v.preview}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{ backgroundColor: token("colors.background"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
      >
        <Section style={{ border: { width: 1, style: "solid", color: token("colors.border") } }}>
          <Column>
            <Row style={{ ...band, backgroundColor: token("colors.surface"), alignItems: "center", gap: token("spacing.md") }}>
              <Column>
                <Text style={{ fontWeight: 700 }}>Tracking Number</Text>
                <Text field="trackingNumber" style={muted}>{v.trackingNumber}</Text>
                {v.carrier ? <Text field="carrier" style={muted}>{v.carrier}</Text> : null}
                {v.arrives ? <Text field="arrives" style={{ fontWeight: 700, padding: [token("spacing.xs"), 0, 0] }}>Arrives {v.arrives}</Text> : null}
              </Column>
              <Button href={v.trackingLink} style={outline}>Track Package</Button>
            </Row>
            <Divider style={rule} />
            <Column style={{ padding: [token("spacing.lg"), token("spacing.xl")], gap: token("spacing.md"), alignItems: "center", textAlign: "center", mobile: { padding: [token("spacing.lg"), token("spacing.md")] } }}>
              <Image
                src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
                alt={brand.logo.alt}
                style={{ width: Math.min(160, Math.round((26 * brand.logo.width) / brand.logo.height)) }}
              />
              <Heading field="headline" level={1}>{v.headline}</Heading>
              {v.message.map((words, i) => (
                <Text key={i} field={`message[${i}]`} style={muted}>{words}</Text>
              ))}
            </Column>
            <Divider style={rule} />
            <Column style={band}>
              <Text field="shipTo.name" style={{ fontWeight: 700 }}>Shipping to: {v.shipTo.name}</Text>
              {v.shipTo.address.map((line, i) => (
                <Text key={i} field={`shipTo.address[${i}]`} style={muted}>{line}</Text>
              ))}
            </Column>
            <Divider style={rule} />
            {v.items.map((item, i) => (
              <Fragment key={i}>
                <Row style={{ ...band, padding: [token("spacing.lg"), token("spacing.lg")], gap: token("spacing.sm"), alignItems: "start" }}>
                  <Image field={`items[${i}].image`} src={item.image} alt={item.name} style={{ width: 260 }} />
                  <Column>
                    <Text field={`items[${i}].name`}>{item.link ? <Link href={item.link} style={product}>{item.name}</Link> : item.name}</Text>
                    {item.details ? <Text field={`items[${i}].details`} style={muted}>{item.details}</Text> : null}
                  </Column>
                </Row>
                <Divider style={rule} />
              </Fragment>
            ))}
            <Column style={{ ...band, gap: token("spacing.lg") }}>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                <Column style={{ width: 170 }}>
                  <Text style={{ fontWeight: 700 }}>Order Number</Text>
                  <Text field="orderNumber" style={muted}>{v.orderNumber}</Text>
                </Column>
                <Column>
                  <Text style={{ fontWeight: 700 }}>Order Date</Text>
                  <Text field="orderDate" style={muted}>{v.orderDate}</Text>
                </Column>
              </Row>
              <Column style={{ alignItems: "center" }}>
                <Button href={`${site}/orders`} style={outline}>Order Status</Button>
              </Column>
            </Column>
            {v.picks.length > 0 ? (
              <>
                <Divider style={rule} />
                <Column style={{ padding: [token("spacing.md"), token("spacing.xs")], gap: token("spacing.md") }}>
                  <Heading level={2} style={{ textAlign: "center" }}>Top Picks For You</Heading>
                  <Row style={{ gap: token("spacing.xs") }}>
                    {v.picks.map((pick, i) => {
                      const picture = <Image field={`picks[${i}].image`} src={pick.image} alt={`${pick.name} ${pick.kind}`} style={{ width: "100%" }} />;
                      return (
                        <Column key={i} style={{ gap: token("spacing.xs") }}>
                          {pick.link ? <Link href={pick.link}>{picture}</Link> : picture}
                          <Column style={{ padding: [token("spacing.xs"), 10] }}>
                            <Text field={`picks[${i}].name`} style={{ fontSize: 15, lineHeight: 1.3 }}>
                              {pick.link ? <Link href={pick.link} style={product}>{pick.name}</Link> : pick.name}
                            </Text>
                            <Text field={`picks[${i}].kind`} style={{ ...muted, fontSize: 15, lineHeight: 1.3 }}>{pick.kind}</Text>
                          </Column>
                        </Column>
                      );
                    })}
                  </Row>
                </Column>
              </>
            ) : null}
            <Divider style={rule} />
            <Column style={{ ...band, backgroundColor: token("colors.surface"), gap: token("spacing.md") }}>
              <Text style={{ fontWeight: 700 }}>Get Help</Text>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                <Text><Link href={`${site}/help/shipping-status`} style={help}>Shipping Status</Link></Text>
                <Text><Link href={`${site}/help/shipping-delivery`} style={help}>Shipping & Delivery</Link></Text>
                <Text><Link href={`${site}/help/returns`} style={help}>Returns & Exchanges</Link></Text>
              </Row>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                <Text><Link href={`${site}/help/how-to-return`} style={help}>How to Return</Link></Text>
                <Text style={{ flex: 2 }}><Link href={brand.links.help} style={help}>Contact Options</Link></Text>
              </Row>
              {brand.support?.phone || brand.support?.hours ? (
                <>
                  <Divider style={rule} />
                  <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                    {brand.support.phone ? <Text>{brand.support.phone}</Text> : null}
                    {brand.support.hours ? <Text>{brand.support.hours}</Text> : null}
                  </Row>
                </>
              ) : null}
            </Column>
            <Divider style={rule} />
            <Column style={{ ...band, gap: token("spacing.sm"), alignItems: "center", textAlign: "center" }}>
              <Heading level={2}>{host}</Heading>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md"), justifyContent: "center" }}>
                <Text><Link href={`${site}/men`} style={help}>Men</Link></Text>
                <Text><Link href={`${site}/women`} style={help}>Women</Link></Text>
                <Text><Link href={`${site}/kids`} style={help}>Kids</Link></Text>
                <Text><Link href={`${site}/customize`} style={help}>Customize</Link></Text>
              </Row>
            </Column>
            <Divider style={rule} />
            <Column style={{ ...band, gap: token("spacing.sm"), alignItems: "center", textAlign: "center" }}>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md"), justifyContent: "center" }}>
                <Text><Link href={`${site}/email/web-version`} style={{ ...help, color: token("colors.muted") }}>Web Version</Link></Text>
                <Text><Link href={`${site}/legal/privacy`} style={{ ...help, color: token("colors.muted") }}>Privacy Policy</Link></Text>
              </Row>
              <Text style={muted}>Please contact us if you have any questions. (If you reply to this email, we won't be able to see it.)</Text>
              <Text style={muted}>© {brand.name}. All Rights Reserved.</Text>
              {brand.address ? <Text style={muted}>{brand.name}, {brand.address}</Text> : null}
            </Column>
          </Column>
        </Section>
      </Email>
    ),
  });
}

export default nikeShipping(brand);
