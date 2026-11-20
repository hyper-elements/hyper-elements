import { Column, Email, Heading, Image, Link, Row, Table, TableCell, TableRow, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Receipt",
  category: "receipt",
  description: "A payment receipt that leads with the amount paid, then the items, the total, and how it was paid",
};

export default function Receipt({ brand }: { brand: Brand }) {
  return (
    <Email
      width={560}
      title={`Your ${brand.name} receipt`}
      previewText="$48.00 paid on March 4. Thanks."
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
            <Column
              style={{
                gap: token("spacing.xs"),
                alignItems: "center",
                textAlign: "center",
                padding: [0, 0, token("spacing.sm")],
              }}
            >
              <Text
                style={{
                  fontSize: token("fontSizes.small"),
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: token("colors.primary"),
                }}
              >
                Payment received
              </Text>
              <Heading level={1}>$48.00</Heading>
              <Text style={{ color: token("colors.muted") }}>Paid on March 4 with Visa ending 4242</Text>
            </Column>
            <Table>
              <TableRow header={true}>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                    fontSize: token("fontSizes.small"),
                    color: token("colors.muted"),
                  }}
                >
                  Item
                </TableCell>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                    fontSize: token("fontSizes.small"),
                    color: token("colors.muted"),
                    textAlign: "right",
                    width: 110,
                  }}
                >
                  Amount
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                  }}
                >
                  Pro plan, monthly
                </TableCell>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                    textAlign: "right",
                    width: 110,
                  }}
                >
                  $24.00
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                  }}
                >
                  Extra seats × 3
                </TableCell>
                <TableCell
                  style={{
                    padding: [token("spacing.sm"), 0],
                    border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                    textAlign: "right",
                    width: 110,
                  }}
                >
                  $24.00
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={{ padding: [token("spacing.sm"), 0], fontWeight: 700 }}>Total paid</TableCell>
                <TableCell
                  style={{ padding: [token("spacing.sm"), 0], fontWeight: 700, textAlign: "right", width: 110 }}
                >
                  $48.00
                </TableCell>
              </TableRow>
            </Table>
            <Row
              stackOnMobile={false}
              style={{
                backgroundColor: token("colors.surface"),
                borderRadius: token("radii.sm"),
                padding: token("spacing.md"),
                gap: token("spacing.md"),
              }}
            >
              <Column>
                <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Receipt number</Text>
                <Text style={{ fontWeight: 700 }}>R-20418</Text>
              </Column>
              <Column>
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    color: token("colors.muted"),
                    textAlign: "right",
                  }}
                >
                  Date paid
                </Text>
                <Text style={{ fontWeight: 700, textAlign: "right" }}>March 4</Text>
              </Column>
            </Row>
            <Text style={{ color: token("colors.muted") }}>
              Keep this email for your records. To ask about a charge, reply to it.
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
