/**
 * An order confirmation. Its logo, its headings, the note that it ships soon and its footer (the company's address and
 * links to its site and help) are locked: a design fills the order's number, date and page, whom it thanks, the items
 * with their prices and any shipping, tax and discount, and where it's going, and the template adds up the subtotal and
 * the total. It's made from a brand (`orderConfirmation(brand)`), which sets its colors, fonts, logo, currency and
 * company details, and the domains its links may go to.
 */
import { Column, Email, Heading, Image, LineBreak, Link, Row, Span, Table, TableCell, TableRow, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** A date with no year and no weekday, so it reads the same any time: March 9. */
const DATE = "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)(?![\\s\\S]*\\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\\b)[\\s\\S]{3,20}$";
/** The most an amount may be, in the brand's currency. */
const MOST = 999999999;

const fields = {
  order: prop.text({ label: "Order number", required: true, pattern: "^[A-Za-z0-9][A-Za-z0-9-]{0,15}$", guidance: "Letters, digits and dashes: 10482" }),
  placedOn: prop.text({ label: "Placed on", required: true, pattern: DATE, guidance: "The day and month, with no year or weekday: March 9" }),
  firstName: prop.text({ label: "Customer's first name", maxLength: 60, guidance: "The name they gave; leave it out where you don't have one" }),
  items: prop.list(
    prop.object(
      {
        name: prop.text({ label: "Item", required: true, maxLength: 100, guidance: "The product and its option: Field notebook, dot grid" }),
        quantity: prop.number({ label: "Quantity", required: true, integer: true, min: 1, max: 99 }),
        price: prop.number({ label: "Price each", required: true, min: 0, max: MOST, guidance: "One item's price, in the brand's currency: 14" }),
        thumbnail: field.image({
          label: "Picture",
          aspect: { min: 1, max: 1 },
          fit: "cover",
          minWidth: 120,
          accepts: ["png", "jpeg"],
          guidance: "A square picture of the product, at least 120px wide",
        }),
      },
      { label: "Item" },
    ),
    { label: "Items", min: 1, max: 8, guidance: "The template adds them up (quantity × price each) into the subtotal" },
  ),
  shippingCost: prop.number({ label: "Shipping", min: 0, max: MOST, guidance: "What shipping costs, in the brand's currency: 0 for free shipping; leave it out to show no shipping line" }),
  taxes: prop.list(
    prop.object(
      {
        label: prop.text({ label: "Tax", required: true, maxLength: 60, guidance: "The tax and its rate: Sales tax, 8%" }),
        amount: prop.number({ label: "Amount", required: true, min: 0, max: MOST, guidance: "The tax, in the brand's currency: 5.28" }),
      },
      { label: "Tax" },
    ),
    { label: "Taxes", min: 0, max: 3, guidance: "Each tax charged, if any" },
  ),
  discount: prop.object(
    {
      label: prop.text({ label: "Discount", required: true, maxLength: 60, guidance: "What it's for: Welcome code, 10% off" }),
      amount: prop.number({ label: "Amount", required: true, min: -MOST, max: 0, guidance: "What it takes off, as a negative number: -6.60" }),
    },
    { label: "Discount" },
  ),
  shipTo: prop.object(
    {
      name: prop.text({ label: "Name", required: true, maxLength: 60 }),
      lines: prop.list(prop.text({ label: "Line", required: true, maxLength: 60 }), {
        label: "Address",
        min: 1,
        max: 5,
        guidance: "One line each: the street, a second line, the city with its region and postal code, and the country",
      }),
    },
    { label: "Shipping to", required: true },
  ),
  orderLink: prop.link({ label: "Order page", required: true, guidance: "The order's page on your site, where it can be changed" }),
};

export function orderConfirmation(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const line = { padding: [token("spacing.sm"), 0], border: { bottom: { width: 1, style: "solid", color: token("colors.border") } } } as const;
  const money = (n: number) => new Intl.NumberFormat(brand.lang ?? "en", { style: "currency", currency: brand.currency }).format(n);
  return template({
    id: "emails.OrderConfirmation",
    version: "1.0.0",
    label: "Order confirmation",
    description: "An order confirmed: its number and date, the items with the total, and where it's going",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      order: "10001",
      placedOn: "January 9",
      firstName: "Ada",
      items: [{ name: "Field notebook, dot grid", quantity: 1, price: 14 }],
      shipTo: { name: "Ada Park", lines: ["48 Harbor Road", "Portland, OR 97209"] },
      orderLink: `${brand.links.site}/orders/10001`,
    },
    render: (v) => {
      const subtotal = v.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const extras = v.shippingCost !== undefined || v.taxes.length > 0 || v.discount !== undefined;
      const total = subtotal + (v.shippingCost ?? 0) + v.taxes.reduce((sum, tax) => sum + tax.amount, 0) + (v.discount?.amount ?? 0);
      // A column for the pictures only where an item has one, so the names line up.
      const pictures = v.items.some((item) => item.thumbnail);
      const right = { textAlign: "right", width: 110 } as const;
      const sumLine = { padding: [token("spacing.xs"), 0], color: token("colors.muted") } as const;
      return (
        <Email
          width={560}
          title={`Your ${brand.name} order ${v.order}`}
          previewText={`Order ${v.order} is confirmed: ${money(total)}. We'll email you when it ships.`}
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
              <Column
                style={{
                  backgroundColor: token("colors.primary"),
                  color: token("colors.primaryForeground"),
                  padding: [token("spacing.xl"), token("spacing.xl"), token("spacing.lg")],
                  gap: token("spacing.sm"),
                  borderRadius: { topLeft: token("radii.md"), topRight: token("radii.md") },
                }}
              >
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: token("colors.primaryForeground"),
                  }}
                >
                  Order confirmed
                </Text>
                <Heading level={1} field={v.firstName ? "firstName" : undefined} style={{ color: token("colors.primaryForeground") }}>
                  {v.firstName ? `Thanks for your order, ${v.firstName}` : "Thanks for your order"}
                </Heading>
              </Column>
              <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
                <Text>We've got it, and we'll email you again when it ships.</Text>
                <Row stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                  <Column>
                    <Text style={small}>Order</Text>
                    <Text field="order" style={{ fontWeight: 700 }}>{v.order}</Text>
                  </Column>
                  <Column>
                    <Text style={{ ...small, textAlign: "right" }}>Placed on</Text>
                    <Text field="placedOn" style={{ fontWeight: 700, textAlign: "right" }}>{v.placedOn}</Text>
                  </Column>
                </Row>
                <Table>
                  {v.items.map((item, i) => (
                    <TableRow key={i}>
                      {pictures && (
                        <TableCell style={{ ...line, width: 72, verticalAlign: "top" }}>
                          {item.thumbnail && (
                            <Image field={`items[${i}].thumbnail`} src={item.thumbnail} alt={item.name} style={{ width: 56, borderRadius: token("radii.sm") }} />
                          )}
                        </TableCell>
                      )}
                      <TableCell field={`items[${i}].name`} style={line}>
                        {item.name}
                        <LineBreak />
                        <Span field={`items[${i}].quantity`} style={small}>
                          {item.quantity > 1 ? `Quantity ${item.quantity}, ${money(item.price)} each` : `Quantity ${item.quantity}`}
                        </Span>
                      </TableCell>
                      <TableCell field={`items[${i}].price`} style={{ ...line, ...right }}>{money(item.quantity * item.price)}</TableCell>
                    </TableRow>
                  ))}
                  {extras && (
                    <TableRow>
                      <TableCell colSpan={pictures ? 2 : 1} style={{ ...sumLine, padding: [token("spacing.sm"), 0, token("spacing.xs")] }}>Subtotal</TableCell>
                      <TableCell style={{ ...sumLine, ...right, padding: [token("spacing.sm"), 0, token("spacing.xs")] }}>{money(subtotal)}</TableCell>
                    </TableRow>
                  )}
                  {v.shippingCost !== undefined && (
                    <TableRow>
                      <TableCell colSpan={pictures ? 2 : 1} style={sumLine}>Shipping</TableCell>
                      <TableCell field="shippingCost" style={{ ...sumLine, ...right }}>{v.shippingCost === 0 ? "Free" : money(v.shippingCost)}</TableCell>
                    </TableRow>
                  )}
                  {v.discount && (
                    <TableRow>
                      <TableCell colSpan={pictures ? 2 : 1} field="discount.label" style={sumLine}>{v.discount.label}</TableCell>
                      <TableCell field="discount.amount" style={{ ...sumLine, ...right }}>{money(v.discount.amount)}</TableCell>
                    </TableRow>
                  )}
                  {v.taxes.map((tax, i) => (
                    <TableRow key={`tax-${i}`}>
                      <TableCell colSpan={pictures ? 2 : 1} field={`taxes[${i}].label`} style={sumLine}>{tax.label}</TableCell>
                      <TableCell field={`taxes[${i}].amount`} style={{ ...sumLine, ...right }}>{money(tax.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell
                      colSpan={pictures ? 2 : 1}
                      style={{
                        padding: [token("spacing.sm"), 0],
                        fontWeight: 700,
                        ...(extras ? { border: { top: { width: 1, style: "solid", color: token("colors.border") } } } : {}),
                      }}
                    >
                      Total
                    </TableCell>
                    <TableCell
                      style={{
                        padding: [token("spacing.sm"), 0],
                        fontWeight: 700,
                        ...right,
                        ...(extras ? { border: { top: { width: 1, style: "solid", color: token("colors.border") } } } : {}),
                      }}
                    >
                      {money(total)}
                    </TableCell>
                  </TableRow>
                </Table>
                <Column style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), padding: token("spacing.md"), gap: 2 }}>
                  <Text style={small}>Shipping to</Text>
                  <Text field="shipTo.name" style={{ fontWeight: 700 }}>{v.shipTo.name}</Text>
                  {v.shipTo.lines.map((address, i) => (
                    <Text key={i} field={`shipTo.lines[${i}]`}>{address}</Text>
                  ))}
                </Column>
                <Text style={{ color: token("colors.muted") }}>
                  {"Need to change something? Reply within the hour, or see "}
                  <Link field="orderLink" href={v.orderLink}>{`order ${v.order}`}</Link>
                  .
                </Text>
              </Column>
            </Column>
            <Column style={{ gap: token("spacing.xs") }}>
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

export default orderConfirmation(brand);
