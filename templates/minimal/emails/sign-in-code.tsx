import { Column, Divider, Email, Heading, Image, Link, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Sign-in code",
  description: "A one-time code, large and centered in a box of its own, with when it expires and what to do if it wasn't you",
};

export default function MinimalSignInCode({ brand }: { brand: Brand }) {
  return (
    <Email
      width={560}
      title={`Your ${brand.name} code`}
      previewText="Your code is 482-913. It expires in 10 minutes."
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
                Your {brand.name} code
              </Text>
              <Heading level={1}>Here's your code to sign in</Heading>
              <Text>Enter it in the window where you asked for it.</Text>
              <Column
                style={{
                  width: "100%",
                  backgroundColor: token("colors.surface"),
                  border: { width: 2, style: "dashed", color: token("colors.border") },
                  borderRadius: token("radii.md"),
                  padding: [token("spacing.lg"), token("spacing.md")],
                  gap: token("spacing.xs"),
                }}
              >
                <Text
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    letterSpacing: 6,
                    lineHeight: 1.2,
                    textAlign: "center",
                  }}
                >
                  482-913
                </Text>
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    color: token("colors.muted"),
                    textAlign: "center",
                  }}
                >
                  Expires in 10 minutes
                </Text>
              </Column>
              <Divider />
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                Didn't ask for a code? Someone may have typed your email address by mistake. You can ignore this email: nobody can sign in without the code.
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
