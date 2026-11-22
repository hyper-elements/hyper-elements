/**
 * A tips issue, as a newsletter. Its header (the logo on the page, and a banner with the issue's headline and tagline
 * beside its art) and its footer (why the reader gets it, the links to unsubscribe and change settings, the logo and
 * the company's address) are locked: a design fills their fields. Its body, ruled sections of tips, is the design's
 * own: written with the elements the body allows, styled with the brand's tokens.
 */
import { Button, Column, Divider, Email, Heading, Image, LineBreak, Link, List, ListItem, Row, Span, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_companies/stack-overflow";

const fields = {
  // The header: the preview text the inbox shows, and the banner's words and art.
  preview: prop.text({ label: "Preview text", required: true, pattern: "^[\\s\\S]{30,120}$", guidance: "What the inbox shows after the subject: 30 to 120 characters" }),
  headline: prop.text({ label: "Headline", required: true, maxLength: 48, guidance: "The issue in a few words, which is its title too: Find what you want, faster" }),
  tagline: prop.text({ label: "Tagline", required: true, maxLength: 80 }),
  art: field.image({ label: "Banner art", required: true, aspect: { min: 1.3, max: 1.8 }, minWidth: 640, accepts: ["png", "jpeg"] }),
  artAlt: prop.text({ label: "Banner art's alternate text", maxLength: 120, guidance: "For art with words in it, what they say. Leave it out for art that's only decoration" }),
  // The body: the issue's own sections.
  body: field.slot({
    label: "Body",
    required: true,
    allow: [Column, Row, Heading, Text, Span, Link, LineBreak, Button, Image, Divider, List, ListItem],
    styles: "theme",
    count: { Button: { min: 1, max: 1 }, Heading: { min: 2, max: 4 }, Image: { max: 4 } },
    guidance: "Two to four sections, each a level-2 heading and a few sentences or a list of tips, ruled off from the next, and one button to read more. Plain and practical.",
  }),
};

export const meta = {
  author: "bruno88cabral",
  recreates: { company: "stack-overflow", what: "search tips newsletter", original: "https://reallygoodemails.com/search/emails/Stack%20Overflow" },
};

export function stackOverflowTips(brand: Brand) {
  const site = brand.links.site;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.md"), 0] } as const;
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const footerLink = { color: token("colors.muted"), textDecoration: "underline" } as const;
  const gap = "   ";
  return template({
    id: "emails.StackOverflowTips",
    version: "1.0.0",
    label: "Stack Overflow tips",
    description: "A tips issue: the logo on the page, a banner with the headline beside its art, ruled sections with a list of tips, one button, and a footer with the email's settings and the address",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "marketing" }) },
      require: { lint: ["unsubscribe", "preview-text", "link-text", "alt-text", "contrast", "text-size", "lang", "heading-order", "heading-one"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains], tags: "deny" },
    },
    example: {
      preview: `${brand.name} tips for searching, and finding it faster`,
      headline: "Find what you want, faster",
      tagline: `Tips and tricks for searching on ${brand.name}`,
      art: { src: "https://hyperelements.dev/generated/gallery/assets/companies/stack-overflow/header.png", width: 640, height: 374 },
      body: (
        <Column style={{ gap: token("spacing.md") }}>
          <Heading level={2}>Searching for solutions</Heading>
          <Text>Someone may already have answered the question you have. Search before you ask.</Text>
          <Heading level={2}>Use the search bar</Heading>
          <Text>Put a phrase in quotes, and a tag in square brackets.</Text>
          <Button href={`${site}/search`}>Search now</Button>
        </Column>
      ),
    },
    render: (v) => (
      <Email
        width={680}
        title={v.headline}
        previewText={v.preview}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{ backgroundColor: token("colors.surface"), color: token("colors.foreground"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
      >
        <Column style={{ padding: [token("spacing.lg"), token("spacing.xl")] }}>
          <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 146 }} />
        </Column>
        <Column style={{ backgroundColor: token("colors.background") }}>
          <Row style={{ backgroundColor: token("colors.primary"), borderRadius: [token("radii.md"), token("radii.md"), 0, 0], alignItems: "center" }}>
            <Column style={{ width: "47%", padding: [token("spacing.lg"), token("spacing.xl"), token("spacing.md")], gap: token("spacing.md") }}>
              <Heading field="headline" level={1} style={{ color: token("colors.primaryForeground") }}>
                {v.headline}
              </Heading>
              <Text field="tagline" style={{ color: token("colors.primaryForeground"), fontSize: 17, lineHeight: 1.4 }}>{v.tagline}</Text>
            </Column>
            <Column style={{ width: "53%", padding: [token("spacing.xl"), 10] }}>
              <Image field="art" src={v.art} alt={v.artAlt ?? ""} style={{ width: "100%" }} />
            </Column>
          </Row>
          <Column field="body" style={{ padding: [token("spacing.xl"), token("spacing.xl"), 40], gap: token("spacing.md") }}>
            {v.body}
          </Column>
        </Column>
        <Column style={{ padding: [32, token("spacing.xl")], gap: token("spacing.sm") }}>
          <Text style={small}>You're receiving this email because your {brand.name} activity triggered this tip or reminder.</Text>
          <Text style={small}>
            <Link href={brand.links.unsubscribe} style={footerLink}>
              Unsubscribe from emails like this
            </Link>
            {gap}
            <Link href={brand.links.preferences} style={footerLink}>
              Edit email settings
            </Link>
            {gap}
            <Link href={`${site}/contact`} style={footerLink}>
              Contact us
            </Link>
            {gap}
            <Link href={`${site}/legal/privacy-policy`} style={footerLink}>
              Privacy
            </Link>
          </Text>
          <Divider style={{ ...rule, padding: [token("spacing.lg"), 0] }} />
          <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 111 }} />
          {brand.address ? (
            <Text style={small}>
              <Span style={{ fontWeight: 700 }}>{brand.name}</Span>, {brand.address}
            </Text>
          ) : null}
          <Row stackOnMobile={false} style={{ justifyContent: "start" }}>
            <Text
              style={{
                ...small,
                color: token("colors.primary"),
                lineHeight: 1,
                padding: [4, 6, 3],
                border: { width: 1, style: "solid", color: token("colors.border") },
                borderRadius: 1,
                flex: "none",
              }}
            >
              {"<3"}
            </Text>
          </Row>
        </Column>
      </Email>
    ),
  });
}

export default stackOverflowTips(brand);
