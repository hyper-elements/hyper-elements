import { Column, Email, Heading, Image, Menu, Social, Text } from "@hyper-elements/react";

const items = ["Dark mode for every template.", "Faster renders, about twice as fast.", "A new keyboard shortcut panel."];

export default function Digest() {
  return (
    <Email previewText="Three things shipped this week." style={{ backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" }}>
      <Column style={{ padding: 32, gap: 16 }}>
        <Image src={{ src: "https://assets.orbit.dev/img/orbit-logo.png", width: 252, height: 128 }} alt="Orbit" style={{ width: 126 }} />
        <Menu
          items={[
            { text: "Product", href: "https://orbit.dev/product" },
            { text: "Blog", href: "https://orbit.dev/blog" },
            { text: "Pricing", href: "https://orbit.dev/pricing" },
          ]}
        />
        <Heading level={1} style={{ fontSize: 32, mobile: { fontSize: 24 } }}>Three things shipped this week</Heading>
        {items.map((item) => (
          <Text key={item}>{item}</Text>
        ))}
        <Text hidden={{ mobile: true }} style={{ color: "#6b7280" }}>Reading on a desktop? Press ? anywhere in Orbit to see every shortcut.</Text>
        <Social
          icons={[
            { name: "X", href: "https://x.com/orbit" },
            { name: "LinkedIn", href: "https://www.linkedin.com/company/orbit" },
          ]}
        />
        <Text style={{ fontSize: 12, color: "#6b7280" }}>Orbit Labs, 500 Market St, San Francisco</Text>
      </Column>
    </Email>
  );
}
