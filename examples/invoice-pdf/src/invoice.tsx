import {
  Column,
  Document,
  Heading,
  Link,
  PageFooter,
  PageNumber,
  Row,
  Table,
  TableCell,
  TableRow,
  Text,
} from "@hyper-elements/react";

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface LineItem {
  description: string;
  /** Number of units. */
  quantity: number;
  /** Price per unit in the invoice currency. */
  unitPrice: number;
}

export interface TaxLine {
  /** e.g. "Sales tax (8.25%)" */
  label: string;
  amount: number;
}

export interface InvoiceData {
  number: string;
  /** Company issuing the invoice. */
  from: { name: string; address: string; taxId?: string };
  /** Customer being billed. */
  to: { name: string; address: string[]; taxId?: string };
  poNumber?: string;
  /** Display string — no year, e.g. "March 1". */
  issued: string;
  /** Display string — no year, e.g. "March 31". */
  due: string;
  /** When set the invoice shows a "Paid" badge and omits the payment link. */
  paidOn?: string;
  lines: LineItem[];
  taxes?: TaxLine[];
  note?: string;
  /** URL of the online payment page. Required when the invoice is not yet paid. */
  payLink?: string;
  currency?: string;
  lang?: string;
}

export const sampleInvoice: InvoiceData = {
  number: "INV-0417",
  from: {
    name: "Orbit Studio LLC",
    address: "340 Pine Street, Suite 800, San Francisco, CA 94104",
    taxId: "EIN 94-1234567",
  },
  to: {
    name: "Northwind Traders",
    address: ["48 Harbor Road", "Portland, OR 97209"],
  },
  poNumber: "PO-77310",
  issued: "March 1",
  due: "March 31",
  lines: [
    { description: "Team plan, March", quantity: 12, unitPrice: 29 },
    { description: "Extra workspaces (2 seats)", quantity: 2, unitPrice: 15 },
    { description: "Priority support add-on", quantity: 1, unitPrice: 49 },
  ],
  taxes: [{ label: "Sales tax (8.25%)", amount: 36.98 }],
  note: "Thank you for your business. Payments are accepted via bank transfer or online.",
  payLink: "https://orbit.example/billing/INV-0417",
  currency: "USD",
  lang: "en",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round = (n: number) => Math.round(n * 100) / 100;

function money(amount: number, currency = "USD", lang = "en"): string {
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency,
  }).format(amount);
}

function fmt(n: number, lang = "en"): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(n);
}

// Status badge colors
const STATUS = {
  paid: { bg: "#dcfce7", color: "#166534", label: "Paid" },
  due: { bg: "#dbeafe", color: "#1e40af", label: "Due" },
  overdue: { bg: "#fee2e2", color: "#991b1b", label: "Overdue" },
} as const;

type Status = keyof typeof STATUS;

// ---------------------------------------------------------------------------
// Design
// ---------------------------------------------------------------------------

/**
 * Returns a `<Document size="A4">` invoice design.
 *
 * Pass the result directly to `render()`:
 *
 * ```ts
 * import { render } from "@hyper-elements/react";
 * import { invoiceDocument, sampleInvoice } from "./invoice";
 *
 * const { html } = await render(invoiceDocument(sampleInvoice));
 * ```
 *
 * The same `InvoiceData` can also drive an email or a web page by swapping
 * `<Document>` for `<Email>` or `<Page>` as the root.
 */
export function invoiceDocument(data: InvoiceData) {
  const cur = data.currency ?? "USD";
  const lang = data.lang ?? "en";
  const m = (n: number) => money(n, cur, lang);

  const amounts = data.lines.map((l) => round(l.quantity * l.unitPrice));
  const subtotal = round(amounts.reduce((a, b) => a + b, 0));
  const taxTotal = round((data.taxes ?? []).reduce((a, t) => a + t.amount, 0));
  const total = round(subtotal + taxTotal);

  const status: Status = data.paidOn ? "paid" : "due";
  const badge = STATUS[status];

  // Shared styles
  const muted = { fontSize: 11, color: "#6b7280" } as const;
  const cell = {
    padding: [8, 0] as [number, number],
    border: { bottom: { width: 1, style: "solid" as const, color: "#e5e7eb" } },
  };
  const headCell = {
    ...cell,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 600,
  } as const;

  return (
    <Document
      size="A4"
      margin={[56, 64, 64, 64]}
      title={`Invoice ${data.number} · ${data.from.name}`}
      lang={lang}
      style={{ fontFamily: "Inter, Arial, sans-serif", fontSize: 12, lineHeight: 1.5, color: "#111827" }}
    >
      <Document.Page style={{ gap: 24 }}>
        {/* ── Accent bar ─────────────────────────────────────────── */}
        <Column style={{ height: 4, backgroundColor: "#0879a1", borderRadius: 2 }} />

        {/* ── Letterhead ──────────────────────────────────────────── */}
        <Row stackOnMobile={false} style={{ alignItems: "start", gap: 16 }}>
          <Column style={{ gap: 2 }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: "#0879a1" }}>
              {data.from.name}
            </Text>
            <Text style={muted}>{data.from.address}</Text>
            {data.from.taxId && <Text style={muted}>{data.from.taxId}</Text>}
          </Column>
          <Column style={{ gap: 2 }}>
            {/* Status badge */}
            <Row stackOnMobile={false} style={{ justifyContent: "flex-end" }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: badge.color,
                  backgroundColor: badge.bg,
                  padding: [4, 10],
                  borderRadius: 4,
                }}
              >
                {badge.label}
                {data.paidOn ? ` · ${data.paidOn}` : ""}
              </Text>
            </Row>
          </Column>
        </Row>

        {/* ── Invoice heading ─────────────────────────────────────── */}
        <Heading level={1} style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
          Invoice {data.number}
        </Heading>

        {/* ── Billed-to + dates ───────────────────────────────────── */}
        <Row style={{ gap: 32, alignItems: "start" }}>
          <Column style={{ gap: 2 }}>
            <Text style={{ ...muted, fontWeight: 600 }}>Billed to</Text>
            <Text style={{ fontWeight: 600 }}>{data.to.name}</Text>
            {data.to.address.map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
            {data.to.taxId && <Text style={muted}>{data.to.taxId}</Text>}
          </Column>
          <Column style={{ gap: 12 }}>
            <Row style={{ gap: 32 }}>
              <Column style={{ gap: 2 }}>
                <Text style={{ ...muted, fontWeight: 600 }}>Issued</Text>
                <Text style={{ fontWeight: 600 }}>{data.issued}</Text>
              </Column>
              <Column style={{ gap: 2 }}>
                <Text style={{ ...muted, fontWeight: 600 }}>Due</Text>
                <Text style={{ fontWeight: 600 }}>{data.due}</Text>
              </Column>
            </Row>
            {data.poNumber && (
              <Column style={{ gap: 2 }}>
                <Text style={{ ...muted, fontWeight: 600 }}>PO number</Text>
                <Text style={{ fontWeight: 600 }}>{data.poNumber}</Text>
              </Column>
            )}
          </Column>
        </Row>

        {/* ── Line items table ────────────────────────────────────── */}
        <Table>
          <TableRow header={true}>
            <TableCell style={headCell}>Description</TableCell>
            <TableCell style={{ ...headCell, textAlign: "right", width: 60 }}>Qty</TableCell>
            <TableCell style={{ ...headCell, textAlign: "right", width: 110 }}>Unit price</TableCell>
            <TableCell style={{ ...headCell, textAlign: "right", width: 120 }}>Amount</TableCell>
          </TableRow>
          {data.lines.map((line, i) => (
            <TableRow key={i}>
              <TableCell style={cell}>{line.description}</TableCell>
              <TableCell style={{ ...cell, textAlign: "right" }}>{fmt(line.quantity, lang)}</TableCell>
              <TableCell style={{ ...cell, textAlign: "right" }}>{m(line.unitPrice)}</TableCell>
              <TableCell style={{ ...cell, textAlign: "right" }}>{m(amounts[i]!)}</TableCell>
            </TableRow>
          ))}
        </Table>

        {/* ── Totals + payment ────────────────────────────────────── */}
        <Row style={{ gap: 32, alignItems: "start" }}>
          {/* How to pay */}
          <Column style={{ gap: 8 }}>
            {!data.paidOn && data.payLink && (
              <>
                <Text style={{ fontWeight: 700 }}>How to pay</Text>
                <Text style={muted}>
                  {"Pay online at "}
                  <Link href={data.payLink}>
                    {data.payLink.replace(/^https?:\/\//, "")}
                  </Link>
                  {", or by bank transfer quoting "}
                  {data.number}.
                </Text>
              </>
            )}
            {data.paidOn && (
              <Text style={muted}>
                Payment received on {data.paidOn}. Thank you.
              </Text>
            )}
            {data.note && <Text style={muted}>{data.note}</Text>}
          </Column>

          {/* Subtotal / tax / total */}
          <Column style={{ width: 280, gap: 0 }}>
            {/* Show subtotal row only when there are taxes */}
            {(data.taxes ?? []).length > 0 && (
              <>
                <Row
                  stackOnMobile={false}
                  style={{ padding: [6, 0], border: { bottom: { width: 1, style: "solid", color: "#e5e7eb" } } }}
                >
                  <Text style={{ flex: 1, ...muted }}>Subtotal</Text>
                  <Text style={{ textAlign: "right" }}>{m(subtotal)}</Text>
                </Row>
                {(data.taxes ?? []).map((tax, i) => (
                  <Row
                    key={i}
                    stackOnMobile={false}
                    style={{ padding: [6, 0], border: { bottom: { width: 1, style: "solid", color: "#e5e7eb" } } }}
                  >
                    <Text style={{ flex: 1, ...muted }}>{tax.label}</Text>
                    <Text style={{ textAlign: "right" }}>{m(tax.amount)}</Text>
                  </Row>
                ))}
              </>
            )}
            {/* Total box */}
            <Column
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 6,
                padding: 16,
                gap: 2,
              }}
            >
              <Text style={muted}>
                {data.paidOn ? "Total paid" : "Amount due"}
              </Text>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: "#0879a1",
                }}
              >
                {m(total)}
              </Text>
              {!data.paidOn && (
                <Text style={{ fontWeight: 600 }}>by {data.due}</Text>
              )}
            </Column>
          </Column>
        </Row>
      </Document.Page>

      {/* ── Footer (every page) ─────────────────────────────────── */}
      <PageFooter>
        <Text
          style={{
            ...muted,
            padding: [8, 0, 0],
            border: { top: { width: 1, style: "solid", color: "#e5e7eb" } },
          }}
        >
          {[data.from.name, data.from.taxId].filter(Boolean).join(" · ")}
          {"  ·  Page "}
          <PageNumber />
          {" of "}
          <PageNumber total={true} />
        </Text>
      </PageFooter>
    </Document>
  );
}
