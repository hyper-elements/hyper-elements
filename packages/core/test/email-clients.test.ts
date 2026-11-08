import { Diagnostics, formatDiagnostics, type Diagnostic } from "../src/diagnostics";
import { addForClients, DEFAULT_EMAIL_CLIENTS, EMAIL_CLIENTS, forEmailClients, type EmailClient } from "../src/email-clients";
import { renderTemplate, validateTemplate } from "../src/writers";

const email = (children: unknown[], props: Record<string, unknown> = {}) => ({ root: { type: "Email", props: { width: 600, ...props }, children } });
const page = (children: unknown[]) => ({ root: { type: "Page", props: { width: 600 }, children } });
const spaced = { type: "Text", style: { letterSpacing: 2 }, children: ["Spaced"] };
const sized = { type: "Row", children: [{ type: "Column", style: { flex: "none" }, children: [{ type: "Text", children: ["x"] }] }] };
const codes = (diagnostics: Diagnostic[]) => diagnostics.map((d) => d.code);
const html = (markup: string) => email([{ type: "Html", props: { html: markup } }]);
const htmlChecks = (markup: string, emailClients?: EmailClient[]) => validateTemplate(html(markup), { emailClients }).diagnostics.filter((d) => d.code === "email/html-css");
const ALL = Object.keys(EMAIL_CLIENTS) as EmailClient[];

describe("email clients", () => {
  it("checks the clients most email is read in by default, four of them measured, the rest from caniemail's tables", () => {
    expect(DEFAULT_EMAIL_CLIENTS).toEqual(["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "apple-mail", "yahoo", "aol", "samsung-email"]);
    expect(ALL).toHaveLength(26);
    expect(EMAIL_CLIENTS.outlook.measured).toMatchObject({ elements: "0.3.0", wordsWithin4px: 0.85 });
    expect(EMAIL_CLIENTS.outlook.approximate).toBe(true);
    expect(ALL.filter((client) => EMAIL_CLIENTS[client].measured)).toEqual(["outlook", "outlook-com", "gmail", "apple-mail"]);
    expect(EMAIL_CLIENTS.yahoo).toEqual({ name: "Yahoo Mail", widths: {}, dark: false, approximate: true, measured: null });
  });

  it("names the clients a problem is about: letter spacing, which classic Outlook doesn't draw", () => {
    const [d] = validateTemplate(email([spaced])).diagnostics;
    expect(d).toMatchObject({ code: "email/outlook-degraded", severity: "info", clients: ["outlook"] });
  });

  it("leaves out a problem about clients not asked for, and keeps one about none in particular", () => {
    const template = email([spaced, sized]);
    expect(codes(validateTemplate(template).diagnostics)).toEqual(["email/outlook-degraded", "email/width"]);
    expect(codes(validateTemplate(template, { emailClients: ["gmail"] }).diagnostics)).toEqual(["email/width"]);
    // [] leaves out every email client problem, not the email's own.
    expect(codes(validateTemplate(template, { emailClients: [] }).diagnostics)).toEqual(["email/width"]);
  });

  it("narrows a problem's clients to those asked for, its code and path the same", () => {
    const template = email([{ type: "Text", style: { fontFamily: "Inter" }, children: ["Hi"] }], { fonts: [{ family: "Inter", src: "https://fonts.test/inter.woff2" }] });
    const all = validateTemplate(template).diagnostics.find((d) => d.code === "email/font-fallback")!;
    const narrowed = validateTemplate(template, { emailClients: ["outlook", "apple-mail"] }).diagnostics.find((d) => d.code === "email/font-fallback")!;
    expect(all.clients).toEqual(["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol"]);
    expect(all.fix).toBe('end it with a font the client has: "Inter, Arial, sans-serif"');
    expect(all.see).toBe("https://www.caniemail.com/features/css-at-font-face/");
    expect(narrowed).toEqual({ ...all, clients: ["outlook"] });
    // Apple Mail loads web fonts: asked for alone, nothing to say.
    expect(validateTemplate(template, { emailClients: ["apple-mail"] }).diagnostics.filter((d) => d.code === "email/font-fallback")).toEqual([]);
  });

  it("says Gmail's clipping once, for Gmail on the web and its apps", () => {
    const long = email(Array.from({ length: 400 }, (_, i) => ({ type: "Text", children: [`Paragraph ${i} `.repeat(30)] })));
    const sizes = (emailClients?: EmailClient[]) => renderTemplate(long, { emailClients }).diagnostics.filter((d) => d.code === "email/size");
    const [clipped] = sizes();
    expect(sizes()).toHaveLength(1);
    expect(clipped).toMatchObject({ severity: "warning", clients: ["gmail", "gmail-app", "gmail-app-other"] });
    expect(clipped.fix).toContain("shorten the email");
    expect(sizes(["gmail-app"])).toEqual([{ ...clipped, clients: ["gmail-app"] }]);
    expect(sizes(["apple-mail"])).toEqual([]);
  });

  it("ignores the option for a root that isn't an Email, and says so", () => {
    expect(codes(validateTemplate(page([spaced])).diagnostics)).toEqual([]);
    expect(validateTemplate(page([spaced]), { emailClients: ["gmail"] }).diagnostics).toEqual([
      { code: "email/clients-ignored", severity: "info", message: "emailClients is for an Email; a Page isn't checked for email clients", path: "root" },
    ]);
  });

  it("throws on a client it doesn't know", () => {
    expect(() => validateTemplate(email([spaced]), { emailClients: ["hotmail" as never] })).toThrow(/emailClients takes a list of outlook, outlook-com, outlook-mac, .*, rainloop, not "hotmail"/);
  });

  it("makes one diagnostic of two the same, with the clients of both", () => {
    const d = (clients: Diagnostic["clients"]): Diagnostic => ({ code: "email/x", severity: "info", message: "m", path: "root", clients });
    expect(forEmailClients([d(["gmail"]), d(["outlook"]), d(undefined)])).toEqual([d(["gmail", "outlook"]), d(undefined)]);
  });

  it("reports a problem at its severity for measured clients and caniemail's alike, and what's assumed as a note", () => {
    const d = new Diagnostics();
    addForClients(d, "email/x", "warning", "Cut off", "root", undefined, { clients: ["outlook", "gmail-app"] });
    addForClients(d, "email/y", "warning", "Hidden", "root", undefined, { clients: ["gmail"], assumed: true });
    expect(d.list).toEqual([
      { code: "email/x", severity: "warning", message: "Cut off", path: "root", clients: ["outlook", "gmail-app"] },
      { code: "email/y", severity: "info", message: "Hidden (not checked)", path: "root", clients: ["gmail"] },
    ]);
  });

  it("prints a diagnostic's clients, fix and how to see it on its line", () => {
    const line = formatDiagnostics([{ code: "email/size", severity: "warning", message: "The email is 108 KB", path: "root", clients: ["gmail"], fix: "shorten it", see: "a preview" }]);
    expect(line).toBe("warning email/size at root: The email is 108 KB [gmail] Fix: shorten it See: a preview");
    expect(formatDiagnostics([{ code: "prop/unknown", severity: "error", message: "No such prop", path: "root" }])).toBe("error prop/unknown at root: No such prop");
  });
});

describe("an Html block's CSS that email clients remove", () => {
  const OUTLOOKS = ["outlook", "outlook-com", "outlook-mac", "outlook-app"];
  const GMAILS = ["gmail", "gmail-app", "gmail-app-other"];
  it.each([
    ["!IMPORTANT in capitals", '<p style="color:red !IMPORTANT">x</p>', ["gmail"], undefined],
    ["a negative margin", '<p style="margin-top:-12px">x</p>', ["outlook-com", "gmail"], undefined],
    ["position: absolute", '<div style="position:absolute;top:0">x</div>', [...OUTLOOKS, ...GMAILS, "yahoo", "aol"], "css-position"],
    ["var()", '<p style="color:var(--brand)">x</p>', [...OUTLOOKS, ...GMAILS, "yahoo", "aol"], "css-variables"],
    ["a gradient", '<div style="background:linear-gradient(#fff,#000)">x</div>', [...OUTLOOKS, "gmail-app", "gmail-app-other", "yahoo", "aol", "samsung-email"], "css-linear-gradient"],
    ["oklch()", '<p style="color:oklch(70% 0.1 200)">x</p>', ["outlook-com", "gmail"], undefined],
    ["rgb() with spaces", '<p style="color:rgb(8 121 161)">x</p>', ["gmail"], undefined],
    ["a <style>", "<style>p{color:red}</style><p>x</p>", GMAILS, "html-style"],
    ["box-shadow", '<div style="box-shadow:0 1px 2px #000">x</div>', ["outlook", "gmail", "gmail-app", "yahoo", "aol"], "css-box-shadow"],
    ["text-shadow", '<p style="text-shadow:0 1px #000">x</p>', [...OUTLOOKS, ...GMAILS], "css-text-shadow"],
    ["display: flex", '<div style="display:flex">x</div>', ["outlook", "gmail-app-other"], "css-display-flex"],
    ["display: grid", '<div style="display:grid">x</div>', ["outlook", "gmail-app-other"], "css-display-grid"],
    ["opacity", '<p style="opacity:0.5">x</p>', ["outlook", "aol"], "css-opacity"],
    ["object-fit", '<img style="object-fit:cover" src="https://example.com/a.png" alt="">', ["outlook", "gmail-app-other", "yahoo", "aol"], "css-object-fit"],
    ["aspect-ratio", '<div style="aspect-ratio:16/9">x</div>', [...OUTLOOKS, ...GMAILS, "yahoo", "aol", "samsung-email"], "css-aspect-ratio"],
  ])("notes %s, for the clients that remove it", (_, markup, clients, feature) => {
    const found = htmlChecks(markup);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: "info", path: "root.children[0].props.html" });
    expect([...found[0].clients!].sort()).toEqual([...clients].sort());
    expect(found[0].message).toMatch(/^This Html block's markup may have /);
    expect(found[0].fix).toBeTruthy();
    expect(found[0].see).toBe(feature && `https://www.caniemail.com/features/${feature}/`);
  });

  it("notes nothing in markup they keep", () => {
    const kept = '<div style="background-position:center;margin:0 12px;color:rgb(8, 121, 161);position:relative"><p style="color:red !important;padding:4px;display:block">A gradient of words, in color (position: absolute), with a text-shadow</p></div>';
    expect(htmlChecks(kept)).toEqual([]);
  });

  it("leaves its notes out with the clients", () => {
    expect(htmlChecks('<div style="position:absolute">x</div>', [])).toEqual([]);
  });

  it("names clients not checked by default where they're asked for", () => {
    expect(htmlChecks('<div style="display:flex">x</div>', ALL)[0]!.clients).toEqual(["outlook", "gmail-app-other", "orange", "gmx", "web-de"]);
  });
});

describe("other problems from caniemail's tables", () => {
  const image = (src: string) => email([{ type: "Image", props: { src: { src, width: 600, height: 300 }, alt: "Hero" } }]);
  const formats = (src: string, emailClients?: EmailClient[]) => validateTemplate(image(src), { emailClients }).diagnostics.filter((d) => d.code === "email/image-format");

  it("warns of an image format a client doesn't show, by its extension or data: type", () => {
    expect(formats("https://example.com/hero.webp?v=2")).toEqual([
      {
        code: "email/image-format",
        severity: "warning",
        message: "This Image is a WEBP file, which these email clients don't show",
        path: "root.children[0].props.src",
        clients: ["outlook"],
        fix: "use a PNG, JPEG or GIF file",
        see: "https://www.caniemail.com/features/image-webp/",
      },
    ]);
    expect(formats("https://example.com/hero.avif", ALL)[0]!.clients).toEqual(["outlook", "fastmail", "gmx", "web-de", "orange", "sfr", "mail-ru", "ionos"]);
    expect(formats("data:image/svg+xml;base64,PHN2Zy8+", ALL)[0]!.clients).toEqual(["mail-ru"]);
    // Gmail shows an SVG, as a PNG: nothing by default.
    expect(formats("https://example.com/logo.svg")).toEqual([]);
    expect(formats("https://example.com/hero.png")).toEqual([]);
    expect(formats("https://example.com/webp/hero.png")).toEqual([]);
  });

  it("notes once where phone styles don't apply, and warns where something hidden on desktop would show nowhere", () => {
    const phone = (children: unknown[]) => validateTemplate(email(children)).diagnostics.filter((d) => d.code === "email/phone-styles");
    const text = (extra: Record<string, unknown>) => ({ type: "Text", ...extra, children: ["Hi"] });
    expect(phone([text({})])).toEqual([]);
    const [styled] = phone([text({ mobile: { fontSize: 18 } }), text({ mobile: { fontSize: 20 } })]);
    expect(phone([text({ mobile: { fontSize: 18 } }), text({ mobile: { fontSize: 20 } })])).toHaveLength(1);
    expect(styled).toMatchObject({ severity: "info", path: "root", clients: ["gmail-app-other", "samsung-email"], see: "https://www.caniemail.com/features/css-at-media/" });
    expect(styled!.message).toBe("On phones, the email's phone styles don't apply: it keeps its desktop styles (Rows still stack)");
    expect(phone([text({ hidden: { mobile: true } })])[0]).toMatchObject({ severity: "info", message: "On phones, the email's phone styles don't apply: what's hidden on phones shows (Rows still stack)" });
    const [hidden] = phone([text({ hidden: { desktop: true } })]);
    expect(hidden).toMatchObject({ severity: "warning", message: "On phones, the email's phone styles don't apply: what's hidden on desktop shows nowhere (Rows still stack)" });
    expect(hidden!.fix).toContain("show what a reader needs on desktop too");
  });

  it("says what caniemail's tables say of a style, with the page there", () => {
    const one = (style: Record<string, unknown>, emailClients?: EmailClient[]) => validateTemplate(email([{ type: "Text", style, children: ["Hi"] }]), { emailClients }).diagnostics;
    expect(one({ fontWeight: 300 })).toEqual([
      {
        code: "email/outlook-degraded",
        severity: "info",
        message: "fontWeight on this Text in classic Outlook: normal weight: Word draws only normal and bold (600 and over)",
        path: "root.children[0].style.fontWeight",
        clients: ["outlook"],
        see: "https://www.caniemail.com/features/css-font-weight/",
      },
    ]);
    expect(one({ fontWeight: 600 })).toEqual([]);
    expect(one({ textTransform: "lowercase" }).map((d) => [d.code, d.clients])).toEqual([["email/outlook-degraded", ["outlook"]]]);
    expect(one({ textDecoration: "line-through" }).map((d) => [d.code, d.severity, d.clients, d.message])).toEqual([
      ["email/degraded", "info", ["gmail-app-other"], 'textDecoration: "line-through" on this Text in some email clients: no line: the client removes it'],
    ]);
    expect(one({ textDecoration: "none" })).toEqual([]);
  });

  it("says what a root's language and direction do, for the clients that remove them", () => {
    const root = (props: Record<string, unknown>, emailClients?: EmailClient[]) => validateTemplate(email([{ type: "Text", children: ["مرحبا"] }], props), { emailClients }).diagnostics;
    // Neither is about a client checked by default.
    expect(root({ lang: "ar", dir: "rtl" })).toEqual([]);
    expect(root({ lang: "ar", dir: "rtl" }, ALL).map((d) => [d.path, d.clients])).toEqual([
      ["root.props.lang", ["hey", "gmx", "web-de", "orange", "ionos"]],
      ["root.props.dir", ["gmx", "web-de"]],
    ]);
    expect(root({ dir: "ltr" }, ALL)).toEqual([]);
  });
});
