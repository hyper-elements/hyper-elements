/**
 * The Hyper Elements home page (apps/website/src/pages/index.astro) written as a Page with Box and page styles: the
 * themes and pages plan's Phase 3 exit check, for testing only. The site's own page is unchanged.
 *
 * Its static parts only. The plan puts the rest in later phases: the hero animation, the agent loop's and "How it
 * works"'s demos (Islands, Phase 8), the agent tabs and the templates marquee (Phase 6), copy buttons (Phase 6), the
 * reveal-on-scroll motion (Phase 7), and the 1000px and 640px layouts (Phase 4). Those parts are drawn here as what
 * they show before any script runs.
 */
import type { ReactNode } from "react";
import { Box, Button, Heading, Image, LineBreak, Link, Page, Path, Span, Svg, Text } from "../../../src/primitives";

/** The site's light-mode tokens (apps/website/src/styles/global.css). */
const c = {
  bg: "#ffffff",
  bg1: "#fafafa",
  line: "rgba(0, 0, 0, 0.08)",
  line2: "rgba(0, 0, 0, 0.13)",
  text: "#0a0a0a",
  text2: "#525252",
  text3: "#8a8a8a",
  ok: "#15803d",
  warn: "#b45309",
  err: "#dc2626",
  ink: "#141414",
  inkText: "#ededed",
  inkMuted: "#8a8a8a",
};
const sans = 'Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const mono = '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const line = (color = c.line) => ({ width: 1, style: "solid" as const, color });

/** Where the site's generated images are served (the website's build, served locally for the screenshot). */
export const assets = "http://127.0.0.1:4417";

/** `.wrap`: the content's width, centered. */
const Wrap = ({ children, style }: { children: ReactNode; style?: Record<string, unknown> }) => (
  <Box style={{ width: "100%", maxWidth: 1200, padding: "0 24px", alignSelf: "center", ...style }}>{children}</Box>
);

/** A row that centres what it holds at its own width: in a stack, a Box or a Text keeps the full width whatever its parent's alignItems (the email model). */
const Centered = ({ children }: { children: ReactNode }) => <Box style={{ flexDirection: "row", justifyContent: "center" }}>{children}</Box>;

/** `.cmd`: the install command (its copy button is Phase 6's CopyButton). */
const Cmd = () => (
  <Text
    style={{
      fontFamily: mono,
      fontSize: 14,
      fontWeight: 500,
      padding: "10px 16px",
      border: line(c.line2),
      borderRadius: 10,
      backgroundColor: c.bg1,
      whiteSpace: "nowrap",
    }}
  >
    <Span style={{ color: c.text3 }}>$ </Span>npm i @hyper-elements/react
  </Text>
);

const primary = {
  backgroundColor: c.text,
  color: c.bg,
  fontSize: 14.5,
  fontWeight: 600,
  padding: "11px 18px",
  borderRadius: 10,
} as const;
const ghost = { ...primary, backgroundColor: c.bg, color: c.text, border: line(c.line2) };

/** `.mini`: a few lines of code in a tile. */
const Mini = ({ children, nowrap }: { children: ReactNode; nowrap?: boolean }) => (
  <Text style={{ fontFamily: mono, fontSize: 12.5, lineHeight: 1.65, whiteSpace: nowrap ? "pre" : "pre-wrap", flexGrow: 1 }}>
    {children}
  </Text>
);
const Dim = ({ children }: { children: ReactNode }) => <Span style={{ color: c.text3 }}>{children}</Span>;
const Tag = ({ children }: { children: ReactNode }) => <Span style={{ fontWeight: 600 }}>{children}</Span>;
const Label = ({ children, color }: { children: ReactNode; color: string }) => (
  <Span style={{ color, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.06em" }}>{children}</Span>
);

/** `.tile`: a feature in the bento grid. */
const Tile = ({ title, span, children }: { title: string; span?: string; children: ReactNode }) => (
  <Box
    as="article"
    style={{
      gridColumn: span,
      border: line(),
      borderRadius: 14,
      padding: 28,
      backgroundColor: c.bg1,
      minHeight: 230,
      gap: 16,
      overflow: "hidden",
    }}
  >
    <Heading level={3} style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.2 }}>
      {title}
    </Heading>
    {children}
  </Box>
);
const Note = ({ children }: { children: ReactNode }) => (
  <Text style={{ fontSize: 13.5, color: c.text2 }}>{children}</Text>
);

/** `.sec-head`: a section's heading and line under it. */
const SecHead = ({ title, sub }: { title: string; sub?: string }) => (
  <Box style={{ alignItems: "center", textAlign: "center", gap: 12, maxWidth: 640, alignSelf: "center" }}>
    <Heading level={2} style={{ fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.06, letterSpacing: "-0.04em", fontWeight: 600 }}>
      {title}
    </Heading>
    {sub && <Text style={{ color: c.text2, fontSize: 17 }}>{sub}</Text>}
  </Box>
);
const Band = ({ children, top = 160 }: { children: ReactNode; top?: number }) => (
  <Box as="section" style={{ padding: `${top}px 0 160px` }}>
    <Wrap style={{ gap: 64 }}>{children}</Wrap>
  </Box>
);

/** `.fact`: one of the four figures under the hero. */
const Fact = ({ k, v, s, href, first }: { k: string; v: string; s: string; href?: string; first?: boolean }) => (
  <Box style={{ gap: 6, padding: first ? "22px 24px 22px 0" : "22px 24px", borderLeft: first ? undefined : line(), minWidth: 0 }}>
    <Text style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: c.text3 }}>{k}</Text>
    <Text style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, paddingTop: 4 }}>
      {href ? (
        <Link href={href} style={{ color: c.text, textDecoration: "none", hover: { textDecoration: "underline" } }}>
          {v}
        </Link>
      ) : (
        v
      )}
    </Text>
    <Text style={{ fontSize: 13.5, color: c.text3, lineHeight: 1.45 }}>{s}</Text>
  </Box>
);

/** The logo (Logo.astro), its second half turned 180° about its centre: an Svg's Path takes no transform. */
const Logo = ({ size = 28 }: { size?: number }) => (
  <Svg width={size} height={Math.round(size * 0.75)} viewBox="228 326 798 600">
    <Path
      d="M595 388 L623 424 L436 627 L665 913 L522 913 Q492 913 470 891 L262 678 Q240 654 240 627 Q240 600 262 576 L428 410 Q452 388 482 388 Z"
      style={{ fill: "#111111" }}
    />
    <Path
      d="M659 864 L631 828 L818 625 L589 339 L732 339 Q762 339 784 361 L992 574 Q1014 598 1014 625 Q1014 652 992 676 L826 842 Q802 864 772 864 Z"
      style={{ fill: "#ef4638" }}
    />
  </Svg>
);

const navLink = { color: c.text2, textDecoration: "none", fontSize: 14, hover: { color: c.text } } as const;

const Header = () => (
  <Box
    as="header"
    style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      height: 64,
      backgroundColor: "rgba(255, 255, 255, 0.8)",
      backdropFilter: "saturate(1.4) blur(14px)",
      borderBottom: line(),
      justifyContent: "center",
    }}
  >
    <Box style={{ flexDirection: "row", alignItems: "center", gap: 24, width: "100%", maxWidth: 1360, padding: "0 24px", alignSelf: "center" }}>
      <Box style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Logo />
        <Text style={{ fontWeight: 600, letterSpacing: "-0.02em", fontSize: 15.5, whiteSpace: "nowrap" }}>
          <Link href="/" style={{ color: c.text, textDecoration: "none" }}>
            Hyper Elements
          </Link>
        </Text>
      </Box>
      <Text style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, color: c.text2, border: line(c.line2), borderRadius: 999, padding: "2px 7px" }}>
        v0.4
      </Text>
      <Box as="nav" style={{ flexDirection: "row", gap: 2, flex: 1 }}>
        {["Docs", "Components", "Templates", "Playground", "AI", "Blog"].map((label) => (
          <Text key={label} style={{ padding: "6px 11px", borderRadius: 8 }}>
            <Link href={`/${label.toLowerCase()}`} style={navLink}>
              {label}
            </Link>
          </Text>
        ))}
      </Box>
      <Box style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text
          style={{
            width: 200,
            padding: "7px 8px 7px 12px",
            borderRadius: 9,
            border: line(c.line2),
            backgroundColor: c.bg1,
            color: c.text3,
            fontSize: 13.5,
          }}
        >
          Search docs
        </Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" style={{ padding: 9 }}>
          <Path
            d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"
            style={{ fill: c.text2 }}
          />
        </Svg>
        <Button href="/docs/quickstart" style={{ ...primary, fontSize: 13.5, padding: "8px 12px", borderRadius: 9 }}>
          Get started
        </Button>
      </Box>
    </Box>
  </Box>
);

/** The hero's picture before its animation runs (Prism.astro, an Island in Phase 8): the template, the engine, the email. */
const Prism = () => (
  <Box style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40, padding: "48px 0 0" }}>
    <Box style={{ width: 360, backgroundColor: c.ink, borderRadius: 12, padding: 20, gap: 12, boxShadow: "0 30px 60px -30px rgba(0, 0, 0, 0.25)" }}>
      <Text style={{ fontFamily: mono, fontSize: 11, color: c.inkMuted }}>tarn-shipped.tsx</Text>
      <Text style={{ fontFamily: mono, fontSize: 12.5, lineHeight: 1.65, color: c.inkText, whiteSpace: "pre" }}>
        {"const out = await render(\n  <Email>\n    <TarnShipped />\n  </Email>\n)"}
      </Text>
      <Text style={{ fontFamily: mono, fontSize: 12.5, color: c.inkMuted }}>→ tarn-shipped.html + .txt</Text>
    </Box>
    <Box style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: c.ink, alignItems: "center", justifyContent: "center" }}>
      <Logo size={48} />
    </Box>
    <Box style={{ width: 380, borderRadius: 12, overflow: "hidden", border: line(c.line2), boxShadow: "0 30px 60px -30px rgba(0, 0, 0, 0.25)" }}>
      <Image
        src={{ src: `${assets}/generated/email-clients/tarn-shipped-apple-mail.png`, width: 820, height: 985 }}
        alt="The Tarn shipping email"
        style={{ width: "100%", height: 300, objectFit: "cover", objectPosition: "top" }}
      />
    </Box>
  </Box>
);

const Hero = () => (
  <Box as="section" style={{ padding: "clamp(28px, 5vh, 80px) 0 128px" }}>
    <Wrap style={{ alignItems: "center", textAlign: "center", gap: "clamp(12px, 1.8vh, 20px)" }}>
      <Centered>
      <Box
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: "4px 14px 4px 6px",
          borderRadius: 999,
          border: line(c.line2),
          backgroundColor: c.bg1,
        }}
      >
        <Text style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, backgroundColor: c.text, color: c.bg }}>
          v0.4
        </Text>
        <Text style={{ fontSize: 13.5, color: c.text2 }}>
          <Link href="https://github.com/hyper-elements/hyper-elements" style={{ color: c.text2, textDecoration: "none" }}>
            Open source, MIT licensed →
          </Link>
        </Text>
      </Box>
      </Centered>
      <Heading
        level={1}
        style={{ fontSize: "clamp(40px, min(6.6vw, 7.3vh), 84px)", lineHeight: 0.98, letterSpacing: "-0.055em", fontWeight: 600 }}
      >
        The content engine
        <LineBreak />
        <Span style={{ color: c.text3 }}>for agents.</Span>
      </Heading>
      <Text style={{ maxWidth: "60ch", fontSize: "clamp(16px, 2.1vh, 19px)", lineHeight: 1.55, color: c.text2 }}>
        Your agent writes React. Hyper Elements turns it into emails, pages, PDFs and images, checks it in every client, and
        tells the agent how to fix what's wrong.
      </Text>
      <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "center" }}>
        <Button href="/components" style={primary}>
          Explore components →
        </Button>
        <Cmd />
      </Box>
    </Wrap>
    <Wrap>
      <Prism />
    </Wrap>
  </Box>
);

const Facts = () => (
  <Box as="section" style={{ borderTop: line(), borderBottom: line() }}>
    <Wrap style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
      <Fact first k="Agent benchmark" v="2.6× faster" s="than React Email" href="/docs/benchmark" />
      <Fact k="Tokens written" v="3.4× fewer" s="than React Email" href="/docs/benchmark" />
      <Fact k="Renders" v="One template" s="Email, web page, PDF or image" />
      <Fact k="Built for" v="Any agent" s="Claude Code, Codex, Cursor, Copilot" />
    </Wrap>
  </Box>
);

/** A dark panel of code, as the demos draw them. */
const Ink = ({ children }: { children: ReactNode }) => (
  <Box style={{ backgroundColor: c.ink, borderRadius: 12, padding: 16, gap: 8, minHeight: 220 }}>{children}</Box>
);
const InkCode = ({ children }: { children: ReactNode }) => (
  <Text style={{ fontFamily: mono, fontSize: 11.5, lineHeight: 1.6, color: c.inkText, whiteSpace: "pre-wrap" }}>{children}</Text>
);

/** The agent loop (AgentLoop.astro) at rest: its four steps. */
const AgentLoop = () => {
  const step = (num: string, title: string, sub: string, panel: ReactNode) => (
    <Box as="li" style={{ gap: 14, minWidth: 0 }}>
      <Box style={{ flexDirection: "row", gap: 10, alignItems: "start" }}>
        <Text style={{ fontFamily: mono, fontSize: 11, color: c.text3, padding: "2px 6px", border: line(c.line2), borderRadius: 6 }}>{num}</Text>
        <Box style={{ gap: 2 }}>
          <Heading level={3} style={{ fontSize: 15, fontWeight: 600 }}>
            {title}
          </Heading>
          <Text style={{ fontSize: 12.5, color: c.text3 }}>{sub}</Text>
        </Box>
      </Box>
      {panel}
    </Box>
  );
  const client = (id: string, name: string) => (
    <Box style={{ gap: 4, minWidth: 0 }}>
      <Image
        src={{ src: `${assets}/generated/clients/${id}.png`, width: 1200, height: 900 }}
        alt={`The email in ${name}`}
        style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", objectPosition: "top", borderRadius: 4 }}
      />
      <Text style={{ fontSize: 10.5, color: c.inkMuted }}>{name}</Text>
    </Box>
  );
  return (
    <Box style={{ gap: 24 }}>
      <Box as="ol" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20 }}>
        {step(
          "01",
          "Create",
          "Your agent writes JSX",
          <Ink>
            <Text style={{ fontSize: 12, color: c.inkText, border: line("rgba(255, 255, 255, 0.13)"), borderRadius: 8, padding: "6px 10px" }}>
              “Write a launch email for Orbit 2.0”
            </Text>
            <InkCode>
              {'<Email style={{\n  backgroundColor: "#f1f2f6",\n  padding: 24\n}}>\n  <Heading>Orbit 2.0…\n  <Button href="…">Try it\n</Email>'}
            </InkCode>
          </Ink>,
        )}
        {step(
          "02",
          "Check",
          "See it in every client",
          <Ink>
            <Box style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {client("apple-mail", "Apple Mail")}
              {client("classic-outlook", "Classic Outlook")}
              {client("gmail", "Gmail")}
              {client("apple-mail-dark", "Apple Mail, dark")}
            </Box>
            <Text style={{ fontSize: 11.5, color: "#f5b971" }}>⚠ Outlook drops the button's padding</Text>
          </Ink>,
        )}
        {step(
          "03",
          "Validate",
          "Errors, lint and spam score",
          <Ink>
            <InkCode>
              <Span style={{ color: "#ff7b6e" }}>validate() · 1 error</Span>
              {"\nstyle/unknown root.style.padding\n\n"}
              <Span style={{ color: "#f5b971" }}>Lint · 3 warnings</Span>
              {"\na11y/link-text\nbest-practice/preview-text\ndeliverability/unsubscribe\n\n"}
              <Span style={{ color: "#f5b971" }}>Spam score · 3.4 / 10</Span>
            </InkCode>
          </Ink>,
        )}
        {step(
          "04",
          "Fix",
          "Each finding says how",
          <Ink>
            <InkCode>
              <Span style={{ color: "#ff7b6e" }}>{"- <Email style={{padding: 24}}>"}</Span>
              {"\n"}
              <Span style={{ color: "#7ee2a8" }}>{'+ <Email previewText="…">\n+   <Section\n+     style={{ padding: 24 }}>'}</Span>
            </InkCode>
          </Ink>,
        )}
      </Box>
      <Text style={{ fontSize: 12.5, color: c.text3, textAlign: "center" }}>↺ Around again until every check passes and every client looks right</Text>
    </Box>
  );
};

/** "Build with any AI" (BuildWithAI.astro) with its first tab chosen; its tabs are Phase 6's Tabs. */
const BuildWithAI = () => (
  <Box style={{ border: line(), borderRadius: 14, backgroundColor: c.bg1, overflow: "hidden" }}>
    <Box style={{ flexDirection: "row", gap: 4, padding: "10px 12px", borderBottom: line() }}>
      {["Claude Code", "Codex", "Cursor", "Copilot", "Any agent"].map((name, i) => (
        <Text
          key={name}
          style={{
            fontSize: 13,
            fontWeight: 500,
            padding: "6px 12px",
            borderRadius: 8,
            color: i === 0 ? c.text : c.text2,
            backgroundColor: i === 0 ? c.bg : undefined,
            border: i === 0 ? line(c.line2) : undefined,
          }}
        >
          {name}
        </Text>
      ))}
    </Box>
    <Box style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
      <Box style={{ padding: 24, gap: 14 }}>
        <Text style={{ fontSize: 13, fontWeight: 600 }}>1 · Give it the guide</Text>
        <Box style={{ backgroundColor: c.ink, borderRadius: 10, padding: 14, gap: 6 }}>
          <Text style={{ fontFamily: mono, fontSize: 11, color: c.inkMuted }}>CLAUDE.md</Text>
          <Text style={{ fontFamily: mono, fontSize: 12.5, color: c.inkText }}>@node_modules/@hyper-elements/react/GUIDE.md</Text>
        </Box>
        <Text style={{ fontSize: 12.5, color: c.text3 }}>
          The guide ships inside the package, written from the components' own definitions, so it matches the version you
          installed.
        </Text>
      </Box>
      <Box style={{ padding: 24, gap: 14, borderLeft: line() }}>
        <Text style={{ fontSize: 13, fontWeight: 600 }}>2 · Ask for what you want</Text>
        <Box style={{ backgroundColor: c.bg, border: line(c.line2), borderRadius: 10, padding: 14, gap: 12 }}>
          <Text style={{ fontFamily: mono, fontSize: 12.5, lineHeight: 1.6 }}>
            Using Hyper Elements, write a launch email for our new feature in emails/launch.tsx. Run validate() and fix every
            finding, then show me outline().
          </Text>
          <Button href="/ai" style={{ ...ghost, alignSelf: "start", fontSize: 13, padding: "6px 12px" }}>
            Copy prompt
          </Button>
        </Box>
        <Text style={{ fontSize: 13 }}>
          <Link href="/ai" style={{ color: c.text, textDecoration: "none" }}>
            How agents use Hyper Elements →
          </Link>
        </Text>
      </Box>
    </Box>
  </Box>
);

/** "How it works" (WriteThis.astro) at rest: the template and what it draws, side by side. */
const WriteThis = () => (
  <Box style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20 }}>
    <Box style={{ backgroundColor: c.ink, borderRadius: 14, padding: 20, gap: 10 }}>
      <Text style={{ fontFamily: mono, fontSize: 11, color: c.inkMuted }}>emails/pricing.tsx</Text>
      <Text style={{ fontFamily: mono, fontSize: 12, lineHeight: 1.7, color: c.inkText, whiteSpace: "pre" }}>
        {
          'export default function PlanPicker() {\n  return (\n    <Email style={{ backgroundColor: "#f1f2f6" }}>\n      <Section style={{ padding: 24 }}>\n        <Column style={{ gap: 16 }}>\n          <Heading>Pick your Orbit plan</Heading>\n          <Row style={{ gap: 12 }}>\n            {plans.map((p) => (\n              <Column style={{ padding: 12 }}>\n                <Text>{p.name}</Text>\n                <Text>{p.price}</Text>\n              </Column>\n            ))}\n          </Row>\n          <Button href="…">Choose a plan</Button>\n        </Column>\n      </Section>\n    </Email>\n  );\n}'
        }
      </Text>
    </Box>
    <Box style={{ border: line(), borderRadius: 14, backgroundColor: "#f1f2f6", padding: 32, justifyContent: "center", alignItems: "center" }}>
      <Box style={{ width: "100%", maxWidth: 420, backgroundColor: c.bg, borderRadius: 10, padding: 24, gap: 16, boxShadow: "0 12px 30px -18px rgba(0, 0, 0, 0.3)" }}>
        <Heading level={3} style={{ fontSize: 22, fontWeight: 600 }}>
          Pick your Orbit plan
        </Heading>
        <Box style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {[
            ["Starter", "$0"],
            ["Pro", "$24"],
            ["Team", "$79"],
          ].map(([name, price]) => (
            <Box key={name} style={{ padding: 12, borderRadius: 8, backgroundColor: "#eef0fb", gap: 2 }}>
              <Text style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>{name}</Text>
              <Text style={{ fontSize: 20, fontWeight: 700 }}>{price}</Text>
            </Box>
          ))}
        </Box>
        <Button href="https://example.com/plans" style={{ ...primary, backgroundColor: "#6366f1", color: "#ffffff", alignSelf: "start", fontSize: 12, padding: "7px 12px" }}>
          Choose a plan
        </Button>
      </Box>
    </Box>
  </Box>
);

const Features = () => (
  <Box style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
    <Tile title="Type safety" span="span 2">
      <Box style={{ gap: 8 }}>
        <Text style={{ fontFamily: mono, fontSize: 14, lineHeight: 1.7, color: c.text2 }}>
          {"<"}
          <Tag>Button</Tag> style={"{{ font| }}>"}
        </Text>
        <Box
          as="ul"
          style={{
            width: 260,
            padding: 6,
            gap: 0,
            border: line(c.line2),
            borderRadius: 10,
            backgroundColor: c.bg,
            boxShadow: "0 30px 60px -30px rgba(0, 0, 0, 0.25)",
            alignSelf: "start",
          }}
        >
          {[
            ["fontSize", "length"],
            ["fontWeight", "100 to 900"],
            ["fontFamily", "font stack"],
          ].map(([name, kind], i) => (
            <Box
              as="li"
              key={name}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                padding: "5px 8px",
                borderRadius: 6,
                backgroundColor: i === 0 ? "rgba(0, 0, 0, 0.07)" : undefined,
              }}
            >
              <Text style={{ fontFamily: mono, fontSize: 13, color: i === 0 ? c.text : c.text2 }}>{name}</Text>
              <Text style={{ fontFamily: mono, fontSize: 12, color: c.text3 }}>{kind}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Tile>
    <Tile title="Personalization">
      <Mini>
        {"Hi <"}
        <Tag>MergeTag</Tag>
        {' name="first_name" />\n'}
        <Dim>{"  →  in the HTML and the text:"}</Dim>
        {"\nHi {{first_name}}\n\n"}
        <Dim>{"Your provider's syntax with\nthe mergeTag option."}</Dim>
      </Mini>
    </Tile>
    <Tile title="Plain text">
      <Mini>{"[Orbit]\nINTRODUCING ORBIT 2.0\nSHIP EVERY SURFACE FROM ONE CODEBASE.\n…"}</Mini>
    </Tile>
    <Tile title="Client compatibility">
      <Mini>
        <Label color={c.warn}>info</Label>
        {" email/outlook-degraded\n"}
        <Dim>backgroundImage on this Column in classic Outlook: remove backgroundImage</Dim>
      </Mini>
    </Tile>
    <Tile title="Deterministic output">
      <Mini>
        {"render(<Launch />)\n"}
        <Dim>{"  ==="}</Dim>
        {"\nrender(<Launch />)  "}
        <Span style={{ color: c.ok }}>✓</Span>
        {"\n\n"}
        <Dim>{"No clock, no randomness.\nSafe to cache and prerender."}</Dim>
      </Mini>
    </Tile>
    <Tile title="An email client emulator, on your machine" span="1 / -1">
      <Box style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 32 }}>
        <Box style={{ gap: 16, minWidth: 0 }}>
          <Mini>
            {"await renderInEmailClients(<"}
            <Tag>Launch</Tag>
            {" />, { dark: true })\n"}
            <Dim>{"  →  outlook.html  outlook-com.html  gmail.html\n     apple-mail.html  apple-mail.dark.html  …"}</Dim>
            {"\n\n"}
            <Dim>{"Open them in Chrome: each draws the email as that\nclient does, and lists what the client changed."}</Dim>
          </Mini>
          <Note>
            No test sends, no account, nothing uploaded.{" "}
            <Link href="/docs/email-client-emulator" style={{ color: c.text2 }}>
              Email client emulator
            </Link>
          </Note>
        </Box>
        <Box style={{ position: "relative", minHeight: 300 }}>
          <Box style={{ position: "absolute", right: "4%", top: 0, width: "62%", height: 250, opacity: 0.55, borderRadius: 8, overflow: "hidden", border: line(c.line2) }}>
            <Image src={{ src: `${assets}/generated/email-clients/launch-apple-mail.png`, width: 820, height: 985 }} alt="" style={{ width: "100%" }} />
          </Box>
          <Box
            style={{
              position: "absolute",
              left: "4%",
              top: 30,
              width: "62%",
              height: 270,
              borderRadius: 8,
              overflow: "hidden",
              border: line(c.line2),
              boxShadow: "0 18px 40px -18px rgba(0, 0, 0, 0.6)",
              maskImage: "linear-gradient(#000 70%, transparent)",
            }}
          >
            <Image src={{ src: `${assets}/generated/email-clients/launch-outlook.png`, width: 820, height: 989 }} alt="" style={{ width: "100%" }} />
          </Box>
          <Box
            style={{
              position: "absolute",
              right: "7%",
              top: 48,
              width: "25%",
              height: 252,
              borderRadius: 16,
              overflow: "hidden",
              border: { width: 4, style: "solid", color: "#2a2a2a" },
              maskImage: "linear-gradient(#000 78%, transparent)",
            }}
          >
            <Image src={{ src: `${assets}/generated/email-clients/launch-gmail-app.png`, width: 380, height: 997 }} alt="" style={{ width: "100%" }} />
          </Box>
        </Box>
      </Box>
    </Tile>
    <Tile title="Security">
      <Mini>
        {"<"}
        <Tag>Text</Tag>
        {">Hi {name}</"}
        <Tag>Text</Tag>
        {">\n"}
        <Dim>{"  → Hi &lt;img onerror=…&gt;"}</Dim>
        {'\n\n<Button href="javascript:…">\n'}
        <Label color={c.err}>error</Label>
        {" prop/invalid\n"}
        <Dim>isn't a link Elements will write</Dim>
      </Mini>
      <Note>Every value escaped. No eval: runs under a strict CSP.</Note>
    </Tile>
    <Tile title="Custom components" span="span 2">
      <Box style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 28 }}>
        <Mini nowrap>
          <Dim>const</Dim>
          {
            ' ProductCard = component({\n  type: "acme.ProductCard",\n  props: { name: prop.text({ required: true }),\n           photo: prop.image({ required: true }) },\n  render: ({ name, photo }) => …,\n});'
          }
        </Mini>
        <Box style={{ borderLeft: line(), paddingLeft: 28 }}>
          <Mini>
            {"<"}
            <Tag>ProductCard</Tag>
            {' name="Linen shirt" />\n\n'}
            <Label color={c.err}>error</Label>
            {" prop/required\n"}
            <Dim>A acme.ProductCard needs "photo"</Dim>
          </Mini>
        </Box>
      </Box>
      <Note>Named, typed blocks your team and your agents reuse, checked like the built-ins.</Note>
    </Tile>
  </Box>
);

/** The templates band, still: the marquee's animation is Phase 6's Marquee. */
const Templates = () => {
  const cards = [
    ["Fernway spring sale", "Email", "fernway-spring-sale.png"],
    ["Crumb Club", "Image", "crumb-club-thumbnail.png"],
    ["Gridline workshop", "Image", "gridline-workshop-banner.png"],
    ["Morning pages", "Image", "morning-pages-quote.png"],
    ["Slow signals", "Image", "slow-signals-card.png"],
  ];
  return (
    <Box as="section" style={{ padding: "160px 0", gap: 48 }}>
      <Wrap style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "end", gap: 16 }}>
        <Heading level={2} style={{ fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.06, letterSpacing: "-0.04em", fontWeight: 600 }}>
          Templates
        </Heading>
        <Button href="/templates" style={ghost}>
          All templates →
        </Button>
      </Wrap>
      <Box
        style={{
          flexDirection: "row",
          gap: 16,
          overflow: "hidden",
          justifyContent: "center",
          maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        }}
      >
        {cards.map(([title, kind, file]) => (
          <Box key={title} as="article" style={{ width: 340, flexShrink: 0, borderRadius: 12, overflow: "hidden", border: line(), backgroundColor: c.bg1 }}>
            <Image
              src={{ src: `${assets}/generated/templates/${file}`, width: 1200, height: 630 }}
              alt={title}
              style={{ width: "100%", height: 220, objectFit: "cover", objectPosition: "top" }}
            />
            <Box style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "12px 14px" }}>
              <Text style={{ fontSize: 14, fontWeight: 500 }}>{title}</Text>
              <Text style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, color: c.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kind}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const Runs = () => {
  const groups: [string, string[]][] = [
    ["Runs in", ["Next.js", "Node.js", "Server Components", "React 18 & 19"]],
    ["Sends with", ["Resend", "AWS SES", "Postmark", "SendGrid", "Nodemailer"]],
  ];
  return (
    <Box as="section" style={{ borderTop: line(), borderBottom: line() }}>
      {groups.map(([label, items], g) => (
        <Box key={label} style={{ borderTop: g ? line() : undefined }}>
          <Wrap style={{ display: "grid", gridTemplateColumns: "168px minmax(0, 1fr)" }}>
            <Text
              style={{
                alignSelf: "center",
                fontFamily: mono,
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: c.text3,
              }}
            >
              {label}
            </Text>
            <Box style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", minWidth: 0 }}>
              {items.map((name) => (
                <Text key={name} style={{ padding: "20px 22px", borderLeft: line(), fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                  <Link href="/docs" style={{ color: c.text, textDecoration: "none" }}>
                    {name}
                  </Link>
                </Text>
              ))}
            </Box>
          </Wrap>
        </Box>
      ))}
    </Box>
  );
};

const Final = () => (
  <Box as="section" style={{ padding: "160px 0" }}>
    <Wrap style={{ alignItems: "center", textAlign: "center", gap: 20 }}>
      <Heading level={2} style={{ fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.06, letterSpacing: "-0.04em", fontWeight: 600 }}>
        Get started
      </Heading>
      <Centered>
        <Cmd />
      </Centered>
      <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        <Button href="/docs/quickstart" style={primary}>
          Read the quickstart →
        </Button>
        <Button href="https://github.com/hyper-elements/hyper-elements" style={ghost}>
          View on GitHub
        </Button>
      </Box>
    </Wrap>
  </Box>
);

const Footer = () => {
  const column = (title: string, links: string[]) => (
    <Box style={{ gap: 12 }}>
      <Heading level={2} style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: c.text3 }}>
        {title}
      </Heading>
      <Box as="ul" style={{ gap: 8 }}>
        {links.map((name) => (
          <Box as="li" key={name}>
            <Text style={{ fontSize: 14 }}>
              <Link href="/docs" style={{ color: c.text2, textDecoration: "none", hover: { color: c.text } }}>
                {name}
              </Link>
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
  return (
    <Box as="footer" style={{ borderTop: line(), padding: "64px 0 32px" }}>
      <Wrap style={{ gap: 48 }}>
        <Box style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(3, minmax(0, 1fr))", gap: 32 }}>
          <Box style={{ gap: 14 }}>
            <Box style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Logo />
              <Text style={{ fontWeight: 600, fontSize: 15.5 }}>Hyper Elements</Text>
            </Box>
            <Text style={{ maxWidth: 300, fontSize: 14, color: c.text2 }}>
              The content engine for agents. Email, web pages, PDFs and images. Open source, MIT.
            </Text>
            <Text style={{ fontSize: 14, color: c.text2 }}>
              Built by the team at{" "}
              <Link href="https://unlayer.com" style={{ color: c.text2 }}>
                Unlayer
              </Link>
            </Text>
          </Box>
          {column("Learn", ["Introduction", "Quickstart", "Blog", "Components", "Rendering"])}
          {column("Explore", ["Component gallery", "Templates", "Playground", "For AI agents", "Migrate from React Email"])}
          {column("Project", ["GitHub", "npm", "llms.txt", "llms-full.txt", "MIT License"])}
        </Box>
        <Box style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, fontSize: 12.5, color: c.text3 }}>
          <Text>© 2026 Hyper Elements</Text>
          <Text>Every preview on this site is real output, rendered by Hyper Elements when the site is built.</Text>
        </Box>
      </Wrap>
    </Box>
  );
};

export default function HomePage() {
  return (
    <Page
      width={1200}
      title="Hyper Elements: the content engine for agents"
      description="Your agent writes React. Hyper Elements turns it into emails, pages, PDFs and images."
      lang="en"
      fonts={[
        { family: "Geist", src: "https://fonts.gstatic.com/s/geist/v1/gyByhwUxId8gMEwcGFU.woff2", format: "woff2", weight: 400 },
      ]}
      style={{ backgroundColor: c.bg, color: c.text, fontFamily: sans, fontSize: 16, lineHeight: 1.6, gap: 0 }}
    >
      <Header />
      <Hero />
      <Facts />
      <Band>
        <SecHead title="The agent loop" sub="Create, check, validate, fix. Around again until the content is right." />
        <AgentLoop />
      </Band>
      <Band top={0}>
        <SecHead title="Build with any AI" sub="Point your agent at the guide, then ask for what you want." />
        <BuildWithAI />
      </Band>
      <Band>
        <SecHead title="How it works" sub="A short template and its real HTML. Resize it: rows stack and phone styles apply." />
        <WriteThis />
      </Band>
      <Band>
        <SecHead title="Features" />
        <Features />
      </Band>
      <Templates />
      <Runs />
      <Final />
      <Footer />
    </Page>
  );
}
