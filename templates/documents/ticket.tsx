import { Column, Document, Heading, Image, Row, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Ticket",
  description: "A ticket as a PDF: the event on a band of the brand's color, who it's for, when and where, and the code to show at the door",
};

export default function Ticket({ brand }: { brand: Brand }) {
  return (
    <Document
      size="A5"
      orientation="landscape"
      margin={32}
      title="Ticket for Build Day, Ada Park"
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ fontSize: 12, lineHeight: token("lineHeights.body") }}
    >
      <Document.Page>
        <Row
          style={{
            border: { width: 1, style: "solid", color: token("colors.border") },
            borderRadius: token("radii.md"),
          }}
        >
          <Column
            style={{
              width: 200,
              backgroundColor: token("colors.primary"),
              color: token("colors.primaryForeground"),
              padding: token("spacing.lg"),
              gap: token("spacing.sm"),
              borderRadius: { topLeft: token("radii.md"), bottomLeft: token("radii.md") },
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Admit one
            </Text>
            <Heading level={2} style={{ color: token("colors.primaryForeground") }}>Build Day</Heading>
            <Text>May 14</Text>
          </Column>
          <Column style={{ padding: token("spacing.lg"), gap: token("spacing.md") }}>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: 120 }}
            />
            <Row style={{ gap: token("spacing.lg") }}>
              <Column style={{ gap: 2 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: token("colors.muted"),
                  }}
                >
                  Ticket holder
                </Text>
                <Text style={{ fontSize: 16, fontWeight: 700 }}>Ada Park</Text>
              </Column>
              <Column style={{ gap: 2 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: token("colors.muted"),
                  }}
                >
                  Doors open
                </Text>
                <Text style={{ fontSize: 16, fontWeight: 700 }}>9:00 AM</Text>
              </Column>
            </Row>
            <Column style={{ gap: 2 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: token("colors.muted"),
                }}
              >
                Where
              </Text>
              <Text>The Foundry, 120 Mill Street, Pittsburgh</Text>
            </Column>
            <Column
              style={{
                backgroundColor: token("colors.surface"),
                borderRadius: token("radii.sm"),
                padding: [token("spacing.sm"), token("spacing.md")],
                gap: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: token("colors.muted"),
                }}
              >
                Show this at the door
              </Text>
              <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3 }}>BD-4821-K7</Text>
            </Column>
          </Column>
        </Row>
      </Document.Page>
    </Document>
  );
}
