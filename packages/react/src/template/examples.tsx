/**
 * Example templates, for the tests and the docs: a launch graphic in two formats (a Canvas, its images bound and
 * checked), a weekly digest (an Email of repeated stories, an image's rules inside a list of objects), and a
 * newsletter (an Email with fixed header and footer around typed fields).
 */
import { Canvas, Column, Email, Heading, Image, Layer, Link, List, ListItem, Row, Section, Text, prop } from "../primitives/index";
import { field, fitInside, formatDate, template } from "./index";

const CDN = "https://cdn.acme.example";

export const launch = template({
  id: "acme.LaunchGraphic",
  version: "1.0.0",
  label: "Product launch graphic",
  guidance: "For product launches only. Copy is in sentence case, with no emoji and no exclamation marks.",
  root: "Canvas",
  formats: {
    square: { width: 1080, height: 1080, scale: 2 },
    landscape: { width: 1200, height: 675, scale: 2 },
  },
  fields: {
    headline: prop.text({ label: "Headline", required: true, maxLength: 90 }),
    features: prop.list(prop.text({ label: "Feature", maxLength: 48 }), { label: "Features", required: true, min: 3, max: 3 }),
    launchDate: prop.date({ label: "Launch date", required: true }),
    locale: prop.choice(["en-US", "de-DE", "fr-FR"], { label: "Language", default: "en-US" }),
    screenshot: field.image({ label: "Product screenshot", required: true, fit: "contain", aspect: { min: 1.2, max: 2.0 }, minWidth: 1600, accepts: ["png"] }),
    artwork: field.image({
      label: "Decorative artwork",
      required: true,
      fit: "cover",
      maxCrop: 0.6,
      accepts: ["png", "jpeg"],
      transparent: "forbidden",
      guidance: "Abstract light waves in violet and teal on dark navy. No text, letters, logos, UI or people.",
    }),
  },
  example: {
    headline: "Meet Orbit: release notes that write themselves",
    features: ["Drafts from merged PRs", "Your voice, every release", "Ships to Slack and email"],
    launchDate: "2026-12-03",
    screenshot: { src: `${CDN}/orbit/screenshot.png`, width: 2400, height: 1500 },
    artwork: { src: `${CDN}/orbit/waves.png`, width: 2160, height: 1360 },
  },
  render(v, { format }) {
    const square = format === "square";
    // The artwork is a region (a Layer of a fixed size per format); the screenshot sits over it, contained.
    const region = square ? { width: 952, height: 400 } : { width: 488, height: 547 };
    const shot = fitInside(v.screenshot, square ? { width: 860, height: 340 } : { width: 440, height: 480 });
    const words = (
      <Column style={{ gap: 24, ...(square ? {} : { width: 520 }) }}>
        <Heading field="headline" level={1} fit={{ sizes: square ? [88, 76, 64] : [64, 56, 48], maxLines: 3 }} style={{ lineHeight: 1.1 }}>
          {v.headline}
        </Heading>
        <List style={{ gap: 8 }}>
          {v.features.map((feature, i) => (
            <ListItem key={i} field={`features[${i}]`}>
              {feature}
            </ListItem>
          ))}
        </List>
        <Text field="launchDate" style={{ color: "#2DD4BF", fontSize: 28 }}>
          {formatDate(v.launchDate, v.locale, { dateStyle: "long" })}
        </Text>
      </Column>
    );
    const art = (
      <Layer style={{ ...region, borderRadius: 24, alignItems: "center", justifyItems: "center" }}>
        <Image field="artwork" src={v.artwork} alt="" />
        <Image field="screenshot" src={v.screenshot} alt="Orbit's release notes" style={shot} />
      </Layer>
    );
    return (
      <Canvas
        {...(square ? { width: 1080, height: 1080 } : { width: 1200, height: 675 })}
        lang={v.locale}
        style={{ backgroundColor: "#0B1020", color: "#F7F7FB", fontFamily: "Liberation Sans", padding: 64, gap: 32 }}
      >
        {square ? (
          <>
            {words}
            {art}
          </>
        ) : (
          <Row style={{ gap: 64 }}>
            {words}
            {art}
          </Row>
        )}
      </Canvas>
    );
  },
});

export const digest = template({
  id: "acme.Digest",
  version: "2.1.0",
  label: "Weekly digest",
  root: "Email",
  fields: {
    intro: prop.text({ label: "Intro", maxLength: 280, required: true }),
    stories: prop.list(
      prop.object(
        {
          title: prop.text({ label: "Title", maxLength: 80, required: true }),
          href: prop.link({ label: "Link", required: true }),
          image: field.image({ label: "Image", fit: "contain", aspect: { min: 1.5, max: 2 } }),
        },
        { label: "Story" }
      ),
      { label: "Stories", required: true, min: 1, max: 6 }
    ),
    promo: prop.object({ text: prop.text({ label: "Text", maxLength: 120, required: true }), href: prop.link({ label: "Link", required: true }) }, { label: "Promo" }),
  },
  example: {
    intro: "Three things worth your time this week.",
    stories: [
      { title: "Orbit ships", href: "https://acme.example/orbit", image: { src: `${CDN}/digest/orbit.png`, width: 1600, height: 900 } },
      { title: "How we test emails", href: "https://acme.example/blog/testing" },
      { title: "Hiring: a designer", href: "https://acme.example/jobs", image: { src: `${CDN}/digest/jobs.png`, width: 1200, height: 800 } },
    ],
  },
  render: (v) => (
    <Email width={600} lang="en" title="Weekly digest">
      <Section style={{ padding: 24 }}>
        <Text field="intro">{v.intro}</Text>
      </Section>
      {v.stories.map((story, i) => (
        <Section key={i} style={{ padding: 24, gap: 12 }}>
          {story.image && <Image field={`stories[${i}].image`} src={story.image} alt="" style={fitInside(story.image, { width: 552, height: 368 })} />}
          <Heading field={`stories[${i}].title`} level={2}>
            <Link href={story.href}>{story.title}</Link>
          </Heading>
        </Section>
      ))}
      {v.promo && (
        <Section style={{ padding: 24 }}>
          <Text field="promo.text">
            <Link href={v.promo.href}>{v.promo.text}</Link>
          </Text>
        </Section>
      )}
    </Email>
  ),
});

export const newsletter = template({
  id: "acme.Newsletter",
  version: "1.0.0",
  label: "Acme newsletter",
  guidance: "Friendly and plain. One main call to action. No emoji in headings.",
  root: "Email",
  fields: {
    subject: prop.text({ label: "Subject", required: true, maxLength: 70 }),
    preview: prop.text({ label: "Preview text", required: true, maxLength: 140 }),
    heading: prop.text({ label: "Heading", required: true, maxLength: 80, guidance: "Lead with the news in one sentence." }),
    paragraphs: prop.list(prop.text({ label: "Paragraph", maxLength: 600 }), { label: "Paragraphs", min: 1, max: 4 }),
    cta: prop.object({ text: prop.text({ label: "Text", required: true, maxLength: 30 }), href: prop.link({ label: "Link", required: true }) }, { label: "Call to action", required: true }),
  },
  example: {
    subject: "What's new at Acme",
    preview: "Three things shipped this week, and one you can try today.",
    heading: "Orbit is live",
    paragraphs: ["Release notes that write themselves, from your merged pull requests."],
    cta: { text: "Try Orbit", href: "https://acme.example/orbit" },
  },
  render: (v) => (
    <Email width={600} title={v.subject} previewText={v.preview} lang="en">
      <Section style={{ padding: 24, backgroundColor: "#0B1020" }}>
        <Text style={{ color: "#ffffff" }}>Acme</Text>
      </Section>
      <Section style={{ padding: 24, gap: 16 }}>
        <Heading field="heading" level={1}>
          {v.heading}
        </Heading>
        {v.paragraphs.map((paragraph, i) => (
          <Text key={i} field={`paragraphs[${i}]`}>
            {paragraph}
          </Text>
        ))}
        <Text field="cta.text">
          <Link href={v.cta.href}>{v.cta.text}</Link>
        </Text>
      </Section>
      <Section style={{ padding: 24 }}>
        <Text style={{ fontSize: 12 }}>
          Acme, 1 Main Street. <Link href="https://acme.example/unsubscribe">Unsubscribe</Link>
        </Text>
      </Section>
    </Email>
  ),
});
