/**
 * A receipt as a PDF. Its letterhead (the brand's band, logo, name and address), its headings, the "Paid in full" badge,
 * the sums, its thanks and its footer are locked; a design fills the receipt's number, who paid, when and how, the
 * items, any discount and tax. The template adds the items up, and puts them on as many pages as they need: the first
 * page has the letterhead and who paid, the next ones a short header, and the last one the total. It's made from a
 * brand (`receipt(brand)`), which sets its colors, fonts, logo and company details.
 */
import { Column, Document, Heading, Image, PageFooter, PageNumber, Row, Table, TableCell, TableRow, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

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
  number: prop.text({ label: "Receipt number", required: true, pattern: "^[A-Za-z0-9][A-Za-z0-9-]{2,11}$", guidance: "Letters, digits and dashes: R-20418" }),
  paidBy: prop.text({ label: "Paid by", required: true, maxLength: 60 }),
  datePaid: prop.text({
    label: "Date paid",
    required: true,
    // A month and day, with no year, so it reads the same any time.
    pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,14}$",
    guidance: "The day it was paid, with no year or weekday: March 4",
  }),
  paidWith: prop.text({
    label: "Paid with",
    required: true,
    // Never a card's number: five digits in a row are refused.
    pattern: "^(?![\\s\\S]*(?:\\d[\\s-]?){5})[\\s\\S]{3,40}$",
    guidance: "The card or account, never its full number: Visa ending 4242",
  }),
  lines: prop.list(
    prop.object(
      {
        description: prop.text({ label: "Description", required: true, maxLength: 100 }),
        quantity: prop.number({ label: "Quantity", required: true, min: 0, max: 10000 }),
        unitPrice: prop.number({ label: "Unit price", required: true, min: -100000, max: 100000, guidance: "In the brand's currency, as a number: 24, or -112 for a credit" }),
      },
      { label: "Item" },
    ),
    { label: "Items", required: true, min: 1, max: 30 },
  ),
  discounts: sumLines("Discounts", "Discount", "What it is: Yearly billing (10%)", "What it takes off, in the brand's currency, as a positive number: 12.5"),
  taxes: sumLines("Tax", "Tax", "The tax and its rate: Sales tax (8.25%)", "In the brand's currency, as a number: 31.19"),
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

export function receipt(brand: Brand) {
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
  const thanks = "Thank you. Keep this receipt for your records; nothing more is owed.";

  return template({
    id: "documents.Receipt",
    version: "1.0.0",
    label: "Receipt",
    description: "A receipt as a PDF: paid in full, with the items, the total, the date and how it was paid",
    root: "Document",
    fields,
    rules: {
      require: { core: ["layout/overflow", "document/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      number: "R-10001",
      paidBy: "Northwind Traders",
      datePaid: "January 4",
      paidWith: "Visa ending 4242",
      lines: [{ description: "Pro plan, monthly", quantity: 1, unitPrice: 24 }],
    },
    render: (v) => {
      const amounts = v.lines.map((l) => round(l.quantity * l.unitPrice));
      const subtotal = sum(amounts);
      const total = sum([subtotal, ...v.discounts.map((d) => -d.amount), ...v.taxes.map((t) => t.amount)]);
      const totalText = money(total);
      // The total at the size that fits its box: smaller for a long one.
      const totalSize = Math.min(26, Math.floor((SUMS - 64) / (totalText.length * 0.62)));
      const sums = [
        ...(v.discounts.length || v.taxes.length ? [{ label: "Subtotal", amount: subtotal, field: undefined as string | undefined }] : []),
        ...v.discounts.map((d, i) => ({ label: d.label, amount: -d.amount, field: `discounts[${i}].label` })),
        ...v.taxes.map((t, i) => ({ label: t.label, amount: t.amount, field: `taxes[${i}].label` })),
      ];

      // What each part of a page takes, in px, estimated from the brand's sizes (a little over, never under).
      const footer = line(small) + sm + 1;
      const room = PAGE.height - footer;
      const third = (PAGE.width - 2 * lg) / 3;
      const facts = line(small) + 2 + Math.max(...[v.paidBy, v.datePaid, v.paidWith].map((text) => linesOf(text, third, BODY * 1.08))) * line(BODY);
      const first = 6 + xl + Math.max(logoHeight(150), 2 * line(small)) + xl + linesOf(`Receipt ${v.number}`, (PAGE.width - lg) / 2, 40) * 48 + xl + facts + xl;
      const next = 6 + xl + Math.max(logoHeight(110), line(small)) + xl;
      const tableHead = line(small) + 2 * sm + 1;
      const rowOf = (i: number) => linesOf(v.lines[i]!.description, DESCRIPTION, BODY) * line(BODY) + 2 * sm + 1;
      const sumsHeight =
        (sums.length ? sums.reduce((h, s) => h + Math.max(linesOf(money(s.amount), COLUMNS.amount, BODY) * line(BODY), linesOf(s.label, SUMS - COLUMNS.amount - sm, small) * line(small)) + 2 * xs, xs) : 0) + 2 * lg + line(small) + 2 + totalSize * 1.2;
      const tail = xl + Math.max(linesOf(thanks, PAGE.width - SUMS - lg, small) * line(small), sumsHeight);

      // The items, page by page: as many as fit under each page's header, and the total on the last one.
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
        // The total doesn't fit under the last items: it goes on a page of its own, with the last item beside it.
        const last = pages[pages.length - 1]!;
        pages.push(last.length > 1 && next + tableHead + rowOf(last[last.length - 1]!) + tail <= room ? [last.pop()!] : []);
      }

      return (
        <Document
          size="A4"
          margin={[56, 64, 64, 64]}
          title={`Receipt ${v.number}, ${brand.name}`}
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
                  <Row style={{ alignItems: "end", gap: token("spacing.lg") }}>
                    <Heading field="number" level={1}>Receipt {v.number}</Heading>
                    <Column style={{ alignItems: "end" }}>
                      <Column style={{ backgroundColor: token("colors.primary"), borderRadius: token("radii.sm"), padding: [6, 14] }}>
                        <Text style={{ color: token("colors.primaryForeground"), fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Paid in full</Text>
                      </Column>
                    </Column>
                  </Row>
                  <Row style={{ gap: token("spacing.lg") }}>
                    <Column style={{ gap: 2 }}>
                      <Text style={label}>Paid by</Text>
                      <Text field="paidBy" style={{ fontWeight: 700 }}>{v.paidBy}</Text>
                    </Column>
                    <Column style={{ gap: 2 }}>
                      <Text style={label}>Date paid</Text>
                      <Text field="datePaid" style={{ fontWeight: 700 }}>{v.datePaid}</Text>
                    </Column>
                    <Column style={{ gap: 2 }}>
                      <Text style={label}>Paid with</Text>
                      <Text field="paidWith" style={{ fontWeight: 700 }}>{v.paidWith}</Text>
                    </Column>
                  </Row>
                </>
              ) : (
                <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
                  <Column>
                    <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 110 }} />
                  </Column>
                  <Column>
                    <Text style={{ ...label, textAlign: "right" }}>Receipt {v.number}, continued</Text>
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
                  <Text style={label}>{thanks}</Text>
                  <Column style={{ width: SUMS, gap: token("spacing.xs") }}>
                    {sums.length ? (
                      <Column>
                        {sums.map((row, i) => (
                          <Row key={i} stackOnMobile={false} style={{ padding: [token("spacing.xs"), 0], gap: token("spacing.sm") }}>
                            <Text field={row.field} style={{ ...label, flex: 1 }}>{row.label}</Text>
                            <Text style={{ width: COLUMNS.amount, textAlign: "right" }}>{money(row.amount)}</Text>
                          </Row>
                        ))}
                      </Column>
                    ) : null}
                    <Column style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), padding: token("spacing.lg"), gap: 2 }}>
                      <Text style={label}>Total paid</Text>
                      <Text style={{ fontSize: totalSize, fontWeight: 700, lineHeight: 1.2 }}>{totalText}</Text>
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

export default receipt(brand);
