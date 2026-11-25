/**
 * A payment receipt. Its logo, its headings, the note to keep it and its footer (the company's legal name, its address
 * and links to its site and help) are locked: a design fills the amount of each item, any tax and discounts, when and
 * how it was paid and the receipt's number, and the template adds up the total. It's made from a brand
 * (`receipt(brand)`), which sets its colors, fonts, logo, currency and company details, and the domains its links may
 * go to.
 */
import { Column, Email, Heading, Image, Link, Row, Table, TableCell, TableRow, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** A date with no year and no weekday, so it reads the same any time: March 4. */
const DATE = "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)(?![\\s\\S]*\\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\\b)[\\s\\S]{3,20}$";

/** A line that changes the total: a tax, or a discount (a negative amount). */
const adjustment = (what: "tax" | "discount") =>
  prop.object(
    {
      label: prop.text({
        label: what === "tax" ? "Tax" : "Discount",
        required: true,
        maxLength: 60,
        guidance: what === "tax" ? "The tax and its rate: Sales tax, 8%" : "What it's for: Annual plan, 10% off",
      }),
      amount:
        what === "tax"
          ? prop.number({ label: "Amount", required: true, min: 0, max: 999999999, guidance: "The tax, in the brand's currency: 3.84" })
          : prop.number({ label: "Amount", required: true, min: -999999999, max: 0, guidance: "What it takes off, as a negative number: -10" }),
    },
    { label: what === "tax" ? "Tax" : "Discount" },
  );

const fields = {
  paidOn: prop.text({ label: "Date paid", required: true, pattern: DATE, guidance: "The day and month, with no year or weekday: March 4" }),
  method: prop.text({
    label: "Paid with",
    required: true,
    // Never a whole card or account number: no more than four digits in a row.
    pattern: "^(?![\\s\\S]*(?:\\d[\\s-]?){5})[\\s\\S]{3,40}$",
    guidance: "The card or account, by its last four digits only: Visa ending 4242",
  }),
  number: prop.text({ label: "Receipt number", required: true, pattern: "^[A-Za-z0-9][A-Za-z0-9-]{0,15}$", guidance: "Letters, digits and dashes: R-20418" }),
  items: prop.list(
    prop.object(
      {
        description: prop.text({ label: "Item", required: true, maxLength: 100, guidance: "What was paid for: Pro plan, monthly" }),
        amount: prop.number({ label: "Amount", required: true, min: 0, max: 999999999, guidance: "In the brand's currency: 24" }),
      },
      { label: "Item" },
    ),
    { label: "Items", min: 1, max: 8, guidance: "Each thing paid for, in the order of the invoice; the template adds them up, with any tax and discounts, into the total" },
  ),
  taxes: prop.list(adjustment("tax"), { label: "Taxes", min: 0, max: 3, guidance: "Each tax charged, if any" }),
  discounts: prop.list(adjustment("discount"), { label: "Discounts", min: 0, max: 3, guidance: "Each discount or credit, if any" }),
};

export function receipt(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const line = { padding: [token("spacing.sm"), 0], border: { bottom: { width: 1, style: "solid", color: token("colors.border") } } } as const;
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  return template({
    id: "emails.Receipt",
    version: "1.0.0",
    label: "Receipt",
    description: "A payment receipt that leads with the amount paid, then the items, the total, and how it was paid",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      paidOn: "January 9",
      method: "Visa ending 4242",
      number: "R-10001",
      items: [{ description: "Pro plan, monthly", amount: 24 }],
    },
    render: (v) => {
      const adjustments = [...v.taxes, ...v.discounts];
      const total = [...v.items, ...adjustments].reduce((sum, line) => sum + line.amount, 0);
      const right = { textAlign: "right", width: 110 } as const;
      return (
        <Email
          width={560}
          title={`Your ${brand.name} receipt`}
          previewText={`${money(total)} paid on ${v.paidOn} with ${v.method}. Thanks.`}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ backgroundColor: token("colors.surface"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
        >
          <Column style={{ padding: [token("spacing.xl"), token("spacing.md"), token("spacing.lg")], gap: token("spacing.lg") }}>
            <Column style={{ alignItems: "center" }}>
              <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 150 }} />
            </Column>
            <Column
              style={{
                backgroundColor: token("colors.background"),
                borderRadius: token("radii.md"),
                border: { width: 1, style: "solid", color: token("colors.border") },
              }}
            >
              <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
                <Column style={{ gap: token("spacing.xs"), alignItems: "center", textAlign: "center", padding: [0, 0, token("spacing.sm")] }}>
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
                  <Heading level={1}>{money(total)}</Heading>
                  <Text style={{ color: token("colors.muted") }}>
                    Paid on {v.paidOn} with {v.method}
                  </Text>
                </Column>
                <Table>
                  <TableRow header={true}>
                    <TableCell style={{ ...line, ...small }}>Item</TableCell>
                    <TableCell style={{ ...line, ...small, ...right }}>Amount</TableCell>
                  </TableRow>
                  {v.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell field={`items[${i}].description`} style={line}>{item.description}</TableCell>
                      <TableCell field={`items[${i}].amount`} style={{ ...line, ...right }}>{money(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {v.taxes.map((tax, i) => (
                    <TableRow key={`tax-${i}`}>
                      <TableCell field={`taxes[${i}].label`} style={{ ...line, color: token("colors.muted") }}>{tax.label}</TableCell>
                      <TableCell field={`taxes[${i}].amount`} style={{ ...line, ...right, color: token("colors.muted") }}>{money(tax.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {v.discounts.map((discount, i) => (
                    <TableRow key={`discount-${i}`}>
                      <TableCell field={`discounts[${i}].label`} style={{ ...line, color: token("colors.muted") }}>{discount.label}</TableCell>
                      <TableCell field={`discounts[${i}].amount`} style={{ ...line, ...right, color: token("colors.muted") }}>{money(discount.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell style={{ padding: [token("spacing.sm"), 0], fontWeight: 700 }}>Total paid</TableCell>
                    <TableCell style={{ padding: [token("spacing.sm"), 0], fontWeight: 700, ...right }}>{money(total)}</TableCell>
                  </TableRow>
                </Table>
                <Row
                  stackOnMobile={false}
                  style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), padding: token("spacing.md"), gap: token("spacing.md") }}
                >
                  <Column>
                    <Text style={small}>Receipt number</Text>
                    <Text field="number" style={{ fontWeight: 700 }}>{v.number}</Text>
                  </Column>
                  <Column>
                    <Text style={{ ...small, textAlign: "right" }}>Date paid</Text>
                    <Text field="paidOn" style={{ fontWeight: 700, textAlign: "right" }}>{v.paidOn}</Text>
                  </Column>
                </Row>
                <Text style={{ color: token("colors.muted") }}>Keep this email for your records. To ask about a charge, reply to it.</Text>
              </Column>
            </Column>
            <Column style={{ gap: token("spacing.xs") }}>
              {brand.legal && (
                <Text style={{ ...small, textAlign: "center" }}>
                  {brand.legal.taxId ? `${brand.legal.entity} · ${brand.legal.taxId}` : brand.legal.entity}
                </Text>
              )}
              <Text style={{ ...small, textAlign: "center" }}>{brand.address ? `${brand.name} · ${brand.address}` : brand.name}</Text>
              {brand.support && (brand.support.phone || brand.support.hours) && (
                <Text style={{ ...small, textAlign: "center" }}>
                  {[brand.support.phone && `Call ${brand.support.phone}`, brand.support.hours].filter(Boolean).join(", ")}
                </Text>
              )}
              <Text style={{ ...small, textAlign: "center" }}>
                <Link href={`${brand.links.site}/`}>Visit {brand.name}</Link>
                {" · "}
                <Link href={brand.links.help}>Get help from {brand.name}</Link>
              </Text>
            </Column>
          </Column>
        </Email>
      );
    },
  });
}

export default receipt(brand);
