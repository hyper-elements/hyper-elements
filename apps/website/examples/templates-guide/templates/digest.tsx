// templates/digest.tsx
import { Button, Email, Heading, Link, Section, Text, prop } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";

export default template({
  id: "acme.Digest",
  version: "1.0.0",
  label: "Orbit digest",
  guidance: "A short digest. Lead with the news; one button at most.",
  root: "Email",
  fields: {
    preview: prop.text({ label: "Preview text", required: true, maxLength: 120 }),
    // Open: which sections, and in what order. Each is one of three approved types, filled as data.
    body: prop.blocks(
      {
        story: prop.object({ title: prop.text({ label: "Title", required: true, maxLength: 60 }), text: prop.text({ label: "Text", required: true, maxLength: 240 }) }, { label: "Story" }),
        quote: prop.object({ text: prop.text({ label: "Quote", required: true, maxLength: 140 }), by: prop.text({ label: "Who said it", required: true, maxLength: 60 }) }, { label: "Quote" }),
        button: prop.object({ label: prop.text({ label: "Label", required: true, maxLength: 30 }), href: prop.link({ label: "Link", required: true }) }, { label: "Button" }),
      },
      { label: "Body", required: true, min: 1, max: 6 },
    ),
  },
  rules: {
    plugins: { lint: lint({ kind: "marketing" }) },
    require: { lint: ["unsubscribe", "lang"] },
    links: { domains: ["orbit.example", "*.orbit.example"] },
  },
  example: {
    preview: "This week at Orbit: one story, and where to read the rest of it",
    body: [
      { type: "story", title: "Faster exports", text: "Exports finish in half the time, with no settings to change." },
      { type: "button", label: "Read the changelog", href: "https://orbit.example/changelog" },
    ],
  },
  render(v) {
    return (
      <Email lang="en" previewText={v.preview} style={{ backgroundColor: "#eef0f6" }}>
        <Section style={{ backgroundColor: "#0b1020", padding: [20, 32] }}>
          <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700 }}>Orbit</Text>
        </Section>
        {/* Each block's look is the template's: its type picks which. */}
        {v.body.map((block, i) =>
          block.type === "story" ? (
            <Section key={i} id={`story-${i}`} style={{ backgroundColor: "#ffffff", padding: [24, 32], gap: 8 }}>
              <Heading level={2} field={`body[${i}].title`} style={{ fontSize: 20, color: "#0b1020" }}>{block.title}</Heading>
              <Text field={`body[${i}].text`} style={{ color: "#3b4254" }}>{block.text}</Text>
            </Section>
          ) : block.type === "quote" ? (
            <Section key={i} id={`quote-${i}`} style={{ backgroundColor: "#f3f4ff", padding: [24, 32], gap: 8 }}>
              <Text field={`body[${i}].text`} style={{ fontSize: 20, lineHeight: 1.4, color: "#4f46e5" }}>“{block.text}”</Text>
              <Text field={`body[${i}].by`} style={{ fontSize: 14, color: "#5b6478" }}>{block.by}</Text>
            </Section>
          ) : (
            <Section key={i} id={`button-${i}`} style={{ backgroundColor: "#ffffff", padding: [24, 32] }}>
              <Button field={`body[${i}].label`} href={block.href} style={{ backgroundColor: "#0b1020", color: "#ffffff", padding: [12, 20], fontWeight: 700 }}>{block.label}</Button>
            </Section>
          ),
        )}
        <Section style={{ padding: [20, 32] }}>
          <Text style={{ fontSize: 14, color: "#5b6478" }}>
            Orbit, 1 Main Street. <Link href="https://orbit.example/unsubscribe">Unsubscribe from these emails</Link>
          </Text>
        </Section>
      </Email>
    );
  },
});
