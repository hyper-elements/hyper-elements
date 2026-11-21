import { Button, Column, Divider, Email, Heading, Image, Link, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Magic link",
  description: "A one-time link that signs the reader in, how long it works, and a note for when they didn't ask",
};

export default function MagicLink({ brand }: { brand: Brand }) {
  return (
    <Email
      width={560}
      title={`Sign in to ${brand.name}`}
      previewText="Your sign-in link works for 15 minutes."
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
                href={`${brand.links.site}/login/3be8f1`}
                style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.xl")] }}
              >
                Sign in to {brand.name}
              </Button>
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                It works once, for the next 15 minutes.
              </Text>
              <Divider />
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                Didn't ask to sign in? Someone may have typed your address by mistake. Nobody can get in without this link.
              </Text>
            </Column>
          </Column>
        </Column>
        <Column style={{ gap: token("spacing.xs") }}>
          <Text
            style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}
          >
            {brand.name} · {brand.address}
          </Text>
          <Text
            style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}
          >
            <Link href={`${brand.links.site}/`}>Visit {brand.name}</Link>
            {" · "}
            <Link href={`${brand.links.site}/help`}>Get help from {brand.name}</Link>
          </Text>
        </Column>
      </Column>
    </Email>
  );
}
