import { Column, Divider, Email, Heading, Image, LineBreak, Link, Row, Section, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "App Store receipt",
  author: "zehfernandes",
  description: "A subscription's receipt: the order's details in a gray table, the app with its icon and price, the total, an offer, and the fine print",
  recreates: { company: "apple", what: "App Store receipt", original: "https://reallygoodemails.com/search/emails/Apple" },
};

// The app the receipt is for: no company's, so it reads the same in every brand.
const APP_ICON = "https://hyperelements.dev/generated/gallery/assets/companies/apple/app-icon.png";

export default function AppleReceipt({ brand }: { brand: Brand }) {
  const site = brand.links.site;
  // The logo as tall as the original's, whatever its shape.
  const logo = (height: number) => Math.min(160, Math.round((height * brand.logo.width) / brand.logo.height));
  const label = { fontSize: token("fontSizes.small"), color: token("colors.muted"), textTransform: "uppercase", letterSpacing: 0.5 } as const;
  const cell = { padding: [token("spacing.sm"), token("spacing.md")], gap: 2, border: { width: 1, style: "solid", color: token("colors.background") } } as const;
  const link = { color: token("colors.primary"), textDecoration: "none" } as const;
  const fine = { fontSize: token("fontSizes.small"), color: token("colors.muted"), lineHeight: 1.5 } as const;
  return (
    <Email
      width={640}
      title={`Your receipt from ${brand.name}`}
      previewText={`Your ${brand.name} receipt: Lumen Pro (Monthly), $14.99`}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ backgroundColor: token("colors.background"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
    >
      <Section style={{ padding: [token("spacing.md"), 0, token("spacing.xl")], mobile: { padding: [token("spacing.md"), token("spacing.md"), token("spacing.xl")] } }}>
        <Column style={{ gap: token("spacing.lg") }}>
          <Row stackOnMobile={false} style={{ alignItems: "center" }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: logo(42) }} />
            <Heading level={1} style={{ color: token("colors.muted"), textAlign: "right" }}>Receipt</Heading>
          </Row>
          <Text style={{ textAlign: "center", fontWeight: 700 }}>
            Save 3% on all your {brand.name} purchases with {brand.name} Card.¹ <Link href={`${site}/card`} style={link}>Apply and use in minutes</Link>²
          </Text>
          <Row style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm") }}>
            <Column>
              <Column style={cell}>
                <Text style={label}>{brand.name} Account</Text>
                <Text>alan.turing@example.com</Text>
              </Column>
              <Column style={cell}>
                <Text style={label}>Invoice date</Text>
                <Text>18 Jan</Text>
              </Column>
              <Column style={cell}>
                <Text style={label}>Order ID</Text>
                <Text>
                  <Link href={`${site}/account/orders`} style={link}>ML4F5L8522</Link>
                </Text>
              </Column>
              <Column style={cell}>
                <Text style={label}>Document no.</Text>
                <Text>186623754793</Text>
              </Column>
            </Column>
            <Column style={cell}>
              <Text style={label}>Billed to</Text>
              <Text>Visa .... 7461</Text>
              <Text>Alan Turing</Text>
              <Text>2125 Chestnut St</Text>
              <Text>San Francisco, CA 94123</Text>
              <Text>USA</Text>
            </Column>
          </Row>
          <Text style={{ padding: [token("spacing.xs"), token("spacing.sm")], backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), fontWeight: 700 }}>
            {brand.name} Store
          </Text>
          <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "start", padding: [0, token("spacing.md")] }}>
            <Image
              src={{ src: APP_ICON, width: 120, height: 120 }}
              alt="Lumen"
              style={{ width: 64, borderRadius: token("radii.md"), border: { width: 1, style: "solid", color: token("colors.border") } }}
            />
            <Column style={{ gap: 2 }}>
              <Text style={{ fontWeight: 700 }}>Lumen: Photo Journal</Text>
              <Text style={{ color: token("colors.muted") }}>Lumen Pro (Monthly)</Text>
              <Text style={{ color: token("colors.muted") }}>Renews Aug 20</Text>
              <Text>
                <Link href={`${site}/store/review`} style={link}>Write a Review</Link> | <Link href={`${site}/store/report`} style={link}>Report a Problem</Link>
              </Text>
            </Column>
            <Text style={{ width: 90, textAlign: "right", fontWeight: 700 }}>$14.99</Text>
          </Row>
          <Divider style={{ borderTop: { width: 1, style: "solid", color: token("colors.border") } }} />
          <Row stackOnMobile={false} style={{ alignItems: "center", justifyContent: "end", gap: token("spacing.lg"), padding: [0, token("spacing.md")] }}>
            <Text style={{ ...label, fontWeight: 700, textAlign: "right" }}>Total</Text>
            <Text style={{ width: 90, fontSize: 18, fontWeight: 700, textAlign: "right" }}>$14.99</Text>
          </Row>
          <Divider style={{ borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [0, 0, token("spacing.xl")] }} />
          <Column style={{ gap: token("spacing.sm"), alignItems: "center", textAlign: "center" }}>
            <Heading level={2}>Save 3% on all your {brand.name} purchases.</Heading>
            <Text>
              <Link href={`${site}/card`} style={link}>Apply and use in minutes</Link>
            </Text>
          </Column>
          <Divider style={{ borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.xl"), 0, 0] }} />
          <Column style={{ gap: token("spacing.md") }}>
            <Text style={fine}>
              1. 3% savings is earned as Daily Cash and is transferred to your {brand.name} Cash card when transactions post to your {brand.name} Card account. If
              you do not have a {brand.name} Cash card, Daily Cash can be applied by you as a credit on your statement balance. 3% is the total amount of Daily
              Cash earned for these purchases. See the {brand.name} Card Customer Agreement for more details on Daily Cash and qualifying transactions.
            </Text>
            <Text style={fine}>2. Subject to credit approval.</Text>
            <Text style={fine}>Available for qualifying applicants in the United States.</Text>
          </Column>
          <Column style={{ gap: token("spacing.md"), alignItems: "center", textAlign: "center" }}>
            <Text style={fine}>
              Privacy: We use a <Link href={`${site}/legal/privacy`} style={link}>Subscriber ID</Link> to provide reports to developers.
            </Text>
            <Text style={fine}>
              Get help with subscriptions and purchases. <Link href={`${site}/support`} style={link}>Visit {brand.name} Support.</Link>
            </Text>
            <Text style={fine}>
              You have the option to stop receiving email receipts for your subscription renewals. If you have opted out, you can still view your receipts in
              your account under Purchase History. To manage receipts or to opt in again, go to <Link href={`${site}/account`} style={link}>Account Settings</Link>.
            </Text>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: logo(26) }} />
            <Text style={fine}>
              <Link href={`${site}/account`} style={link}>Account Settings</Link> • <Link href={`${site}/legal/sales`} style={link}>Terms of Sale</Link> •{" "}
              <Link href={`${site}/legal/privacy`} style={link}>Privacy Policy</Link>
            </Text>
            <Text style={fine}>
              Copyright © {brand.name}. <Link href={`${site}/legal`} style={link}>All rights reserved</Link>
              {brand.address ? <><LineBreak />{brand.address}</> : null}
            </Text>
          </Column>
        </Column>
      </Section>
    </Email>
  );
}
