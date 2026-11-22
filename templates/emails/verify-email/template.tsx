/**
 * A request to confirm an email address. Everything but the address and the link that confirms it is locked: the
 * logo, the band, the words around the button, the note for a reader who didn't sign up, and the footer (the company's
 * address and its links). It's made from a brand (`verifyEmail(brand)`), which sets its colors, fonts, logo and company
 * details, and the domains its links may go to.
 */
import { Button, Column, Email, Heading, Image, Link, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

const fields = {
  email: prop.text({
    label: "Email address",
    required: true,
    // An address, as long as an address can be: it wraps in its box.
    maxLength: 254,
    pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$",
    guidance: "The address the account was made with, up to 254 characters",
  }),
  verifyLink: prop.link({ label: "Confirmation link", required: true, guidance: "The one-time link that confirms the address" }),
  // Both or neither: shown under the button only when it's given.
  expiry: prop.object(
    {
      expires: prop.number({ label: "Expires in", required: true, min: 1, max: 72, integer: true, guidance: "How long the link works, in the unit below: 24" }),
      unit: prop.choice(["minutes", "hours", "days"], { label: "Unit", required: true, guidance: "The unit of how long the link works: hours" }),
    },
    { label: "Expiry" },
  ),
};

/** How long something works, as a reader says it: "10 minutes", "1 hour". */
const duration = (n: number, unit: "minutes" | "hours" | "days") => `${n} ${n === 1 ? unit.slice(0, -1) : unit}`;
/** A link's address, written out for a reader to paste. */
const written = (link: string | { href: string }) => (typeof link === "string" ? link : link.href);

export function verifyEmail(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" } as const;
  return template({
    id: "emails.VerifyEmail",
    version: "1.0.0",
    label: "Verify email",
    description: "One step before the account is ready: confirm the email address it was made with",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      email: "sam@example.com",
      verifyLink: `${brand.links.site}/verify/0a1b2c`,
    },
    render: (v) => (
      <Email
        width={560}
        title={`Confirm your email for ${brand.name}`}
        previewText={`One step left: confirm ${v.email} is yours.`}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{
          backgroundColor: token("colors.surface"),
          fontSize: token("fontSizes.body"),
          lineHeight: token("lineHeights.body"),
        }}
      >
        <Column
          style={{
            padding: [token("spacing.xl"), token("spacing.md"), token("spacing.lg")],
            gap: token("spacing.lg"),
          }}
        >
          <Column style={{ alignItems: "center" }}>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: 150 }}
            />
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
                One step left
              </Text>
              <Heading level={1} style={{ color: token("colors.primaryForeground") }}>Confirm your email address</Heading>
            </Column>
            <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
              <Text>Your {brand.name} account is almost ready. Confirm that this address is yours, and you're in.</Text>
              <Column
                style={{
                  backgroundColor: token("colors.surface"),
                  borderRadius: token("radii.sm"),
                  padding: [token("spacing.sm"), token("spacing.md")],
                }}
              >
                <Text field="email" style={{ fontWeight: 700 }}>{v.email}</Text>
              </Column>
              <Button
                field="verifyLink"
                href={v.verifyLink}
                style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
              >
                Confirm my email address
              </Button>
              <Column style={{ gap: token("spacing.xs") }}>
                <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Or paste this link into your browser:</Text>
                <Text style={{ fontSize: token("fontSizes.small") }}>{written(v.verifyLink)}</Text>
              </Column>
              {v.expiry && (
                <Text field="expiry.expires" style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                  The link works once, and expires in {duration(v.expiry.expires, v.expiry.unit)}.
                </Text>
              )}
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                Didn't sign up for {brand.name}? You can ignore this email, and no account will be made.
              </Text>
            </Column>
          </Column>
          <Column style={{ gap: token("spacing.xs") }}>
            <Text style={small}>
              {brand.name}
              {brand.address && ` · ${brand.address}`}
            </Text>
            <Text style={small}>
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

export default verifyEmail(brand);
