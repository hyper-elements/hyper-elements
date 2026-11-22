/**
 * A weekly challenge, as a newsletter. Its header (the logo as header art, a link to the challenge and "This week:" with
 * the brand's hashtag and the week's topic) and its footer (the PRO panel, how to take part with the week's tag, ideas
 * and resources side by side, the button to the challenges, the brand's links to choose emails and opt out, and its
 * address) are locked: a design fills their fields. Its body, the week's brief, is the design's own: written with the
 * elements the body allows, styled with the brand's tokens; the boxed challenge and the picture after it are fields.
 */
import { Button, Column, Divider, Email, Heading, Image, LineBreak, Link, List, ListItem, Row, Section, Span, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/codepen";

/** One card's words, in pieces: a piece with a link is a link. */
const card = prop.list(
  prop.object(
    {
      text: prop.text({ label: "Words", required: true, maxLength: 240 }),
      href: prop.link({ label: "Link", guidance: "Set it to make these words a link: the name of the Pen, article or idea it goes to" }),
    },
    { label: "Piece" },
  ),
  { label: "Card", min: 1, max: 12 },
);

const fields = {
  // The header: the preview text the inbox shows, the week's topic and its page.
  preview: prop.text({ label: "Preview text", required: true, pattern: "^[\\s\\S]{30,120}$", guidance: "What the inbox shows after the subject: 30 to 120 characters" }),
  topic: prop.text({ label: "Topic", required: true, maxLength: 24, guidance: "The week's challenge in a word or two: Cubes" }),
  challenge: prop.link({ label: "Challenge link", required: true, guidance: "The week's challenge page" }),
  // The body: the week's brief.
  body: field.slot({
    label: "Body",
    required: true,
    allow: [Column, Row, Heading, Text, Span, Link, LineBreak, Button, Image, Divider, List, ListItem],
    styles: "theme",
    count: { Button: { max: 2 }, Image: { max: 3 } },
    guidance: "The week's brief: a few short paragraphs on the topic. The challenge itself and the picture are their own fields, drawn after it. Images have alt text, or alt=\"\" for a decorative one.",
  }),
  // After the brief: the challenge itself in a boxed line, and the week's picture.
  task: prop.object(
    {
      text: prop.text({ label: "The challenge", required: true, maxLength: 100, guidance: "What to make, in a few words after \"Your Challenge:\": create a Pen that includes cube shapes." }),
      link: prop.link({ label: "Starter link", required: true, guidance: "The week's starter template: the words link there" }),
    },
    { label: "Your challenge", required: true },
  ),
  picture: field.image({ label: "Picture", aspect: { min: 1.5, max: 2.5 }, minWidth: 1200, accepts: ["png", "jpeg"], guidance: "The week's art, shown 600px wide under the challenge" }),
  pictureAlt: prop.text({ label: "Picture's alternate text", maxLength: 120, guidance: "What the picture shows, for a reader who can't see it. Leave it out for a decorative one" }),
  // The footer: the week's tag, and its ideas and resources.
  tag: prop.text({ label: "Week's tag", required: true, pattern: "^[a-z0-9-]{3,30}$", guidance: "The tag Pens take this week, in lower case: cpc-cubes" }),
  ideas: prop.list(card, { label: "Ideas", required: true, min: 1, max: 3, guidance: "Each a few sentences on a way into the topic, linking to examples" }),
  resources: prop.list(card, { label: "Resources", required: true, min: 1, max: 3, guidance: "Each a few sentences on tutorials and Pens to learn from, linking to them" }),
};

export const meta = {
  recreates: { company: "codepen", what: "Challenges newsletter", original: "https://reallygoodemails.com/search/emails/CodePen" },
};

export function codepenChallenges(brand: Brand) {
  const site = brand.links.site;
  const tag = brand.name.replace(/[^A-Za-z0-9]/g, "");
  const hashtag = `#${tag}Challenge`;
  const bold = { fontWeight: 700 } as const;
  const box = (color: "border" | "accent") =>
    ({
      backgroundColor: token("colors.background"),
      border: { width: 1, style: "solid", color: token(`colors.${color}`) },
      borderRadius: token("radii.md"),
      padding: token("spacing.lg"),
      gap: token("spacing.md"),
    }) as const;
  const icon = { fontSize: 36, lineHeight: 1, textAlign: "center" } as const;
  const small = { fontSize: token("fontSizes.small") } as const;
  const label = { fontSize: 18, lineHeight: 1.1 } as const;
  const footerLink = { color: token("colors.muted"), textDecoration: "underline" } as const;
  return template({
    id: "emails.CodepenChallenges",
    version: "1.0.0",
    label: "CodePen Challenges",
    description: "A weekly challenge: header art on a dark band, a yellow heading, the brief and a boxed challenge, a picture, a PRO panel, how to take part, ideas and resources side by side, and a button to the challenge",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "marketing" }) },
      require: { lint: ["unsubscribe", "preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains], tags: "deny" },
    },
    example: {
      preview: `${hashtag}: Cubes. Make the magic of 3D on a flat screen.`,
      topic: "Cubes",
      challenge: `${site}/challenges/cubes`,
      body: (
        <Column style={{ gap: token("spacing.md") }}>
          <Text>This week, we move on to cubes. Take control of perspective and shadows, and make 3D on a flat screen.</Text>
        </Column>
      ),
      task: { text: "create a Pen that includes cube shapes.", link: `${site}/challenges/cubes/starter` },
      tag: "cpc-cubes",
      ideas: [[{ text: "Use " }, { text: "perspective", href: `${site}/challenges/cubes/perspective` }, { text: " in CSS to build a 3D cube." }]],
      resources: [[{ text: "Learn " }, { text: "how CSS perspective works", href: `${site}/challenges/cubes/css-perspective` }, { text: "." }]],
    },
    render: (v) => {
      const cards = (list: typeof v.ideas, name: "ideas" | "resources", color: "border" | "accent", emoji: string) =>
        list.map((pieces, i) => (
          <Column key={i} style={box(color)}>
            <Text style={icon}>{emoji}</Text>
            <Text field={`${name}[${i}]`} style={small}>
              {pieces.map((piece, j) => (piece.href ? <Link key={j} href={piece.href}>{piece.text}</Link> : piece.text))}
            </Text>
          </Column>
        ));
      return (
        <Email
          width={648}
          title={`${hashtag}: ${v.topic}`}
          previewText={v.preview}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ backgroundColor: token("colors.muted"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
        >
          {/* The brand's logo as the header: in CodePen's brand, its Challenges art. */}
          <Section style={{ backgroundColor: token("colors.background"), alignItems: "center" }}>
            <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 600 }} />
          </Section>
          <Column style={{ padding: [token("spacing.md"), 0, 48] }}>
            <Column style={{ backgroundColor: token("colors.surface"), padding: token("spacing.xl"), gap: token("spacing.md") }}>
              <Text style={{ ...small, textAlign: "center" }}>
                <Link field="challenge" href={v.challenge}>View this Challenge on {brand.name}</Link>
              </Text>
              <Heading field="topic" level={1} style={{ fontWeight: 400 }}>
                <Span style={bold}>This week:</Span> {hashtag}:<LineBreak />
                {v.topic}
              </Heading>
            </Column>

            <Column style={{ backgroundColor: token("colors.background"), padding: [token("spacing.md"), 24, 24], gap: 40 }}>
              <Column style={{ gap: 40 }}>
                <Column style={{ gap: token("spacing.md") }}>
                  <Column field="body">{v.body}</Column>
                  <Text field="task.text" style={{ border: { width: 6, style: "solid", color: token("colors.border") }, padding: token("spacing.lg") }}>
                    💪 <Span style={bold}>Your Challenge:</Span> <Link href={v.task.link}>{v.task.text}</Link>
                  </Text>
                </Column>
                {v.picture ? <Image field="picture" src={v.picture} alt={v.pictureAlt ?? ""} style={{ width: 600 }} /> : null}
              </Column>
              <Column
                style={{
                  backgroundColor: token("colors.primary"),
                  color: token("colors.primaryForeground"),
                  border: { width: 6, style: "solid", color: token("colors.accent") },
                  padding: [35, token("spacing.lg"), token("spacing.xl")],
                  alignItems: "center",
                  gap: token("spacing.md"),
                }}
              >
                <Heading level={2} style={{ color: token("colors.primaryForeground"), fontSize: 32, letterSpacing: 2, textAlign: "center", textTransform: "uppercase" }}>
                  {brand.name} PRO
                </Heading>
                <Text style={{ ...small, textAlign: "center", padding: [14, 0, 0] }}>
                  {brand.name} PRO combines a bunch of features that can help any front-end designer or developer at any experience level.
                </Text>
                <Button
                  href={`${site}/features/pro`}
                  aria-label={`Learn more about ${brand.name} PRO`}
                  style={{
                    backgroundColor: token("colors.background"),
                    color: token("colors.primary"),
                    fontSize: 15,
                    lineHeight: "18px",
                    fontWeight: 700,
                    padding: 12,
                    borderRadius: token("radii.sm"),
                  }}
                >
                  Learn More
                </Button>
              </Column>
            </Column>

            <Column style={{ padding: [token("spacing.md"), 0] }}>
              <Text field="tag" style={{ backgroundColor: token("colors.surface"), padding: token("spacing.xl"), fontSize: 18, lineHeight: 1.5 }}>
                <Span style={bold}>To participate:</Span> <Link href={`${site}/pen/new`}>Create a Pen →</Link> and tag it{" "}
                <Link href={`${site}/tag/${tag.toLowerCase()}challenge`}>
                  <Span style={bold}>{tag.toLowerCase()}challenge</Span>
                </Link>{" "}
                and{" "}
                <Link href={`${site}/tag/${v.tag}`}>
                  <Span style={bold}>{v.tag}</Span>
                </Link>
                . We'll be watching and gathering the Pens into a Collection, and sharing on <Link href={`${site}/twitter`}>Twitter</Link> and{" "}
                <Link href={`${site}/instagram`}>Instagram</Link> (Use the {hashtag} tag on Twitter and Instagram as well).
              </Text>
            </Column>

            <Column style={{ backgroundColor: token("colors.background"), padding: [token("spacing.md"), 24, token("spacing.lg")] }}>
              <Row style={{ gap: token("spacing.lg"), alignItems: "start" }}>
                <Column style={{ gap: token("spacing.lg") }}>
                  <Heading level={2} style={label}>IDEAS!</Heading>
                  {cards(v.ideas, "ideas", "border", "🌟")}
                </Column>
                <Column style={{ gap: token("spacing.lg") }}>
                  <Heading level={2} style={label}>RESOURCES!</Heading>
                  {cards(v.resources, "resources", "accent", "📖")}
                </Column>
              </Row>
            </Column>

            <Column style={{ padding: [40, 0, 120], alignItems: "center" }}>
              <Button href={`${site}/challenges`} style={{ fontSize: 26, fontWeight: 700, padding: [15, token("spacing.xl")], borderRadius: token("radii.sm") }}>
                Go to Challenge Page
              </Button>
            </Column>

            <Column style={{ backgroundColor: token("colors.background"), padding: [token("spacing.md"), 24], gap: token("spacing.sm") }}>
              <Text style={{ ...small, color: token("colors.muted") }}>
                You can adjust your <Link href={brand.links.preferences} style={footerLink}>email preferences</Link> any time, or{" "}
                <Link href={brand.links.unsubscribe} style={footerLink}>instantly opt out</Link> of emails of this kind. Need help with anything? Hit up{" "}
                <Link href={brand.links.help} style={footerLink}>support</Link>.
              </Text>
              {brand.address ? <Text style={{ ...small, color: token("colors.muted") }}>{brand.name}, {brand.address}</Text> : null}
            </Column>
          </Column>
        </Email>
      );
    },
  });
}

export default codepenChallenges(brand);
