/**
 * The email that sends an invoice. Its logo and the company's address, its words around the values, the company's
 * legal name and the link to help are locked: a design fills the invoice's number, whom it's for, whether it's due or
 * overdue and when, whether its PDF is attached, the lines, and the page that pays it, and the template adds up the
 * amount due. It's made from a brand (`invoice(brand)`), which sets its colors, fonts, logo, currency and company
 * details, and the domains its links may go to (with its payment processor's, for the payment page).
 */
import { Button, Column, Divider, Email, Heading, Image, Link, Row, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** A date with no year and no weekday, so it reads the same any time: March 31. */
const DATE = "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)(?![\\s\\S]*\\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\\b)[\\s\\S]{3,20}$";
/** The most an amount may be, in the brand's currency. */
const MOST = 999999999;

const fields = {
  number: prop.text({ label: "Invoice number", required: true, pattern: "^[A-Za-z0-9][A-Za-z0-9-]{0,15}$", guidance: "Letters, digits and dashes: INV-0417" }),
  customer: prop.text({ label: "Billed to", required: true, maxLength: 60, guidance: "The customer's company or name, as on the invoice: Northwind Traders" }),
  status: prop.choice(["due", "overdue"], {
    label: "Status",
    default: "due",
    guidance: "Due, for an invoice sent before its due date; overdue, for a reminder once the date has passed",
  }),
  dueOn: prop.text({ label: "Due", required: true, pattern: DATE, guidance: "The day and month, with no year or weekday: March 31" }),
  attached: prop.boolean({ label: "PDF attached", default: false, guidance: "Whether the email carries the invoice's PDF: the email says so only when it does" }),
  lines: prop.list(
    prop.object(
      {
        description: prop.text({ label: "Line", required: true, maxLength: 100, guidance: "What it's for, and how many: Team plan, March × 12" }),
        amount: prop.number({ label: "Amount", required: true, min: -MOST, max: MOST, guidance: "In the brand's currency: 348; a credit is a negative number: -50" }),
      },
      { label: "Line" },
    ),
    { label: "Lines", min: 1, max: 10, guidance: "The invoice's lines, as on its PDF; the template adds them up into the amount due" },
  ),
  payLink: prop.link({ label: "Payment page", required: true, guidance: "The page that pays this invoice: on your site, or your payment processor's" }),
};

export function invoice(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  return template({
    id: "emails.Invoice",
    version: "1.0.0",
    label: "Invoice email",
    description: "The email that sends an invoice: the amount due, the due date, the lines, and a button to pay online",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains, ...(brand.links.payments ?? [])] },
    },
    example: {
      number: "INV-0001",
      customer: "Northwind Traders",
      dueOn: "January 31",
      lines: [{ description: "Team plan, January × 1", amount: 29 }],
      payLink: `${brand.links.site}/billing/INV-0001`,
    },
    render: (v) => {
      const amountDue = money(v.lines.reduce((sum, line) => sum + line.amount, 0));
      const overdue = v.status === "overdue";
      return (
        <Email
          width={600}
          title={`Invoice ${v.number} from ${brand.name}`}
          previewText={
            overdue
              ? `${amountDue} was due ${v.dueOn} on invoice ${v.number} from ${brand.name}`
              : `${amountDue} due ${v.dueOn} on invoice ${v.number} from ${brand.name}`
          }
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
        >
          <Column style={{ padding: token("spacing.xl"), gap: token("spacing.lg") }}>
            <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
              <Column>
                <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 150 }} />
              </Column>
              <Column>
                <Text style={{ ...small, textAlign: "right" }}>{brand.address ? `${brand.name} · ${brand.address}` : brand.name}</Text>
              </Column>
            </Row>
            <Column style={{ gap: token("spacing.sm") }}>
              <Heading level={1} field="number">{overdue ? `Invoice ${v.number} is overdue` : `Invoice ${v.number}`}</Heading>
              <Text field="customer">
                {overdue
                  ? `Hello ${v.customer}, this invoice from ${brand.name} is past its due date.${v.attached ? " The PDF is attached." : ""}`
                  : `Hello ${v.customer}, here's your invoice from ${brand.name}.${v.attached ? " The PDF is attached." : ""}`}
              </Text>
            </Column>
            <Column style={{ backgroundColor: token("colors.surface"), padding: token("spacing.lg"), gap: token("spacing.md"), borderRadius: token("radii.sm") }}>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "end" }}>
                <Column style={{ gap: 2 }}>
                  <Text style={small}>Amount due</Text>
                  <Text style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: token("colors.primary") }}>{amountDue}</Text>
                </Column>
                <Column style={{ gap: 2 }}>
                  <Text style={{ ...small, textAlign: "right" }}>Due</Text>
                  <Text field="dueOn" style={{ fontWeight: 700, textAlign: "right" }}>{v.dueOn}</Text>
                </Column>
              </Row>
              <Divider />
              {v.lines.map((line, i) => (
                <Row key={i} stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                  <Column>
                    <Text field={`lines[${i}].description`}>{line.description}</Text>
                  </Column>
                  <Column style={{ width: 120 }}>
                    <Text field={`lines[${i}].amount`} style={{ textAlign: "right" }}>{money(line.amount)}</Text>
                  </Column>
                </Row>
              ))}
            </Column>
            <Button field="payLink" href={v.payLink} style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}>
              {`Pay ${amountDue} online`}
            </Button>
            <Column style={{ gap: token("spacing.xs") }}>
              <Text style={small}>
                {"Questions about this invoice? "}
                <Link href={brand.links.help}>Get help from {brand.name}</Link>
                {brand.support?.phone ? `, or call ${brand.support.phone}${brand.support.hours ? ` (${brand.support.hours})` : ""}` : ""}
              </Text>
              {brand.legal && <Text style={small}>{brand.legal.taxId ? `${brand.legal.entity} · ${brand.legal.taxId}` : brand.legal.entity}</Text>}
            </Column>
          </Column>
        </Email>
      );
    },
  });
}

export default invoice(brand);
