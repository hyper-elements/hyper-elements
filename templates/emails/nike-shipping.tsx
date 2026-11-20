import { Button, Column, Divider, Email, Heading, Image, Link, Row, Section, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "It's on its way",
  author: "zehfernandes",
  description: "An order that has shipped: the tracking number and a button up top, a bold headline, where it's going, the item with its picture, picks for you, and help",
  recreates: { company: "nike", what: "shipping confirmation", original: "https://reallygoodemails.com/search/emails/Nike" },
};

const ASSETS = "https://hyperelements.dev/generated/gallery/assets/companies/nike/";
const PICKS = [
  { image: "pick-1.jpg", name: "USWNT Stadium Home", kind: "Women's Dri-FIT Soccer Jersey" },
  { image: "pick-2.jpg", name: "Brazil Stadium Goalkeeper", kind: "Men's Dri-FIT Short-Sleeve Football Shirt" },
  { image: "pick-4.jpg", name: "FFF", kind: "Women's Soccer Jacket" },
];

export default function NikeShipping({ brand }: { brand: Brand }) {
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
  return (
    <Email
      width={600}
      title="It's On Its Way."
      previewText="Get your order summary, estimated delivery date and more"
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
              <Text style={muted}>1ZV218970300071628</Text>
            </Column>
            <Button href={`${site}/orders/track`} style={outline}>Track Package</Button>
          </Row>
          <Divider style={rule} />
          <Column style={{ padding: [token("spacing.lg"), token("spacing.xl")], gap: token("spacing.md"), alignItems: "center", textAlign: "center", mobile: { padding: [token("spacing.lg"), token("spacing.md")] } }}>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: Math.min(160, Math.round((26 * brand.logo.width) / brand.logo.height)) }}
            />
            <Heading level={1}>It's On Its Way.</Heading>
            <Text style={muted}>Your order is on its way. Use the link above to track its progress.</Text>
            <Text style={muted}>
              We've also charged your payment method for the cost of your order and will be removing any authorization holds. For payment details, please
              visit your Orders page on {host} or in the {brand.name} app.
            </Text>
          </Column>
          <Divider style={rule} />
          <Column style={band}>
            <Text style={{ fontWeight: 700 }}>Shipping to: Alan Turing</Text>
            <Text style={muted}>2125 Chestnut St, San Francisco, CA 94123</Text>
          </Column>
          <Divider style={rule} />
          <Row style={{ ...band, padding: [token("spacing.lg"), token("spacing.lg")], gap: token("spacing.sm"), alignItems: "start" }}>
            <Image src={{ src: `${ASSETS}product.jpg`, width: 560, height: 560 }} alt="Brazil Stadium Away Women's Dri-FIT Soccer Jersey" style={{ width: 260 }} />
            <Column>
              <Text>Brazil Stadium Away Women's Dri-FIT Soccer Jersey</Text>
              <Text style={muted}>Size L (12–14)</Text>
            </Column>
          </Row>
          <Divider style={rule} />
          <Column style={{ ...band, gap: token("spacing.lg") }}>
            <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
              <Column style={{ width: 170 }}>
                <Text style={{ fontWeight: 700 }}>Order Number</Text>
                <Text style={muted}>C0106373851</Text>
              </Column>
              <Column>
                <Text style={{ fontWeight: 700 }}>Order Date</Text>
                <Text style={muted}>Sep 22</Text>
              </Column>
            </Row>
            <Column style={{ alignItems: "center" }}>
              <Button href={`${site}/orders`} style={outline}>Order Status</Button>
            </Column>
          </Column>
          <Divider style={rule} />
          <Column style={{ padding: [token("spacing.md"), token("spacing.xs")], gap: token("spacing.md") }}>
            <Heading level={2} style={{ textAlign: "center" }}>Top Picks For You</Heading>
            <Row style={{ gap: token("spacing.xs") }}>
              {PICKS.map((pick) => (
                <Column key={pick.image} style={{ gap: token("spacing.xs") }}>
                  <Image src={{ src: `${ASSETS}${pick.image}`, width: 320, height: 400 }} alt={`${pick.name} ${pick.kind}`} style={{ width: "100%" }} />
                  <Column style={{ padding: [token("spacing.xs"), 10] }}>
                    <Text style={{ fontSize: 15, lineHeight: 1.3 }}>{pick.name}</Text>
                    <Text style={{ ...muted, fontSize: 15, lineHeight: 1.3 }}>{pick.kind}</Text>
                  </Column>
                </Column>
              ))}
            </Row>
          </Column>
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
              <Text style={{ flex: 2 }}><Link href={`${site}/help/contact`} style={help}>Contact Options</Link></Text>
            </Row>
            <Divider style={rule} />
            <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
              <Text>1-800-806-6453</Text>
              <Text>4 am - 11 pm PT</Text>
            </Row>
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
  );
}
