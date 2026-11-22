/**
 * An invoice as Stripe's PDFs lay it out. Its title and logo, who it's from (the brand's name, address and billing
 * address), its headings, the sums and the footer's shape are locked; a design fills the invoice's number, its dates,
 * who it's billed to, the link to pay it, its lines, and any discount and tax. The template adds the lines up, and puts
 * them on as many pages as they need: the first page has the numbers, who it's from and who it's billed to, the next
 * ones a short header, and the last one the sums. It's made from a brand (`stripeInvoice(brand)`), Stripe's by default,
 * which sets its colors, fonts, logo and company details, and the domains its links may go to.
 */
import { Column, Document, Heading, Image, LineBreak, Link, PageFooter, PageNumber, Row, Span, Table, TableCell, TableRow, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/stripe";

export const meta = {
  recreates: { company: "stripe", what: "invoice PDF", original: "https://docs.stripe.com/invoicing/customize" },
};

/** A month and day, with no year, so it reads the same any time. */
const date = (label: string, guidance: string) => prop.text({ label, required: true, pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,14}$", guidance });

/** Lines of the sums, none to three: each a label, and an amount in the brand's currency. */
const sumLines = (list: string, item: string, what: string, amount: string) =>
  prop.list(
    prop.object(
      {
        label: prop.text({ label: "Label", required: true, maxLength: 40, guidance: what }),
        amount: prop.number({ label: "Amount", required: true, min: 0, max: 10000000, guidance: amount }),
      },
      { label: item },
    ),
    { label: list, min: 0, max: 3 },
  );

const fields = {
  number: prop.text({ label: "Invoice number", required: true, pattern: "^[A-Z0-9][A-Z0-9-]{3,19}$", guidance: "Capital letters, digits and dashes: A1B2C3D4-0017" }),
  issued: date("Date of issue", "The day it's issued, with no year or weekday: March 1"),
  due: date("Date due", "The day it's due, with no year or weekday: March 31"),
  billTo: prop.object(
    {
      name: prop.text({ label: "Name", required: true, maxLength: 60 }),
      address: prop.list(prop.text({ label: "Address line", maxLength: 60 }), { label: "Address", min: 1, max: 5, guidance: "One to five lines, the country last where it's abroad" }),
      email: prop.text({ label: "Email", required: true, pattern: "^(?=[\\s\\S]{6,254}$)[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", guidance: "Where the invoice is sent: ap@northwind.example" }),
      taxId: prop.text({ label: "Tax ID", maxLength: 32, guidance: "Their tax or VAT number, with its kind: EU VAT DE123456789" }),
    },
    { label: "Bill to", required: true },
  ),
  payLink: prop.link({ label: "Payment link", required: true, guidance: "The invoice's page to pay it online" }),
  lines: prop.list(
    prop.object(
      {
        description: prop.text({ label: "Description", required: true, maxLength: 100 }),
        period: prop.text({ label: "Period", pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,32}$", guidance: "What it covers, with no year: Mar 1 – Mar 31, or Billed in arrears" }),
        quantity: prop.number({ label: "Quantity", required: true, min: 0, max: 1000000 }),
        unitPrice: prop.number({ label: "Unit price", required: true, min: -100000, max: 100000, guidance: "In the brand's currency, as a number: 299, or 0.01 for each API call" }),
      },
      { label: "Line" },
    ),
    { label: "Lines", required: true, min: 1, max: 30 },
  ),
  discounts: sumLines("Discounts", "Discount", "What it is, as Stripe names a coupon: Launch offer (20% off)", "What it takes off, in the brand's currency, as a positive number: 59.8"),
  taxes: sumLines("Tax", "Tax", "The tax and its rate: Sales tax (8.25%)", "In the brand's currency, as a number: 31.19"),
};

/** Text whose long runs (an email address's) can break: a soft hyphen every 20 characters of a run longer than 28. */
const breakable = (text: string) => text.replace(/\S{29,}/g, (run) => run.replace(/.{20}(?=.)/gu, "$&\u00ad"));

const round = (n: number) => Math.round(n * 100) / 100;
const sumOf = (ns: readonly number[]) => round(ns.reduce((a, b) => a + b, 0));

/** A character's width in Inter, in ems, by its kind: a little over, so text is never thought shorter than it is. */
const em = (ch: string) => (/[mwMW@%]/.test(ch) ? 0.95 : /[A-Z0-9#$&€£]/.test(ch) ? 0.7 : /[ijlrtfI.,;:'|!()[\] ]/.test(ch) ? 0.34 : 0.58);

/** How many lines a text takes at `size` px in a column `width` px wide, broken at its spaces and soft hyphens (an estimate). */
function linesOf(text: string, width: number, size: number): number {
  const space = 0.34 * size;
  let lines = 1;
  let x = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    word.split("\u00ad").forEach((piece, i) => {
      const gap = x > 0 && i === 0 ? space : 0;
      const w = [...piece].reduce((sum, ch) => sum + em(ch), 0) * size;
      if (x > 0 && x + gap + w > width) {
        lines += 1;
        x = 0;
      }
      if (x === 0 && w > width) {
        // A piece wider than the column breaks inside it.
        lines += Math.ceil(w / width) - 1;
        x = w - (Math.ceil(w / width) - 1) * width;
      } else x += (x > 0 ? gap : 0) + w;
    });
  }
  return lines;
}

// The page, in px: Letter inside its margins, and the table's columns.
const PAGE = { width: 704, height: 944 };
const COLUMNS = { quantity: 70, unitPrice: 100, amount: 120 };
const SUMS = 300;
const DESCRIPTION = PAGE.width - COLUMNS.quantity - COLUMNS.unitPrice - COLUMNS.amount;
const BODY = 12;

export function stripeInvoice(brand: Brand) {
  const host = new URL(brand.links.site).host.replace(/^www\./, "");
  const theme = brand.theme as unknown as { spacing: Record<string, number>; fontSizes: Record<string, number>; lineHeights: Record<string, number> };
  const { xs, sm, lg, xl } = theme.spacing as Record<"xs" | "sm" | "md" | "lg" | "xl", number>;
  const small = theme.fontSizes.small!;
  const leading = theme.lineHeights.body!;
  const line = (size: number) => size * leading;
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  const count = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { maximumFractionDigits: 2 }).format(n);
  // A heading's size and line height at a level, from the brand's theme.
  const level = (n: 1 | 2) => {
    const own = (brand.theme.elements?.Heading as { by?: { level?: Record<number, { fontSize?: number; lineHeight?: number }> } } | undefined)?.by?.level?.[n];
    const size = own?.fontSize ?? (n === 1 ? 40 : 32);
    return { size, line: size * (own?.lineHeight ?? theme.lineHeights.heading ?? 1.3) };
  };
  const logoWidth = Math.min(140, Math.round((32 * brand.logo.width) / brand.logo.height));
  const logoHeight = (width: number) => (width * brand.logo.height) / brand.logo.width;

  const muted = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const head = { padding: [token("spacing.sm"), 0], fontSize: token("fontSizes.small"), color: token("colors.muted"), border: { bottom: { width: 1, style: "solid", color: token("colors.foreground") } } } as const;
  const cell = { padding: [token("spacing.sm"), 0], border: { bottom: { width: 1, style: "solid", color: token("colors.border") } } } as const;
  const sum = (label: string, value: string, field?: string, strong = false, key?: number) => (
    <Row key={key} stackOnMobile={false} style={{ padding: [token("spacing.xs"), 0], gap: token("spacing.sm"), border: { bottom: { width: 1, style: "solid", color: token("colors.border") } } }}>
      <Text field={field} style={{ flex: 1, ...(strong ? { fontWeight: 700 } : {}) }}>{label}</Text>
      <Text style={{ width: COLUMNS.amount, textAlign: "right", ...(strong ? { fontWeight: 700 } : {}) }}>{value}</Text>
    </Row>
  );
  return template({
    id: "documents.StripeInvoice",
    version: "1.0.0",
    label: "Stripe invoice",
    description: "An invoice as Stripe's PDFs lay it out: the title and logo, its numbers and dates, from and bill to, the amount due with a link to pay, the lines, the totals, and a footer on every page",
    root: "Document",
    fields,
    rules: {
      require: { core: ["layout/overflow", "document/overflow"] },
      links: { domains: [...brand.links.domains, ...(brand.links.payments ?? [])] },
    },
    example: {
      number: "A1B2C3D4-0001",
      issued: "January 1",
      due: "January 31",
      billTo: { name: "Northwind Traders", address: ["48 Harbor Road", "Portland, OR 97209"], email: "ap@northwind.example" },
      payLink: `${brand.links.site}/invoices/pay/A1B2C3D4-0001`,
      lines: [{ description: "Growth plan", period: "Jan 1 – Jan 31", quantity: 1, unitPrice: 299 }],
    },
    render: (v) => {
      const amounts = v.lines.map((l) => round(l.quantity * l.unitPrice));
      const subtotal = sumOf(amounts);
      const total = sumOf([subtotal, ...v.discounts.map((d) => -d.amount), ...v.taxes.map((t) => t.amount)]);
      const amountDue = `${money(total)} ${brand.currency}`;

      // What each part of a page takes, in px, estimated from the brand's sizes (a little over, never under).
      const footer = line(small) + sm + 1;
      const room = PAGE.height - footer;
      const half = (PAGE.width - lg) / 2;
      const from = [brand.name, ...(brand.address ? [brand.address] : []), `billing@${host}`];
      const billTo = [v.billTo.name, ...v.billTo.address, breakable(v.billTo.email), ...(v.billTo.taxId ? [v.billTo.taxId] : [])];
      const block = (texts: string[]) => line(BODY) + texts.reduce((h, text) => h + 2 + linesOf(text, half, BODY) * line(BODY), 0);
      const first =
        Math.max(level(1).line, logoHeight(logoWidth)) + xl + 3 * line(BODY) + 4 + xl + Math.max(block(from), block(billTo)) + xl + linesOf(`${amountDue} due ${v.due}`, PAGE.width, level(2).size) * level(2).line + sm + line(BODY) + xl;
      const next = Math.max(line(BODY), logoHeight(logoWidth)) + xl;
      const tableHead = line(small) + 2 * sm + 1;
      const rowOf = (i: number) => {
        const { description, period } = v.lines[i]!;
        return linesOf(description, DESCRIPTION, BODY) * line(BODY) + (period ? linesOf(period, DESCRIPTION, small) * line(small) : 0) + 2 * sm + 1;
      };
      const sumRows = [["Subtotal", money(subtotal)], ...v.discounts.map((d) => [d.label, money(-d.amount)]), ...v.taxes.map((t) => [t.label, money(t.amount)]), ["Total", money(total)], ["Amount due", amountDue]] as const;
      const tail = xl + sumRows.reduce((h, [text, value]) => h + Math.max(linesOf(text, SUMS - COLUMNS.amount - sm, BODY * 1.08), linesOf(value, COLUMNS.amount, BODY * 1.08)) * line(BODY) + 2 * xs + 1, 0);

      // The lines, page by page: as many as fit under each page's header, and the sums on the last one.
      const pages: number[][] = [[]];
      let used = first + tableHead;
      v.lines.forEach((_, i) => {
        // A page holds one line at least, but the first may hold none where its own parts fill it.
        if (used + rowOf(i) > room && (pages[pages.length - 1]!.length || pages.length === 1)) {
          pages.push([]);
          used = next + tableHead;
        }
        pages[pages.length - 1]!.push(i);
        used += rowOf(i);
      });
      if (used + tail > room) {
        // The sums don't fit under the last lines: they go on a page of their own, with the last line beside them.
        const last = pages[pages.length - 1]!;
        pages.push(last.length > 1 && next + tableHead + rowOf(last[last.length - 1]!) + tail <= room ? [last.pop()!] : []);
      }

      return (
        <Document
          size="Letter"
          margin={[48, 56, 64, 56]}
          title={`Invoice ${v.number}, ${brand.name}`}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ fontSize: BODY, lineHeight: token("lineHeights.body"), color: token("colors.foreground") }}
        >
          {pages.map((lines, p) => (
            <Document.Page key={p} style={{ gap: token("spacing.xl") }}>
              {p === 0 ? (
                <>
                  <Row stackOnMobile={false} style={{ alignItems: "start" }}>
                    <Heading level={1} style={{ flex: 1 }}>Invoice</Heading>
                    <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: logoWidth }} />
                  </Row>
                  <Column style={{ gap: 2 }}>
                    {(
                      [
                        ["Invoice number", v.number, "number"],
                        ["Date of issue", v.issued, "issued"],
                        ["Date due", v.due, "due"],
                      ] as const
                    ).map(([label, value, field]) => (
                      <Row key={label} stackOnMobile={false}>
                        <Text style={{ width: 120, fontWeight: 700 }}>{label}</Text>
                        <Text field={field}>{value}</Text>
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
                      <Text field="billTo.name">{v.billTo.name}</Text>
                      {v.billTo.address.map((text, i) => (
                        <Text key={i} field={`billTo.address[${i}]`}>{text}</Text>
                      ))}
                      <Text field="billTo.email">{breakable(v.billTo.email)}</Text>
                      {v.billTo.taxId ? <Text field="billTo.taxId">{v.billTo.taxId}</Text> : null}
                    </Column>
                  </Row>
                  <Column style={{ gap: token("spacing.sm") }}>
                    <Heading level={2}>{amountDue} due {v.due}</Heading>
                    <Text>
                      <Link field="payLink" href={v.payLink} style={{ color: token("colors.primary"), textDecoration: "underline" }}>
                        Pay online
                      </Link>
                    </Text>
                  </Column>
                </>
              ) : (
                <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
                  <Text style={{ flex: 1, fontWeight: 700 }}>Invoice {v.number}, continued</Text>
                  <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: logoWidth }} />
                </Row>
              )}
              {lines.length ? (
                <Table>
                  <TableRow header={true}>
                    <TableCell style={head}>Description</TableCell>
                    <TableCell style={{ ...head, width: COLUMNS.quantity, textAlign: "right" }}>Qty</TableCell>
                    <TableCell style={{ ...head, width: COLUMNS.unitPrice, textAlign: "right" }}>Unit price</TableCell>
                    <TableCell style={{ ...head, width: COLUMNS.amount, textAlign: "right" }}>Amount</TableCell>
                  </TableRow>
                  {lines.map((i) => (
                    <TableRow key={i}>
                      <TableCell field={`lines[${i}].description`} style={cell}>
                        {v.lines[i]!.description}
                        {v.lines[i]!.period ? <LineBreak /> : null}
                        {v.lines[i]!.period ? <Span style={muted}>{v.lines[i]!.period}</Span> : null}
                      </TableCell>
                      <TableCell field={`lines[${i}].quantity`} style={{ ...cell, textAlign: "right" }}>{count(v.lines[i]!.quantity)}</TableCell>
                      <TableCell field={`lines[${i}].unitPrice`} style={{ ...cell, textAlign: "right" }}>{money(v.lines[i]!.unitPrice)}</TableCell>
                      <TableCell style={{ ...cell, textAlign: "right" }}>{money(amounts[i]!)}</TableCell>
                    </TableRow>
                  ))}
                </Table>
              ) : null}
              {p === pages.length - 1 ? (
                <Row stackOnMobile={false}>
                  <Column />
                  <Column style={{ width: SUMS }}>
                    {sum("Subtotal", money(subtotal))}
                    {v.discounts.map((d, i) => sum(d.label, money(-d.amount), `discounts[${i}].label`, false, i))}
                    {v.taxes.map((t, i) => sum(t.label, money(t.amount), `taxes[${i}].label`, false, i))}
                    {sum("Total", money(total))}
                    {sum("Amount due", amountDue, undefined, true)}
                  </Column>
                </Row>
              ) : null}
            </Document.Page>
          ))}
          <PageFooter>
            <Text style={{ ...muted, padding: [token("spacing.sm"), 0, 0], border: { top: { width: 1, style: "solid", color: token("colors.border") } } }}>
              {`${v.number} · ${amountDue} due ${v.due} · Page `}
              <PageNumber />
              {" of "}
              <PageNumber total={true} />
            </Text>
          </PageFooter>
        </Document>
      );
    },
  });
}

export default stripeInvoice(brand);
