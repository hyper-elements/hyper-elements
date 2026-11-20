import { Button, Column, Email, Heading, Image, Link, Row, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Shipping",
  description: "An order on its way: when it should arrive, who's carrying it, a button to track it, and what's in the box",
};

export default function MinimalShipping({ brand }: { brand: Brand }) {
  return (
    <Email
      width={560}
      title={`Your ${brand.name} order 10482 is on its way`}
      previewText="It should arrive by March 13, with Parcel Post."
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
              On its way
            </Text>
            <Heading level={1} style={{ color: token("colors.primaryForeground") }}>Your order has shipped</Heading>
          </Column>
          <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
            <Column
              style={{
                backgroundColor: token("colors.surface"),
                borderRadius: token("radii.sm"),
                padding: token("spacing.lg"),
                gap: 2,
              }}
            >
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Arrives by</Text>
              <Text style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25 }}>March 13</Text>
              <Text style={{ color: token("colors.muted") }}>With Parcel Post, order 10482</Text>
            </Column>
            <Button
              href={`${brand.links.site}/orders/10482/track`}
              style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
            >
              Track your parcel
            </Button>
            <Column style={{ gap: token("spacing.xs"), padding: [token("spacing.sm"), 0, 0] }}>
              <Text style={{ fontWeight: 700 }}>In the box</Text>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                <Column>
                  <Text>Field notebook, dot grid</Text>
                </Column>
                <Column style={{ width: 60 }}>
                  <Text style={{ color: token("colors.muted"), textAlign: "right" }}>× 2</Text>
                </Column>
              </Row>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                <Column>
                  <Text>Brass pen</Text>
                </Column>
                <Column style={{ width: 60 }}>
                  <Text style={{ color: token("colors.muted"), textAlign: "right" }}>× 1</Text>
                </Column>
              </Row>
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
