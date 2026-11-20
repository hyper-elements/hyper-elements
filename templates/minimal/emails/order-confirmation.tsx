import { Column, Email, Heading, Image, LineBreak, Link, Row, Span, Table, TableCell, TableRow, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Order confirmation",
  description: "An order confirmed: its number and date, the items with the total, and where it's going",
};

export default function MinimalOrderConfirmation({ brand }: { brand: Brand }) {
  return (
    <Email
      width={560}
      title={`Your ${brand.name} order 10482`}
      previewText="Order 10482 is confirmed: $66.00. We'll email you when it ships."
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
              Order confirmed
            </Text>
            <Heading level={1} style={{ color: token("colors.primaryForeground") }}>Thanks for your order, Ada</Heading>
          </Column>
          <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
            <Text>We've got it, and we'll email you again when it ships.</Text>
            <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
              <Column>
                <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Order</Text>
                <Text style={{ fontWeight: 700 }}>10482</Text>
              </Column>
              <Column>
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    color: token("colors.muted"),
                    textAlign: "right",
                  }}
                >
                  Placed on
                </Text>
                <Text style={{ fontWeight: 700, textAlign: "right" }}>March 9</Text>
              </Column>
            </Row>
            <Table>
              <TableRow>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                  }}
                >
                  Field notebook, dot grid
                  <LineBreak />
                  <Span style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Quantity 2</Span>
                </TableCell>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                    textAlign: "right",
                    width: 110,
                  }}
                >
                  $28.00
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                  }}
                >
                  Brass pen
                  <LineBreak />
                  <Span style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Quantity 1</Span>
                </TableCell>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                    textAlign: "right",
                    width: 110,
                  }}
                >
                  $38.00
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={{ padding: [token("spacing.sm"), 0], fontWeight: 700 }}>Total</TableCell>
                <TableCell
                  style={{ padding: [token("spacing.sm"), 0], fontWeight: 700, textAlign: "right", width: 110 }}
                >
                  $66.00
                </TableCell>
              </TableRow>
            </Table>
            <Column
              style={{
                backgroundColor: token("colors.surface"),
                borderRadius: token("radii.sm"),
                padding: token("spacing.md"),
                gap: 2,
              }}
            >
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Shipping to</Text>
              <Text style={{ fontWeight: 700 }}>Ada Park</Text>
              <Text>48 Harbor Road</Text>
              <Text>Portland, OR 97209</Text>
            </Column>
            <Text style={{ color: token("colors.muted") }}>
              {"Need to change something? Reply within the hour, or see "}
              <Link href={`${brand.links.site}/orders/10482`}>order 10482</Link>
              .
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
