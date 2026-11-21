import { Column, Document, Heading, Image, PageFooter, PageNumber, Row, Table, TableCell, TableRow, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Receipt",
  description: "A receipt as a PDF: paid in full, with the items, the total, the date and how it was paid",
};

export default function Receipt({ brand }: { brand: Brand }) {
  return (
    <Document
      size="A4"
      margin={[56, 64, 64, 64]}
      title={`Receipt R-20418, ${brand.name}`}
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
        <Row style={{ alignItems: "end", gap: token("spacing.lg") }}>
          <Heading level={1}>Receipt R-20418</Heading>
          <Column style={{ alignItems: "end" }}>
            <Column
              style={{
                backgroundColor: token("colors.primary"),
                borderRadius: token("radii.sm"),
                padding: [6, 14],
              }}
            >
              <Text
                style={{
                  color: token("colors.primaryForeground"),
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Paid in full
              </Text>
            </Column>
          </Column>
        </Row>
        <Row style={{ gap: token("spacing.lg") }}>
          <Column style={{ gap: 2 }}>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Paid by</Text>
            <Text style={{ fontWeight: 700 }}>Northwind Traders</Text>
          </Column>
          <Column style={{ gap: 2 }}>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Date paid</Text>
            <Text style={{ fontWeight: 700 }}>March 4</Text>
          </Column>
          <Column style={{ gap: 2 }}>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Paid with</Text>
            <Text style={{ fontWeight: 700 }}>Visa ending 4242</Text>
          </Column>
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
              Pro plan, monthly
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
              $24.00
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
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
              Extra seats
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              3
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $8.00
            </TableCell>
            <TableCell
              style={{
                padding: [token("spacing.sm"), 0],
                border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                textAlign: "right",
              }}
            >
              $24.00
            </TableCell>
          </TableRow>
        </Table>
        <Row style={{ gap: token("spacing.lg"), alignItems: "start" }}>
          <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
            Thank you. Keep this receipt for your records; nothing more is owed.
          </Text>
          <Column
            style={{
              width: 240,
              backgroundColor: token("colors.surface"),
              borderRadius: token("radii.sm"),
              padding: token("spacing.lg"),
              gap: 2,
            }}
          >
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>Total paid</Text>
            <Text style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>$48.00</Text>
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
