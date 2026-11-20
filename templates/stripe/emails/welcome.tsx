import { Button, Column, Divider, Email, Image, Link, Section, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Welcome",
  description: "The email once an account can take live payments: the logo, short paragraphs with links into the docs, one button, and the address",
  recreates: { what: "Welcome email", original: "https://reallygoodemails.com/search/emails/Stripe" },
};

export default function StripeWelcome({ brand }: { brand: Brand }) {
  const site = brand.links.site;
  const paragraph = { padding: [0, 0, token("spacing.md")], textAlign: "left" } as const;
  const link = { color: token("colors.primary"), textDecoration: "none" } as const;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.lg"), 0] } as const;
  return (
    <Email
      width={600}
      title={`Welcome to ${brand.name}`}
      previewText={`You're now ready to make live transactions with ${brand.name}!`}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ backgroundColor: token("colors.surface"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
    >
      <Section style={{ padding: [0, 0, 64] }}>
        <Column style={{ padding: [token("spacing.lg"), token("spacing.xl"), 64], backgroundColor: token("colors.background") }}>
          <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 58 }} />
          <Divider style={rule} />
          <Text style={paragraph}>Thanks for submitting your account information. You're now ready to make live transactions with {brand.name}!</Text>
          <Text style={paragraph}>You can view your payments and a variety of other information about your account right from your dashboard.</Text>
          <Button
            href={`${site}/dashboard`}
            style={{ width: "100%", backgroundColor: token("colors.primary"), color: token("colors.primaryForeground"), fontWeight: 700, padding: 10, borderRadius: token("radii.sm") }}
          >
            View your {brand.name} Dashboard
          </Button>
          <Divider style={rule} />
          <Text style={paragraph}>
            If you haven't finished your integration, you might find our <Link href={`${site}/docs/dashboard/basics`} style={link}>docs</Link> handy.
          </Text>
          <Text style={paragraph}>
            Once you're ready to start accepting payments, you'll just need to use your live <Link href={`${site}/dashboard/apikeys`} style={link}>API keys</Link> instead
            of your test API keys. Your account can simultaneously be used for both test and live requests, so you can continue testing while accepting live
            payments. Check out our <Link href={`${site}/docs/dashboard/basics`} style={link}>tutorial about account basics</Link>.
          </Text>
          <Text style={paragraph}>
            Finally, we've put together a <Link href={`${site}/docs/get-started/checklist/website`} style={link}>quick checklist</Link> to ensure your website
            conforms to card network standards.
          </Text>
          <Text style={paragraph}>
            We'll be here to help you with any step along the way. You can find answers to most questions and get in touch with us on our{" "}
            <Link href={`${site}/support`} style={link}>support site</Link>.
          </Text>
          <Text style={paragraph}>— The {brand.name} team</Text>
          <Divider style={{ ...rule, padding: [token("spacing.xs"), 0, token("spacing.lg")] }} />
          <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), lineHeight: 1.4 }}>
            {brand.name}, {brand.address}
          </Text>
        </Column>
      </Section>
    </Email>
  );
}
