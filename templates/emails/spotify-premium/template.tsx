/**
 * A paid plan that has just started: the logo, a big headline, the plan's perks numbered, one pill button, the plan and
 * its price in a box, then the brand's apps, its legal links and the address. The logo, the apps, the legal links and
 * the address are the brand's; the words, the perks, the plan and the reader's address are each send's.
 */
import { Button, Column, Divider, Email, Heading, Image, Link, Row, Section, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/spotify";

/** What's free text with no year, so it reads the same any time. */
const noYear = (min: number, max: number) => `^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{${min},${max}}$`;

const fields = {
  subject: prop.text({ label: "Subject", required: true, pattern: "^[\\s\\S]{10,70}$", guidance: "10 to 70 characters" }),
  preview: prop.text({ label: "Preview text", required: true, pattern: "^[\\s\\S]{30,120}$", guidance: "What the inbox shows after the subject: 30 to 120 characters" }),
  headline: prop.text({ label: "Headline", required: true, maxLength: 40, guidance: "A few big words, like Welcome to Premium." }),
  intro: prop.text({ label: "Intro", required: true, maxLength: 160 }),
  perks: prop.list(
    prop.object(
      {
        title: prop.text({ label: "Perk", required: true, maxLength: 40 }),
        text: prop.text({ label: "What it means", required: true, maxLength: 90 }),
      },
      { label: "Perk" },
    ),
    { label: "Perks", required: true, min: 2, max: 6 },
  ),
  button: prop.object(
    {
      label: prop.text({ label: "Button text", required: true, maxLength: 30 }),
      href: prop.link({ label: "Button link", required: true }),
    },
    { label: "Button", required: true },
  ),
  plan: prop.object(
    {
      name: prop.text({ label: "Plan", required: true, maxLength: 40 }),
      price: prop.number({ label: "Price", required: true, min: 0, guidance: "What it costs each period, in the brand's currency: 11.99" }),
      period: prop.choice(["month", "year"], { label: "Billed every", required: true }),
      // When the free month ends, with no year, so it reads the same any time.
      trial: prop.text({ label: "Free month ends", pattern: noYear(3, 30), guidance: "The day the free month ends, with no year: 20 December. Leave it out for a plan with no free month" }),
    },
    { label: "Plan", required: true },
  ),
  email: prop.text({ label: "Reader's email address", required: true, pattern: "^(?=[\\s\\S]{6,254}$)[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }),
};

export const meta = {
  recreates: { company: "spotify", what: "Premium welcome email", original: "https://reallygoodemails.com/search/emails/Spotify" },
};

export function spotifyPremium(brand: Brand) {
  const site = brand.links.site;
  const muted = { color: token("colors.muted") } as const;
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const link = { color: token("colors.primary"), textDecoration: "none", fontWeight: 700 } as const;
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  return template({
    id: "emails.SpotifyPremium",
    version: "1.0.0",
    label: "Welcome to Premium",
    description: "A paid plan that has just started: a big headline, what it gives you, one pill button, the plan and its price, and the apps",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      subject: `Welcome to ${brand.name} Premium`,
      preview: "Ad-free listening, downloads and more. Here's what you get now.",
      headline: "Welcome to Premium.",
      intro: "Thanks for joining. Here's what you get now:",
      perks: [
        { title: "Ad-free listening", text: "Enjoy it uninterrupted." },
        { title: "Listen offline", text: "Download and save your data." },
      ],
      button: { label: `Open ${brand.name}`, href: `${site}/open` },
      plan: { name: "Premium Individual", price: 11.99, period: "month", trial: "20 December" },
      email: "reader@example.com",
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
        style={{ backgroundColor: token("colors.surface"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
      >
        <Section style={{ padding: [token("spacing.lg"), 0], mobile: { padding: 0 } }}>
          <Column style={{ padding: token("spacing.xl"), gap: token("spacing.lg"), backgroundColor: token("colors.background"), borderRadius: token("radii.md"), mobile: { padding: [token("spacing.lg"), token("spacing.md")] } }}>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: Math.min(180, Math.round((36 * brand.logo.width) / brand.logo.height)) }}
            />
            <Column style={{ gap: token("spacing.md") }}>
              <Heading field="headline" level={1}>{v.headline}</Heading>
              <Text field="intro" style={muted}>{v.intro}</Text>
            </Column>
            <Column style={{ gap: token("spacing.md") }}>
              {v.perks.map((perk, i) => (
                <Row key={i} stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "start" }}>
                  <Text style={{ width: 32, fontWeight: 700, color: token("colors.primary") }}>0{i + 1}</Text>
                  <Column>
                    <Text field={`perks[${i}].title`} style={{ fontWeight: 700 }}>{perk.title}</Text>
                    <Text field={`perks[${i}].text`} style={muted}>{perk.text}</Text>
                  </Column>
                </Row>
              ))}
            </Column>
            <Column style={{ alignItems: "start" }}>
              <Button
                field="button.label"
                href={v.button.href}
                style={{
                  padding: [14, 32],
                  backgroundColor: token("colors.primary"),
                  color: token("colors.primaryForeground"),
                  fontWeight: 700,
                  borderRadius: token("radii.sm"),
                  mobile: { width: "100%", textAlign: "center" },
                }}
              >
                {v.button.label}
              </Button>
            </Column>
            <Column style={{ padding: token("spacing.md"), gap: token("spacing.xs"), backgroundColor: token("colors.surface"), borderRadius: token("radii.md") }}>
              <Text field="plan.name" style={{ fontWeight: 700 }}>{v.plan.name}</Text>
              <Text field="plan.price" style={muted}>
                {money(v.plan.price)} a {v.plan.period}
                {v.plan.trial ? ` after your free month ends on ${v.plan.trial}` : ""}.
              </Text>
              <Text style={muted}>
                Cancel anytime on your <Link href={`${site}/account`} style={link}>account page</Link>.
              </Text>
            </Column>
            <Divider style={{ borderTop: { width: 1, style: "solid", color: token("colors.border") } }} />
            <Column style={{ gap: token("spacing.sm") }}>
              <Text style={small}>
                Get {brand.name} for: <Link href={`${site}/download/ios`} style={link}>iPhone</Link> · <Link href={`${site}/download/android`} style={link}>Android</Link> ·{" "}
                <Link href={`${site}/download`} style={link}>Desktop</Link>
              </Text>
              <Text style={small}>
                <Link href={`${site}/legal/terms`} style={{ ...link, color: token("colors.muted") }}>Terms of Use</Link> ·{" "}
                <Link href={`${site}/legal/privacy`} style={{ ...link, color: token("colors.muted") }}>Privacy Policy</Link> ·{" "}
                <Link href={brand.links.help} style={{ ...link, color: token("colors.muted") }}>Contact Us</Link>
              </Text>
              <Text field="email" style={small}>This message was sent to {v.email} because you started a {brand.name} Premium plan.</Text>
              {brand.address ? <Text style={small}>{brand.name}, {brand.address}</Text> : null}
            </Column>
          </Column>
        </Section>
      </Email>
    ),
  });
}

export default spotifyPremium(brand);
