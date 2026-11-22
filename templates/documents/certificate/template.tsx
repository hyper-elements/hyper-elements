/**
 * A certificate on a landscape page. Its double frame, the logo, its headings, the seal and the signer (their signature,
 * in ink that reads on the brand's page, their name and role) are locked; a design fills who it's for, their photo (or
 * none), what they achieved, the date it's awarded, the level the seal names, and the credential's ID and the page that
 * verifies it. It's made from a brand (`certificate(brand)`), which sets its colors, fonts, logo and name.
 */
import { Column, Document, Heading, Image, Layer, Link, Polygon, Row, Span, Svg, Text, prop, token } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

/** Whether a `#rgb` or `#rrggbb` color is light: dark ink reads on it better than light ink does. */
function isLight(color: string): boolean {
  const hex = color.length === 4 ? color.replace(/[0-9a-f]/gi, (d) => d + d) : color;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.18;
}

const fields = {
  recipient: prop.text({ label: "Recipient", required: true, maxLength: 60, guidance: "Their name as they'd like it printed" }),
  photo: field.image({
    label: "Recipient's photo",
    accepts: ["png", "jpeg"],
    // Drawn in a circle 116px across, cropped from its center: a square portrait, or close to one.
    fit: "cover",
    aspect: { min: 0.8, max: 1.25 },
    minWidth: 232,
    minHeight: 232,
    guidance: "A portrait with their face in the center",
  }),
  achievement: prop.text({
    label: "Achievement",
    required: true,
    pattern: "^[\\s\\S]{12,120}$",
    guidance: "What they did, as a sentence without its subject or a full stop: Completed the Foundations of Accessible Design course, with distinction",
  }),
  dateAwarded: prop.text({
    label: "Date awarded",
    required: true,
    // A month and day, with no year, so it reads the same any time.
    pattern: "^(?![\\s\\S]*\\b(19|20)\\d{2}\\b)[\\s\\S]{3,16}$",
    guidance: "The day it's awarded, with no year or weekday: June 20",
  }),
  level: prop.choice(["Completion", "Merit", "Distinction"], { label: "Award level", required: true, guidance: "What the seal says: Completion, Merit or Distinction" }),
  credentialId: prop.text({ label: "Credential ID", pattern: "^[A-Z0-9-]{6,24}$", guidance: "Capital letters, digits and dashes, as the record of it has it: FAD-2291-PK" }),
  verifyLink: prop.link({ label: "Verification link", guidance: "The page where anyone can check the certificate is real" }),
};

export function certificate(brand: Brand) {
  // The signature is in ink that reads on the page: dark on a light background, light on a dark one.
  const ink = isLight((brand.theme.colors as Record<string, string>).background!) ? "dark" : "light";
  return template({
    id: "documents.Certificate",
    version: "1.0.0",
    label: "Certificate",
    description: "A certificate on a landscape page: a double frame, the recipient's photo and name, what they achieved, the date, a seal, and the signer's signature",
    root: "Document",
    fields,
    rules: {
      require: { core: ["layout/overflow", "document/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      recipient: "Sam Rivera",
      photo: { src: "https://hyperelements.dev/generated/gallery/assets/images/recipient.jpg", width: 600, height: 600 },
      achievement: "Completed the Introduction to Research course",
      dateAwarded: "March 12",
      level: "Merit",
    },
    render: (v) => {
      // A long name at a smaller size than the brand's first heading, so it takes two lines at most.
      const own = (brand.theme.elements?.Heading as { by?: { level?: Record<number, { fontSize?: number }> } } | undefined)?.by?.level?.[1]?.fontSize ?? 40;
      const nameSize = v.recipient.length > 32 ? { fontSize: Math.min(own, 30) } : {};
      // The seal's word at the size that fits inside it.
      const levelSize = Math.min(24, Math.floor(90 / (v.level.length * 0.62)));
      const verifyHref = v.verifyLink === undefined ? undefined : typeof v.verifyLink === "string" ? v.verifyLink : v.verifyLink.href;
      // The link as it reads: its host and path, or its host alone where the path is long.
      const bare = verifyHref?.replace(/^https?:\/\//, "");
      const verifyText = bare && (bare.length <= 48 ? bare : bare.split("/")[0]!);
      return (
        <Document
          size="A4"
          orientation="landscape"
          margin={28}
          title={`Certificate for ${v.recipient}, ${brand.name}`}
          lang={brand.lang ?? "en"}
          dir={brand.dir}
          theme={brand.theme}
          fonts={brand.fonts}
          style={{ fontSize: 13, lineHeight: token("lineHeights.body") }}
        >
          <Document.Page>
            <Column style={{ height: 738, border: { width: 3, style: "solid", color: token("colors.primary") }, padding: 8 }}>
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
                <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 150 }} />
                <Text style={{ fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: token("colors.primary") }}>Certificate of achievement</Text>
                {v.photo ? (
                  <Column style={{ width: 128, padding: 4, borderRadius: 64, border: { width: 2, style: "solid", color: token("colors.primary") } }}>
                    <Layer style={{ width: 116, height: 116, borderRadius: 58 }}>
                      <Image field="photo" src={v.photo} alt={v.recipient} />
                    </Layer>
                  </Column>
                ) : null}
                <Column style={{ gap: token("spacing.xs"), alignItems: "center" }}>
                  <Text style={{ color: token("colors.muted") }}>This certifies that</Text>
                  <Heading field="recipient" level={1} style={{ textAlign: "center", ...nameSize }}>{v.recipient}</Heading>
                </Column>
                <Text field="achievement" style={{ fontSize: 16, maxWidth: 640, textAlign: "center" }}>{v.achievement}</Text>
                <Row style={{ gap: 48, justifyContent: "center", alignItems: "center" }}>
                  <Column style={{ width: 230, gap: 4, alignItems: "center" }}>
                    <Column style={{ height: 64, justifyContent: "end", alignItems: "center" }}>
                      <Text field="dateAwarded" style={{ fontSize: 15 }}>{v.dateAwarded}</Text>
                    </Column>
                    <Column style={{ width: 230, border: { top: { width: 1, style: "solid", color: token("colors.foreground") } } }} />
                    <Text style={{ fontWeight: 700, textAlign: "center" }}>Date awarded</Text>
                    <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}>Awarded by {brand.name}</Text>
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
                            fontSize: levelSize,
                            fontWeight: 700,
                            lineHeight: 1.1,
                            textAlign: "center",
                          }}
                        >
                          {v.level}
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
                        src={{ src: `https://hyperelements.dev/generated/gallery/assets/images/signature-${ink}.png`, width: 740, height: 240 }}
                        alt="Morgan Ellis's signature"
                        style={{ width: 180 }}
                      />
                    </Column>
                    <Column style={{ width: 230, border: { top: { width: 1, style: "solid", color: token("colors.foreground") } } }} />
                    <Text style={{ fontWeight: 700, textAlign: "center" }}>Morgan Ellis</Text>
                    <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}>Head of learning</Text>
                  </Column>
                </Row>
                {v.credentialId || verifyHref ? (
                  <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" }}>
                    {v.credentialId ? <Span field="credentialId">Credential ID {v.credentialId}</Span> : null}
                    {v.credentialId && verifyHref ? " · " : null}
                    {verifyHref ? "Verify it at " : null}
                    {verifyHref ? (
                      <Link field="verifyLink" href={v.verifyLink!}>
                        {verifyText}
                      </Link>
                    ) : null}
                  </Text>
                ) : null}
              </Column>
            </Column>
          </Document.Page>
        </Document>
      );
    },
  });
}

export default certificate(brand);
