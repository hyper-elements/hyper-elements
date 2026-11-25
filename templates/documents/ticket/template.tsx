/**
 * A ticket as a PDF. Its band of the brand's color, the logo, its headings and its terms line are locked; a design fills
 * the event, its date, who the ticket is for, when doors open, where, the code to show at the door, and the code's QR
 * image where it has one. It's made from a brand (`ticket(brand)`), which sets its colors, fonts and logo.
 */
import { Column, Document, Heading, Image, Link, Row, Text, prop, token } from "@hyper-elements/react";
import { field, fitInside, template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

const fields = {
  event: prop.text({ label: "Event", required: true, maxLength: 48, guidance: "Its name, in title case: Build Day" }),
  date: prop.text({
    label: "Date",
    required: true,
    // A month and day, or a range of days, with no year, so it reads the same any time.
    pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,20}$",
    guidance: "The day of the event, or its days, with no year or weekday: May 14, or May 14–15",
  }),
  holder: prop.text({ label: "Ticket holder", required: true, maxLength: 60 }),
  doorsOpen: prop.text({ label: "Doors open", required: true, maxLength: 16, guidance: "The time doors open: 9:00 AM" }),
  venue: prop.text({ label: "Where", required: true, maxLength: 72, guidance: "The venue and its address: The Foundry, 120 Mill Street, Pittsburgh" }),
  code: prop.text({ label: "Door code", required: true, pattern: "^[A-Z0-9][A-Z0-9-]{3,13}$", guidance: "Capital letters, digits and dashes: BD-4821-K7" }),
  qr: field.image({
    label: "QR code",
    accepts: ["png"],
    // Drawn whole, 96px square, beside the code: the door's scanner reads it.
    aspect: { min: 1, max: 1 },
    fit: "contain",
    minWidth: 300,
    guidance: "The door code as a QR code, square, with its quiet margin",
  }),
};

/** A character's width in Inter, in ems, by its kind: a little over, so text is never thought shorter than it is. */
const em = (ch: string) => (/[mwMW@%]/.test(ch) ? 0.95 : /[A-Z0-9#$&€£]/.test(ch) ? 0.7 : /[ijlrtfI.,;:'|!()[\] ]/.test(ch) ? 0.34 : 0.58);
const widthOf = (word: string, size: number) => [...word].reduce((sum, ch) => sum + em(ch), 0) * size;

/** How many lines a text takes at `size` px in a column `width` px wide, broken at its spaces (an estimate). */
function linesOf(text: string, width: number, size: number): number {
  let lines = 1;
  let x = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = widthOf(word, size);
    if (x > 0 && x + 0.34 * size + w > width) {
      lines += 1;
      x = 0;
    }
    x += (x > 0 ? 0.34 * size : 0) + w;
  }
  return lines;
}

const BAND = 200;
const QR = 96;

export function ticket(brand: Brand) {
  const caption = { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: token("colors.muted") } as const;
  const { md, lg } = brand.theme.spacing as Record<string, number>;
  // The right side's width inside its padding: an A5 page's, landscape, inside its margins, less the band.
  const side = 730 - BAND - 2 * lg!;
  // The event's name at the brand's second heading's size, or smaller where it's long: each word on a line, four lines at most.
  const own = (brand.theme.elements?.Heading as { by?: { level?: Record<number, { fontSize?: number }> } } | undefined)?.by?.level?.[2]?.fontSize ?? 26;
  const eventSize = (event: string) => {
    const room = BAND - 2 * lg!;
    let size = own;
    while (size > 12 && (linesOf(event, room, size) > 4 || Math.max(...event.split(/\s+/).map((word) => widthOf(word, size))) > room)) size -= 2;
    return size;
  };
  const helpText = brand.links.help.replace(/^https?:\/\/(www\.)?/, "");
  const help = brand.links.help;
  return template({
    id: "documents.Ticket",
    version: "1.0.0",
    label: "Ticket",
    description: "A ticket as a PDF: the event on a band of the brand's color, who it's for, when and where, and the code to show at the door",
    root: "Document",
    fields,
    rules: {
      require: { core: ["layout/overflow", "document/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      event: "Open Studio",
      date: "June 3",
      holder: "Sam Rivera",
      doorsOpen: "6:00 PM",
      venue: "The Foundry, 120 Mill Street, Pittsburgh",
      code: "OS-1024-A1",
    },
    render: (v) => {
      const size = eventSize(v.event);
      // The door code and the time doors open at their sizes, or smaller where they're wide.
      const codeRoom = side - 2 * md! - (v.qr ? QR + md! : 0);
      const codeSize = Math.max(12, Math.min(22, Math.floor((codeRoom - 3 * v.code.length) / ([...v.code].reduce((sum, ch) => sum + em(ch), 0) || 1))));
      const doorsSize = Math.max(11, Math.min(16, Math.floor((side - lg!) / 2 / (widthOf(v.doorsOpen, 1) * 1.08))));
      return (
        <Document
          size="A5"
          orientation="landscape"
          margin={32}
          title={`Ticket for ${v.event}, ${v.holder}`}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ fontSize: 12, lineHeight: token("lineHeights.body") }}
        >
          <Document.Page>
            <Row style={{ border: { width: 1, style: "solid", color: token("colors.border") }, borderRadius: token("radii.md") }}>
              <Column
                style={{
                  width: BAND,
                  backgroundColor: token("colors.primary"),
                  color: token("colors.primaryForeground"),
                  padding: token("spacing.lg"),
                  gap: token("spacing.sm"),
                  borderRadius: { topLeft: token("radii.md"), bottomLeft: token("radii.md") },
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Admit one</Text>
                <Heading field="event" level={2} style={{ color: token("colors.primaryForeground"), ...(size === own ? {} : { fontSize: size, lineHeight: 1.2 }) }}>
                  {v.event}
                </Heading>
                <Text field="date">{v.date}</Text>
              </Column>
              <Column style={{ padding: token("spacing.lg"), gap: token("spacing.md") }}>
                <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 120 }} />
                <Row style={{ gap: token("spacing.lg") }}>
                  <Column style={{ gap: 2 }}>
                    <Text style={caption}>Ticket holder</Text>
                    <Text field="holder" style={{ fontSize: 16, fontWeight: 700 }}>{v.holder}</Text>
                  </Column>
                  <Column style={{ gap: 2 }}>
                    <Text style={caption}>Doors open</Text>
                    <Text field="doorsOpen" style={{ fontSize: doorsSize, fontWeight: 700 }}>{v.doorsOpen}</Text>
                  </Column>
                </Row>
                <Column style={{ gap: 2 }}>
                  <Text style={caption}>Where</Text>
                  <Text field="venue">{v.venue}</Text>
                </Column>
                <Row stackOnMobile={false} style={{ backgroundColor: token("colors.surface"), borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.md")], gap: token("spacing.md"), alignItems: "center" }}>
                  <Column style={{ gap: 2 }}>
                    <Text style={caption}>Show this at the door</Text>
                    <Text field="code" style={{ fontSize: codeSize, fontWeight: 700, letterSpacing: 3 }}>{v.code}</Text>
                  </Column>
                  {v.qr ? (
                    <Column style={{ width: QR }}>
                      <Image field="qr" src={v.qr} alt={`QR code for ${v.code}`} style={fitInside(v.qr, { width: QR, height: QR })} />
                    </Column>
                  ) : null}
                </Row>
                <Text style={{ fontSize: 10, color: token("colors.muted") }}>
                  {"One entry per ticket, and it can't be resold. Terms, refunds and help: "}
                  <Link href={help}>{helpText}</Link>
                </Text>
              </Column>
            </Row>
          </Document.Page>
        </Document>
      );
    },
  });
}

export default ticket(brand);
