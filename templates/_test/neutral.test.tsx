/**
 * Negative controls: designs each check must fail, so a check that passes everything can't pass unnoticed. Each is a
 * small design written as the folder's designs are, with a probe brand or a real one.
 */
import type { ReactElement } from "react";
import { Button, Canvas, Column, Document, Email, Heading, Html, Image, Layer, Link, Menu, PageHeader, Text, defineTheme, render, token, validate } from "@hyper-elements/react";
import { renderPdf } from "@hyper-elements/react/pdf";
import { emailClients } from "@hyper-elements/email-clients";
import { ASSETS, checkBrand, type Brand } from "../_brand";
import { brand as orbit } from "../_brands/orbit";
import { fontFiles } from "../_scripts/assets";
import { checker } from "./checks";
import { PROBES, tokenNames } from "./probes";

const [probe1, probe2] = PROBES;
const LOGO = { src: orbit.logo.src, width: orbit.logo.width, height: orbit.logo.height };

/** What the plugin finds in a design, with a probe brand (neutral, pairs) or a real one (contrast). */
function found(design: ReactElement, options: { probe?: Brand; contrast?: boolean }): string[] {
  const probe = options.probe;
  const fonts = probe ? (probe.theme.fonts as Record<string, string>) : undefined;
  const { plugin, findings } = checker({
    ...(probe ? { probe: { names: tokenNames(probe), fonts: new Set([fonts!.body, fonts!.heading]) } } : {}),
    ...(options.contrast ? { contrast: true } : {}),
  });
  validate(design, { plugins: [plugin] });
  return findings.map((f) => f.check);
}

const email = (brand: Brand, children: ReactElement | ReactElement[]) => (
  <Email lang="en" theme={brand.theme} style={{ backgroundColor: token("colors.background") }}>
    {children}
  </Email>
);

describe("the neutral check", () => {
  it("passes a design that uses only tokens", () => {
    expect(found(email(probe1, <Text style={{ color: token("colors.muted") }}>Quiet</Text>), { probe: probe1 })).toEqual([]);
  });
  it("fails a literal color", () => {
    expect(found(email(probe1, <Text style={{ color: "#123456" }}>Hard-coded</Text>), { probe: probe1 })).toContain("neutral");
  });
  it("fails a literal font", () => {
    expect(found(email(probe1, <Text style={{ fontFamily: "Georgia, serif" }}>Hard-coded</Text>), { probe: probe1 })).toContain("neutral");
  });
  it("fails a sample brand's own color written as a literal", () => {
    const primary = (orbit.theme.colors as Record<string, string>).primary;
    expect(found(email(probe1, <Text style={{ color: primary }}>Orbit's indigo</Text>), { probe: probe1 })).toContain("neutral");
  });
  it("fails a literal equal to the first probe's sentinel, which the second probe exposes", () => {
    const sentinel = (probe1.theme.colors as Record<string, string>).muted;
    const design = (brand: Brand) => email(brand, <Text style={{ color: sentinel }}>Looks like a token</Text>);
    expect(found(design(probe1), { probe: probe1 })).not.toContain("neutral");
    expect(found(design(probe2), { probe: probe2 })).toContain("neutral");
  });
  it("fails a Menu left at its default colors", () => {
    expect(found(email(probe1, <Menu items={[{ text: "Home", href: "https://orbit.example" }]} />), { probe: probe1 })).toContain("neutral");
  });
  it("fails an Html block, and an image from outside the assets folder", () => {
    // Html is refused in an expanded tree whatever it holds.
    expect(found(email(probe1, <Column><Text>Before</Text></Column>), { probe: probe1 })).not.toContain("html");
    expect(found(email(probe1, <Html html={'<p style="color:#123456">Raw</p>'} />), { probe: probe1 })).toContain("html");
    expect(found(email(probe1, <Image src={{ src: "https://example.com/logo.png", width: 100, height: 40 }} alt="Logo" />), { probe: probe1 })).toContain("image");
    expect(found(email(probe1, <Image src={{ src: `${ASSETS}brands/orbit/logo.png`, width: 480, height: 120 }} alt="Logo" />), { probe: probe1 })).not.toContain("image");
  });
});

describe("the pair check", () => {
  it("fails background text on background", () => {
    expect(found(email(probe1, <Text style={{ color: token("colors.background") }}>Invisible</Text>), { probe: probe1 })).toContain("pairs");
  });
  it("fails a Link inside a primary box", () => {
    const design = email(probe1, (
      <Column style={{ backgroundColor: token("colors.primary") }}>
        <Text style={{ color: token("colors.primaryForeground") }}>
          Fine, but <Link href="https://orbit.example">this link</Link> is primary on primary
        </Text>
      </Column>
    ));
    expect(found(design, { probe: probe1 })).toContain("pairs");
  });
  it("passes a Button, primaryForeground on primary", () => {
    expect(found(email(probe1, <Button href="https://orbit.example">Go</Button>), { probe: probe1 })).toEqual([]);
  });
  const canvas = (children: ReactElement) => (
    <Canvas width={600} height={300} theme={probe1.theme}>
      {children}
    </Canvas>
  );
  it("fails text straight over a Layer's image in a Canvas", () => {
    const design = canvas(
      <Layer style={{ height: 300 }}>
        <Image src={LOGO} alt="" />
        <Text>Over the picture</Text>
      </Layer>,
    );
    expect(found(design, { probe: probe1 })).toContain("pairs");
  });
  it("fails text in a Layer over a sibling Column painted foreground", () => {
    const design = canvas(
      <Layer style={{ height: 300 }}>
        <Column style={{ backgroundColor: token("colors.foreground"), height: 300 }}>
          <Text style={{ color: token("colors.background") }}>Under</Text>
        </Column>
        <Text>Foreground on foreground</Text>
      </Layer>,
    );
    expect(found(design, { probe: probe1 })).toContain("pairs");
  });
  it("passes text in a Layer on a box with its own background", () => {
    const design = canvas(
      <Layer style={{ height: 300 }}>
        <Image src={LOGO} alt="" />
        <Column style={{ backgroundColor: token("colors.surface") }}>
          <Text>On a surface</Text>
        </Column>
      </Layer>,
    );
    expect(found(design, { probe: probe1 })).toEqual([]);
  });
  it("fails a PageHeader whose text fails against one Document.Page's background", () => {
    const design = (
      <Document theme={probe1.theme}>
        <PageHeader>
          <Text>On every page</Text>
        </PageHeader>
        <Document.Page>
          <Text>A plain page</Text>
        </Document.Page>
        <Document.Page style={{ backgroundColor: token("colors.foreground") }}>
          <Text style={{ color: token("colors.background") }}>A dark page</Text>
        </Document.Page>
      </Document>
    );
    expect(found(design, { probe: probe1 })).toContain("pairs");
  });
});

describe("the contrast check", () => {
  const readable = (brand: Brand, design: ReactElement) => found(design, { contrast: true }).filter((c) => c === "contrast");
  it("passes a sample brand's own pairs", () => {
    expect(readable(orbit, email(orbit, <Text style={{ color: token("colors.muted") }}>Quiet</Text>))).toEqual([]);
  });
  it("fails a recreation whose extra token is unreadable on its background", () => {
    const company: Brand = { ...orbit, theme: defineTheme({ ...(orbit.theme as object), colors: { ...(orbit.theme.colors as object), highlight: "#f0f0f0" } } as never) as Brand["theme"] };
    const colors = company.theme.colors as Record<string, string>;
    const design = email(company, <Text style={{ color: colors.highlight ?? colors.foreground }}>Pale</Text>);
    expect(readable(company, design)).toContain("contrast");
  });
  it("fails a brand whose formats.canvas changes the foreground to the background's color", () => {
    const sneaky = { ...orbit, theme: defineTheme({ ...(orbit.theme as object), formats: { canvas: { colors: { foreground: "#ffffff" } } } } as never) };
    expect(checkBrand(sneaky).join("\n")).toMatch(/formats\.canvas\.colors/);
    const design = <Canvas width={600} height={200} theme={sneaky.theme}><Text>White on white</Text></Canvas>;
    expect(readable(sneaky, design)).toContain("contrast");
  });
  it("fails fitted text between 3:1 and 4.5:1, even where its largest size is large", () => {
    const design = (
      <Canvas width={800} height={300} theme={orbit.theme}>
        <Heading level={1} fit={{ sizes: [40, 16], maxLines: 1 }} style={{ color: "#8a8a8a" }}>
          A headline that may be drawn small
        </Heading>
      </Canvas>
    );
    expect(readable(orbit, design)).toContain("contrast");
  });
});

describe("the email client checks", () => {
  it("find an image some email clients don't show", async () => {
    const out = await render(email(orbit, <Image src={{ src: "https://orbit.example/photo.webp", width: 600, height: 300 }} alt="A photo" />), { plugins: [await emailClients()] });
    expect(out.diagnostics.map((d) => d.code)).toContain("email/image-format");
  });
  it("find an email past Gmail's size limit", async () => {
    const long = Array.from({ length: 1500 }, (_, i) => <Text key={i}>Paragraph {i} of an email far too long to read in one sitting, repeated to make it heavy.</Text>);
    const out = await render(email(orbit, <Column>{long}</Column>), { plugins: [await emailClients()] });
    expect(out.diagnostics.map((d) => d.code)).toContain("email/size");
  });
});

describe("the PDF's images", () => {
  it("refuse an SVG logo in checkBrand(), and the PDF says it couldn't draw one", async () => {
    const svg = { ...orbit, logo: { ...orbit.logo, src: `${ASSETS}brands/orbit/logo.svg` } };
    expect(checkBrand(svg).join("\n")).toMatch(/PNG or JPEG/);
    const mark = new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="12"><rect width="48" height="12" fill="#4f46e5"/></svg>`);
    const design = (
      <Document theme={orbit.theme} fonts={orbit.fonts}>
        <Image src={{ src: svg.logo.src, width: 48, height: 12 }} alt="Orbit" />
      </Document>
    );
    const pdf = await renderPdf(design, { fonts: fontFiles(orbit), images: { [svg.logo.src]: mark } });
    expect(pdf.diagnostics.map((d) => d.code)).toContain("pdf/image");
  });
});
