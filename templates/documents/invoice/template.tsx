/**
 * An invoice as a PDF. Its letterhead (the brand's band, logo, name and address), its headings, the sums, how to pay and
 * its footer are locked; a design fills the invoice's number, who it's billed to, its dates, its lines, any tax, a note
 * and the link to pay it. The template adds the lines up, and puts them on as many pages as they need: the first page
 * has the letterhead and who it's billed to, the next ones a short header, and the last one the sums and how to pay.
 * It's made from a brand (`invoice(brand)`), which sets its colors, fonts, logo and company details, and the domains its
 * links may go to.
 */
import { Column, Document, Heading, Image, Link, PageFooter, PageNumber, Row, Table, TableCell, TableRow, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** A month and day, with no year, so it reads the same any time. */
const date = (label: string, guidance: string) => prop.text({ label, required: true, pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,14}$", guidance });

const fields = {
  number: prop.text({ label: "Invoice number", required: true, pattern: "^[A-Za-z0-9][A-Za-z0-9-]{2,15}$", guidance: "Letters, digits and dashes: INV-0417" }),
  billedTo: prop.object(
    {
      name: prop.text({ label: "Name", required: true, maxLength: 60 }),
      address: prop.list(prop.text({ label: "Address line", maxLength: 60 }), { label: "Address", min: 1, max: 5, guidance: "One to five lines, the country last where it's abroad" }),
      taxId: prop.text({ label: "Tax ID", maxLength: 32, guidance: "Their tax or VAT number, with its kind: VAT GB123456789" }),
    },
    { label: "Billed to", required: true },
  ),
  poNumber: prop.text({ label: "PO number", maxLength: 24, guidance: "Their purchase order's number, where they gave one" }),
  issued: date("Issued", "The day it's issued, with no year or weekday: March 1"),
  due: date("Due", "The day it's due, with no year or weekday: March 31"),
  lines: prop.list(
    prop.object(
      {
        description: prop.text({ label: "Description", required: true, maxLength: 100 }),
        quantity: prop.number({ label: "Quantity", required: true, min: 0, max: 10000 }),
        unitPrice: prop.number({ label: "Unit price", required: true, min: -100000, max: 100000, guidance: "In the brand's currency, as a number: 29, or -40 for a credit" }),
      },
      { label: "Line" },
    ),
    { label: "Lines", required: true, min: 1, max: 40 },
  ),
  taxes: prop.list(
    prop.object(
      {
        label: prop.text({ label: "Label", required: true, maxLength: 40, guidance: "The tax and its rate: Sales tax (8.25%)" }),
        amount: prop.number({ label: "Amount", required: true, min: 0, max: 10000000, guidance: "In the brand's currency, as a number: 31.19" }),
      },
      { label: "Tax" },
    ),
    { label: "Tax", min: 0, max: 3 },
  ),
  note: prop.text({ label: "Note", maxLength: 300, guidance: "Anything the customer should know about this invoice, in a sentence or two" }),
  payLink: prop.link({ label: "Payment link", required: true, guidance: "The page that pays this invoice online" }),
};

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (ns: readonly number[]) => round(ns.reduce((a, b) => a + b, 0));

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

// The page, in px: A4 inside its margins, and the table's columns.
const PAGE = { width: 666, height: 1002 };
const COLUMNS = { quantity: 60, unitPrice: 100, amount: 120 };
const SUMS = 280;
const DESCRIPTION = PAGE.width - COLUMNS.quantity - COLUMNS.unitPrice - COLUMNS.amount;
const BODY = 12;

export function invoice(brand: Brand) {
  const theme = brand.theme as unknown as { spacing: Record<string, number>; fontSizes: Record<string, number>; lineHeights: Record<string, number> };
  const { xs, sm, lg, xl } = theme.spacing as Record<"xs" | "sm" | "md" | "lg" | "xl", number>;
  const small = theme.fontSizes.small!;
  const leading = theme.lineHeights.body!;
  const line = (size: number) => size * leading;
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  const count = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { maximumFractionDigits: 2 }).format(n);
  const who = brand.legal ? [brand.legal.entity, brand.legal.taxId].filter(Boolean).join(" · ") : brand.name;
  const logoHeight = (width: number) => (width * brand.logo.height) / brand.logo.width;

  const label = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const cell = { padding: [token("spacing.sm"), 0], border: { bottom: { width: 1, style: "solid", color: token("colors.border") } } } as const;
  const head = { ...cell, fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const band = <Column style={{ height: 6, backgroundColor: token("colors.primary"), borderRadius: 3 }} />;

  return template({
    id: "documents.Invoice",
    version: "1.0.0",
    label: "Invoice",
    description: "An invoice as a PDF: the letterhead, who it's billed to, the lines with their sums, the total due, and page numbers",
    root: "Document",
    fields,
    rules: {
      require: { core: ["layout/overflow", "document/overflow"] },
      links: { domains: [...brand.links.domains, ...(brand.links.payments ?? [])] },
    },
    example: {
      number: "INV-0001",
      billedTo: { name: "Northwind Traders", address: ["48 Harbor Road", "Portland, OR 97209"] },
      issued: "January 2",
      due: "February 1",
      lines: [{ description: "Team plan, January", quantity: 10, unitPrice: 29 }],
      payLink: `${brand.links.site}/billing/INV-0001`,
    },
    render: (v) => {
      const amounts = v.lines.map((l) => round(l.quantity * l.unitPrice));
      const subtotal = sum(amounts);
      const due = sum([subtotal, ...v.taxes.map((t) => t.amount)]);
      const payHref = typeof v.payLink === "string" ? v.payLink : v.payLink.href;
      // The link as it reads: its host and path, or its host alone where the path is long.
      const bare = payHref.replace(/^https?:\/\//, "");
      const payText = bare.length <= 48 ? bare : bare.split("/")[0]!;
      const dueText = money(due);
      // The amount due at the size that fits its box: smaller for a long one.
      const dueSize = Math.min(26, Math.floor((SUMS - 64) / (dueText.length * 0.62)));

      // What each part of a page takes, in px, estimated from the brand's sizes (a little over, never under).
      const footer = line(small) + sm + 1;
      const room = PAGE.height - footer;
      const half = (PAGE.width - lg) / 2;
      const billedTo =
        line(small) +
        2 +
        linesOf(v.billedTo.name, half, BODY * 1.08) * line(BODY) +
        [...v.billedTo.address, ...(v.billedTo.taxId ? [v.billedTo.taxId] : [])].reduce((h, text) => h + 2 + linesOf(text, half, BODY) * line(BODY), 0);
      const facts = line(small) + 2 + line(BODY) + (v.poNumber ? sm + line(small) + 2 + linesOf(v.poNumber, half, BODY * 1.08) * line(BODY) : 0);
      const first = 6 + xl + Math.max(logoHeight(150), 2 * line(small)) + xl + linesOf(`Invoice ${v.number}`, PAGE.width, 40) * 48 + xl + Math.max(billedTo, facts) + xl;
      const next = 6 + xl + Math.max(logoHeight(110), line(small)) + xl;
      const tableHead = line(small) + 2 * sm + 1;
      const rowOf = (i: number) => linesOf(v.lines[i]!.description, DESCRIPTION, BODY) * line(BODY) + 2 * sm + 1;
      const howToPay = line(BODY) + xs + linesOf(`Pay online at ${payText}, or by bank transfer quoting ${v.number}.`, PAGE.width - SUMS - lg, small) * line(small);
      const note = v.note ? xs + linesOf(v.note, PAGE.width - SUMS - lg, small) * line(small) : 0;
      const sums =
        (v.taxes.length ? [{ label: "Subtotal", amount: subtotal }, ...v.taxes].reduce((h, t) => h + Math.max(linesOf(money(t.amount), COLUMNS.amount, BODY) * line(BODY), linesOf(t.label, SUMS - COLUMNS.amount - sm, small) * line(small)) + 2 * xs, xs) : 0) + 2 * lg + line(small) + 4 + dueSize * 1.2 + line(BODY);
      const tail = xl + Math.max(howToPay + note, sums);

      // The lines, page by page: as many as fit under each page's header, and the sums on the last one.
      const pages: number[][] = [[]];
      let used = first + tableHead;
      v.lines.forEach((_, i) => {
        if (used + rowOf(i) > room && pages[pages.length - 1]!.length) {
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
          size="A4"
          margin={[56, 64, 64, 64]}
          title={`Invoice ${v.number}, ${brand.name}`}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ fontSize: BODY, lineHeight: token("lineHeights.body") }}
        >
          {pages.map((lines, p) => (
            <Document.Page key={p} style={{ gap: token("spacing.xl") }}>
              {band}
              {p === 0 ? (
                <>
                  <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
                    <Column>
                      <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 150 }} />
                    </Column>
                    <Column>
                      <Text style={{ ...label, textAlign: "right" }}>
                        {[brand.name, brand.address].filter(Boolean).join(" · ")}
                      </Text>
                    </Column>
                  </Row>
                  <Heading field="number" level={1}>Invoice {v.number}</Heading>
                  <Row style={{ alignItems: "start", gap: token("spacing.lg") }}>
                    <Column style={{ gap: 2 }}>
                      <Text style={label}>Billed to</Text>
                      <Text field="billedTo.name" style={{ fontWeight: 700 }}>{v.billedTo.name}</Text>
                      {v.billedTo.address.map((text, i) => (
                        <Text key={i} field={`billedTo.address[${i}]`}>{text}</Text>
                      ))}
                      {v.billedTo.taxId ? <Text field="billedTo.taxId">{v.billedTo.taxId}</Text> : null}
                    </Column>
                    <Column style={{ gap: token("spacing.sm") }}>
                      <Row style={{ gap: token("spacing.lg") }}>
                        <Column style={{ gap: 2 }}>
                          <Text style={label}>Issued</Text>
                          <Text field="issued" style={{ fontWeight: 700 }}>{v.issued}</Text>
                        </Column>
                        <Column style={{ gap: 2 }}>
                          <Text style={label}>Due</Text>
                          <Text field="due" style={{ fontWeight: 700 }}>{v.due}</Text>
                        </Column>
                      </Row>
                      {v.poNumber ? (
                        <Column style={{ gap: 2 }}>
                          <Text style={label}>PO number</Text>
                          <Text field="poNumber" style={{ fontWeight: 700 }}>{v.poNumber}</Text>
                        </Column>
                      ) : null}
                    </Column>
                  </Row>
                </>
              ) : (
                <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
                  <Column>
                    <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 110 }} />
                  </Column>
                  <Column>
                    <Text style={{ ...label, textAlign: "right" }}>Invoice {v.number}, continued</Text>
                  </Column>
                </Row>
              )}
              {lines.length ? (
                <Table>
                  <TableRow header={true}>
                    <TableCell style={head}>Description</TableCell>
                    <TableCell style={{ ...head, textAlign: "right", width: COLUMNS.quantity }}>Qty</TableCell>
                    <TableCell style={{ ...head, textAlign: "right", width: COLUMNS.unitPrice }}>Unit price</TableCell>
                    <TableCell style={{ ...head, textAlign: "right", width: COLUMNS.amount }}>Amount</TableCell>
                  </TableRow>
                  {lines.map((i) => (
                    <TableRow key={i}>
                      <TableCell field={`lines[${i}].description`} style={cell}>{v.lines[i]!.description}</TableCell>
                      <TableCell field={`lines[${i}].quantity`} style={{ ...cell, textAlign: "right" }}>{count(v.lines[i]!.quantity)}</TableCell>
                      <TableCell field={`lines[${i}].unitPrice`} style={{ ...cell, textAlign: "right" }}>{money(v.lines[i]!.unitPrice)}</TableCell>
                      <TableCell style={{ ...cell, textAlign: "right" }}>{money(amounts[i]!)}</TableCell>
                    </TableRow>
                  ))}
                </Table>
              ) : null}
              {p === pages.length - 1 ? (
                <Row style={{ gap: token("spacing.lg"), alignItems: "start" }}>
                  <Column style={{ gap: token("spacing.xs") }}>
                    <Text style={{ fontWeight: 700 }}>How to pay</Text>
                    <Text style={label}>
                      {"Pay online at "}
                      <Link field="payLink" href={v.payLink}>{payText}</Link>
                      , or by bank transfer quoting {v.number}.
                    </Text>
                    {v.note ? <Text field="note" style={label}>{v.note}</Text> : null}
                  </Column>
                  <Column style={{ width: SUMS, gap: token("spacing.xs") }}>
                    {v.taxes.length ? (
                      <Column>
                        {[{ label: "Subtotal", amount: subtotal, field: undefined as string | undefined }, ...v.taxes.map((t, i) => ({ ...t, field: `taxes[${i}].label` }))].map((row, i) => (
                          <Row key={i} stackOnMobile={false} style={{ padding: [token("spacing.xs"), 0], gap: token("spacing.sm") }}>
                            <Text field={row.field} style={{ ...label, flex: 1 }}>{row.label}</Text>
                            <Text style={{ width: COLUMNS.amount, textAlign: "right" }}>{money(row.amount)}</Text>
                          </Row>
                        ))}
                      </Column>
                    ) : null}
                    <Column style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), padding: token("spacing.lg"), gap: 2 }}>
                      <Text style={label}>Amount due</Text>
                      <Text style={{ fontSize: dueSize, fontWeight: 700, lineHeight: 1.2, color: token("colors.primary") }}>{dueText}</Text>
                      <Text style={{ fontWeight: 700 }}>by {v.due}</Text>
                    </Column>
                  </Column>
                </Row>
              ) : null}
            </Document.Page>
          ))}
          <PageFooter>
            <Text style={{ ...label, padding: [token("spacing.sm"), 0, 0], border: { top: { width: 1, style: "solid", color: token("colors.border") } } }}>
              {[who, brand.address, "Page "].filter(Boolean).join(" · ")}
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

export default invoice(brand);
