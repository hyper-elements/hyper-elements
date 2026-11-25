/**
 * A magic link that signs the reader in. Everything but the link and how long it works is locked: the logo, the words
 * around the button, the note for a reader who didn't ask, and the footer (the company's address and its links). It's
 * made from a brand (`magicLink(brand)`), which sets its colors, fonts, logo and company details, and the domains its
 * links may go to.
 */
import { Button, Column, Divider, Email, Heading, Image, Link, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

const fields = {
  signInLink: prop.link({ label: "Sign-in link", required: true, guidance: "The one-time link that signs the reader in" }),
  expires: prop.number({ label: "Works for", required: true, min: 1, max: 60, integer: true, guidance: "How long the link works, in the unit below: 15" }),
  unit: prop.choice(["minutes", "hours", "days"], { label: "Unit", required: true, guidance: "The unit of how long the link works: minutes" }),
};

/** How long something works, as a reader says it: "10 minutes", "1 hour". */
const duration = (n: number, unit: "minutes" | "hours" | "days") => `${n} ${n === 1 ? unit.slice(0, -1) : unit}`;
/** A link's address, written out for a reader to paste. */
const written = (link: string | { href: string }) => (typeof link === "string" ? link : link.href);

export function magicLink(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" } as const;
  return template({
    id: "emails.MagicLink",
    version: "1.0.0",
    label: "Magic link",
    description: "A one-time link that signs the reader in, how long it works, and a note for when they didn't ask",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      signInLink: `${brand.links.site}/login/0a1b2c`,
      expires: 15,
      unit: "minutes",
    },
    render: (v) => (
      <Email
        width={560}
        title={`Sign in to ${brand.name}`}
        previewText={`Your sign-in link works for ${duration(v.expires, v.unit)}.`}
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
            <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
              <Column style={{ gap: token("spacing.md"), alignItems: "center", textAlign: "center" }}>
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: token("colors.primary"),
                  }}
                >
                  Sign in
                </Text>
                <Heading level={1}>Sign in to {brand.name}</Heading>
                <Text>Use this link on the device where you asked for it. No password needed.</Text>
                <Button
                  field="signInLink"
                  href={v.signInLink}
                  style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.xl")] }}
                >
                  Sign in to {brand.name}
                </Button>
                <Column style={{ gap: token("spacing.xs") }}>
                  <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Or paste this link into your browser:</Text>
                  <Text style={{ fontSize: token("fontSizes.small") }}>{written(v.signInLink)}</Text>
                </Column>
                <Text field="expires" style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                  It works once, for the next {duration(v.expires, v.unit)}.
                </Text>
                <Divider />
                <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                  Didn't ask to sign in? Someone may have typed your address by mistake. Nobody can get in without this link.
                </Text>
              </Column>
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

export default magicLink(brand);
