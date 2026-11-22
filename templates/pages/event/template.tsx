/**
 * An event's web page. Its logo, its headings, the links' words and its footer (who runs it, the company's address and
 * a link to ask about it) are locked: a design fills the event's name and tagline, whether it's in person, online or
 * both, its dates, hours and place or the link that joins it, its tickets and whether they're on sale, the page that
 * registers for it, the schedule, the speakers and anything more about it. It's made from a brand (`event(brand)`),
 * which sets its colors, fonts, logo and company details, and the domains its links may go to.
 */
import { Button, Column, Grid, Heading, Image, Link, List, ListItem, Page, Row, Section, Span, Text, prop, token } from "@hyper-elements/react";
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
  status: prop.choice(["open", "waitlist", "sold out", "ended"], {
    label: "Registration",
    default: "open",
    guidance: "Open shows the button to register; waitlist, a button to join the waitlist; sold out and ended show no button",
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
  tickets: prop.text({ label: "Tickets", required: true, maxLength: 60, guidance: "What a seat costs, and what comes with it: Free, with lunch" }),
  registerLink: prop.link({ label: "Registration page", required: true, guidance: "The page on your site that registers for the event" }),
  schedule: prop.list(
    prop.object(
      {
        time: prop.text({ label: "Time", required: true, pattern: noYear(1, 8), guidance: "When it starts: 9:30 AM" }),
        title: prop.text({ label: "What happens", required: true, maxLength: 100, guidance: "What happens then, in sentence case: Lightning talks" }),
      },
      { label: "Session" },
    ),
    { label: "Schedule", min: 0, max: 10, guidance: "The sessions, in order; leave it empty to show no schedule" },
  ),
  speakers: prop.list(
    prop.object(
      {
        name: prop.text({ label: "Name", required: true, maxLength: 60, guidance: "Their first and last name; without a photo, the badge shows their initials" }),
        role: prop.text({ label: "Role", required: true, maxLength: 60, guidance: "Their job and where: Staff engineer, Northwind" }),
        talk: prop.text({ label: "Talk", required: true, maxLength: 100, guidance: "Their talk's title, in sentence case" }),
        photo: field.image({
          label: "Photo",
          aspect: { min: 1, max: 1 },
          fit: "cover",
          minWidth: 192,
          accepts: ["png", "jpeg"],
          guidance: "A square portrait with the face in the middle, at least 192px wide: it's cut to a circle",
        }),
      },
      { label: "Speaker" },
    ),
    { label: "Speakers", min: 0, max: 6, guidance: "Leave it empty to show no speakers" },
  ),
  about: field.slot({
    label: "About",
    allow: [Column, Row, Heading, Text, Span, Link, List, ListItem, Image],
    styles: "theme",
    count: { Image: { max: 4 } },
    guidance: "More about the event, under when and where: a heading and a few short paragraphs, a list, or a row of pictures. Images have alt text, or alt=\"\" for a decorative one. Friendly and plain: sentence case, no exclamation marks, no emoji.",
  }),
};

/** The dates an event runs: May 14, May 14–15, or May 30 – June 1. */
const dates = (start: string, end?: string) => {
  if (!end || end === start) return start;
  const [startMonth] = start.split(" ");
  const [endMonth, endDay] = end.split(" ");
  return startMonth === endMonth ? `${start}–${endDay}` : `${start} – ${end}`;
};

/** A speaker's initials, for their badge: Rosa Lindqvist → RL. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function event(brand: Brand) {
  const label = {
    fontSize: token("fontSizes.small"),
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: token("colors.muted"),
  } as const;
  return template({
    id: "pages.Event",
    version: "1.0.0",
    label: "Event page",
    description: "An event's web page: its name and tagline on a band of the brand's color, when and where, the schedule, and the speakers",
    root: "Page",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains], tags: "deny" },
    },
    example: {
      name: "Build Day",
      tagline: "A day of talks and workshops for the people who build and ship software.",
      date: "May 14",
      time: "9:30 AM to 6:00 PM",
      venue: "The Foundry",
      address: ["120 Mill Street", "Pittsburgh"],
      tickets: "Free, with lunch",
      registerLink: `${brand.links.site}/events/build-day`,
      schedule: [
        { time: "9:30 AM", title: "Doors open, coffee and breakfast" },
        { time: "1:00 PM", title: "Workshops, in four rooms" },
      ],
      speakers: [{ name: "Rosa Lindqvist", role: "Staff engineer, Northwind", talk: "Shipping weekly without breaking anything" }],
    },
    render: (v) => {
      const [month, day] = v.date.split(" ");
      const when = dates(v.date, v.endDate);
      const inPerson = v.attendance !== "online";
      const online = v.attendance !== "in person";
      // Where it is, in a few words: its venue (or its address's first line), online, or both.
      const place = inPerson ? (v.venue ?? v.address[0]) : undefined;
      const where = place ? (online ? `${place} and online` : place) : online ? "Online" : undefined;
      // What registering says, and whether there's a button for it.
      const signUp = v.status === "open" ? `Register for ${v.name}` : v.status === "waitlist" ? `Join the waitlist for ${v.name}` : undefined;
      const closed = v.status === "sold out" ? "Sold out" : v.status === "ended" ? "This event has ended" : undefined;
      const lists = v.schedule.length > 0 || v.speakers.length > 0;
      return (
        <Page
          width={1040}
          title={`${v.name} · ${brand.name}`}
          description={`${v.tagline} ${where ? `${when}, ${place ? where : "online"}.` : `${when}.`}`}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
        >
          <Section style={{ padding: [token("spacing.lg"), token("spacing.xl")] }}>
            <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md") }}>
              <Column>
                <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 150 }} />
              </Column>
              <Column style={{ alignItems: "end" }}>
                {signUp && (
                  <Link field="registerLink" href={v.registerLink}>
                    {signUp}
                  </Link>
                )}
              </Column>
            </Row>
          </Section>
          <Section style={{ backgroundColor: token("colors.primary"), color: token("colors.primaryForeground"), padding: [56, token("spacing.xl"), 64] }}>
            <Column style={{ gap: token("spacing.md"), maxWidth: 720 }}>
              <Text field="date" style={{ fontSize: token("fontSizes.small"), fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                {where ? `${when} · ${where}` : when}
              </Text>
              <Heading level={1} field="name" style={{ color: token("colors.primaryForeground") }}>{v.name}</Heading>
              <Text field="tagline" style={{ fontSize: 20 }}>{v.tagline}</Text>
              {signUp && (
                <Button
                  field="registerLink"
                  href={v.registerLink}
                  style={{
                    backgroundColor: token("colors.background"),
                    color: token("colors.foreground"),
                    borderRadius: token("radii.sm"),
                    padding: [token("spacing.sm"), token("spacing.lg")],
                  }}
                >
                  {signUp}
                </Button>
              )}
              {closed && (
                <Text field="status" style={{ fontWeight: 700 }}>
                  {closed}
                </Text>
              )}
            </Column>
          </Section>
          <Section style={{ padding: [token("spacing.xl"), token("spacing.xl")] }}>
            <Grid columns={3} style={{ gap: token("spacing.md") }}>
              <Row stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "center" }}>
                <Column style={{ width: 76 }}>
                  <Column style={{ width: 76, backgroundColor: token("colors.surface"), borderRadius: token("radii.md"), padding: [10, 0] }}>
                    <Text style={{ ...label, color: token("colors.primary"), textAlign: "center" }}>{month.slice(0, 3)}</Text>
                    <Text style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>{day}</Text>
                  </Column>
                </Column>
                <Column style={{ gap: 2 }}>
                  <Text style={label}>When</Text>
                  {v.endDate && v.endDate !== v.date && (
                    <Text field="endDate" style={{ fontWeight: 700 }}>
                      {when}
                    </Text>
                  )}
                  <Text field="time">{v.time}</Text>
                </Column>
              </Row>
              {where && (
                <Column style={{ gap: 2 }}>
                  <Text style={label}>Where</Text>
                  {inPerson && v.venue && (
                    <Text field="venue" style={{ fontWeight: 700 }}>
                      {v.venue}
                    </Text>
                  )}
                  {inPerson &&
                    v.address.map((address, i) => (
                      <Text key={i} field={`address[${i}]`} style={{ color: token("colors.muted") }}>
                        {address}
                      </Text>
                    ))}
                  {online && (
                    <Text field="attendance" style={place ? { color: token("colors.muted") } : { fontWeight: 700 }}>
                      {place ? "And online" : "Online"}
                    </Text>
                  )}
                  {online && v.joinLink && v.status !== "ended" && (
                    <Link field="joinLink" href={v.joinLink}>
                      {`Join ${v.name} online`}
                    </Link>
                  )}
                </Column>
              )}
              <Column style={{ gap: 2 }}>
                <Text style={label}>Tickets</Text>
                <Text field="tickets" style={{ fontWeight: 700 }}>{v.tickets}</Text>
                {v.status === "open" && (
                  <Link field="registerLink" href={v.registerLink}>
                    Save your seat
                  </Link>
                )}
                {v.status === "waitlist" && (
                  <Link field="registerLink" href={v.registerLink}>
                    Join the waitlist
                  </Link>
                )}
                {closed && (
                  <Text field="status" style={{ color: token("colors.muted") }}>
                    {closed}
                  </Text>
                )}
              </Column>
            </Grid>
          </Section>
          {v.about && (
            <Section field="about" style={{ padding: [token("spacing.lg"), token("spacing.xl")] }}>
              {v.about}
            </Section>
          )}
          {lists && (
            <Section style={{ padding: [token("spacing.lg"), token("spacing.xl"), token("spacing.xl")] }}>
              <Row style={{ gap: token("spacing.xl"), alignItems: "start" }}>
                {v.schedule.length > 0 && (
                  <Column style={{ gap: token("spacing.md") }}>
                    <Heading level={2}>Schedule</Heading>
                    {v.schedule.map((session, i) => (
                      <Row
                        key={i}
                        stackOnMobile={false}
                        style={{
                          gap: token("spacing.md"),
                          padding: [token("spacing.sm"), 0],
                          border: { bottom: { width: 1, style: "solid", color: token("colors.border") } },
                        }}
                      >
                        <Column style={{ width: 96 }}>
                          <Text field={`schedule[${i}].time`} style={{ fontWeight: 700, color: token("colors.primary") }}>{session.time}</Text>
                        </Column>
                        <Column>
                          <Text field={`schedule[${i}].title`}>{session.title}</Text>
                        </Column>
                      </Row>
                    ))}
                  </Column>
                )}
                {v.speakers.length > 0 && (
                  <Column style={{ gap: token("spacing.md") }}>
                    <Heading level={2}>Speakers</Heading>
                    {v.speakers.map((speaker, i) => (
                      <Row
                        key={i}
                        stackOnMobile={false}
                        style={{
                          gap: token("spacing.md"),
                          alignItems: "center",
                          backgroundColor: token("colors.surface"),
                          borderRadius: token("radii.md"),
                          padding: token("spacing.md"),
                        }}
                      >
                        <Column style={{ width: 56 }}>
                          {speaker.photo ? (
                            <Image field={`speakers[${i}].photo`} src={speaker.photo} alt={speaker.name} style={{ width: 56, borderRadius: 28 }} />
                          ) : (
                            <Column style={{ backgroundColor: token("colors.primary"), borderRadius: 28, padding: [14, 0] }}>
                              <Text style={{ color: token("colors.primaryForeground"), fontWeight: 700, textAlign: "center", lineHeight: 1.75 }}>
                                {initials(speaker.name)}
                              </Text>
                            </Column>
                          )}
                        </Column>
                        <Column style={{ gap: 2 }}>
                          <Text field={`speakers[${i}].name`} style={{ fontWeight: 700 }}>{speaker.name}</Text>
                          <Text field={`speakers[${i}].role`} style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>{speaker.role}</Text>
                          <Text field={`speakers[${i}].talk`}>{speaker.talk}</Text>
                        </Column>
                      </Row>
                    ))}
                  </Column>
                )}
              </Row>
            </Section>
          )}
          <Section style={{ backgroundColor: token("colors.surface"), padding: [token("spacing.lg"), token("spacing.xl")] }}>
            <Text field="name" style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
              {brand.address ? `${v.name} is run by ${brand.name}, ${brand.address}. ` : `${v.name} is run by ${brand.name}. `}
              <Link href={brand.links.help}>Ask {brand.name} about the event</Link>
            </Text>
          </Section>
        </Page>
      );
    },
  });
}

export default event(brand);
