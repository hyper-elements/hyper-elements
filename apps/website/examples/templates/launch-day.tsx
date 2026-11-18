/**
 * Solstice (a fictional maker of release-notes tooling) announces Solstice 1.0.
 *
 * One piece of content, three outputs: the same announcement renders as an email,
 * a web page and a printed document — "React in. Everything out." The email is the
 * default export; LaunchDayPage and LaunchDayDocument share its content, so the
 * launch is written once and ships to every channel.
 *
 * Slate ink, one indigo accent, Inter: a clean dev-tool look, with a dark header
 * band, a release card as the hero visual, and a dark early-access band to close.
 */
import {
  Button,
  Column,
  defineTheme,
  Document,
  Email,
  Grid,
  Heading,
  Link,
  List,
  ListItem,
  Menu,
  Page,
  Row,
  Social,
  Span,
  Text,
  token,
} from "@hyper-elements/react";

export const meta = {
  title: "Launch Day — Solstice 1.0",
  description: "A product launch announcement that renders as email, web page and PDF from one React template.",
  root: "Email",
};

const INK = "#0F172A";
const PAPER = "#F8FAFC";
const ACCENT = "#4F46E5";
const ACCENT_DARK = "#4338CA";
const MUTED = "#64748B";
const RULE = "#E2E8F0";
const GREEN = "#15803D";

const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SITE = "https://solstice.example";

/** The brand, once: every Email, Page and Document that takes it is on brand. */
const launchDay = defineTheme({
  colors: {
    background: PAPER,
    foreground: INK,
    primary: ACCENT,
    primaryForeground: "#FFFFFF",
    muted: MUTED,
    border: RULE,
  },
  fonts: { body: SANS, heading: SANS },
  fontSizes: { body: 16 },
  lineHeights: { body: 1.6 },
  components: {
    Heading: {
      by: {
        level: {
          1: { fontSize: 40, lineHeight: 1.1, letterSpacing: -1.2, mobile: { fontSize: 30, letterSpacing: -0.8 } },
          2: { fontSize: 26, lineHeight: 1.25, letterSpacing: -0.6, mobile: { fontSize: 22 } },
          3: { fontSize: 17, lineHeight: 1.4 },
        },
      },
    },
    Button: { borderRadius: 8, fontWeight: 600, hover: { backgroundColor: ACCENT_DARK } },
  },
  styles: {
    card: { backgroundColor: "#FFFFFF", border: `1px solid ${RULE}`, borderRadius: 12, padding: 20, gap: 8 },
  },
});

/** One feature card: its number in an indigo disc, what it is, and why it matters. */
const feature = (n: string, title: string, body: string) => (
  <Column style={{ apply: ["card"] }}>
    <Text
      style={{
        width: 24,
        backgroundColor: ACCENT,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: "24px",
        textAlign: "center",
        color: "#FFFFFF",
      }}
    >
      {n}
    </Text>
    <Heading level={3}>{title}</Heading>
    <Text style={{ fontSize: 15, lineHeight: 1.55, color: token("colors.muted") }}>{body}</Text>
  </Column>
);

/** One line of the release card: a green plus and what shipped. */
const shipped = (line: string) => (
  <Text style={{ fontSize: 14, lineHeight: 1.55 }}>
    <Span style={{ color: GREEN, fontWeight: 700 }}>+ </Span>
    {line}
  </Text>
);

/** The announcement's sections, in order: no root, so any root can carry them.
 * The Email and the Page stack them in one column; the Document paginates them
 * (header, hero and features on page one, the rest on page two). */
function launchDaySections() {
  return [
    <Column key="header" style={{ backgroundColor: INK, padding: [20, 24] }}>
      <Row stackOnMobile={false} style={{ alignItems: "center" }}>
        <Column>
          <Text style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, color: "#FFFFFF" }}>
            <Link href={SITE} style={{ color: "#FFFFFF", textDecoration: "none" }}>
              SOLSTICE
            </Link>
          </Text>
        </Column>
        <Column style={{ alignItems: "end" }}>
          <Text
            style={{
              width: 120,
              backgroundColor: ACCENT,
              borderRadius: 999,
              padding: [4, 10],
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textAlign: "center",
              color: "#FFFFFF",
            }}
          >
            v1.0 · LIVE
          </Text>
        </Column>
      </Row>
    </Column>,

    <Column key="hero" style={{ padding: [36, 28, 28], gap: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT }}>
        Launching 1 December 2026
      </Text>
      <Heading level={1}>
        Release notes that <Span style={{ color: ACCENT }}>write themselves</Span>.
      </Heading>
      <Text style={{ fontSize: 18, lineHeight: 1.55, color: MUTED }}>
        Solstice 1.0 turns your merged pull requests into release notes your users actually read — drafted the
        moment you tag a release, in your voice, in every channel.
      </Text>
      <Row style={{ alignItems: "center", gap: 20 }}>
        <Button href={`${SITE}/start`} style={{ width: 160, padding: [14, 0], textAlign: "center" }}>
          Start free
        </Button>
        <Link href={`${SITE}/notes/1-0`} style={{ fontWeight: 600 }}>
          Read the launch notes →
        </Link>
      </Row>
      <Text style={{ fontSize: 13, color: MUTED }}>Free during beta · No card required</Text>

      {/* The hero visual: the release itself, as a card */}
      <Column style={{ apply: ["card"], gap: 12, padding: 24 }}>
        <Row stackOnMobile={false} style={{ alignItems: "center" }}>
          <Column>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>v1.0.0 — 1 December 2026</Text>
          </Column>
          <Column style={{ alignItems: "end" }}>
            <Text style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: GREEN }}>● STABLE</Text>
          </Column>
        </Row>
        {shipped("Drafts from merged pull requests, grouped by area")}
        {shipped("One-click publish to email, web and PDF")}
        {shipped("Your brand, carried into every channel")}
      </Column>
    </Column>,

    <Column key="features" style={{ backgroundColor: PAPER, padding: [32, 28], gap: 16 }}>
      <Heading level={2}>Why teams switch</Heading>
      <Grid columns={3} style={{ gap: 16 }}>
        {feature(
          "1",
          "Drafts itself",
          "Tag a release and Solstice drafts the notes from your merged PRs — grouped, de-duplicated, and written in plain language."
        )}
        {feature(
          "2",
          "Ships everywhere",
          "The same announcement renders as an email, a web page and a PDF. Write it once; Solstice carries it to every channel."
        )}
        {feature(
          "3",
          "Stays on brand",
          "Your colours, type and voice live in one theme, so every channel reads like it came from the same team."
        )}
      </Grid>
    </Column>,

    <Column key="whats-new" style={{ padding: [32, 28], gap: 16 }}>
      <Heading level={2}>What&rsquo;s new in 1.0</Heading>
      <List type="bullet">
        <ListItem>Release drafts from merged pull requests, grouped by area and written in plain language</ListItem>
        <ListItem>One-click publish to email, web and PDF — the same source, every channel</ListItem>
        <ListItem>Themes: your brand, defined once, carried into every output</ListItem>
        <ListItem>Approvals: a second pair of eyes before anything ships</ListItem>
        <ListItem>Changelog API: pull the same notes into your docs and status page</ListItem>
      </List>
    </Column>,

    <Column key="proof" style={{ padding: [8, 28, 28], gap: 12 }}>
      <Column style={{ border: { left: `3px solid ${ACCENT}` }, padding: [4, 0, 4, 20], gap: 12 }}>
        <Text style={{ fontSize: 20, lineHeight: 1.4, fontStyle: "italic" }}>
          &ldquo;We shipped our 1.0 notes in eleven minutes. Our last launch took a whole afternoon of
          copy-paste.&rdquo;
        </Text>
        <Text style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>
          Priya Raman, CTO, Fieldnotes
        </Text>
      </Column>
    </Column>,

    <Column key="early-access" style={{ padding: [0, 28, 28] }}>
      <Column style={{ backgroundColor: INK, borderRadius: 12, padding: 28, gap: 12 }}>
        <Heading level={2} style={{ color: "#FFFFFF" }}>
          Free while we&rsquo;re in beta
        </Heading>
        <Text style={{ fontSize: 15, lineHeight: 1.55, color: "#CBD5E1" }}>
          No card required. Bring your repo, tag a release, and watch your notes draft themselves.
        </Text>
        <Column style={{ alignItems: "start" }}>
          <Button
            href={`${SITE}/start`}
            style={{ backgroundColor: "#FFFFFF", color: INK, padding: [14, 28], hover: { backgroundColor: "#E2E8F0" } }}
          >
            Claim early access
          </Button>
        </Column>
      </Column>
    </Column>,

    <Column key="footer" style={{ padding: [8, 28, 28], gap: 16, alignItems: "center" }}>
      <Social
        icons={[
          { name: "X", href: "https://x.com/solsticehq" },
          { name: "GitHub", href: "https://github.com/solsticehq" },
          { name: "YouTube", href: "https://www.youtube.com/@solsticehq" },
        ]}
      />
      <Menu
        items={[
          { text: "View online", href: `${SITE}/notes/1-0` },
          { text: "Preferences", href: `${SITE}/preferences` },
          { text: "Unsubscribe", href: `${SITE}/unsubscribe` },
        ]}
        style={{ justifyContent: "center" }}
      />
      <Text style={{ fontSize: 12, lineHeight: 1.6, color: MUTED, textAlign: "center" }}>
        Solstice Labs, 44 Harbor Lane, Portland, OR 97209. You&rsquo;re receiving this because you joined the
        Solstice launch list.
      </Text>
    </Column>,
  ];
}

/** The announcement itself: no root, so any root can carry it. */
function LaunchDayContent() {
  return (
    <Column style={{ gap: 0, backgroundColor: "#FFFFFF", borderRadius: 12, overflow: "hidden" }}>
      {launchDaySections()}
    </Column>
  );
}

/** The launch as an email: the template the gallery shows. */
export default function LaunchDay() {
  return (
    <Email
      theme={launchDay}
      width={600}
      lang="en"
      title="Solstice 1.0 is live"
      previewText="Release notes that write themselves — Solstice 1.0 is here, free during beta."
      style={{ backgroundColor: PAPER, fontFamily: SANS }}
    >
      <LaunchDayContent />
    </Email>
  );
}

/** The same launch as a web page: responsive, with no client JavaScript. */
export function LaunchDayPage() {
  return (
    <Page
      theme={launchDay}
      width={960}
      lang="en"
      title="Solstice 1.0 is live"
      description="Release notes that write themselves — Solstice 1.0 is here, free during beta."
      style={{ backgroundColor: PAPER, fontFamily: SANS }}
    >
      <LaunchDayContent />
    </Page>
  );
}

/** The same launch as a printed document: two A4 pages to hand out or file. */
export function LaunchDayDocument() {
  const sections = launchDaySections();
  return (
    <Document
      theme={launchDay}
      size="A4"
      orientation="portrait"
      lang="en"
      title="Solstice 1.0 is live"
      style={{ backgroundColor: PAPER, fontFamily: SANS }}
    >
      <Document.Page style={{ gap: 0, backgroundColor: "#FFFFFF" }}>{sections.slice(0, 3)}</Document.Page>
      <Document.Page style={{ gap: 0, backgroundColor: "#FFFFFF" }}>{sections.slice(3)}</Document.Page>
    </Document>
  );
}
