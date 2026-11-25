/**
 * A newsletter. Its header (the logo and the issue) and its footer (why the reader gets it, the company's address and
 * the links to unsubscribe and choose emails, from the brand) are locked: a design fills the header's fields. Its body is the design's own:
 * sections written with the elements the body allows, styled with the brand's tokens. It's made from a brand
 * (`newsletter(brand)`), which sets its colors, fonts, logo and company details, and the domains its links may go to.
 */
import { Button, Column, Divider, Email, Heading, Image, Link, LineBreak, List, ListItem, Row, Span, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

const fields = {
  // The header: the subject and preview text the inbox shows, and the issue beside the logo.
  subject: prop.text({ label: "Subject", required: true, pattern: "^[\\s\\S]{10,70}$", guidance: "10 to 70 characters, in sentence case" }),
  preview: prop.text({ label: "Preview text", required: true, pattern: "^[\\s\\S]{30,120}$", guidance: "What the inbox shows after the subject: 30 to 120 characters" }),
  issue: prop.text({
    label: "Issue",
    required: true,
    // What fits beside the logo on one line, with no year, so it reads the same any time.
    pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,32}$",
    guidance: "Its number and date, with no year: No. 14 · March 5",
  }),
  // The body: the issue's own sections.
  body: field.slot({
    label: "Body",
    required: true,
    allow: [Column, Row, Heading, Text, Span, Link, LineBreak, Button, Image, Divider, List, ListItem],
    styles: "theme",
    count: { Button: { max: 3 }, Image: { max: 6 } },
    guidance: "Two to five short sections, each a heading and a few sentences, a button or a link to read more. Images have alt text, or alt=\"\" for a decorative one. Friendly and plain: sentence case, no exclamation marks, no emoji.",
  }),
};

export function newsletter(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" } as const;
  return template({
    id: "emails.Newsletter",
    version: "1.0.0",
    label: "Newsletter",
    description: "A regular issue: a locked masthead and footer, with the issue, an unsubscribe link and the company's address, around a body of sections the issue writes",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "marketing" }) },
      require: { lint: ["unsubscribe", "preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      // A {{…}} tag can't carry a link past the domain rule.
      links: { domains: [...brand.links.domains], tags: "deny" },
    },
    example: {
      subject: "What's new this month",
      preview: "Faster exports, and a date for the open house in the studio",
      issue: "No. 1 · January 9",
      body: (
        <Column style={{ gap: token("spacing.md") }}>
          <Heading level={1}>Exports that finish in seconds</Heading>
          <Text>Big projects that took minutes now take seconds, with nothing to change in your settings.</Text>
          <Button href={`${brand.links.site}/blog/faster-exports`}>Read about faster exports</Button>
        </Column>
      ),
    },
    render: (v) => (
      <Email
        width={600}
        title={v.subject}
        previewText={v.preview}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{ backgroundColor: token("colors.surface"), fontSize: token("fontSizes.body"), lineHeight: token("lineHeights.body") }}
      >
        <Column style={{ padding: [token("spacing.lg"), token("spacing.md")], gap: token("spacing.lg") }}>
          <Row stackOnMobile={false} style={{ alignItems: "center", gap: token("spacing.md"), padding: [0, token("spacing.sm")] }}>
            <Column>
              <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 140 }} />
            </Column>
            <Column>
              <Text field="issue" style={{ ...small, textAlign: "right" }}>{v.issue}</Text>
            </Column>
          </Row>
          <Column
            field="body"
            style={{
              backgroundColor: token("colors.background"),
              borderRadius: token("radii.md"),
              border: { width: 1, style: "solid", color: token("colors.border") },
              padding: token("spacing.xl"),
            }}
          >
            {v.body}
          </Column>
          <Column style={{ padding: [0, token("spacing.sm")], gap: token("spacing.xs") }}>
            <Text style={small}>You're getting {brand.name}'s newsletter because you signed up for it.</Text>
            <Text style={small}>{brand.address ? `${brand.name}, ${brand.address}` : brand.name}</Text>
            <Text style={small}>
              <Link href={brand.links.unsubscribe}>Unsubscribe from these emails</Link>
              {" · "}
              <Link href={brand.links.preferences}>Choose which emails you get</Link>
            </Text>
          </Column>
        </Column>
      </Email>
    ),
  });
}

export default newsletter(brand);
