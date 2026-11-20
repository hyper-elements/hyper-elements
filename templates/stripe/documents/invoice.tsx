import { Column, Document, Heading, Image, LineBreak, Link, PageFooter, PageNumber, Row, Span, Table, TableCell, TableRow, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Invoice",
  description: "An invoice as Stripe's PDFs lay it out: the title and logo, its numbers and dates, from and bill to, the amount due with a link to pay, the lines, the totals, and a footer on every page",
  recreates: { what: "Invoice PDF", original: "https://docs.stripe.com/invoicing/customize" },
};

const LINES = [
  { description: "Growth plan", period: "Mar 1 – Mar 31", qty: "1", unit: "$299.00", amount: "$299.00" },
  { description: "Additional seats", period: "Mar 1 – Mar 31", qty: "4", unit: "$15.00", amount: "$60.00" },
  { description: "Usage: API calls over plan", period: "Billed in arrears", qty: "1,900", unit: "$0.01", amount: "$19.00" },
];

export default function StripeInvoice({ brand }: { brand: Brand }) {
  const host = new URL(brand.links.site).host.replace(/^www\./, "");
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const head = { padding: [token("spacing.sm"), 0], fontSize: token("fontSizes.small"), color: token("colors.muted"), border: { bottom: { width: 1, style: "solid", color: token("colors.foreground") } } } as const;
  const cell = { padding: [token("spacing.sm"), 0], border: { bottom: { width: 1, style: "solid", color: token("colors.border") } } } as const;
  const sum = (label: string, value: string, strong = false) => (
    <Row stackOnMobile={false} style={{ padding: [token("spacing.xs"), 0], border: { bottom: { width: 1, style: "solid", color: token("colors.border") } } }}>
      <Text style={{ flex: 1, ...(strong ? { fontWeight: 700 } : {}) }}>{label}</Text>
      <Text style={{ width: 110, textAlign: "right", ...(strong ? { fontWeight: 700 } : {}) }}>{value}</Text>
    </Row>
  );
  return (
    <Document
      size="Letter"
      margin={[48, 56, 64, 56]}
      title={`Invoice A1B2C3D4-0017, ${brand.name}`}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ fontSize: 12, lineHeight: token("lineHeights.body"), color: token("colors.foreground") }}
    >
      <Document.Page style={{ gap: token("spacing.xl") }}>
        <Row stackOnMobile={false} style={{ alignItems: "start" }}>
          <Heading level={1} style={{ flex: 1 }}>Invoice</Heading>
          <Image
            src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
            alt={brand.logo.alt}
            style={{ width: Math.min(140, Math.round((32 * brand.logo.width) / brand.logo.height)) }}
          />
        </Row>
        <Column style={{ gap: 2 }}>
          {[
            ["Invoice number", "A1B2C3D4-0017"],
            ["Date of issue", "March 1"],
            ["Date due", "March 31"],
          ].map(([label, value]) => (
            <Row stackOnMobile={false}>
              <Text style={{ width: 120, fontWeight: 700 }}>{label}</Text>
              <Text>{value}</Text>
            </Row>
          ))}
        </Column>
        <Row stackOnMobile={false} style={{ gap: token("spacing.lg"), alignItems: "start" }}>
          <Column style={{ gap: 2 }}>
            <Text style={{ fontWeight: 700 }}>{brand.name}</Text>
            {brand.address ? <Text>{brand.address}</Text> : null}
            <Text>billing@{host}</Text>
          </Column>
          <Column style={{ gap: 2 }}>
            <Text style={{ fontWeight: 700 }}>Bill to</Text>
            <Text>Northwind Traders</Text>
            <Text>48 Harbor Road</Text>
            <Text>Portland, OR 97209</Text>
            <Text>ap@northwind.example</Text>
          </Column>
        </Row>
        <Column style={{ gap: token("spacing.sm") }}>
          <Heading level={2}>$378.00 USD due March 31</Heading>
          <Text>
            <Link href={`${brand.links.site}/invoices/pay/A1B2C3D4-0017`} style={{ color: token("colors.primary"), textDecoration: "underline" }}>
              Pay online
            </Link>
          </Text>
        </Column>
        <Table>
          <TableRow header={true}>
            <TableCell style={head}>Description</TableCell>
            <TableCell style={{ ...head, width: 70, textAlign: "right" }}>Qty</TableCell>
            <TableCell style={{ ...head, width: 90, textAlign: "right" }}>Unit price</TableCell>
            <TableCell style={{ ...head, width: 100, textAlign: "right" }}>Amount</TableCell>
          </TableRow>
          {LINES.map((line) => (
            <TableRow>
              <TableCell style={cell}>
                {line.description}
                <LineBreak />
                <Span style={small}>{line.period}</Span>
              </TableCell>
              <TableCell style={{ ...cell, textAlign: "right" }}>{line.qty}</TableCell>
              <TableCell style={{ ...cell, textAlign: "right" }}>{line.unit}</TableCell>
              <TableCell style={{ ...cell, textAlign: "right" }}>{line.amount}</TableCell>
            </TableRow>
          ))}
        </Table>
        <Row stackOnMobile={false}>
          <Column />
          <Column style={{ width: 280 }}>
            {sum("Subtotal", "$378.00")}
            {sum("Total", "$378.00")}
            {sum("Amount due", "$378.00 USD", true)}
          </Column>
        </Row>
      </Document.Page>
      <PageFooter>
        <Text style={{ ...small, padding: [token("spacing.sm"), 0, 0], border: { top: { width: 1, style: "solid", color: token("colors.border") } } }}>
          {"A1B2C3D4-0017 · $378.00 USD due March 31 · Page "}
          <PageNumber />
          {" of "}
          <PageNumber total={true} />
        </Text>
      </PageFooter>
    </Document>
  );
}
