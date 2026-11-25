/**
 * An event invitation. Its logo, its headings, the button's words and its footer (the company's address and the link
 * that stops these invitations) are locked: a design fills the event's name and tagline, whether it's in person,
 * online or both, its dates, hours and place or the link that joins it, the page that registers for it, the schedule,
 * and any details of its own. It's made from a brand (`event(brand)`), which sets its colors, fonts, logo and company
 * details, and the domains its links may go to.
 */
import { Button, Column, Email, Heading, Image, Link, List, ListItem, Row, Section, Span, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** Text with no year in it, so it reads the same any time. */
const noYear = (min: number, max: number) => `^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{${min},${max}}$`;
/** The month in full and the day, which the calendar badge splits: no year, no weekday. */
const MONTH_DAY = "^(January|February|March|April|May|June|July|August|September|October|November|December) ([1-9]|[12][0-9]|3[01])$";

const fields = {
  name: prop.text({ label: "Event", required: true, maxLength: 60, guidance: "Its name, in title case: Build Day" }),
  tagline: prop.text({ label: "Tagline", required: true, pattern: "^[\\s\\S]{20,120}$", guidance: "One sentence on who it's for and what happens: 20 to 120 characters" }),
  attendance: prop.choice(["in person", "online", "hybrid"], {
    label: "Format",
    default: "in person",
    guidance: "In person needs a venue and its address; online needs a join link; hybrid needs all three",
  }),
  date: prop.text({ label: "Date", required: true, pattern: MONTH_DAY, guidance: "The month and the day, with no year or weekday: May 14" }),
  endDate: prop.text({ label: "Ends", pattern: MONTH_DAY, guidance: "For an event of more than one day, its last day, with no year or weekday: May 15" }),
  time: prop.text({ label: "Hours", required: true, pattern: noYear(3, 32), guidance: "When it starts and ends: 9:30 AM to 6:00 PM" }),
  venue: prop.text({ label: "Venue", pattern: noYear(2, 60), guidance: "The building's name: The Foundry. For an event in person or hybrid" }),
  address: prop.list(prop.text({ label: "Line", required: true, maxLength: 60 }), {
    label: "Address",
    min: 0,
    max: 5,
    guidance: "The venue's address, a line each: its street, its city, and its country for guests from abroad. For an event in person or hybrid",
  }),
  joinLink: prop.link({ label: "Join link", guidance: "The page that streams or joins the event online. For an event online or hybrid" }),
  registerLink: prop.link({ label: "Registration page", required: true, guidance: "The page on your site that registers for the event" }),
  schedule: prop.list(
    prop.object(
      {
        time: prop.text({ label: "Time", required: true, pattern: noYear(1, 8), guidance: "When it starts: 9:30 AM" }),
        title: prop.text({ label: "What happens", required: true, maxLength: 100, guidance: "What happens then, in sentence case: Workshops, in four rooms" }),
      },
      { label: "Session" },
    ),
    { label: "Schedule", min: 0, max: 8, guidance: "The main sessions, in order; leave it empty to show no schedule" },
  ),
  details: field.slot({
    label: "Details",
    allow: [Column, Heading, Text, Span, Link, List, ListItem, Image],
    styles: "theme",
    count: { Image: { max: 2 } },
    guidance: "Anything else a guest should know, after the button: a heading and a few sentences, or a short list (what to bring, how to get there). Images have alt text. Friendly and plain: sentence case, no exclamation marks, no emoji.",
  }),
};

/** The dates an event runs: May 14, May 14–15, or May 30 – June 1. */
const dates = (start: string, end?: string) => {
  if (!end || end === start) return start;
  const [startMonth] = start.split(" ");
  const [endMonth, endDay] = end.split(" ");
  return startMonth === endMonth ? `${start}–${endDay}` : `${start} – ${end}`;
};

export function event(brand: Brand) {
  return template({
    id: "emails.Event",
    version: "1.0.0",
    label: "Event invitation",
    description: "An invitation: the event's name on a band of the brand's color, when and where, a button to register, and the day's schedule",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "marketing" }) },
      require: { lint: ["unsubscribe", "preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains], tags: "deny" },
    },
    example: {
      name: "Build Day",
      tagline: "A day of talks and workshops for the people who build and ship software.",
      date: "May 14",
      time: "9:30 AM to 6:00 PM",
      venue: "The Foundry",
      address: ["120 Mill Street", "Pittsburgh"],
      registerLink: `${brand.links.site}/events/build-day`,
      schedule: [
        { time: "9:30 AM", title: "Doors open, coffee and breakfast" },
        { time: "1:00 PM", title: "Workshops, in four rooms" },
      ],
    },
    render: (v) => {
      const [month, day] = v.date.split(" ");
      const when = dates(v.date, v.endDate);
      const inPerson = v.attendance !== "online";
      const online = v.attendance !== "in person";
      const place = inPerson ? [v.venue, ...v.address].filter(Boolean).join(", ") : "";
      const where = [place, online ? (place ? "and online" : "Online") : ""].filter(Boolean).join(" ");
      return (
        <Email
          width={600}
          title={`You're invited to ${v.name}`}
          previewText={`${where ? `${when}, ${place ? where : "online"}.` : `${when}.`} ${v.tagline}`}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
        >
          <Section style={{ padding: [token("spacing.lg"), token("spacing.xl")] }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 140 }} />
          </Section>
          <Section style={{ backgroundColor: token("colors.primary"), color: token("colors.primaryForeground"), padding: [token("spacing.xl"), token("spacing.xl")] }}>
            <Column style={{ gap: token("spacing.sm") }}>
              <Text style={{ fontSize: token("fontSizes.small"), fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>You're invited</Text>
              <Heading level={1} field="name" style={{ color: token("colors.primaryForeground") }}>{v.name}</Heading>
              <Text field="tagline">{v.tagline}</Text>
            </Column>
          </Section>
          <Section style={{ padding: [token("spacing.xl"), token("spacing.xl"), token("spacing.lg")] }}>
            <Column style={{ gap: token("spacing.lg") }}>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "center" }}>
                <Column style={{ width: 76 }}>
                  <Column style={{ width: 76, backgroundColor: token("colors.surface"), borderRadius: token("radii.md"), padding: [10, 0] }}>
                    <Text
                      style={{
                        fontSize: token("fontSizes.small"),
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: token("colors.primary"),
                        textAlign: "center",
                      }}
                    >
                      {month.slice(0, 3)}
                    </Text>
                    <Text style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>{day}</Text>
                  </Column>
                </Column>
                <Column style={{ gap: 2 }}>
                  <Text field="date" style={{ fontWeight: 700 }}>{when}</Text>
                  <Text field="time" style={{ color: token("colors.muted") }}>{v.time}</Text>
                  {where && (
                    <Text field={place ? (v.venue ? "venue" : "address") : "attendance"} style={{ color: token("colors.muted") }}>
                      {where}
                    </Text>
                  )}
                  {online && v.joinLink && (
                    <Text>
                      <Link field="joinLink" href={v.joinLink}>{`Join ${v.name} online`}</Link>
                    </Text>
                  )}
                </Column>
              </Row>
              <Button
                field="registerLink"
                href={v.registerLink}
                style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
              >
                {`Register for ${v.name}`}
              </Button>
            </Column>
          </Section>
          {v.details && (
            <Section field="details" style={{ padding: [0, token("spacing.xl"), token("spacing.xl")] }}>
              {v.details}
            </Section>
          )}
          {v.schedule.length > 0 && (
            <Section style={{ padding: [0, token("spacing.xl"), token("spacing.xl")] }}>
              <Column
                style={{
                  gap: token("spacing.sm"),
                  border: { top: { width: 1, style: "solid", color: token("colors.border") } },
                  padding: [token("spacing.lg"), 0, 0],
                }}
              >
                <Heading level={2}>{v.endDate && v.endDate !== v.date ? "The schedule" : "The day"}</Heading>
                {v.schedule.map((session, i) => (
                  <Row key={i} stackOnMobile={false} style={{ gap: token("spacing.md") }}>
                    <Column style={{ width: 96 }}>
                      <Text field={`schedule[${i}].time`} style={{ fontWeight: 700, color: token("colors.primary") }}>{session.time}</Text>
                    </Column>
                    <Column>
                      <Text field={`schedule[${i}].title`}>{session.title}</Text>
                    </Column>
                  </Row>
                ))}
              </Column>
            </Section>
          )}
          <Section style={{ backgroundColor: token("colors.surface"), padding: [token("spacing.lg"), token("spacing.xl")] }}>
            <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
              {brand.address ? `${brand.name} · ${brand.address}` : brand.name}
              {" · "}
              <Link href={brand.links.unsubscribe}>Stop event invitations</Link>
            </Text>
          </Section>
        </Email>
      );
    },
  });
}

export default event(brand);
