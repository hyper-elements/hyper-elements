import { Button, Column, Divider, Email, Heading, Image, Link, List, ListItem, Row, Span, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Stack Overflow tips",
  author: "bruno88cabral",
  description: "A tips issue: the logo on the page, a banner with the headline beside its art, ruled sections with a list of tips, one button, and a footer with the email's settings and the address",
  recreates: {
    company: "stack-overflow",
    what: "search tips newsletter",
    original: "https://reallygoodemails.com/search/emails/Stack%20Overflow",
  },
};

export default function StackOverflowTips({ brand }: { brand: Brand }) {
  const site = brand.links.site;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") }, padding: [token("spacing.md"), 0] } as const;
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted") } as const;
  const footerLink = { color: token("colors.muted"), textDecoration: "underline" } as const;
  return (
    <Email
      width={680}
      title="Find what you want, faster"
      previewText={`${brand.name} tips for searching`}
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
            <Heading level={1} style={{ color: token("colors.primaryForeground") }}>
              Find what you want, faster
            </Heading>
            <Text style={{ color: token("colors.primaryForeground"), fontSize: 17, lineHeight: 1.4 }}>Tips and tricks for searching on {brand.name}</Text>
          </Column>
          <Column style={{ width: "53%", padding: [token("spacing.xl"), 10] }}>
            <Image src={{ src: "https://hyperelements.dev/generated/gallery/assets/companies/stack-overflow/header.png", width: 640, height: 374 }} alt="" style={{ width: "100%" }} />
          </Column>
        </Row>
        <Column style={{ padding: [token("spacing.xl"), token("spacing.xl"), 40], gap: token("spacing.md") }}>
          <Heading level={2}>Searching for solutions</Heading>
          <Text>With more than 18 million questions, it's possible that someone has already provided a solution to the problem you're facing.</Text>
          <Divider style={rule} />
          <Heading level={2}>Use the search bar at the top of the page to find what you need</Heading>
          <Text>Here are a few simple search tips to get you started:</Text>
          <List style={{ gap: token("spacing.md") }}>
            <ListItem>To find a specific phrase, enter it in quotes: "local storage"</ListItem>
            <ListItem>To search within specific tag(s), enter them in square brackets: [javascript]</ListItem>
            <ListItem>
              Combine them to get even more precise results - [javascript] "local storage" searches for the phrase “local storage” in questions that have the
              [javascript] tag
            </ListItem>
          </List>
          <Text>
            The more information you can put in the search bar, the more likely you will be to either find the answer you need or feel confident that no one
            else has asked the question before.
          </Text>
          <Divider style={rule} />
          <Heading level={2}>Take a break and read about the worst coder in the world</Heading>
          <Column style={{ padding: [token("spacing.sm"), 0, 0], alignItems: "start" }}>
            <Button
              href={`${site}/blog/code-review`}
              style={{
                backgroundColor: token("colors.primary"),
                color: token("colors.primaryForeground"),
                fontSize: 17,
                lineHeight: 1,
                padding: [13, 17],
                borderRadius: token("radii.sm"),
              }}
            >
              I need a break
            </Button>
          </Column>
        </Column>
      </Column>
      <Column style={{ padding: [32, token("spacing.xl")], gap: token("spacing.sm") }}>
        <Text style={small}>You're receiving this email because your {brand.name} activity triggered this tip or reminder.</Text>
        <Text style={small}>
          <Link href={`${site}/unsubscribe`} style={footerLink}>
            Unsubscribe from emails like this
          </Link>
          {"\u00a0\u00a0 "}
          <Link href={`${site}/users/email/settings`} style={footerLink}>
            Edit email settings
          </Link>
          {"\u00a0\u00a0 "}
          <Link href={`${site}/contact`} style={footerLink}>
            Contact us
          </Link>
          {"\u00a0\u00a0 "}
          <Link href={`${site}/legal/privacy-policy`} style={footerLink}>
            Privacy
          </Link>
        </Text>
        <Divider style={{ ...rule, padding: [token("spacing.lg"), 0] }} />
        <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 111 }} />
        <Text style={small}>
          <Span style={{ fontWeight: 700 }}>{brand.name}</Span>, {brand.address}
        </Text>
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
  );
}
