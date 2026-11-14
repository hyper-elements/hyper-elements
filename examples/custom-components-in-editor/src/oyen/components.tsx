/**
 * Oyen's own components (Oyen is a fictional maker of audio instruments): the parts its dispatches repeat. Warm
 * drafting paper, near-black ink and one signal orange; Geist for words, Geist Mono for labels and numbers.
 *
 * Each is one `component()`: a name, typed props and a render. In a template it's a tag (`<Callout number={1} … />`);
 * in the Unlayer editor the same definition is a tool, with a field for each prop (see `tools.ts`).
 *
 * A component drawn in the editor is drawn on its own, so each sets its own font and colors instead of taking the
 * template's.
 */
import { Button, Column, Heading, Row, Text, component, prop } from "@hyper-elements/react";
import { currency } from "../properties";

export const PAPER = "#F3F1EC";
export const INK = "#1A1917";
export const QUIET = "#5F5B53";
export const RULE = "#D3CEC4";
export const SIGNAL = "#FF5B1F";
const SIGNAL_DOWN = "#E8490F";

export const SANS = "Geist, 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const MONO = "'Geist Mono', SFMono-Regular, Menlo, Consolas, monospace";

const SITE = "https://oyen.example";

/** Words: the text face, in ink. */
const words = { fontFamily: SANS, color: INK } as const;
/** Small mono capitals: section labels, metadata, a figure's caption. */
export const label = { fontFamily: MONO, fontSize: 12, lineHeight: 1.5, letterSpacing: 1.2, textTransform: "uppercase", color: QUIET } as const;

/** A price as Oyen writes one, in euros: no decimals where there are none. */
const money = (amount: number) => `€${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

/** The announcement: what's new, in one line, with the way to get it. */
export const Announcement = component({
  type: "oyen.Announcement",
  label: "Announcement",
  props: {
    eyebrow: prop.text({ label: "Eyebrow", default: "New instrument" }),
    headline: prop.text({ label: "Headline", required: true }),
    lede: prop.text({ label: "Lede", default: "" }),
    button: prop.text({ label: "Button", default: "Pre-order" }),
    href: prop.link({ label: "Button link", default: SITE }),
    // The example's own property (`../properties.ts`): a number, from 0, edited as money, its field showing €.
    price: currency({ label: "Price", min: 0, default: 349, symbol: "€" }),
    ships: prop.text({ label: "Ships", default: "Ships 2 December" }),
  },
  render: (p) => (
    <Column style={{ gap: 28, mobile: { gap: 24 } }}>
      <Column style={{ gap: 20 }}>
        <Text style={label}>{p.eyebrow}</Text>
        <Heading level={1} style={{ ...words, fontSize: 62, lineHeight: 1, letterSpacing: -2.6, fontWeight: 500, mobile: { fontSize: 44, letterSpacing: -1.8 } }}>
          {p.headline}
        </Heading>
      </Column>
      {p.lede ? <Text style={{ ...words, fontSize: 19, lineHeight: 1.5, maxWidth: 400, mobile: { fontSize: 17 } }}>{p.lede}</Text> : null}
      <Row style={{ alignItems: "center", gap: 20, mobile: { gap: 14 } }}>
        <Button
          href={p.href}
          style={{ width: 184, backgroundColor: SIGNAL, color: INK, fontFamily: SANS, fontSize: 15, fontWeight: 600, padding: [16, 0], borderRadius: 2, mobile: { width: "100%" }, hover: { backgroundColor: SIGNAL_DOWN } }}
        >
          {p.button}
        </Button>
        <Text style={label}>{`${money(p.price)} · ${p.ships}`}</Text>
      </Row>
    </Column>
  ),
});

/** One of a drawing's callouts: its number in a disc, what the part is, and why it matters. */
export const Callout = component({
  type: "oyen.Callout",
  label: "Callout",
  props: {
    number: prop.number({ label: "Number", min: 1, max: 99, integer: true, default: 1 }),
    title: prop.text({ label: "Title", required: true }),
    body: prop.text({ label: "Text", default: "" }),
    color: prop.color({ label: "Disc", default: SIGNAL }),
    rule: prop.boolean({ label: "Rule above", default: true }),
  },
  render: ({ number, title, body, color, rule }) => (
    <Row stackOnMobile={false} style={{ gap: 16, padding: rule ? [20, 0] : [0, 0, 20], border: rule ? { top: `1px solid ${RULE}` } : undefined }}>
      <Column style={{ width: 24 }}>
        <Text style={{ width: 24, backgroundColor: color, borderRadius: 12, fontFamily: MONO, fontSize: 12, fontWeight: 500, lineHeight: "24px", textAlign: "center", color: INK }}>{String(number)}</Text>
      </Column>
      <Column style={{ gap: 4 }}>
        <Heading level={3} style={{ ...words, fontSize: 17, fontWeight: 600, lineHeight: "24px", letterSpacing: -0.2 }}>
          {title}
        </Heading>
        {body ? <Text style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.55, color: QUIET }}>{body}</Text> : null}
      </Column>
    </Row>
  ),
});

/** A line of the spec sheet: what's measured in the label face, and its value. */
export const Spec = component({
  type: "oyen.Spec",
  label: "Spec",
  props: {
    name: prop.text({ label: "Name", required: true }),
    value: prop.text({ label: "Value", required: true }),
    rule: prop.boolean({ label: "Rule above", default: true }),
  },
  render: ({ name, value, rule }) => (
    <Row stackOnMobile={false} style={{ gap: 12, padding: rule ? [10, 0] : [0, 0, 10], border: rule ? { top: `1px solid ${RULE}` } : undefined }}>
      <Column style={{ width: 100 }}>
        <Text style={{ fontFamily: MONO, fontSize: 12, lineHeight: "21px", letterSpacing: 0.6, textTransform: "uppercase", color: QUIET }}>{name}</Text>
      </Column>
      <Column>
        <Text style={{ ...words, fontSize: 14, lineHeight: "21px" }}>{value}</Text>
      </Column>
    </Row>
  ),
});

/** A line from someone who used it, and who they are. */
export const FieldNote = component({
  type: "oyen.FieldNote",
  label: "Field note",
  props: {
    quote: prop.text({ label: "Quote", required: true }),
    name: prop.text({ label: "Name", required: true }),
    role: prop.text({ label: "Role", default: "" }),
  },
  render: ({ quote, name, role }) => (
    <Column style={{ gap: 16 }}>
      <Text style={{ ...words, fontSize: 24, lineHeight: 1.32, letterSpacing: -0.6, mobile: { fontSize: 22 } }}>{`“${quote}”`}</Text>
      <Text style={label}>{role ? `${name}, ${role}` : name}</Text>
    </Column>
  ),
});

/** The closing band: the price as large as it goes, and the button again. */
export const PriceBand = component({
  type: "oyen.PriceBand",
  label: "Price band",
  props: {
    eyebrow: prop.text({ label: "Eyebrow", default: "First run" }),
    price: currency({ label: "Price", min: 0, default: 349, symbol: "€" }),
    note: prop.text({ label: "Note", default: "" }),
    button: prop.text({ label: "Button", default: "Pre-order" }),
    href: prop.link({ label: "Button link", default: SITE }),
    background: prop.color({ label: "Band", default: SIGNAL }),
  },
  render: (p) => (
    <Column style={{ backgroundColor: p.background, padding: [44, 48, 48], mobile: { padding: [36, 24] } }}>
      <Row style={{ alignItems: "end", gap: 24, mobile: { gap: 28 } }}>
        <Column style={{ gap: 14 }}>
          <Text style={{ ...label, color: INK }}>{p.eyebrow}</Text>
          <Heading level={2} style={{ ...words, fontSize: 96, lineHeight: 0.9, letterSpacing: -4.5, fontWeight: 500, mobile: { fontSize: 80, letterSpacing: -3.6 } }}>
            {money(p.price)}
          </Heading>
          {p.note ? <Text style={{ ...words, fontSize: 15, lineHeight: 1.5 }}>{p.note}</Text> : null}
        </Column>
        <Column style={{ width: 168, mobile: { width: "100%" } }}>
          <Button href={p.href} style={{ width: "100%", backgroundColor: INK, color: PAPER, fontFamily: SANS, fontSize: 15, fontWeight: 600, padding: [16, 20], borderRadius: 2, hover: { backgroundColor: "#3A3833" } }}>
            {p.button}
          </Button>
        </Column>
      </Row>
    </Column>
  ),
});

/** Every component, for the editor and for reading a design back. */
export const components = [Announcement, Callout, Spec, FieldNote, PriceBand];
