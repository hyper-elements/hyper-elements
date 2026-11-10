/**
 * emailClients(): the checks that left core in 0.4.0, through core's plugin hooks, with core 0.3.1's codes, messages,
 * clients and pages (these are 0.3.1's tests, ported). What changed, on purpose: `email/width` and `email/image-width`
 * name classic Outlook (they're left out where it isn't asked for), the option is the plugin's, and its errors say so.
 */
import { formatDiagnostics, renderTemplate, validateTemplate, type Diagnostic, type ElementsPlugin } from "@unlayer-internal/elements-core";
import { DEFAULT_EMAIL_CLIENTS, EMAIL_CLIENTS, forClients, type EmailClient } from "../src/email-clients";
import { emailClients } from "../src/plugin";

const email = (children: unknown[], props: Record<string, unknown> = {}) => ({ root: { type: "Email", props: { width: 600, ...props }, children } });
const page = (children: unknown[]) => ({ root: { type: "Page", props: { width: 600 }, children } });
const spaced = { type: "Text", style: { letterSpacing: 2 }, children: ["Spaced"] };
const sized = { type: "Row", children: [{ type: "Column", style: { flex: "none" }, children: [{ type: "Text", children: ["x"] }] }] };
const codes = (diagnostics: Diagnostic[]) => diagnostics.map((d) => d.code);
const ALL = Object.keys(EMAIL_CLIENTS) as EmailClient[];

/** One plugin per selection, compiled once. */
const plugins = new Map<string, Promise<ElementsPlugin>>();
const plugin = (clients?: readonly EmailClient[]) => {
  const key = JSON.stringify(clients ?? null);
  if (!plugins.has(key)) plugins.set(key, emailClients(clients === undefined ? {} : { clients }));
  return plugins.get(key)!;
};
const validate = async (template: unknown, clients?: readonly EmailClient[]) => validateTemplate(template, { plugins: [await plugin(clients)] }).diagnostics;
const render = async (template: unknown, clients?: readonly EmailClient[]) => renderTemplate(template, { plugins: [await plugin(clients)] }).diagnostics;
const html = (markup: string) => email([{ type: "Html", props: { html: markup } }]);
const htmlChecks = async (markup: string, clients?: EmailClient[]) => (await validate(html(markup), clients)).filter((d) => d.code === "email/html-css");

describe("email clients", () => {
  it("checks the clients most email is read in by default, four of them measured, the rest from caniemail's tables", () => {
    expect(DEFAULT_EMAIL_CLIENTS).toEqual(["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "apple-mail", "yahoo", "aol", "samsung-email"]);
    expect(ALL).toHaveLength(26);
    expect(EMAIL_CLIENTS.outlook.measured).toMatchObject({ elements: "0.3.0", wordsWithin4px: 0.85 });
    expect(EMAIL_CLIENTS.outlook.approximate).toBe(true);
    expect(ALL.filter((client) => EMAIL_CLIENTS[client].measured)).toEqual(["outlook", "outlook-com", "gmail", "apple-mail"]);
    expect(EMAIL_CLIENTS.yahoo).toEqual({ name: "Yahoo Mail", widths: {}, dark: false, approximate: true, measured: null });
  });

  it("is a plugin named email-clients, for the api core reads", async () => {
    const p = await plugin();
    expect(p).toMatchObject({ name: "email-clients", api: 1 });
    expect(Object.isFrozen(p)).toBe(true);
  });

  it("names the clients a problem is about: letter spacing, which classic Outlook doesn't draw (a captured check)", async () => {
    const [d] = await validate(email([spaced]));
    expect(d).toMatchObject({ code: "email/outlook-degraded", severity: "info", clients: ["outlook"] });
  });

  it("leaves out a problem about clients not asked for: classic Outlook's layout too, from 0.4", async () => {
    const template = email([spaced, sized]);
    expect(codes(await validate(template))).toEqual(["email/width", "email/outlook-degraded"]);
    expect((await validate(template)).find((d) => d.code === "email/width")!.clients).toEqual(["outlook"]);
    expect(codes(await validate(template, ["gmail"]))).toEqual([]);
    expect(codes(await validate(template, []))).toEqual([]);
    const unsized = email([{ type: "Image", props: { src: "https://example.test/a.png", alt: "A" } }]);
    expect((await validate(unsized)).map((d) => [d.code, d.clients])).toEqual([["email/image-width", ["outlook"]]]);
    expect(await validate(unsized, ["gmail"])).toEqual([]);
  });

  it("narrows a problem's clients to those asked for, its code and path the same", async () => {
    const template = email([{ type: "Text", style: { fontFamily: "Inter" }, children: ["Hi"] }], { fonts: [{ family: "Inter", src: "https://fonts.test/inter.woff2" }] });
    const all = (await validate(template)).find((d) => d.code === "email/font-fallback")!;
    const narrowed = (await validate(template, ["outlook", "apple-mail"])).find((d) => d.code === "email/font-fallback")!;
    expect(all.clients).toEqual(["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol"]);
    expect(all.fix).toBe('end it with a font the client has: "Inter, Arial, sans-serif"');
    expect(all.see).toBe("https://www.caniemail.com/features/css-at-font-face/");
    expect(narrowed).toEqual({ ...all, clients: ["outlook"] });
    // Apple Mail loads web fonts: asked for alone, nothing to say.
    expect((await validate(template, ["apple-mail"])).filter((d) => d.code === "email/font-fallback")).toEqual([]);
  });

  it("says Gmail's clipping once, for Gmail on the web and its apps, and its <style> limit, on the written email", async () => {
    const long = email(Array.from({ length: 400 }, (_, i) => ({ type: "Text", children: [`Paragraph ${i} `.repeat(30)] })));
    const sizes = async (clients?: EmailClient[]) => (await render(long, clients)).filter((d) => d.code === "email/size");
    const [clipped] = await sizes();
    expect(await sizes()).toHaveLength(1);
    expect(clipped).toMatchObject({ severity: "warning", path: "root", clients: ["gmail", "gmail-app", "gmail-app-other"] });
    expect(clipped!.message).toMatch(/^The email is \d+ KB; Gmail clips a message after 100 KB \("\[Message clipped\]"\)$/);
    expect(clipped!.fix).toContain("shorten the email");
    expect(await sizes(["gmail-app"])).toEqual([{ ...clipped, clients: ["gmail-app"] }]);
    expect(await sizes(["apple-mail"])).toEqual([]);
    // validate() writes nothing: no size to check.
    expect((await validate(long)).filter((d) => d.code === "email/size")).toEqual([]);
    const styled = email(Array.from({ length: 400 }, (_, i) => ({ type: "Button", props: { href: "https://example.test" }, mobile: { fontSize: 10 + (i % 30) }, hover: { color: `#${String(i).padStart(6, "0")}`, backgroundColor: `#${String(i + 1).padStart(6, "0")}` }, children: ["x"] })));
    const [style] = (await render(styled)).filter((d) => d.code === "email/style-size");
    expect(style).toMatchObject({ severity: "warning", clients: ["gmail", "gmail-app", "gmail-app-other"], fix: "use fewer phone and hover styles: each one adds a rule" });
    expect(style!.message).toMatch(/^The stylesheet is \d+ KB; Gmail reads 16 KB of a <style>$/);
  });

  it("checks nothing for a root that isn't an Email, and says so where clients were given", async () => {
    const long = page(Array.from({ length: 400 }, (_, i) => ({ type: "Text", children: [`Paragraph ${i} `.repeat(30)] })));
    expect(await render(long)).toEqual([]);
    expect(await validate(page([spaced]))).toEqual([]);
    expect(await validate(page([spaced]), ["gmail"])).toEqual([
      { code: "email/clients-ignored", severity: "info", message: "emailClients({ clients }) is for an Email; a Page isn't checked for email clients", path: "root" },
    ]);
  });

  it("rejects a client it doesn't know, before anything is checked", async () => {
    await expect(emailClients({ clients: ["hotmail" as never] })).rejects.toThrow(/emailClients\(\{ clients \}\) takes a list of outlook, outlook-com, outlook-mac, .*, rainloop, not "hotmail"/);
    await expect(emailClients({ clients: "gmail" as never })).rejects.toThrow(TypeError);
  });

  it("keeps the clients asked for, narrowed to them, and one about no client; merging equal ones is core's", () => {
    const d = (clients?: string[]) => ({ code: "email/x", severity: "info" as const, message: "m", path: "root", ...(clients ? { clients } : {}) });
    expect(forClients([d(["gmail", "yahoo"]), d(["outlook"]), d(["gmx"]), d()], ["gmail", "outlook"])).toEqual([d(["gmail"]), d(["outlook"]), d()]);
  });

  it("prints a diagnostic's clients, fix and how to see it on its line", () => {
    const line = formatDiagnostics([{ code: "email/size", severity: "warning", message: "The email is 108 KB", path: "root", clients: ["gmail"], fix: "shorten it", see: "a preview" }]);
    expect(line).toBe("warning email/size at root: The email is 108 KB [gmail] Fix: shorten it See: a preview");
  });

  it("returns the same for the same email, from one plugin shared by renders of several roots", async () => {
    const p = await plugin();
    const template = email([spaced, sized, { type: "Html", props: { html: '<div style="position:absolute">x</div>' } }]);
    const first = validateTemplate(template, { plugins: [p] }).diagnostics;
    expect(validateTemplate(page([spaced]), { plugins: [p] }).diagnostics).toEqual([]);
    const nested = (() => {
      let inner: Diagnostic[] = [];
      const outer = validateTemplate(template, { plugins: [p, { name: "nested", api: 1, check: () => ((inner = validateTemplate(template, { plugins: [p] }).diagnostics), []) }] }).diagnostics;
      return { outer, inner };
    })();
    expect(validateTemplate(template, { plugins: [p] }).diagnostics).toEqual(first);
    expect(nested.outer).toEqual(first);
    expect(nested.inner).toEqual(first);
  });
});

describe("an Html block's CSS that email clients remove", () => {
  const OUTLOOKS = ["outlook", "outlook-com", "outlook-mac", "outlook-app"];
  const GMAILS = ["gmail", "gmail-app", "gmail-app-other"];
  it.each([
    ["!IMPORTANT in capitals (captured)", '<p style="color:red !IMPORTANT">x</p>', ["gmail"], undefined],
    ["a negative margin (captured)", '<p style="margin-top:-12px">x</p>', ["outlook-com", "gmail"], undefined],
    ["position: absolute", '<div style="position:absolute;top:0">x</div>', [...OUTLOOKS, ...GMAILS, "yahoo", "aol"], "css-position"],
    ["position: relative", '<span style="position:relative;top:4px">x</span>', [...OUTLOOKS, ...GMAILS], "css-position"],
    ["var()", '<p style="color:var(--brand)">x</p>', [...OUTLOOKS, ...GMAILS, "yahoo", "aol"], "css-variables"],
    ["a gradient", '<div style="background:linear-gradient(#fff,#000)">x</div>', [...OUTLOOKS, "gmail-app", "gmail-app-other", "yahoo", "aol"], "css-linear-gradient"],
    ["oklch() (captured)", '<p style="color:oklch(70% 0.1 200)">x</p>', ["outlook-com", "gmail"], undefined],
    ["rgb() with spaces (captured)", '<p style="color:rgb(8 121 161)">x</p>', ["gmail"], undefined],
    ["a <style>", "<style>p{color:red}</style><p>x</p>", GMAILS, "html-style"],
    ["box-shadow", '<div style="box-shadow:0 1px 2px #000">x</div>', ["outlook", "gmail", "gmail-app", "yahoo", "aol"], "css-box-shadow"],
    ["text-shadow", '<p style="text-shadow:0 1px #000">x</p>', [...OUTLOOKS, ...GMAILS], "css-text-shadow"],
    ["display: flex", '<div style="display:flex">x</div>', ["outlook", "gmail-app-other"], "css-display-flex"],
    ["display: inline-flex", '<span style="display:inline-flex">x</span>', ["outlook", "gmail-app-other", "yahoo", "aol"], "css-display-flex"],
    ["display: grid", '<div style="display:grid">x</div>', ["outlook", "gmail-app-other"], "css-display-grid"],
    ["opacity", '<p style="opacity:0.5">x</p>', ["outlook", "aol"], "css-opacity"],
    ["object-fit", '<img style="object-fit:cover" src="https://example.com/a.png" alt="">', ["outlook", "gmail-app-other", "yahoo", "aol"], "css-object-fit"],
    ["aspect-ratio", '<div style="aspect-ratio:16/9">x</div>', [...OUTLOOKS, ...GMAILS, "yahoo", "aol", "samsung-email"], "css-aspect-ratio"],
  ])("notes %s, for the clients that remove it", async (_, markup, clients, feature) => {
    const found = await htmlChecks(markup);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: "info", path: "root.children[0].props.html" });
    expect([...found[0]!.clients!].sort()).toEqual([...clients].sort());
    expect(found[0]!.message).toMatch(/^This Html block's markup may have /);
    expect(found[0]!.fix).toBeTruthy();
    expect(found[0]!.see).toBe(feature && `https://www.caniemail.com/features/${feature}/`);
  });

  it("notes nothing in markup they keep", async () => {
    const kept = '<div style="background-position:center;margin:0 12px;color:rgb(8, 121, 161)"><p style="color:red !important;padding:4px;display:block">A gradient of words, in color (position: absolute), with a text-shadow</p></div>';
    expect(await htmlChecks(kept)).toEqual([]);
  });

  it("leaves its notes out with the clients", async () => {
    expect(await htmlChecks('<div style="position:absolute">x</div>', [])).toEqual([]);
  });

  it("reads neither a media query's aspect ratio nor what only classic Outlook reads", async () => {
    expect((await htmlChecks("<style>@media (min-aspect-ratio: 16/9) { p { color: red } }</style><p>x</p>")).map((d) => d.message)).toEqual([
      "This Html block's markup may have a <style> in the email's body: the client removes it, and what it styles shows without it",
    ]);
    expect(await htmlChecks('<!--[if mso]><style>p{color:red}</style><![endif]--><p>x</p>')).toEqual([]);
    expect(await htmlChecks('<!--[if gte mso 9]><div style="box-shadow:0 1px #000">x</div><![endif]-->')).toEqual([]);
    expect(await htmlChecks('<!--[if !mso]><!--><style>p{color:red}</style><!--<![endif]--><p>x</p>')).toHaveLength(1);
  });

  it("names clients not checked by default where they're asked for", async () => {
    expect((await htmlChecks('<div style="display:flex">x</div>', ALL))[0]!.clients).toEqual(["outlook", "gmail-app-other", "orange", "gmx", "web-de"]);
  });
});

describe("the rules inside an Html block's <style> that the clients keeping it remove", () => {
  const styled = async (css: string) => (await htmlChecks(`<style>${css}</style><p class="promo">x</p>`)).filter((d) => !d.message.includes("a <style> in the email's body"));
  it.each([
    ["@font-face", "@font-face { font-family: Brand; src: url(https://example.test/b.woff2) } p { font-family: Brand, Arial }", ["outlook", "outlook-com", "outlook-mac", "outlook-app", "yahoo", "aol"], "css-at-font-face"],
    ["@keyframes", "@keyframes pulse { from { color: #111 } to { color: #555 } }", ["outlook-com"], "css-at-keyframes"],
    ["@supports", "@supports (color: red) { .promo { color: red } }", ["outlook-com"], "css-at-supports"],
    ["@import", "@import url(https://example.test/s.css); p { color: red }", ["outlook-com"], "css-at-import"],
    ["a hover on a class", ".promo:hover { color: red }", ["outlook-com", "outlook-mac"], "css-pseudo-class-hover"],
    ["a state alone, in a media query", "@media (min-width: 600px) { :focus { outline: 0 } }", ["outlook-com", "outlook-mac"], "css-pseudo-class-hover"],
    [":not()", "p:not(.promo) { color: red }", ["outlook-com"], undefined],
    [":nth-child()", "tr:nth-child(2n) td { background: #eee }", ["outlook-com"], undefined],
    ["a class with an attribute", '.promo[data-x="1"] { color: red }', ["outlook-com"], undefined],
    ["an @media inside another", "@media screen { @media (max-width: 480px) { p { color: red } } }", ["outlook-com"], "css-at-media"],
  ])("notes %s, for the clients that keep the <style> and remove it", async (_, css, clients, feature) => {
    const found = await styled(css);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "email/html-css", severity: "info", path: "root.children[0].props.html" });
    expect([...found[0]!.clients!].sort()).toEqual([...clients].sort());
    expect(found[0]!.message).toMatch(/^This Html block's markup may have .* in a <style>/);
    expect(found[0]!.fix).toBeTruthy();
    expect(found[0]!.see).toBe(feature && `https://www.caniemail.com/features/${feature}/`);
  });

  it("notes nothing for rules they keep, or for words outside a <style>", async () => {
    expect(await styled("a:hover { color: red } .promo { color: #333 } td > p + p { margin: 0 } @media (max-width: 480px) { .promo { display: block } }")).toEqual([]);
    expect(await htmlChecks("<p>Use @supports and @import, or .promo:hover and :not(), and @font-face { }</p>")).toEqual([]);
    expect(await htmlChecks("<!--[if mso]><style>@font-face { font-family: Brand } .promo:hover { color: red }</style><![endif]--><p>x</p>")).toEqual([]);
  });

  it("notes each selector and at-rule Outlook.com drops", async () => {
    const { OUTLOOK_COM_STYLE } = await import("../src/html");
    for (const part of OUTLOOK_COM_STYLE.selectors) {
      const selector = `p${part}${part.endsWith("(") ? "1)" : ""}`;
      expect([selector, (await styled(`${selector} { color: red }`)).map((d) => d.clients)]).toEqual([selector, [["outlook-com"]]]);
    }
    for (const name of OUTLOOK_COM_STYLE.atRules) expect([name, (await styled(`@${name} x { }`)).length]).toEqual([name, 1]);
    expect(OUTLOOK_COM_STYLE.onTypeOnly.test(".promo:hover")).toBe(true);
  });

  it("reads selectors past comments, and not inside one (an unclosed one runs to the end)", async () => {
    expect((await styled("/* a { */ .promo:hover { color: red }")).map((d) => d.clients)).toEqual([["outlook-com", "outlook-mac"]]);
    expect(await styled("/* .promo:hover { color: red } */ a { color: red }")).toEqual([]);
    expect(await styled("a { color: red } /* .promo:hover { color: red }")).toEqual([]);
    expect((await styled(".a { color: red } p:not(.b) { color: red }")).map((d) => d.clients)).toEqual([["outlook-com"]]);
  });

  it("names the clients asked for only: Gmail removes the whole <style>, which its own note says", async () => {
    const found = await htmlChecks("<style>.promo:hover { color: red } @supports (display: grid) { p { color: red } }</style><p class='promo'>x</p>", ["gmail"]);
    expect(found.map((d) => d.message)).toEqual(["This Html block's markup may have a <style> in the email's body: the client removes it, and what it styles shows without it"]);
  });
});

describe("the Html block checks, on long markup", () => {
  /** Strings of `tokens`, the same each run (a fixed seed). */
  function* samples(tokens: string[], count: number) {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < count; i++) yield Array.from({ length: Math.floor(next() * 12) }, () => tokens[Math.floor(next() * tokens.length)]).join("");
  }

  it("find a nested @media as the regex it replaced did", async () => {
    const { nestedMedia } = await import("../src/html");
    for (const css of samples(["@media", "@MEDIA", "@", "media", "{", "}", " ", "x"], 20000)) {
      expect([css, nestedMedia(css)]).toEqual([css, /@media[^{]*\{[^}]*@media/i.test(css)]);
    }
  });

  it("read what only classic Outlook reads, and each <style>, as the regexes they replace did", async () => {
    const { styleTexts, withoutOutlookOnly } = await import("../src/html");
    const comments = [...samples(["<!--[if mso]>", "<!--[if gte mso 9]>", "<!--[IF !MSO]>", "<!--[if", " ", "mso", " gte ", "lte", "!", "]>", "]", ">", "<![endif]-->", "<![ENDIF]-->", "<!--", "x"], 30000)];
    for (const markup of comments) expect([markup, withoutOutlookOnly(markup)]).toEqual([markup, markup.replace(/<!--\[if\s+(?:(?:gte?|lte?)\s+)?mso[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, "")]);
    expect(comments.filter((markup) => withoutOutlookOnly(markup) !== markup).length).toBeGreaterThan(300);
    const styles = [...samples(["<style>", "<style media=x>", "<style", "<STYLE", "<styles>", " ", ">", "</style>", "</STYLE>", "</style", "x", "{", "<"], 30000)];
    for (const markup of styles) expect([markup, styleTexts(markup)]).toEqual([markup, [...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1])]);
    expect(styles.filter((markup) => styleTexts(markup).length).length).toBeGreaterThan(300);
  });

  it("take time in proportion to the markup, however long a value, a run of declarations, or of unclosed tags", async () => {
    const long = 400_000;
    const inputs = [
      `<style>.hero { background: url(data:image/png;base64,${"A".repeat(long)}) } .promo:hover { color: red }</style>`,
      `<style>${"/*".repeat(long / 2)}</style>`,
      "@media ".repeat(long / 7),
      `<style>@media x {${" @media".repeat(long / 7)}</style>`,
      "<style>".repeat(long / 7),
      "<!--[if mso]>".repeat(long / 13),
      `${"<!--[if x".repeat(long / 9)}]`,
      `${"<!--[if mso]>".repeat(long / 13)}<![endif]-->`,
      " --x".repeat(long / 4),
      `<p style="${"margin:".repeat(long / 7)}">x</p>`,
    ];
    const p = await plugin(ALL);
    const slow = inputs.flatMap((input) => {
      const start = performance.now();
      validateTemplate(html(input), { plugins: [p] });
      const ms = performance.now() - start;
      return ms < 500 ? [] : [[input.slice(0, 40), Math.round(ms)]];
    });
    expect(slow).toEqual([]);
  });
});

describe("other problems from caniemail's tables", () => {
  const image = (src: string) => email([{ type: "Image", props: { src: { src, width: 600, height: 300 }, alt: "Hero" } }]);
  const formats = async (src: string, clients?: EmailClient[]) => (await validate(image(src), clients)).filter((d) => d.code === "email/image-format");

  it("warns of an image format a client doesn't show, by its extension or data: type", async () => {
    expect(await formats("https://example.com/hero.webp?v=2")).toEqual([
      {
        code: "email/image-format",
        severity: "warning",
        message: "This Image is a WebP file, which these email clients don't show",
        path: "root.children[0].props.src",
        clients: ["outlook"],
        fix: "use a PNG, JPEG or GIF file",
        see: "https://www.caniemail.com/features/image-webp/",
      },
    ]);
    expect((await formats("https://example.com/hero.avif", ALL))[0]!.clients).toEqual(["outlook", "fastmail", "gmx", "web-de", "orange", "sfr", "mail-ru", "ionos"]);
    expect((await formats("data:image/svg+xml;base64,PHN2Zy8+", ALL))[0]!.clients).toEqual(["mail-ru"]);
    // Gmail shows an SVG, as a PNG: nothing by default.
    expect(await formats("https://example.com/logo.svg")).toEqual([]);
    expect(await formats("https://example.com/hero.png")).toEqual([]);
    expect(await formats("https://example.com/webp/hero.png")).toEqual([]);
    // The format an image CDN is asked for.
    expect(await formats("https://images.example.com/hero.jpg?w=600&fm=webp")).toHaveLength(1);
    expect((await formats("https://res.example.com/image/upload/f_avif,q_auto/hero.jpg", ALL))[0]!.message).toBe("This Image is an AVIF file, which these email clients don't show");
    // What the CDN is asked for wins over the file's extension, either way.
    expect((await formats("https://images.example.com/hero.webp?fm=avif", ALL))[0]!.clients).toEqual(["outlook", "fastmail", "gmx", "web-de", "orange", "sfr", "mail-ru", "ionos"]);
    expect(await formats("https://images.example.com/hero.avif?fm=png", ALL)).toEqual([]);
    expect(await formats("https://res.example.com/image/upload/f_jpg/hero.webp", ALL)).toEqual([]);
    expect(await formats("data:image/png;base64,iVBORw0KGgo=", ALL)).toEqual([]);
    const video = (await validate(email([{ type: "Video", props: { src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnail: "https://example.com/thumb.webp" } }]))).filter((d) => d.code === "email/image-format");
    expect(video.map((d) => [d.path, d.message])).toEqual([["root.children[0].props.thumbnail", "This Video's thumbnail is a WebP file, which these email clients don't show"]]);
  });

  it("notes once where phone styles don't apply, and warns where something hidden on desktop would show nowhere", async () => {
    const phone = async (children: unknown[]) => (await validate(email(children))).filter((d) => d.code === "email/phone-styles");
    const text = (extra: Record<string, unknown>) => ({ type: "Text", ...extra, children: ["Hi"] });
    expect(await phone([text({})])).toEqual([]);
    const styledTwice = await phone([text({ mobile: { fontSize: 18 } }), text({ mobile: { fontSize: 20 } })]);
    expect(styledTwice).toHaveLength(1);
    expect(styledTwice[0]).toMatchObject({ severity: "info", path: "root", clients: ["gmail-app-other"], see: "https://www.caniemail.com/features/css-at-media/" });
    expect(styledTwice[0]!.message).toBe("On phones, the email's phone styles don't apply: it keeps its desktop styles (Rows still stack)");
    expect((await phone([text({ hidden: { mobile: true } })]))[0]).toMatchObject({ severity: "info", message: "On phones, the email's phone styles don't apply: what's hidden on phones shows (Rows still stack)" });
    const [hidden] = await phone([text({ hidden: { desktop: true } })]);
    expect(hidden).toMatchObject({ severity: "warning", message: "On phones, the email's phone styles don't apply: what's hidden on desktop shows nowhere (Rows still stack)" });
    expect(hidden!.fix).toContain("show what a reader needs on desktop too");
    // A Menu's separators, hidden on phones by the Menu itself: nothing for the author to change.
    expect(await phone([{ type: "Menu", props: { items: [{ text: "A", href: "https://example.com/a" }, { text: "B", href: "https://example.com/b" }], separator: "|" } }])).toEqual([]);
  });

  it("says what caniemail's tables say of a style, with the page there, but not of a component's own default", async () => {
    const one = async (style: Record<string, unknown>, clients?: EmailClient[]) => validate(email([{ type: "Text", style, children: ["Hi"] }]), clients);
    expect(await one({ fontWeight: 300 })).toEqual([
      {
        code: "email/outlook-degraded",
        severity: "info",
        message: "fontWeight on this Text in classic Outlook: normal weight: Word draws only normal and bold (600 and over)",
        path: "root.children[0].style.fontWeight",
        clients: ["outlook"],
        see: "https://www.caniemail.com/features/css-font-weight/",
      },
    ]);
    expect(await one({ fontWeight: 600 })).toEqual([]);
    expect((await one({ textTransform: "lowercase" })).map((d) => [d.code, d.clients])).toEqual([["email/outlook-degraded", ["outlook"]]]);
    expect((await one({ textDecoration: "line-through" })).map((d) => [d.code, d.severity, d.clients, d.message])).toEqual([
      ["email/degraded", "info", ["gmail-app-other"], 'textDecoration: "line-through" on this Text in some email clients: no line: the client removes it'],
    ]);
    expect(await one({ textDecoration: "none" })).toEqual([]);
    // A Link underlines by default: not the author's to change.
    expect(await validate(email([{ type: "Text", children: [{ type: "Link", props: { href: "https://example.test" }, children: ["Go"] }] }]))).toEqual([]);
  });

  it("says what classic Outlook does with corners and overflow, and what other clients do with corners", async () => {
    const box = (style: Record<string, unknown>) => email([{ type: "Column", style: { width: 300, ...style }, children: [{ type: "Text", children: ["x"] }] }]);
    expect((await validate(box({ borderRadius: 8 }), ALL)).map((d) => [d.code, d.clients, d.message])).toEqual([
      ["email/outlook-degraded", ["outlook"], "borderRadius on this Column in classic Outlook: square corners"],
      ["email/degraded", ["gmx", "web-de", "orange"], "borderRadius on this Column in some email clients: square corners"],
    ]);
    // Core's own note on a Column's overflow (what its writer does) stays core's: here, only what names a client.
    expect((await validate(box({ overflow: "hidden", height: 100 }))).filter((d) => d.clients).map((d) => [d.code, d.message])).toEqual([["email/outlook-degraded", 'overflow: "hidden" on this Column in classic Outlook: content past the height: Word doesn\'t cut it off']]);
  });

  it("says what a block of hover styles does, for the clients that don't apply it", async () => {
    const button = email([{ type: "Button", props: { href: "https://example.test" }, style: { backgroundColor: "#0a7" }, hover: { backgroundColor: "#086" }, children: ["Go"] }]);
    const found = await validate(button, ALL);
    expect(found).toEqual([
      {
        code: "email/degraded",
        severity: "info",
        message: "hover on this Button in some email clients: no change (where it shows, keyboard focus gets it too)",
        path: "root.children[0].hover",
        clients: ["outlook", "outlook-com", "outlook-mac", "gmx", "web-de", "sfr", "laposte", "mail-ru"],
        see: "https://www.caniemail.com/features/css-pseudo-class-hover/",
      },
    ]);
  });

  it("says what a root's language and direction do, for the clients that remove them", async () => {
    const root = async (props: Record<string, unknown>, clients?: EmailClient[]) => validate(email([{ type: "Text", children: ["مرحبا"] }], props), clients);
    // Neither is about a client checked by default.
    expect(await root({ lang: "ar", dir: "rtl" })).toEqual([]);
    expect((await root({ lang: "ar", dir: "rtl" }, ALL)).map((d) => [d.path, d.clients])).toEqual([
      ["root.props.lang", ["hey", "gmx", "web-de", "orange", "ionos"]],
      ["root.props.dir", ["gmx", "web-de"]],
    ]);
    expect(await root({ dir: "ltr" }, ALL)).toEqual([]);
  });

  it("says where web fonts don't load", async () => {
    const found = await validate(email([{ type: "Text", style: { fontFamily: "Inter, Arial" }, children: ["Hi"] }], { fonts: [{ family: "Inter", src: "https://fonts.test/inter.woff2" }] }), ["gmail"]);
    expect(found.map((d) => [d.code, d.path, d.clients, d.message])).toEqual([["email/degraded", "root.props.fonts", ["gmail"], "fonts on this Email in some email clients: no web font loads: the next font in each stack shows"]]);
  });
});
