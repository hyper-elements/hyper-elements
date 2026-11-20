import { Column, Document, Heading, Image, Link, PageFooter, PageNumber, Row, Table, TableCell, TableRow, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Invoice",
  category: "invoice",
  description: "An invoice as a PDF: the letterhead, who it's billed to, the lines with their sums, the total due, and page numbers",
};

export default function Invoice({ brand }: { brand: Brand }) {
  return (
    <Document
      size="A4"
      margin={[56, 64, 64, 64]}
      title={`Invoice INV-0417, ${brand.name}`}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ fontSize: 12, lineHeight: token("lineHeights.body") }}
    >
      <Document.Page style={{ gap: token("spacing.xl") }}>
        <Column style={{ height: 6, backgroundColor: token("colors.primary"), borderRadius: 3 }} />
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
        <Heading level={1}>Invoice INV-0417</Heading>
        <Row style={{ alignItems: "start", gap: token("spacing.lg") }}>
          <Column style={{ gap: 2 }}>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Billed to</Text>
            <Text style={{ fontWeight: 700 }}>Northwind Traders</Text>
            <Text>48 Harbor Road</Text>
            <Text>Portland, OR 97209</Text>
          </Column>
          <Row style={{ gap: token("spacing.lg") }}>
            <Column style={{ gap: 2 }}>
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Issued</Text>
              <Text style={{ fontWeight: 700 }}>March 1</Text>
            </Column>
            <Column style={{ gap: 2 }}>
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Due</Text>
              <Text style={{ fontWeight: 700 }}>March 31</Text>
            </Column>
          </Row>
        </Row>
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
              Description
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
                fontSize: token("fontSizes.small"),
                color: token("colors.muted"),
                width: 60,
              }}
            >
              Qty
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
                fontSize: token("fontSizes.small"),
                color: token("colors.muted"),
                width: 100,
              }}
            >
              Unit price
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
                fontSize: token("fontSizes.small"),
                color: token("colors.muted"),
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
              Team plan, March
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              12
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $29.00
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $348.00
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
              }}
            >
              Extra workspaces
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              2
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $15.00
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $30.00
            </TableCell>
          </TableRow>
        </Table>
        <Row style={{ gap: token("spacing.lg"), alignItems: "start" }}>
          <Column style={{ gap: token("spacing.xs") }}>
            <Text style={{ fontWeight: 700 }}>How to pay</Text>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
              {"Pay online at "}
              <Link href={`${brand.links.site}/billing/INV-0417`}>
                {new URL(brand.links.site).host}/billing/INV-0417
              </Link>
              , or by bank transfer quoting INV-0417.
            </Text>
          </Column>
          <Column
            style={{
              width: 240,
              backgroundColor: token("colors.surface"),
              borderRadius: token("radii.sm"),
              padding: token("spacing.lg"),
              gap: 2,
            }}
          >
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Amount due</Text>
            <Text style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: token("colors.primary") }}>
              $378.00
            </Text>
            <Text style={{ fontWeight: 700 }}>by March 31</Text>
          </Column>
        </Row>
      </Document.Page>
      <PageFooter>
        <Text
          style={{
            fontSize: token("fontSizes.small"),
            color: token("colors.muted"),
            padding: [token("spacing.sm"), 0, 0],
            border: { top: { width: 1, style: "solid", color: token("colors.border") } },
          }}
        >
          {brand.name}, {brand.address}{". Page "}
          <PageNumber />
          {" of "}
          <PageNumber total={true} />
        </Text>
      </PageFooter>
    </Document>
  );
}
