import { Column, Document, Heading, Image, PageFooter, PageNumber, Row, Table, TableCell, TableRow, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Quote",
  category: "quote",
  description: "A quote as a PDF: who it's for, the work with its prices, the estimated total, how long it holds, and lines to sign it",
};

export default function Quote({ brand }: { brand: Brand }) {
  return (
    <Document
      size="A4"
      margin={[56, 64, 64, 64]}
      title={`Quote Q-0213, ${brand.name}`}
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
        <Heading level={1}>Quote Q-0213</Heading>
        <Row style={{ alignItems: "start", gap: token("spacing.lg") }}>
          <Column style={{ gap: 2 }}>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Prepared for</Text>
            <Text style={{ fontWeight: 700 }}>Northwind Traders</Text>
            <Text>48 Harbor Road</Text>
            <Text>Portland, OR 97209</Text>
          </Column>
          <Row style={{ gap: token("spacing.lg") }}>
            <Column style={{ gap: 2 }}>
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Issued</Text>
              <Text style={{ fontWeight: 700 }}>April 2</Text>
            </Column>
            <Column style={{ gap: 2 }}>
              <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Valid until</Text>
              <Text style={{ fontWeight: 700 }}>May 2</Text>
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
              Design system audit
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              1
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $4,800.00
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $4,800.00
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
              }}
            >
              Workshop day, on site
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
              $1,600.00
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $3,200.00
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
              }}
            >
              Component library setup
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              1
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $6,200.00
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $6,200.00
            </TableCell>
          </TableRow>
        </Table>
        <Row style={{ gap: token("spacing.lg"), alignItems: "start" }}>
          <Column style={{ gap: token("spacing.xs") }}>
            <Text style={{ fontWeight: 700 }}>To go ahead</Text>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
              Sign below and send it back before May 2. Prices hold until then; we'll invoice when the work starts.
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
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Estimated total</Text>
            <Text style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: token("colors.primary") }}>
              $14,200.00
            </Text>
          </Column>
        </Row>
        <Row style={{ gap: token("spacing.xl") }}>
          <Column style={{ gap: 4, padding: [token("spacing.xl"), 0, 0] }}>
            <Column
              style={{ border: { top: { width: 1, style: "solid", color: token("colors.foreground") } } }}
            />
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
              Accepted for Northwind Traders
            </Text>
          </Column>
          <Column style={{ gap: 4, padding: [token("spacing.xl"), 0, 0] }}>
            <Column
              style={{ border: { top: { width: 1, style: "solid", color: token("colors.foreground") } } }}
            />
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Date</Text>
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
