/**
 * A welcome email. The logo, the band's line that welcomes the reader to the brand, the sign-off and the footer (the
 * company's address and its links) are locked: a design fills the greeting, the steps and the button. It's made from a
 * brand (`welcome(brand)`), which sets its colors, fonts, logo and company details, and the domains its links may go to.
 */
import { Button, Column, Email, Heading, Image, Link, Row, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

const fields = {
  preview: prop.text({ label: "Preview text", required: true, pattern: "^[\\s\\S]{30,120}$", guidance: "What the inbox shows after the subject: 30 to 120 characters" }),
  heading: prop.text({ label: "Greeting", required: true, maxLength: 40, guidance: "A short, warm greeting, with the reader's first name: Glad you're here, Ada" }),
  intro: prop.text({ label: "Introduction", required: true, maxLength: 200, guidance: "One or two sentences on what the steps are for, and how long they take" }),
  steps: prop.list(
    prop.object(
      {
        title: prop.text({ label: "Step", required: true, maxLength: 40, guidance: "What to do, in a few words: Invite your team" }),
        detail: prop.text({ label: "Why", required: true, maxLength: 100, guidance: "One sentence on what the step gives the reader" }),
      },
      { label: "Step" },
    ),
    { label: "Next steps", min: 1, max: 4 },
  ),
  buttonLabel: prop.text({ label: "Button text", required: true, maxLength: 32, guidance: "What the button does: Start your first week" }),
  buttonLink: prop.link({ label: "Button link", required: true, guidance: "Where the reader starts: the first step's page" }),
};

export function welcome(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" } as const;
  return template({
    id: "emails.Welcome",
    version: "1.0.0",
    label: "Welcome",
    description: "A greeting on a band of the brand's color, three numbered next steps, and one button",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      preview: "Two ways to get started, and where to find help",
      heading: "Glad you're here",
      intro: "Here's how to get going. It takes about five minutes.",
      steps: [
        { title: "Invite your team", detail: "Everyone sees the same work, and nothing gets lost in email." },
        { title: "Start your first project", detail: "Pick a template, or begin with a blank page." },
      ],
      buttonLabel: "Start your first project",
      buttonLink: `${brand.links.site}/start`,
    },
    render: (v) => (
      <Email
        width={560}
        title={`Welcome to ${brand.name}`}
        previewText={v.preview}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{
          backgroundColor: token("colors.surface"),
          fontSize: token("fontSizes.body"),
          lineHeight: token("lineHeights.body"),
        }}
      >
        <Column
          style={{
            padding: [token("spacing.xl"), token("spacing.md"), token("spacing.lg")],
            gap: token("spacing.lg"),
          }}
        >
          <Column style={{ alignItems: "center" }}>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: 150 }}
            />
          </Column>
          <Column
            style={{
              backgroundColor: token("colors.background"),
              borderRadius: token("radii.md"),
              border: { width: 1, style: "solid", color: token("colors.border") },
            }}
          >
            <Column
              style={{
                backgroundColor: token("colors.primary"),
                color: token("colors.primaryForeground"),
                padding: [token("spacing.xl"), token("spacing.xl"), token("spacing.lg")],
                gap: token("spacing.sm"),
                borderRadius: { topLeft: token("radii.md"), topRight: token("radii.md") },
              }}
            >
              <Text
                style={{
                  fontSize: token("fontSizes.small"),
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: token("colors.primaryForeground"),
                }}
              >
                Welcome to {brand.name}
              </Text>
              <Heading field="heading" level={1} style={{ color: token("colors.primaryForeground") }}>{v.heading}</Heading>
            </Column>
            <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
              <Text field="intro">{v.intro}</Text>
              <Column style={{ gap: token("spacing.md"), padding: [token("spacing.sm"), 0] }}>
                {v.steps.map((step, i) => (
                  <Row key={i} stackOnMobile={false} style={{ gap: token("spacing.md"), alignItems: "start" }}>
                    <Column style={{ width: 36 }}>
                      <Column style={{ backgroundColor: token("colors.surface"), borderRadius: 18, padding: [6, 0] }}>
                        <Text style={{ fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>{i + 1}</Text>
                      </Column>
                    </Column>
                    <Column style={{ gap: 2 }}>
                      <Text field={`steps[${i}].title`} style={{ fontWeight: 700 }}>{step.title}</Text>
                      <Text field={`steps[${i}].detail`} style={{ color: token("colors.muted") }}>{step.detail}</Text>
                    </Column>
                  </Row>
                ))}
              </Column>
              <Button
                field="buttonLabel"
                href={v.buttonLink}
                style={{ borderRadius: token("radii.sm"), padding: [token("spacing.sm"), token("spacing.lg")] }}
              >
                {v.buttonLabel}
              </Button>
              <Text style={{ color: token("colors.muted") }}>The {brand.name} team</Text>
            </Column>
          </Column>
          <Column style={{ gap: token("spacing.xs") }}>
            <Text style={small}>
              {brand.name}
              {brand.address && ` · ${brand.address}`}
            </Text>
            <Text style={small}>
              <Link href={`${brand.links.site}/`}>Visit {brand.name}</Link>
              {" · "}
              <Link href={brand.links.help}>Get help from {brand.name}</Link>
            </Text>
          </Column>
        </Column>
      </Email>
    ),
  });
}

export default welcome(brand);
