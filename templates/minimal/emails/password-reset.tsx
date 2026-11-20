import { Button, Column, Divider, Email, Heading, Image, Link, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Password reset",
  description: "A link to choose a new password, how long it works, and what to do if the reader didn't ask",
};

export default function MinimalPasswordReset({ brand }: { brand: Brand }) {
  return (
    <Email
      width={560}
      title={`Reset your ${brand.name} password`}
      previewText="Choose a new password. The link expires in 1 hour."
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
                Password reset
              </Text>
              <Heading level={1}>Choose a new password</Heading>
              <Text>
                Someone asked to reset the password for your {brand.name} account. If it was you, choose a new one here.
              </Text>
              <Button
                href={`${brand.links.site}/reset/7d9f2c`}
                style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
              >
                Choose a new password
              </Button>
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                The link works once, and expires in 1 hour.
              </Text>
              <Divider />
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                Didn't ask? Your password hasn't changed, and you can ignore this email.
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
