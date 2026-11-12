/**
 * Five components a shop reuses in its emails: a product, a customer's words, a coupon, an order's progress and a
 * ticket. One quiet look (white cards on warm paper, near-black ink) and one accent color, which each takes as a prop,
 * so a team makes them its own.
 *
 * Each is one `component()`: a tag in a template, and a tool in the Unlayer editor with a field for each prop (see
 * `tools.ts`). A component drawn in the editor is drawn on its own, so each sets its own font and colors.
 */
import { Button, Column, Heading, Image, Row, Span, Text, component, prop } from "@hyper-elements/react";

export const INK = "#14171A";
export const MUTED = "#5E6670";
export const LINE = "#E6E3DC";
export const WASH = "#F6F4EF";
export const PAPER = "#EFECE5";
const WHITE = "#FFFFFF";
const ACCENT = "#0E7C66";

export const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";

/** Small capitals: what a thing is, above what it says. */
const eyebrow = { fontFamily: SANS, fontSize: 11, fontWeight: 700, lineHeight: 1.4, letterSpacing: 1.4, textTransform: "uppercase" } as const;
const accent = prop.color({ label: "Accent", default: ACCENT });

const SYMBOL = { EUR: "€", USD: "$", GBP: "£" } as const;
const money = (amount: number, currency: keyof typeof SYMBOL) => `${SYMBOL[currency]}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

/** A product: its photo, what it is, its price and the way to buy it. In the editor it can be filled from the store. */
export const ProductCard = component({
  type: "shop.ProductCard",
  label: "Product",
  props: {
    photo: prop.image({ label: "Photo" }),
    name: prop.text({ label: "Name", default: "Product name" }),
    description: prop.text({ label: "Description", default: "" }),
    // A number either way: the editor a team registers under this name shows it as money.
    price: prop.number({ label: "Price", min: 0, default: 49, editor: "currency", editorOptions: { step: 1 } }),
    currency: prop.choice(["EUR", "USD", "GBP"], { label: "Currency", default: "EUR" }),
    badge: prop.choice(["none", "new", "sale", "low stock"], { label: "Badge", default: "none" }),
    button: prop.text({ label: "Button", default: "Add to cart" }),
    href: prop.link({ label: "Button link", default: "https://example.com" }),
    accent,
  },
  render: (p) => (
    <Column style={{ backgroundColor: WHITE, border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden" }}>
      {p.photo ? <Image src={p.photo} alt={p.name} style={{ width: "100%" }} /> : null}
      <Column style={{ padding: 20, gap: 16 }}>
        <Column style={{ gap: 6 }}>
          {p.badge !== "none" ? <Text style={{ ...eyebrow, color: p.accent }}>{p.badge}</Text> : null}
          <Heading level={3} style={{ fontFamily: SANS, color: INK, fontSize: 20, fontWeight: 700, lineHeight: 1.25, letterSpacing: -0.2 }}>
            {p.name}
          </Heading>
          {p.description ? <Text style={{ fontFamily: SANS, color: MUTED, fontSize: 14, lineHeight: 1.5 }}>{p.description}</Text> : null}
        </Column>
        <Row stackOnMobile={false} style={{ alignItems: "center", gap: 12 }}>
          <Column>
            <Text style={{ fontFamily: SANS, color: INK, fontSize: 22, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.4 }}>{money(p.price, p.currency)}</Text>
          </Column>
          <Column style={{ width: 128 }}>
            <Button href={p.href} style={{ width: "100%", backgroundColor: p.accent, color: WHITE, fontFamily: SANS, fontSize: 14, fontWeight: 600, padding: [12, 0], borderRadius: 10 }}>
              {p.button}
            </Button>
          </Column>
        </Row>
      </Column>
    </Column>
  ),
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

/** A customer's words: how many stars, what they said, and who they are. */
export const Testimonial = component({
  type: "shop.Testimonial",
  label: "Testimonial",
  props: {
    rating: prop.number({ label: "Stars", min: 1, max: 5, integer: true, default: 5, editor: "counter" }),
    quote: prop.text({ label: "Quote", required: true }),
    name: prop.text({ label: "Name", required: true }),
    role: prop.text({ label: "Role", default: "" }),
    photo: prop.image({ label: "Photo" }),
    accent,
  },
  render: (p) => (
    <Column style={{ backgroundColor: WASH, borderRadius: 16, padding: 28, gap: 18 }}>
      <Text style={{ fontFamily: SANS, fontSize: 18, lineHeight: 1, letterSpacing: 3 }}>
        <Span style={{ color: p.accent }}>{"★".repeat(p.rating)}</Span>
        <Span style={{ color: "#D5D1C8" }}>{"★".repeat(5 - p.rating)}</Span>
      </Text>
      <Text style={{ fontFamily: SERIF, color: INK, fontSize: 21, lineHeight: 1.45, letterSpacing: -0.1 }}>{`“${p.quote}”`}</Text>
      <Row stackOnMobile={false} style={{ alignItems: "center", gap: 12 }}>
        <Column style={{ width: 44 }}>
          {p.photo ? (
            <Image src={p.photo} alt="" style={{ width: 44, borderRadius: 22 }} />
          ) : (
            <Text style={{ width: 44, backgroundColor: p.accent, borderRadius: 22, color: WHITE, fontFamily: SANS, fontSize: 15, fontWeight: 700, lineHeight: "44px", textAlign: "center" }}>{initials(p.name)}</Text>
          )}
        </Column>
        <Column style={{ gap: 2 }}>
          <Text style={{ fontFamily: SANS, color: INK, fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{p.name}</Text>
          {p.role ? <Text style={{ fontFamily: SANS, color: MUTED, fontSize: 13, lineHeight: 1.4 }}>{p.role}</Text> : null}
        </Column>
      </Row>
    </Column>
  ),
});

/** A coupon: what it's worth, the code to use, and until when. */
export const Coupon = component({
  type: "shop.Coupon",
  label: "Coupon",
  props: {
    eyebrow: prop.text({ label: "Eyebrow", default: "A thank-you" }),
    offer: prop.text({ label: "Offer", default: "20% off" }),
    detail: prop.text({ label: "Detail", default: "your next order" }),
    code: prop.text({ label: "Code", required: true }),
    expires: prop.text({ label: "Expires", default: "" }),
    button: prop.text({ label: "Button", default: "Shop now" }),
    href: prop.link({ label: "Button link", default: "https://example.com" }),
    accent,
  },
  render: (p) => (
    <Column style={{ backgroundColor: WHITE, border: `2px dashed ${p.accent}`, borderRadius: 16, padding: 24, gap: 20 }}>
      <Row style={{ alignItems: "center", gap: 20 }}>
        <Column style={{ gap: 4 }}>
          <Text style={{ ...eyebrow, color: p.accent }}>{p.eyebrow}</Text>
          <Heading level={3} style={{ fontFamily: SANS, color: INK, fontSize: 40, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.2 }}>
            {p.offer}
          </Heading>
          <Text style={{ fontFamily: SANS, color: MUTED, fontSize: 15, lineHeight: 1.5 }}>{p.detail}</Text>
        </Column>
        <Column style={{ width: 208, backgroundColor: WASH, borderRadius: 12, padding: [16, 12], gap: 6 }}>
          <Text style={{ ...eyebrow, color: MUTED, textAlign: "center" }}>Your code</Text>
          <Text style={{ fontFamily: MONO, color: INK, fontSize: 20, fontWeight: 700, lineHeight: 1.3, letterSpacing: 2, textAlign: "center" }}>{p.code}</Text>
        </Column>
      </Row>
      <Row stackOnMobile={false} style={{ alignItems: "center", gap: 12 }}>
        <Column>
          <Text style={{ fontFamily: SANS, color: MUTED, fontSize: 13, lineHeight: 1.4 }}>{p.expires}</Text>
        </Column>
        <Column style={{ width: 128 }}>
          <Button href={p.href} style={{ width: "100%", backgroundColor: INK, color: WHITE, fontFamily: SANS, fontSize: 14, fontWeight: 600, padding: [12, 0], borderRadius: 10 }}>
            {p.button}
          </Button>
        </Column>
      </Row>
    </Column>
  ),
});

const STEPS = ["ordered", "packed", "shipped", "delivered"] as const;
const STEP_LABEL = { ordered: "Ordered", packed: "Packed", shipped: "Shipped", delivered: "Delivered" } as const;
const STEP_SAYS = { ordered: "We’ve got your order.", packed: "Packed and ready to go.", shipped: "Your order is on its way.", delivered: "Delivered. Enjoy it." } as const;

/** An order's progress: one choice of where it is redraws the line, the words and what's still to come. */
export const OrderTracker = component({
  type: "shop.OrderTracker",
  label: "Order tracker",
  props: {
    status: prop.choice(STEPS, { label: "Where it is", default: "shipped" }),
    order: prop.text({ label: "Order number", default: "" }),
    eta: prop.text({ label: "When it arrives", default: "" }),
    button: prop.text({ label: "Button", default: "Track your order" }),
    href: prop.link({ label: "Button link", default: "https://example.com" }),
    accent,
  },
  render: (p) => {
    const at = STEPS.indexOf(p.status);
    return (
      <Column style={{ backgroundColor: WHITE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 24, gap: 22 }}>
        <Column style={{ gap: 6 }}>
          {p.order ? <Text style={{ ...eyebrow, color: p.accent }}>{`Order ${p.order}`}</Text> : null}
          <Heading level={3} style={{ fontFamily: SANS, color: INK, fontSize: 24, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 }}>
            {STEP_SAYS[p.status]}
          </Heading>
          {p.eta ? <Text style={{ fontFamily: SANS, color: MUTED, fontSize: 15, lineHeight: 1.5 }}>{p.eta}</Text> : null}
        </Column>
        <Row stackOnMobile={false} style={{ gap: 6 }}>
          {STEPS.map((step, i) => (
            <Column key={step} style={{ gap: 8 }}>
              <Column style={{ height: 6, backgroundColor: i <= at ? p.accent : LINE, borderRadius: 3 }} />
              <Text style={{ fontFamily: SANS, color: i <= at ? INK : MUTED, fontSize: 12, fontWeight: i === at ? 700 : 400, lineHeight: 1.4 }}>{STEP_LABEL[step]}</Text>
            </Column>
          ))}
        </Row>
        <Button href={p.href} style={{ width: 176, backgroundColor: INK, color: WHITE, fontFamily: SANS, fontSize: 14, fontWeight: 600, padding: [12, 0], borderRadius: 10 }}>
          {p.button}
        </Button>
      </Column>
    );
  },
});

/** Code 39: each character is five bars and four spaces, three of them wide (1). */
const CODE39: Record<string, string> = {
  "0": "000110100", "1": "100100001", "2": "001100001", "3": "101100000", "4": "000110001", "5": "100110000", "6": "001110000", "7": "000100101", "8": "100100100", "9": "001100100",
  A: "100001001", B: "001001001", C: "101001000", D: "000011001", E: "100011000", F: "001011000", G: "000001101", H: "100001100", I: "001001100", J: "000011100",
  K: "100000011", L: "001000011", M: "101000010", N: "000010011", O: "100010010", P: "001010010", Q: "000000111", R: "100000110", S: "001000110", T: "000010110",
  U: "110000001", V: "011000001", W: "111000000", X: "010010001", Y: "110010000", Z: "011010000", "-": "010000101", ".": "110000100", " ": "011000100", "*": "010010100",
};

/** A code as a barcode's bars and spaces, each with its width in px: Code 39, between its start and stop marks. */
export function bars(code: string): Array<{ bar: boolean; width: number }> {
  const text = code.toUpperCase().replace(/[^0-9A-Z. -]/g, "");
  const out: Array<{ bar: boolean; width: number }> = [];
  for (const char of `*${text}*`) {
    [...CODE39[char]!].forEach((wide, i) => out.push({ bar: i % 2 === 0, width: wide === "1" ? 4 : 2 }));
    out.push({ bar: false, width: 2 });
  }
  return out.slice(0, -1);
}

/** A ticket: the event, when and where, whose it is, and its code as a barcode drawn from the code itself. */
export const Ticket = component({
  type: "shop.Ticket",
  label: "Ticket",
  props: {
    event: prop.text({ label: "Event", required: true }),
    date: prop.text({ label: "Date", default: "" }),
    time: prop.text({ label: "Doors", default: "" }),
    place: prop.text({ label: "Place", default: "" }),
    seat: prop.text({ label: "Seat", default: "" }),
    name: prop.text({ label: "Whose it is", default: "" }),
    code: prop.text({ label: "Code", required: true }),
    accent,
  },
  render: (p) => {
    const field = (name: string, value: string) =>
      value ? (
        <Column key={name} style={{ gap: 4 }}>
          <Text style={{ ...eyebrow, color: "#8A939C" }}>{name}</Text>
          <Text style={{ fontFamily: SANS, color: WHITE, fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{value}</Text>
        </Column>
      ) : null;
    return (
      <Column style={{ backgroundColor: INK, borderRadius: 18, overflow: "hidden" }}>
        <Column style={{ padding: [28, 28, 24], gap: 22 }}>
          <Column style={{ gap: 8 }}>
            <Text style={{ ...eyebrow, color: p.accent }}>Admit one</Text>
            <Heading level={3} style={{ fontFamily: SANS, color: WHITE, fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.9 }}>
              {p.event}
            </Heading>
          </Column>
          <Row stackOnMobile={false} style={{ gap: 20 }}>
            {field("Date", p.date)}
            {field("Doors", p.time)}
            {field("Seat", p.seat)}
          </Row>
          {field("Place", p.place)}
        </Column>
        <Column style={{ backgroundColor: WHITE, border: { top: `2px dashed ${INK}` }, padding: [20, 28, 22], gap: 10 }}>
          <Row stackOnMobile={false} style={{ height: 52 }}>
            {bars(p.code).map((part, i) => (
              <Column key={i} style={{ width: part.width, height: 52, backgroundColor: part.bar ? INK : WHITE }} />
            ))}
            <Column />
          </Row>
          <Row stackOnMobile={false} style={{ alignItems: "center" }}>
            <Column>
              <Text style={{ fontFamily: MONO, color: INK, fontSize: 13, fontWeight: 700, lineHeight: 1.4, letterSpacing: 2 }}>{p.code.toUpperCase()}</Text>
            </Column>
            <Column>
              <Text style={{ fontFamily: SANS, color: MUTED, fontSize: 13, lineHeight: 1.4, textAlign: "right" }}>{p.name}</Text>
            </Column>
          </Row>
        </Column>
      </Column>
    );
  },
});

/** Every component, for the editor and for reading a design back. */
export const components = [ProductCard, Testimonial, Coupon, OrderTracker, Ticket];
