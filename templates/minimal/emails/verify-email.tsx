import { Button, Column, Email, Heading, Image, Link, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Verify email",
  description: "One step before the account is ready: confirm the email address it was made with",
};

export default function MinimalVerifyEmail({ brand }: { brand: Brand }) {
  return (
    <Email
      width={560}
      title={`Confirm your email for ${brand.name}`}
      previewText="One step left: confirm ada@example.com is yours."
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
              <Text style={{ fontWeight: 700 }}>ada@example.com</Text>
            </Column>
            <Button
              href={`${brand.links.site}/verify/a41c9e`}
              style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
            >
              Confirm my email address
            </Button>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
              Didn't sign up for {brand.name}? You can ignore this email, and no account will be made.
            </Text>
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
