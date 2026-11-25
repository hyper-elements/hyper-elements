/**
 * A subscription's receipt: the logo and "Receipt", the brand's card offer, the order's details in a gray table, each
 * item with its icon and price under the store's name, the total, the offer again with its fine print, and the footer.
 * The logo, the offer, the fine print and the footer are the brand's; the account, the order, who's billed, the items
 * and the total are each receipt's.
 */
import { Column, Divider, Email, Heading, Image, LineBreak, Link, Row, Section, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/apple";

/** Free text with no year, so a receipt reads the same any time. */
const noYear = (min: number, max: number) => `^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{${min},${max}}$`;

const fields = {
  preview: prop.text({ label: "Preview text", required: true, pattern: "^[\\s\\S]{30,120}$", guidance: "What the inbox shows after the subject: the item and its price" }),
  account: prop.text({ label: "Account email address", required: true, pattern: "^(?=[\\s\\S]{6,254}$)[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }),
  invoiceDate: prop.text({ label: "Invoice date", required: true, pattern: noYear(3, 20), guidance: "The day and month, with no year: 18 Jan" }),
  orderId: prop.text({ label: "Order ID", required: true, pattern: "^[A-Z0-9]{6,16}$" }),
  documentNo: prop.text({ label: "Document number", required: true, pattern: "^[0-9]{6,16}$" }),
  billedTo: prop.object(
    {
      // Never a whole card number: five digits in a row are refused.
      payment: prop.text({ label: "Payment method", required: true, pattern: "^(?![\\s\\S]*(?:\\d[\\s-]?){5})[\\s\\S]{3,40}$", guidance: "The card and its last four digits: Visa .... 7461" }),
      name: prop.text({ label: "Name", required: true, maxLength: 60 }),
      address: prop.list(prop.text({ label: "Address line", required: true, maxLength: 60 }), {
        label: "Address",
        required: true,
        min: 1,
        max: 5,
        guidance: "One to five lines, the last its country",
      }),
    },
    { label: "Billed to", required: true },
  ),
  items: prop.list(
    prop.object(
      {
        icon: field.image({ label: "App icon", required: true, aspect: { min: 1, max: 1 }, minWidth: 120, accepts: ["png", "jpeg"] }),
        name: prop.text({ label: "App", required: true, maxLength: 60 }),
        plan: prop.text({ label: "What was bought", required: true, maxLength: 100, guidance: "The subscription or in-app purchase: Lumen Pro (Monthly)" }),
        renews: prop.text({ label: "Renewal", pattern: noYear(3, 30), guidance: "When it renews, with no year: Renews Aug 20" }),
        price: prop.number({ label: "Price", required: true, guidance: "In the brand's currency: 14.99, or less than 0 for a credit" }),
      },
      { label: "Item" },
    ),
    { label: "Items", required: true, min: 1, max: 5 },
  ),
  taxes: prop.list(
    prop.object(
      {
        label: prop.text({ label: "Label", required: true, maxLength: 40, guidance: "What it is: Sales tax, or VAT (20%)" }),
        amount: prop.number({ label: "Amount", required: true, guidance: "In the brand's currency: 1.24" }),
      },
      { label: "Tax" },
    ),
    { label: "Taxes", min: 0, max: 3, guidance: "Each tax added to the items: with any, the receipt shows the subtotal, each tax, then the total" },
  ),
  // The Apple Card offer at the top, and again with its fine print at the bottom.
  offer: prop.boolean({ label: "Show the card offer", default: true }),
};

export const meta = {
  author: "zehfernandes",
  recreates: { company: "apple", what: "App Store receipt", original: "https://reallygoodemails.com/search/emails/Apple" },
};

export function appleReceipt(brand: Brand) {
  const site = brand.links.site;
  // The logo as tall as the original's, whatever its shape.
  const logo = (height: number) => Math.min(160, Math.round((height * brand.logo.width) / brand.logo.height));
  const label = { fontSize: token("fontSizes.small"), color: token("colors.muted"), textTransform: "uppercase", letterSpacing: 0.5 } as const;
  const cell = { padding: [token("spacing.sm"), token("spacing.md")], gap: 2, border: { width: 1, style: "solid", color: token("colors.background") } } as const;
  const link = { color: token("colors.primary"), textDecoration: "none" } as const;
  const fine = { fontSize: token("fontSizes.small"), color: token("colors.muted"), lineHeight: 1.5 } as const;
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  const amount = { width: 90, textAlign: "right" } as const;
  return template({
    id: "emails.AppleReceipt",
    version: "1.0.0",
    label: "App Store receipt",
    description: "A subscription's receipt: the order's details in a gray table, the app with its icon and price, the total, an offer, and the fine print",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      preview: `Your ${brand.name} receipt: Lumen Pro (Monthly), $14.99`,
      account: "reader@example.com",
      invoiceDate: "18 Jan",
      orderId: "ML4F5L8522",
      documentNo: "186623754793",
      billedTo: { payment: "Visa .... 7461", name: "Sam Reader", address: ["1 Main Street", "Springfield", "USA"] },
      items: [
        {
          icon: { src: "https://hyperelements.dev/generated/gallery/assets/companies/apple/app-icon.png", width: 120, height: 120 },
          name: "Lumen: Photo Journal",
          plan: "Lumen Pro (Monthly)",
          renews: "Renews Aug 20",
          price: 14.99,
        },
      ],
    },
    render: (v) => {
      const subtotal = v.items.reduce((sum, item) => sum + item.price, 0);
      const total = v.taxes.reduce((sum, tax) => sum + tax.amount, subtotal);
      return (
        <Email
          width={640}
          title={`Your receipt from ${brand.name}`}
          previewText={v.preview}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ backgroundColor: token("colors.background"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
        >
          <Section style={{ padding: [token("spacing.md"), 0, token("spacing.xl")], mobile: { padding: [token("spacing.md"), token("spacing.md"), token("spacing.xl")] } }}>
            <Column style={{ gap: token("spacing.lg") }}>
              <Row stackOnMobile={false} style={{ alignItems: "center" }}>
                <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: logo(42) }} />
                <Heading level={1} style={{ color: token("colors.muted"), textAlign: "right" }}>Receipt</Heading>
              </Row>
              {v.offer ? (
                <Text style={{ textAlign: "center", fontWeight: 700 }}>
                  Save 3% on all your {brand.name} purchases with {brand.name} Card.¹ <Link href={`${site}/card`} style={link}>Apply and use in minutes</Link>²
                </Text>
              ) : null}
              <Row style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm") }}>
                <Column>
                  <Column style={cell}>
                    <Text style={label}>{brand.name} Account</Text>
                    <Text field="account">{v.account}</Text>
                  </Column>
                  <Column style={cell}>
                    <Text style={label}>Invoice date</Text>
                    <Text field="invoiceDate">{v.invoiceDate}</Text>
                  </Column>
                  <Column style={cell}>
                    <Text style={label}>Order ID</Text>
                    <Text field="orderId">
                      <Link href={`${site}/account/orders`} style={link}>{v.orderId}</Link>
                    </Text>
                  </Column>
                  <Column style={cell}>
                    <Text style={label}>Document no.</Text>
                    <Text field="documentNo">{v.documentNo}</Text>
                  </Column>
                </Column>
                <Column style={cell}>
                  <Text style={label}>Billed to</Text>
                  <Text field="billedTo.payment">{v.billedTo.payment}</Text>
                  <Text field="billedTo.name">{v.billedTo.name}</Text>
                  {v.billedTo.address.map((line, i) => (
                    <Text key={i} field={`billedTo.address[${i}]`}>{line}</Text>
                  ))}
                </Column>
              </Row>
              <Text style={{ padding: [token("spacing.xs"), token("spacing.sm")], backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), fontWeight: 700 }}>
                {brand.name} Store
              </Text>
              {v.items.map((item, i) => (
                <Row key={i} stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "start", padding: [0, token("spacing.md")] }}>
                  <Image
                    field={`items[${i}].icon`}
                    src={item.icon}
                    alt={item.name}
                    style={{ width: 64, borderRadius: token("radii.md"), border: { width: 1, style: "solid", color: token("colors.border") } }}
                  />
                  <Column style={{ gap: 2 }}>
                    <Text field={`items[${i}].name`} style={{ fontWeight: 700 }}>{item.name}</Text>
                    <Text field={`items[${i}].plan`} style={{ color: token("colors.muted") }}>{item.plan}</Text>
                    {item.renews ? <Text field={`items[${i}].renews`} style={{ color: token("colors.muted") }}>{item.renews}</Text> : null}
                    <Text>
                      <Link href={`${site}/store/review`} style={link}>Write a Review</Link> | <Link href={`${site}/store/report`} style={link}>Report a Problem</Link>
                    </Text>
                  </Column>
                  <Text field={`items[${i}].price`} style={{ ...amount, fontWeight: 700 }}>{money(item.price)}</Text>
                </Row>
              ))}
              <Divider style={{ borderTop: { width: 1, style: "solid", color: token("colors.border") } }} />
              {v.taxes.length > 0 ? (
                <Column style={{ gap: token("spacing.xs") }}>
                  <Row stackOnMobile={false} style={{ alignItems: "center", justifyContent: "end", gap: token("spacing.lg"), padding: [0, token("spacing.md")] }}>
                    <Text style={{ ...label, textAlign: "right" }}>Subtotal</Text>
                    <Text style={amount}>{money(subtotal)}</Text>
                  </Row>
                  {v.taxes.map((tax, i) => (
                    <Row key={i} stackOnMobile={false} style={{ alignItems: "center", justifyContent: "end", gap: token("spacing.lg"), padding: [0, token("spacing.md")] }}>
                      <Text field={`taxes[${i}].label`} style={{ ...label, textAlign: "right" }}>{tax.label}</Text>
                      <Text field={`taxes[${i}].amount`} style={amount}>{money(tax.amount)}</Text>
                    </Row>
                  ))}
                </Column>
              ) : null}
              <Row stackOnMobile={false} style={{ alignItems: "center", justifyContent: "end", gap: token("spacing.lg"), padding: [0, token("spacing.md")] }}>
                <Text style={{ ...label, fontWeight: 700, textAlign: "right" }}>Total</Text>
                <Text style={{ ...amount, fontSize: 18, fontWeight: 700 }}>{money(total)}</Text>
              </Row>
              <Divider style={{ borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [0, 0, token("spacing.xl")] }} />
              {v.offer ? (
                <>
                  <Column style={{ gap: token("spacing.sm"), alignItems: "center", textAlign: "center" }}>
                    <Heading level={2}>Save 3% on all your {brand.name} purchases.</Heading>
                    <Text>
                      <Link href={`${site}/card`} style={link}>Apply and use in minutes</Link>
                    </Text>
                  </Column>
                  <Divider style={{ borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.xl"), 0, 0] }} />
                  <Column style={{ gap: token("spacing.md") }}>
                    <Text style={fine}>
                      1. 3% savings is earned as Daily Cash and is transferred to your {brand.name} Cash card when transactions post to your {brand.name} Card account.
                      If you do not have a {brand.name} Cash card, Daily Cash can be applied by you as a credit on your statement balance. 3% is the total amount of
                      Daily Cash earned for these purchases. See the {brand.name} Card Customer Agreement for more details on Daily Cash and qualifying transactions.
                    </Text>
                    <Text style={fine}>2. Subject to credit approval.</Text>
                    <Text style={fine}>Available for qualifying applicants in the United States.</Text>
                  </Column>
                </>
              ) : null}
              <Column style={{ gap: token("spacing.md"), alignItems: "center", textAlign: "center" }}>
                <Text style={fine}>
                  Privacy: We use a <Link href={`${site}/legal/privacy`} style={link}>Subscriber ID</Link> to provide reports to developers.
                </Text>
                <Text style={fine}>
                  Get help with subscriptions and purchases. <Link href={brand.links.help} style={link}>Visit {brand.name} Support.</Link>
                </Text>
                <Text style={fine}>
                  You have the option to stop receiving email receipts for your subscription renewals. If you have opted out, you can still view your receipts in
                  your account under Purchase History. To manage receipts or to opt in again, go to <Link href={`${site}/account`} style={link}>Account Settings</Link>.
                </Text>
                <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: logo(26) }} />
                <Text style={fine}>
                  <Link href={`${site}/account`} style={link}>Account Settings</Link> • <Link href={`${site}/legal/sales`} style={link}>Terms of Sale</Link> •{" "}
                  <Link href={`${site}/legal/privacy`} style={link}>Privacy Policy</Link>
                </Text>
                <Text style={fine}>
                  Copyright © {brand.name}. <Link href={`${site}/legal`} style={link}>All rights reserved</Link>
                  {brand.address ? <><LineBreak />{brand.address}</> : null}
                </Text>
                {brand.legal ? (
                  <Text style={fine}>
                    {brand.legal.entity}
                    {brand.legal.taxId ? ` · ${brand.legal.taxId}` : ""}
                  </Text>
                ) : null}
              </Column>
            </Column>
          </Section>
        </Email>
      );
    },
  });
}

export default appleReceipt(brand);
