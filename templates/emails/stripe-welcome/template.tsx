/**
 * A welcome email for an account that's ready: the logo and a rule, the opening paragraphs, one full-width button, then
 * paragraphs whose words may link into the docs, a sign-off from the team and the address. The logo, the sign-off and
 * the address are the brand's; the words, the button and the links are each send's.
 */
import { Button, Column, Divider, Email, Image, Link, Section, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/stripe";

/** One paragraph's words, in pieces: a piece with a link is a link. */
const paragraph = prop.list(
  prop.object(
    {
      text: prop.text({ label: "Words", required: true, maxLength: 240 }),
      href: prop.link({ label: "Link", guidance: "Set it to make these words a link: a few words that say where it goes" }),
    },
    { label: "Piece" },
  ),
  { label: "Paragraph", min: 1, max: 6 },
);

const fields = {
  subject: prop.text({ label: "Subject", required: true, pattern: "^[\\s\\S]{10,70}$", guidance: "10 to 70 characters" }),
  preview: prop.text({ label: "Preview text", required: true, pattern: "^[\\s\\S]{30,120}$", guidance: "What the inbox shows after the subject: 30 to 120 characters" }),
  intro: prop.list(prop.text({ label: "Paragraph", required: true, maxLength: 320 }), { label: "Opening paragraphs", required: true, min: 1, max: 3 }),
  button: prop.object(
    {
      label: prop.text({ label: "Button text", required: true, maxLength: 40 }),
      href: prop.link({ label: "Button link", required: true }),
    },
    { label: "Button", required: true },
  ),
  paragraphs: prop.list(paragraph, {
    label: "Paragraphs",
    max: 4,
    guidance: "After the button: where to go next, each a few sentences with a link or two into the docs",
  }),
};

export const meta = {
  author: "zenorocha",
  recreates: { company: "stripe", what: "welcome email", original: "https://reallygoodemails.com/search/emails/Stripe" },
};

export function stripeWelcome(brand: Brand) {
  const site = brand.links.site;
  const text = { padding: [0, 0, token("spacing.md")], textAlign: "left" } as const;
  const link = { color: token("colors.primary"), textDecoration: "none" } as const;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.lg"), 0] } as const;
  return template({
    id: "emails.StripeWelcome",
    version: "1.0.0",
    label: "Stripe welcome",
    description: "The email once an account can take live payments: the logo, short paragraphs with links into the docs, one button, and the address",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      subject: `Welcome to ${brand.name}`,
      preview: "Your account is ready to take live payments from today",
      intro: ["Thanks for submitting your account information. You're now ready to take live payments."],
      button: { label: "View your dashboard", href: `${site}/dashboard` },
      paragraphs: [[{ text: "When you have a question, our " }, { text: "support site", href: brand.links.help }, { text: " has the answers." }]],
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
        <Section style={{ padding: [0, 0, 64] }}>
          <Column style={{ padding: [token("spacing.lg"), token("spacing.xl"), 64], backgroundColor: token("colors.background") }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 58 }} />
            <Divider style={rule} />
            {v.intro.map((words, i) => (
              <Text key={i} field={`intro[${i}]`} style={text}>{words}</Text>
            ))}
            <Button
              field="button.label"
              href={v.button.href}
              style={{ width: "100%", backgroundColor: token("colors.primary"), color: token("colors.primaryForeground"), fontWeight: 700, padding: 10, borderRadius: token("radii.sm") }}
            >
              {v.button.label}
            </Button>
            <Divider style={rule} />
            {v.paragraphs.map((pieces, i) => (
              <Text key={i} field={`paragraphs[${i}]`} style={text}>
                {pieces.map((piece, j) => (piece.href ? <Link key={j} href={piece.href} style={link}>{piece.text}</Link> : piece.text))}
              </Text>
            ))}
            <Text style={text}>— The {brand.name} team</Text>
            <Divider style={{ ...rule, padding: [token("spacing.xs"), 0, token("spacing.lg")] }} />
            {brand.address ? (
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), lineHeight: 1.4 }}>
                {brand.name}, {brand.address}
              </Text>
            ) : null}
          </Column>
        </Section>
      </Email>
    ),
  });
}

export default stripeWelcome(brand);
