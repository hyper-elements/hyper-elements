import { Column, Email, Heading, Span, Text } from "@hyper-elements/react";

export default function Example() {
  return (
    <Email width={600} style={{ backgroundColor: "#f4f4f5" }}>
      <Column
        style={{
          padding: [24, 32],
          backgroundColor: "#ffffff",
          border: { width: 1, style: "solid", color: "#a1a1aa" },
          borderRadius: [16, 16, 0, 0],
        }}
      >
        <Heading
          level={2}
          style={{
            fontWeight: "bold",
            lineHeight: "120%",
            textTransform: "uppercase",
          }}
        >
          Title
        </Heading>
        <Text style={{ lineHeight: "24px", border: { bottom: "1px solid #ccc" } }}>
          E = mc<Span style={{ verticalAlign: "super" }}>2</Span>
        </Text>
      </Column>
    </Email>
  );
}
