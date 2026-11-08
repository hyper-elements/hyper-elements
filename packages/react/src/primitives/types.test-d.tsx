/**
 * Type contract of the primitives (checked by `pnpm typecheck`): their props'
 * types come from the component definitions that validate them.
 */
import { Button, Column, Email, Heading, Image, Link, Menu, Rect, Text, Row, Section, Span, Svg } from "./index";
import type { ParagraphProps, TextProps } from "./index";
import { EMAIL_CLIENTS, prepare, render, validate } from "./index";
import type { Diagnostic, EmailClient, ValidateOptions } from "./index";

// A block of text's props, by its name, and by 0.2's that a migrated module may still import.
export const textProps: TextProps = { style: { fontSize: 14, mobile: { fontSize: 12 } }, children: "Hi" };
export const paragraphProps: ParagraphProps = textProps;
export const fromProps = <Text {...textProps} />;
// @ts-expect-error A style that isn't one: the type is the component's, not a loose object.
export const notAStyle: TextProps = { style: { notAStyle: 1 } };

export const ok = (
  <Email
    width={600}
    previewText="Hi"
    fonts={[
      { family: "Inter", src: "https://fonts.example.com/inter-400.woff2", weight: 400 },
      { family: "Inter", src: "https://fonts.example.com/inter-700.woff2", weight: "bold", style: "normal" },
      { family: "Inter Variable", src: "https://fonts.example.com/inter.woff2", weight: "100 900", format: "woff2" },
      { family: "Inter Variable", src: "https://fonts.example.com/inter-italic.woff2", weight: [100, 900], style: "italic" },
    ]}
    style={{ backgroundColor: "#f4f4f4", gap: 16, fontFamily: "Inter, Arial, sans-serif" }}
  >
    <Section style={{ backgroundColor: "#111", padding: [24, 16] }}>
      <Image src={{ src: "https://example.com/logo.png", width: 120 }} alt="Logo" style={{ width: 120 }} />
    </Section>
    <Heading level={2} style={{ fontSize: "28px", lineHeight: "120%", mobile: { fontSize: 22 } }}>
      Title
    </Heading>
    <Row stackOnMobile={false} style={{ gap: 20 }}>
      <Column style={{ width: "40%", padding: "8px 16px", border: "1px solid #ccc", borderRadius: 4 }}>
        <Text>Left</Text>
      </Column>
      <Column style={{ flex: 2 }}>
        <Text dir="rtl">
          Read <Link href={{ href: "https://example.com", target: "_blank" }} title="Docs" aria-label="Read the docs">this</Link>
          <Span style={{ verticalAlign: "super" }}>1</Span>
        </Text>
        <Button href="https://example.com" style={{ fontWeight: "bold", hover: { backgroundColor: "#000" } }}>
          Go
        </Button>
      </Column>
    </Row>
  </Email>
);

// @ts-expect-error compat is what Elements 0.2's components' lowering gave the writers, not a prop of a template
export const noCompat = <Text compat={{ className: "mine" }}>Words</Text>;

// @ts-expect-error a Button needs an href
export const noHref = <Button>Go</Button>;

// @ts-expect-error an Image needs a src
export const noSrc = <Image alt="x" />;

// @ts-expect-error headings go from 1 to 6
export const level = <Heading level={7}>x</Heading>;

// @ts-expect-error em isn't a unit a width takes
export const em = <Column style={{ width: "2em" }} />;

// @ts-expect-error no margins: space between siblings is the parent's gap
export const margin = <Text style={{ margin: 8 }}>x</Text>;

// @ts-expect-error an Image has no text color
export const imageColor = <Image src="https://example.com/a.png" style={{ color: "#000" }} />;

// @ts-expect-error font weights are 100 to 900 in hundreds
export const weight = <Text style={{ fontWeight: 450 }}>x</Text>;

// A web font is the root's, not a fontFamily's.
// @ts-expect-error fontFamily is a stack
export const fontInStyle = <Text style={{ fontFamily: { name: "Inter", src: "https://fonts.example.com/inter.woff2" } }}>x</Text>;
// @ts-expect-error a variable font's range is two weights, its lowest and its highest
export const threeWeights = <Email fonts={[{ family: "Inter", src: "https://fonts.example.com/inter.woff2", weight: [100, 400, 900] }]} />;
// @ts-expect-error a font's format is woff2, woff, truetype or opentype
export const wrongFormat = <Email fonts={[{ family: "Inter", src: "https://fonts.example.com/inter.eot", format: "eot" }]} />;
// @ts-expect-error a Span is raised or lowered: baseline, super or sub
export const wrongRaise = <Span style={{ verticalAlign: "top" }}>x</Span>;


// Phone and hover styles inside style, each block typed to what the component takes there.
export const blocks = (
  <Email>
    <Heading style={{ fontSize: 32, mobile: { fontSize: 24, textAlign: "center" } }}>Title</Heading>
    <Button href="https://example.com" style={{ backgroundColor: "#111827", hover: { backgroundColor: "#374151", color: "#ffffff" }, mobile: { width: "100%" } }}>
      Go
    </Button>
    <Link href="https://example.com" style={{ hover: { textDecoration: "underline" } }}>
      a link
    </Link>
  </Email>
);
// @ts-expect-error A style that can't be set for phones.
export const notOnPhones = <Text style={{ mobile: { backgroundColor: "#000000" } }}>Hi</Text>;
// @ts-expect-error A Heading has no hover styles: not even an empty block.
export const noHoverBlock = <Heading style={{ hover: {} }}>Title</Heading>;
// @ts-expect-error A Heading has no hover styles.
export const noHoverStyle = <Heading style={{ hover: { fontSize: 16 } }}>Title</Heading>;
// @ts-expect-error A Button's hover styles are its colors.
export const notAHoverStyle = <Button href="https://example.com" style={{ hover: { padding: 8 } }}>Go</Button>;
// @ts-expect-error Nor does a Menu have any.
export const menuHover = <Menu items={[{ text: "Docs", href: "https://example.com" }]} style={{ hover: {} }} />;
// @ts-expect-error A shape takes no phone styles.
export const shapeOnPhones = <Svg width={40} height={20}><Rect width={40} height={20} style={{ mobile: { fill: "red" } }} /></Svg>;
const shapeStyle = { mobile: { fill: "red" } };
// @ts-expect-error Not from a variable either.
export const shapeFromVariable = <Svg width={40} height={20}><Rect width={40} height={20} style={shapeStyle} /></Svg>;
// The mobile={…} and hover={…} props are gone: phone and hover styles are blocks of style.
// @ts-expect-error No mobile prop.
export const noMobileProp = <Heading mobile={{ fontSize: 20 }}>Title</Heading>;
// @ts-expect-error No hover prop.
export const noHoverProp = <Button href="https://example.com" hover={{ backgroundColor: "#000000" }}>Go</Button>;
// Other libraries' ways of writing a condition aren't props or styles either.
// @ts-expect-error No _hover prop (Chakra's).
export const chakraHover = <Button href="https://example.com" _hover={{ backgroundColor: "#000000" }}>Go</Button>;
// @ts-expect-error No _hover style.
export const chakraHoverStyle = <Button href="https://example.com" style={{ _hover: { backgroundColor: "#000000" } }}>Go</Button>;
// @ts-expect-error No md breakpoint.
export const tailwindBreakpoint = <Text style={{ md: { fontSize: 18 } }}>Hi</Text>;

// Email clients: the option on validate(), render() and prepare(), the fields on a diagnostic, and what's known of each client.
export const clients: EmailClient[] = ["outlook", "gmail-app"];
export const validated = validate(ok, { emailClients: clients });
export const rendered = render(ok, { emailClients: [], pretty: true });
export const validateOptions: ValidateOptions = { emailClients: ["apple-mail"] };
export const prepared = prepare(ok, { emailClients: ["yahoo", "samsung-email"] });
export const fields = (d: Diagnostic): [EmailClient[] | undefined, string | undefined, string | undefined] => [d.clients, d.fix, d.see];
export const measured: number | undefined = EMAIL_CLIENTS.outlook.measured?.wordsWithin4px;
// @ts-expect-error an email client it doesn't know
export const unknownClient = validate(ok, { emailClients: ["hotmail"] });
