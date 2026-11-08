import { Diagnostics, formatDiagnostics, type Diagnostic } from "../src/diagnostics";
import { addForClients, DEFAULT_EMAIL_CLIENTS, EMAIL_CLIENTS, forEmailClients } from "../src/email-clients";
import { renderTemplate, validateTemplate } from "../src/writers";

const email = (children: unknown[], props: Record<string, unknown> = {}) => ({ root: { type: "Email", props: { width: 600, ...props }, children } });
const page = (children: unknown[]) => ({ root: { type: "Page", props: { width: 600 }, children } });
const spaced = { type: "Text", style: { letterSpacing: 2 }, children: ["Spaced"] };
const sized = { type: "Row", children: [{ type: "Column", style: { flex: "none" }, children: [{ type: "Text", children: ["x"] }] }] };
const codes = (diagnostics: Diagnostic[]) => diagnostics.map((d) => d.code);
const html = (markup: string) => email([{ type: "Html", props: { html: markup } }]);
const htmlChecks = (markup: string, emailClients?: never[]) => validateTemplate(html(markup), { emailClients }).diagnostics.filter((d) => d.code === "email/html-css");

describe("email clients", () => {
  it("lists the measured clients, checked by default, and the Gmail apps as not measured", () => {
    expect(DEFAULT_EMAIL_CLIENTS).toEqual(["outlook", "outlook-com", "gmail", "apple-mail"]);
    expect(EMAIL_CLIENTS.outlook.measured).toMatchObject({ elements: "0.3.0", wordsWithin4px: 0.85 });
    expect(EMAIL_CLIENTS.outlook.approximate).toBe(true);
    expect(EMAIL_CLIENTS["gmail-app"].measured).toBeNull();
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
    expect(all.clients).toEqual(["gmail", "outlook"]);
    expect(all.fix).toBe('end it with a font the client has: "Inter, Arial, sans-serif"');
    expect(narrowed).toEqual({ ...all, clients: ["outlook"] });
  });

  it("says Gmail's clipping for Gmail on the web, and for the apps, as not measured, only when they're named", () => {
    const long = email(Array.from({ length: 400 }, (_, i) => ({ type: "Text", children: [`Paragraph ${i} `.repeat(30)] })));
    const sizes = (emailClients?: ("gmail" | "gmail-app")[]) => renderTemplate(long, { emailClients }).diagnostics.filter((d) => d.code === "email/size");
    const [web] = sizes();
    expect(sizes()).toHaveLength(1);
    expect(web).toMatchObject({ severity: "warning", clients: ["gmail"] });
    expect(web.fix).toContain("shorten the email");
    const [, app] = sizes(["gmail", "gmail-app"]);
    expect(app).toMatchObject({ severity: "info", clients: ["gmail-app"] });
    expect(app.message).toMatch(/\(not measured\)$/);
    expect(sizes(["gmail-app"])).toEqual([app]);
  });

  it("ignores the option for a root that isn't an Email, and says so", () => {
    expect(codes(validateTemplate(page([spaced])).diagnostics)).toEqual([]);
    expect(validateTemplate(page([spaced]), { emailClients: ["gmail"] }).diagnostics).toEqual([
      { code: "email/clients-ignored", severity: "info", message: "emailClients is for an Email; a Page isn't checked for email clients", path: "root" },
    ]);
  });

  it("throws on a client it doesn't know", () => {
    expect(() => validateTemplate(email([spaced]), { emailClients: ["hotmail" as never] })).toThrow(/emailClients takes a list of outlook, outlook-com, gmail, gmail-app, gmail-app-other, apple-mail, not "hotmail"/);
  });

  it("makes one diagnostic of two the same, with the clients of both", () => {
    const d = (clients: Diagnostic["clients"]): Diagnostic => ({ code: "email/x", severity: "info", message: "m", path: "root", clients });
    expect(forEmailClients([d(["gmail"]), d(["outlook"]), d(undefined)])).toEqual([d(["gmail", "outlook"]), d(undefined)]);
  });

  it("reports what's assumed, and clients not measured, as notes that say so", () => {
    const d = new Diagnostics();
    addForClients(d, "email/x", "warning", "Cut off", "root", undefined, { clients: ["outlook", "gmail-app"] });
    addForClients(d, "email/y", "warning", "Hidden", "root", undefined, { clients: ["gmail"], assumed: true });
    expect(d.list).toEqual([
      { code: "email/x", severity: "warning", message: "Cut off", path: "root", clients: ["outlook"] },
      { code: "email/x", severity: "info", message: "Cut off (not measured)", path: "root", clients: ["gmail-app"] },
      { code: "email/y", severity: "info", message: "Hidden (not measured)", path: "root", clients: ["gmail"] },
    ]);
  });

  it("prints a diagnostic's clients, fix and how to see it on its line", () => {
    const line = formatDiagnostics([{ code: "email/size", severity: "warning", message: "The email is 108 KB", path: "root", clients: ["gmail"], fix: "shorten it", see: "a preview" }]);
    expect(line).toBe("warning email/size at root: The email is 108 KB [gmail] Fix: shorten it See: a preview");
    expect(formatDiagnostics([{ code: "prop/unknown", severity: "error", message: "No such prop", path: "root" }])).toBe("error prop/unknown at root: No such prop");
  });
});

describe("an Html block's CSS that email clients remove", () => {
  it.each([
    ["!IMPORTANT in capitals", '<p style="color:red !IMPORTANT">x</p>', ["gmail"]],
    ["a negative margin", '<p style="margin-top:-12px">x</p>', ["gmail", "outlook-com"]],
    ["position", '<div style="position:absolute;top:0">x</div>', ["outlook-com"]],
    ["var()", '<p style="color:var(--brand)">x</p>', ["gmail", "outlook-com"]],
    ["a gradient", '<div style="background:linear-gradient(#fff,#000)">x</div>', ["outlook-com"]],
    ["oklch()", '<p style="color:oklch(70% 0.1 200)">x</p>', ["gmail", "outlook-com"]],
    ["rgb() with spaces", '<p style="color:rgb(8 121 161)">x</p>', ["gmail"]],
  ])("notes %s, for the clients that remove it", (_, markup, clients) => {
    const found = htmlChecks(markup);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: "info", path: "root.children[0].props.html", clients });
    expect(found[0].message).toMatch(/^This Html block's markup may have /);
    expect(found[0].fix).toBeTruthy();
  });

  it("notes nothing in markup they keep", () => {
    const kept = '<div style="background-position:center;margin:0 12px;color:rgb(8, 121, 161)"><p style="color:red !important;padding:4px">A gradient of words, in color (position: left)</p></div>';
    expect(htmlChecks(kept)).toEqual([]);
  });

  it("leaves its notes out with the clients", () => {
    expect(htmlChecks('<div style="position:absolute">x</div>', [])).toEqual([]);
  });
});
