import { Column, Document, Heading, Image, Layer, Polygon, Row, Svg, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Certificate",
  description: "A certificate on a landscape page: a double frame, the recipient's photo and name, what they achieved, the date, a seal, and the signer's signature",
};

/** Whether a `#rgb` or `#rrggbb` color is light: dark ink reads on it better than light ink does. */
function isLight(color: string): boolean {
  const hex = color.length === 4 ? color.replace(/[0-9a-f]/gi, (d) => d + d) : color;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.18;
}

export default function Certificate({ brand }: { brand: Brand }) {
  // The signature is in ink that reads on the page: dark on a light background, light on a dark one.
  const ink = isLight((brand.theme.colors as Record<string, string>).background!) ? "dark" : "light";
  return (
    <Document
      size="A4"
      orientation="landscape"
      margin={28}
      title={`Certificate for Ada Park, ${brand.name}`}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
      fonts={brand.fonts}
      style={{ fontSize: 13, lineHeight: token("lineHeights.body") }}
    >
      <Document.Page>
        <Column
          style={{
            height: 738,
            border: { width: 3, style: "solid", color: token("colors.primary") },
            padding: 8,
          }}
        >
          <Column
            style={{
              height: 716,
              border: { width: 1, style: "solid", color: token("colors.border") },
              padding: [32, 56, 28],
              gap: 18,
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: 150 }}
            />
            <Text
              style={{
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: token("colors.primary"),
              }}
            >
              Certificate of achievement
            </Text>
            <Column
              style={{
                width: 128,
                padding: 4,
                borderRadius: 64,
                border: { width: 2, style: "solid", color: token("colors.primary") },
              }}
            >
              <Layer style={{ width: 116, height: 116, borderRadius: 58 }}>
                <Image
                  src={{
                    src: "https://hyperelements.dev/generated/gallery/assets/images/recipient.jpg",
                    width: 600,
                    height: 600,
                  }}
                  alt="Ada Park"
                />
              </Layer>
            </Column>
            <Column style={{ gap: token("spacing.xs"), alignItems: "center" }}>
              <Text style={{ color: token("colors.muted") }}>This certifies that</Text>
              <Heading level={1} style={{ textAlign: "center" }}>Ada Park</Heading>
            </Column>
            <Text style={{ fontSize: 16, maxWidth: 640, textAlign: "center" }}>
              Completed the Foundations of Accessible Design course, with distinction
            </Text>
            <Row style={{ gap: 48, justifyContent: "center", alignItems: "center" }}>
              <Column style={{ width: 230, gap: 4, alignItems: "center" }}>
                <Column style={{ height: 64, justifyContent: "end", alignItems: "center" }}>
                  <Text style={{ fontSize: 15 }}>June 20</Text>
                </Column>
                <Column
                  style={{
                    width: 230,
                    border: { top: { width: 1, style: "solid", color: token("colors.foreground") } },
                  }}
                />
                <Text style={{ fontWeight: 700, textAlign: "center" }}>Date awarded</Text>
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    color: token("colors.muted"),
                    textAlign: "center",
                  }}
                >
                  Awarded by {brand.name}
                </Text>
              </Column>
              <Layer style={{ width: 132, height: 166, alignItems: "start", justifyItems: "center" }}>
                <Svg width={132} height={166} viewBox="0 0 132 166">
                  <Polygon points="32,66 58,66 58,166 45,154 32,166" style={{ fill: token("colors.accent") }} />
                  <Polygon
                    points="74,66 100,66 100,166 87,154 74,166"
                    style={{ fill: token("colors.accent") }}
                  />
                  <Polygon
                    points="66.00,0.00 72.61,7.37 80.69,1.65 85.49,10.31 94.64,6.54 97.39,16.04 107.15,14.40 107.72,24.28 117.60,24.85 115.96,34.61 125.46,37.36 121.69,46.51 130.35,51.31 124.63,59.39 132.00,66.00 124.63,72.61 130.35,80.69 121.69,85.49 125.46,94.64 115.96,97.39 117.60,107.15 107.72,107.72 107.15,117.60 97.39,115.96 94.64,125.46 85.49,121.69 80.69,130.35 72.61,124.63 66.00,132.00 59.39,124.63 51.31,130.35 46.51,121.69 37.36,125.46 34.61,115.96 24.85,117.60 24.28,107.72 14.40,107.15 16.04,97.39 6.54,94.64 10.31,85.49 1.65,80.69 7.37,72.61 0.00,66.00 7.37,59.39 1.65,51.31 10.31,46.51 6.54,37.36 16.04,34.61 14.40,24.85 24.28,24.28 24.85,14.40 34.61,16.04 37.36,6.54 46.51,10.31 51.31,1.65 59.39,7.37"
                    style={{ fill: token("colors.primary") }}
                  />
                </Svg>
                <Column style={{ padding: [13, 0, 0] }}>
                  <Column
                    style={{
                      width: 106,
                      height: 106,
                      borderRadius: 53,
                      backgroundColor: token("colors.primary"),
                      border: { width: 1.5, style: "solid", color: token("colors.primaryForeground") },
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: token("colors.primaryForeground"),
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        textAlign: "center",
                      }}
                    >
                      Certified
                    </Text>
                    <Text
                      style={{
                        color: token("colors.primaryForeground"),
                        fontSize: 24,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        textAlign: "center",
                      }}
                    >
                      Merit
                    </Text>
                    <Text
                      style={{
                        color: token("colors.primaryForeground"),
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        textAlign: "center",
                      }}
                    >
                      Awarded
                    </Text>
                  </Column>
                </Column>
              </Layer>
              <Column style={{ width: 230, gap: 4, alignItems: "center" }}>
                <Column style={{ height: 64, justifyContent: "end", alignItems: "center" }}>
                  <Image
                    src={{
                      src: `https://hyperelements.dev/generated/gallery/assets/images/signature-${ink}.png`,
                      width: 740,
                      height: 240,
                    }}
                    alt="Morgan Ellis's signature"
                    style={{ width: 180 }}
                  />
                </Column>
                <Column
                  style={{
                    width: 230,
                    border: { top: { width: 1, style: "solid", color: token("colors.foreground") } },
                  }}
                />
                <Text style={{ fontWeight: 700, textAlign: "center" }}>Morgan Ellis</Text>
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    color: token("colors.muted"),
                    textAlign: "center",
                  }}
                >
                  Head of learning
                </Text>
              </Column>
            </Row>
          </Column>
        </Column>
      </Document.Page>
    </Document>
  );
}
