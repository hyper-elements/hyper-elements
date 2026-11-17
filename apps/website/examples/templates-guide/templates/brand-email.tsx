// templates/brand-email.tsx
import { Email, Link, Section, Text, prop } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";

export default template({
  id: "acme.BrandEmail",
  version: "1.0.0",
  label: "Orbit email",
  guidance: "Any email Orbit sends. The header and footer are Orbit's; the body is yours.",
  root: "Email",
  fields: {
    preview: prop.text({ label: "Preview text", required: true, maxLength: 120 }),
    // Open: any element, styled freely. Whoever writes the email, a person or an agent, writes this.
    body: field.slot({ label: "Body", required: true, allow: "all", styles: "free" }),
  },
  // Checked on the finished email, whatever the body holds.
  rules: {
    plugins: { lint: lint({ kind: "marketing" }) },
    require: { lint: ["unsubscribe"], core: ["layout/overflow"] },
    links: { domains: ["orbit.example", "*.orbit.example"] },
  },
  example: {
    preview: "A short note from the team at Orbit, with what changed this week",
    body: <Text>Hello from Orbit.</Text>,
  },
  render(v) {
    return (
      <Email lang="en" previewText={v.preview} style={{ backgroundColor: "#eef0f6" }}>
        {/* Locked: the header. */}
        <Section id="header" style={{ backgroundColor: "#0b1020", padding: [20, 32] }}>
          <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700 }}>Orbit</Text>
        </Section>
        {/* Open: the body. */}
        <Section id="body" field="body" style={{ backgroundColor: "#ffffff", padding: 32 }}>
          {v.body}
        </Section>
        {/* Locked: the footer, with the unsubscribe link every email needs. */}
        <Section id="footer" style={{ padding: [20, 32] }}>
          <Text style={{ fontSize: 14, color: "#5b6478" }}>
            Orbit, 1 Main Street. <Link href="https://orbit.example/unsubscribe">Unsubscribe from these emails</Link>
          </Text>
        </Section>
      </Email>
    );
  },
});
