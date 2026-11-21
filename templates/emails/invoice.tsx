import { Button, Column, Divider, Email, Heading, Image, Link, Row, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Invoice email",
  description: "The email that sends an invoice: the amount due, the due date, the lines, and a button to pay online",
};

export default function Invoice({ brand }: { brand: Brand }) {
  return (
    <Email
      width={600}
      title={`Invoice INV-0417 from ${brand.name}`}
      previewText="$378.00 due March 31"
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
    >
      <Column style={{ padding: token("spacing.xl"), gap: token("spacing.lg") }}>
        <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
          <Column>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: 150 }}
            />
          </Column>
          <Column>
            <Text
              style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "right" }}
            >
              {brand.name} · {brand.address}
            </Text>
          </Column>
        </Row>
        <Column style={{ gap: token("spacing.sm") }}>
          <Heading level={1}>Invoice INV-0417</Heading>
          <Text>Hello Northwind Traders, here's your invoice from {brand.name}. The PDF is attached.</Text>
        </Column>
        <Column
          style={{
            backgroundColor: token("colors.surface"),
            padding: token("spacing.lg"),
            gap: token("spacing.md"),
            borderRadius: token("radii.sm"),
          }}
        >
          <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "end" }}>
            <Column style={{ gap: 2 }}>
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Amount due</Text>
              <Text style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: token("colors.primary") }}>
                $378.00
              </Text>
            </Column>
            <Column style={{ gap: 2 }}>
              <Text
                style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "right" }}
              >
                Due
              </Text>
              <Text style={{ fontWeight: 700, textAlign: "right" }}>March 31</Text>
            </Column>
          </Row>
          <Divider />
          <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
            <Column>
              <Text>Team plan, March × 12</Text>
            </Column>
            <Column style={{ width: 120 }}>
              <Text style={{ textAlign: "right" }}>$348.00</Text>
            </Column>
          </Row>
          <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
            <Column>
              <Text>Extra workspaces × 2</Text>
            </Column>
            <Column style={{ width: 120 }}>
              <Text style={{ textAlign: "right" }}>$30.00</Text>
            </Column>
          </Row>
        </Column>
        <Button
          href={`${brand.links.site}/billing/INV-0417`}
          style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
        >
          Pay $378.00 online
        </Button>
        <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
          {"Questions about this invoice? "}
          <Link href={`${brand.links.site}/billing`}>Visit {brand.name} billing</Link>
        </Text>
      </Column>
    </Email>
  );
}
