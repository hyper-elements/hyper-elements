/**
 * A quote as a PDF. Its letterhead (the brand's band, logo, name and address), its headings, the total, how to go
 * ahead with the payment terms' wording, the lines to sign and its footer are locked; a design fills the quote's
 * number, who it's for, its dates, the work with its prices, any tax and which payment terms apply. The template adds
 * the lines up, and puts them on as many pages as they need: the first page has the letterhead and who it's for, the
 * next ones a short header, and the last one the total and the lines to sign. It's made from a brand (`quote(brand)`),
 * which sets its colors, fonts, logo and company details.
 */
import { Column, Document, Heading, Image, LineBreak, PageFooter, PageNumber, Row, Span, Table, TableCell, TableRow, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** A month and day, with no year, so it reads the same any time. */
const date = (label: string, guidance: string) => prop.text({ label, required: true, pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,14}$", guidance });

/** How the work is paid for, as each choice of `terms` says it. */
const TERMS = {
  "on start": "we'll invoice when the work starts.",
  "50% deposit": "we'll invoice half when the work starts, and the rest when it's done.",
  milestones: "we'll invoice each part of the work as it's delivered.",
} as const;

const fields = {
  number: prop.text({ label: "Quote number", required: true, pattern: "^[A-Za-z0-9][A-Za-z0-9-]{2,15}$", guidance: "Letters, digits and dashes: Q-0213" }),
  preparedFor: prop.object(
    {
      name: prop.text({ label: "Name", required: true, maxLength: 60 }),
      address: prop.list(prop.text({ label: "Address line", maxLength: 60 }), { label: "Address", min: 1, max: 5, guidance: "One to five lines, the country last where it's abroad" }),
    },
    { label: "Prepared for", required: true },
  ),
  issued: date("Issued", "The day it's issued, with no year or weekday: April 2"),
  validUntil: date("Valid until", "The last day its prices hold, with no year or weekday: May 2"),
  lines: prop.list(
    prop.object(
      {
        description: prop.text({ label: "Description", required: true, maxLength: 100 }),
        detail: prop.text({ label: "Detail", maxLength: 140, guidance: "What the line includes, in a sentence: Two rounds of changes, and the files in every format" }),
        quantity: prop.number({ label: "Quantity", required: true, min: 0, max: 10000 }),
        unitPrice: prop.number({ label: "Unit price", required: true, min: -100000, max: 100000, guidance: "In the brand's currency, as a number: 1600, or -400 for a credit" }),
      },
      { label: "Line" },
    ),
    { label: "Lines", required: true, min: 1, max: 24 },
  ),
  taxes: prop.list(
    prop.object(
      {
        label: prop.text({ label: "Label", required: true, maxLength: 40, guidance: "The tax and its rate: Sales tax (7%)" }),
        amount: prop.number({ label: "Amount", required: true, min: 0, max: 10000000, guidance: "In the brand's currency, as a number: 466.2" }),
      },
      { label: "Tax" },
    ),
    { label: "Tax", min: 0, max: 3 },
  ),
  terms: prop.choice(["on start", "50% deposit", "milestones"], {
    label: "Payment terms",
    required: true,
    guidance: "When it's invoiced: the whole when the work starts (on start), half then and half when it's done (50% deposit), or each part as it's delivered (milestones)",
  }),
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

export function quote(brand: Brand) {
  const theme = brand.theme as unknown as { spacing: Record<string, number>; fontSizes: Record<string, number>; lineHeights: Record<string, number> };
  const { xs, sm, lg, xl } = theme.spacing as Record<"xs" | "sm" | "md" | "lg" | "xl", number>;
  const small = theme.fontSizes.small!;
  const leading = theme.lineHeights.body!;
  const line = (size: number) => size * leading;
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  const count = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { maximumFractionDigits: 2 }).format(n);
  const logoHeight = (width: number) => (width * brand.logo.height) / brand.logo.width;

  const label = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const cell = { padding: [token("spacing.sm"), 0], border: { bottom: { width: 1, style: "solid", color: token("colors.border") } } } as const;
  const head = { ...cell, fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const signLine = { border: { top: { width: 1, style: "solid", color: token("colors.foreground") } } } as const;
  const band = <Column style={{ height: 6, backgroundColor: token("colors.primary"), borderRadius: 3 }} />;

  return template({
    id: "documents.Quote",
    version: "1.0.0",
    label: "Quote",
    description: "A quote as a PDF: who it's for, the work with its prices, the estimated total, how long it holds, and lines to sign it",
    root: "Document",
    fields,
    rules: {
      require: { core: ["layout/overflow", "document/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      number: "Q-0001",
      preparedFor: { name: "Northwind Traders", address: ["48 Harbor Road", "Portland, OR 97209"] },
      issued: "January 6",
      validUntil: "February 6",
      lines: [{ description: "Design system audit", quantity: 1, unitPrice: 4800 }],
      terms: "on start",
    },
    render: (v) => {
      const amounts = v.lines.map((l) => round(l.quantity * l.unitPrice));
      const subtotal = sum(amounts);
      const total = sum([subtotal, ...v.taxes.map((t) => t.amount)]);
      const totalText = money(total);
      // The total at the size that fits its box: smaller for a long one.
      const totalSize = Math.min(26, Math.floor((SUMS - 64) / (totalText.length * 0.62)));
      const goAhead = `Sign below and send it back before ${v.validUntil}. Prices hold until then; ${TERMS[v.terms]}`;

      // What each part of a page takes, in px, estimated from the brand's sizes (a little over, never under).
      const footer = line(small) + sm + 1;
      const room = PAGE.height - footer;
      const half = (PAGE.width - lg) / 2;
      const preparedFor =
        line(small) + 2 + linesOf(v.preparedFor.name, half, BODY * 1.08) * line(BODY) + v.preparedFor.address.reduce((h, text) => h + 2 + linesOf(text, half, BODY) * line(BODY), 0);
      const first = 6 + xl + Math.max(logoHeight(150), 2 * line(small)) + xl + linesOf(`Quote ${v.number}`, PAGE.width, 40) * 48 + xl + Math.max(preparedFor, line(small) + 2 + line(BODY)) + xl;
      const next = 6 + xl + Math.max(logoHeight(110), line(small)) + xl;
      const tableHead = line(small) + 2 * sm + 1;
      const rowOf = (i: number) => {
        const { description, detail } = v.lines[i]!;
        return linesOf(description, DESCRIPTION, BODY) * line(BODY) + (detail ? linesOf(detail, DESCRIPTION, small) * line(small) : 0) + 2 * sm + 1;
      };
      const sumsHeight =
        (v.taxes.length ? [{ label: "Subtotal", amount: subtotal }, ...v.taxes].reduce((h, t) => h + Math.max(linesOf(money(t.amount), COLUMNS.amount, BODY) * line(BODY), linesOf(t.label, SUMS - COLUMNS.amount - sm, small) * line(small)) + 2 * xs, xs) : 0) + 2 * lg + line(small) + 2 + totalSize * 1.2;
      const signatures = xl + xl + 1 + 4 + linesOf(`Accepted for ${v.preparedFor.name}`, half, small) * line(small);
      const tail = xl + Math.max(line(BODY) + xs + linesOf(goAhead, PAGE.width - SUMS - lg, small) * line(small), sumsHeight) + signatures;

      // The lines, page by page: as many as fit under each page's header, and the total on the last one.
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
        // The total doesn't fit under the last lines: it goes on a page of its own, with the last line beside it.
        const last = pages[pages.length - 1]!;
        pages.push(last.length > 1 && next + tableHead + rowOf(last[last.length - 1]!) + tail <= room ? [last.pop()!] : []);
      }

      return (
        <Document
          size="A4"
          margin={[56, 64, 64, 64]}
          title={`Quote ${v.number}, ${brand.name}`}
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
                      <Text style={{ ...label, textAlign: "right" }}>{[brand.name, brand.address].filter(Boolean).join(" · ")}</Text>
                    </Column>
                  </Row>
                  <Heading field="number" level={1}>Quote {v.number}</Heading>
                  <Row style={{ alignItems: "start", gap: token("spacing.lg") }}>
                    <Column style={{ gap: 2 }}>
                      <Text style={label}>Prepared for</Text>
                      <Text field="preparedFor.name" style={{ fontWeight: 700 }}>{v.preparedFor.name}</Text>
                      {v.preparedFor.address.map((text, i) => (
                        <Text key={i} field={`preparedFor.address[${i}]`}>{text}</Text>
                      ))}
                    </Column>
                    <Row style={{ gap: token("spacing.lg") }}>
                      <Column style={{ gap: 2 }}>
                        <Text style={label}>Issued</Text>
                        <Text field="issued" style={{ fontWeight: 700 }}>{v.issued}</Text>
                      </Column>
                      <Column style={{ gap: 2 }}>
                        <Text style={label}>Valid until</Text>
                        <Text field="validUntil" style={{ fontWeight: 700 }}>{v.validUntil}</Text>
                      </Column>
                    </Row>
                  </Row>
                </>
              ) : (
                <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
                  <Column>
                    <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 110 }} />
                  </Column>
                  <Column>
                    <Text style={{ ...label, textAlign: "right" }}>Quote {v.number}, continued</Text>
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
                      <TableCell field={`lines[${i}].description`} style={cell}>
                        {v.lines[i]!.description}
                        {v.lines[i]!.detail ? <LineBreak /> : null}
                        {v.lines[i]!.detail ? <Span style={label}>{v.lines[i]!.detail}</Span> : null}
                      </TableCell>
                      <TableCell field={`lines[${i}].quantity`} style={{ ...cell, textAlign: "right" }}>{count(v.lines[i]!.quantity)}</TableCell>
                      <TableCell field={`lines[${i}].unitPrice`} style={{ ...cell, textAlign: "right" }}>{money(v.lines[i]!.unitPrice)}</TableCell>
                      <TableCell style={{ ...cell, textAlign: "right" }}>{money(amounts[i]!)}</TableCell>
                    </TableRow>
                  ))}
                </Table>
              ) : null}
              {p === pages.length - 1 ? (
                <>
                  <Row style={{ gap: token("spacing.lg"), alignItems: "start" }}>
                    <Column style={{ gap: token("spacing.xs") }}>
                      <Text style={{ fontWeight: 700 }}>To go ahead</Text>
                      <Text field="terms" style={label}>{goAhead}</Text>
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
                        <Text style={label}>Estimated total</Text>
                        <Text style={{ fontSize: totalSize, fontWeight: 700, lineHeight: 1.2, color: token("colors.primary") }}>{totalText}</Text>
                      </Column>
                    </Column>
                  </Row>
                  <Row style={{ gap: token("spacing.xl") }}>
                    <Column style={{ gap: 4, padding: [token("spacing.xl"), 0, 0] }}>
                      <Column style={signLine} />
                      <Text style={label}>Accepted for {v.preparedFor.name}</Text>
                    </Column>
                    <Column style={{ gap: 4, padding: [token("spacing.xl"), 0, 0] }}>
                      <Column style={signLine} />
                      <Text style={label}>Date</Text>
                    </Column>
                  </Row>
                </>
              ) : null}
            </Document.Page>
          ))}
          <PageFooter>
            <Text style={{ ...label, padding: [token("spacing.sm"), 0, 0], border: { top: { width: 1, style: "solid", color: token("colors.border") } } }}>
              {[brand.name, brand.address].filter(Boolean).join(", ")}
              {". Page "}
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

export default quote(brand);
