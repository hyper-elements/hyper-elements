/**
 * The checks on a whole email's HTML (documentNotes(), and renderInEmailClients(html)'s diagnostics over them): each where its pattern is,
 * at its first line with an excerpt, once per check; a <style> by where it is; Gmail's limits as Gmail applies them;
 * comments (Outlook's conditional ones among them) and scripts blanked, so lines stay the given HTML's.
 */
import { blankUnread, documentNotes, withoutOutlookOnly } from "../src/html";
import { renderInEmailClients } from "../src/index";
import { NO_MEDIA_QUERIES, NO_WEB_FONTS, STYLE_REMOVED } from "../src/limits";

/** A whole email: `head` in the <head>, `body` in the <body>, each line of the arrays its own line. */
const email = ({ head = [], body = [] }: { head?: string[]; body?: string[] }) => ["<!DOCTYPE html>", "<html>", "<head>", ...head, "</head>", "<body>", ...body, "</body>", "</html>"].join("\n");
const notes = (html: string) => documentNotes(html).map(({ code, severity, line, excerpt, clients, message }) => ({ code, severity, line, excerpt, clients, message }));
const about = (html: string, words: string) => documentNotes(html).filter((d) => d.message.includes(words));

describe("documentNotes(): the checks on a whole email", () => {
  it("finds nothing in a plain table email", () => {
    expect(notes(email({ body: ['<table><tr><td style="font-family:Arial;color:#111111">Hi</td></tr></table>'] }))).toEqual([]);
  });

  it("notes CSS a client removes at its first line, with an excerpt of up to 80 characters, once per check", () => {
    const long = `<div style="position:absolute;top:0">${"x".repeat(120)}</div>`;
    const html = email({ body: ["<p>Intro</p>", long, '<div style="position:absolute">again</div>', '<div style="display:flex">row</div>'] });
    const found = notes(html);
    const position = found.filter((d) => d.message.includes("position: absolute"));
    expect(position).toHaveLength(1);
    expect(position[0]).toMatchObject({ code: "email/html-css", severity: "info", line: 7 });
    expect(position[0]!.excerpt).toBe(long.slice(0, 80));
    expect(found.find((d) => d.message.includes("display: flex"))).toMatchObject({ line: 9, clients: expect.arrayContaining(["outlook"]) });
    // In order of their lines.
    expect(found.map((d) => d.line)).toEqual([...found.map((d) => d.line)].sort((a, b) => a! - b!));
  });

  it("blanks what only classic Outlook reads, keeping every later line where it is", () => {
    const html = email({ body: ["<!--[if mso]>", '<table style="position:absolute"><tr><td>', "<![endif]-->", '<div style="display:flex;margin:-4px">x</div>'] });
    // What's blanked is spaces, newlines kept: the same length, the same lines.
    const blanked = blankUnread(html);
    expect(blanked.length).toBe(html.length);
    expect(blanked.split("\n").length).toBe(html.split("\n").length);
    expect(withoutOutlookOnly(html)).not.toContain("position:absolute");
    // Inside the conditional comment: not seen. After it: on its own line, 9.
    expect(about(html, "position: absolute")).toEqual([]);
    expect(about(html, "display: flex")[0]).toMatchObject({ line: 9 });
  });

  it("blanks every conditional comment for Outlook, whatever its condition, and keeps what's shown to all but Outlook", () => {
    const html = email({
      body: [
        "<!--[if (gte mso 9)|(IE)]>",
        '<v:rect style="position:absolute;width:600px"><v:fill type="tile" /></v:rect>',
        "<![endif]-->",
        "<!--[if mso | IE]><table style=\"opacity:0.5\"><tr><td><![endif]-->",
        "<!--[if !mso]><!-->",
        '<div style="display:flex">for all but Outlook</div>',
        "<!--<![endif]-->",
      ],
    });
    expect(about(html, "position: absolute")).toEqual([]);
    expect(about(html, "opacity")).toEqual([]);
    expect(about(html, "display: flex")).toEqual([expect.objectContaining({ line: 11 })]);
  });

  it("reads nothing inside an ordinary comment or a <script>, and still reads CSS a <style> wraps in <!-- -->", () => {
    const html = email({
      head: ["<!-- <body> -->", "<style><!--", ".a { color: red; }", "@media (max-width: 620px) { .a { color: blue; } }", "--></style>", "<script>var css = 'display:flex';</script>"],
      body: ['<!-- <style>.old { position: absolute; }</style> <img src="old.webp"> -->', '<p class="a">Hi</p>'],
    });
    // The <style> is still in the <head> (the <body> in a comment isn't one), and its @media is read.
    expect(about(html, "in its <body>")).toEqual([]);
    expect(about(html, "applies no media query")).toEqual([expect.objectContaining({ line: 5 })]);
    expect(about(html, "display: flex")).toEqual([]);
    expect(about(html, "position: absolute")).toEqual([]);
    expect(documentNotes(html).filter((d) => d.code === "email/image-format")).toEqual([]);
    // Only the one <style> outside comments: noted once.
    expect(about(html, "removes every <style>")).toEqual([expect.objectContaining({ line: 5 })]);
    const blanked = blankUnread(html);
    expect(blanked.length).toBe(html.length);
    expect(blanked).toContain("<style><!--");
  });

  it("notes a <style> anywhere for the clients that remove every <style>, and one in the <body> for those that remove that one", () => {
    const head = email({ head: ["<style>.a { color: red; }</style>"], body: ['<p class="a">Hi</p>'] });
    expect(about(head, "removes every <style>")).toEqual([expect.objectContaining({ line: 4, clients: [...STYLE_REMOVED] })]);
    expect(about(head, "in its <body>")).toEqual([]);
    const body = email({ body: ["<style>.a { color: red; }</style>", '<p class="a">Hi</p>'] });
    expect(about(body, "in its <body>")).toEqual([expect.objectContaining({ line: 6, clients: ["gmail", "gmail-app", "gmail-app-other", "protonmail", "gmx", "web-de", "sfr", "laposte", "rainloop"] })]);
    expect(STYLE_REMOVED).toContain("gmail-app-other");
    expect(STYLE_REMOVED).not.toContain("gmail");
    expect(STYLE_REMOVED).not.toContain("gmail-app");
  });

  it("names only gmail-app-other for a head <style>, among the Gmails and Apple Mail, and nothing for clients that keep it", async () => {
    const head = email({ head: ["<style>.a { color: red; }</style>"], body: ['<p class="a">Hi</p>'] });
    const { diagnostics } = await renderInEmailClients(head, { emailClients: ["gmail", "gmail-app", "gmail-app-other", "apple-mail"], computers: ["windows"] });
    expect(diagnostics.filter((d) => d.code === "email/html-css").map((d) => d.clients)).toEqual([["gmail-app-other"]]);
    const kept = await renderInEmailClients(head, { emailClients: ["gmail", "apple-mail"], computers: ["windows"] });
    expect(kept.diagnostics.filter((d) => d.code === "email/html-css")).toEqual([]);
    const body = email({ body: ["<style>.a { color: red; }</style>", '<p class="a">Hi</p>'] });
    const inBody = await renderInEmailClients(body, { emailClients: ["gmail", "apple-mail"], computers: ["windows"] });
    expect(inBody.diagnostics.filter((d) => d.code === "email/html-css")).toEqual([expect.objectContaining({ line: 6, clients: ["gmail"] })]);
  });

  it("notes an @media in a head <style> for the clients that apply none", () => {
    const html = email({ head: ["<style>", ".a { width: 600px; }", "@media (max-width: 620px) { .a { width: 100% !important; } }", "</style>"] });
    expect(about(html, "applies no media query")).toEqual([expect.objectContaining({ line: 4, clients: [...NO_MEDIA_QUERIES] })]);
  });

  it("notes a web font once, an @font-face or a stylesheet <link>, whichever is first", () => {
    const face = email({ head: ['<link rel="stylesheet" href="https://fonts.example/brand.css">', "<style>@font-face { font-family: Brand; src: url(https://fonts.example/b.woff2); }</style>"] });
    const found = documentNotes(face).filter((d) => d.message.includes("web font") || d.message.includes("@font-face"));
    expect(found).toEqual([expect.objectContaining({ line: 4, clients: [...NO_WEB_FONTS] })]);
    const onlyFace = email({ head: ["<style>@font-face { font-family: Brand; src: url(b.woff2); }</style>"] });
    expect(documentNotes(onlyFace).filter((d) => d.message.includes("@font-face"))).toHaveLength(1);
    // A font service's stylesheet is a web font; a stylesheet of the email's own isn't.
    const google = email({ head: ['<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">'] });
    expect(documentNotes(google).filter((d) => d.message.includes("web font"))).toEqual([expect.objectContaining({ line: 4 })]);
    const own = email({ head: ['<link rel="stylesheet" href="https://example.com/email.css">'] });
    expect(documentNotes(own).filter((d) => d.message.includes("web font"))).toEqual([]);
  });

  it("notes a stylesheet rule some clients remove at its <style>'s line", () => {
    const html = email({ head: ["<style>.a { color: red; }</style>", "<style>", ".promo:hover { color: blue; }", "@keyframes spin { to { transform: rotate(1turn); } }", "</style>"] });
    expect(about(html, "a hover")[0]).toMatchObject({ line: 5, clients: ["outlook-com", "outlook-mac"] });
    expect(about(html, "@keyframes")[0]).toMatchObject({ line: 5, clients: ["outlook-com"] });
  });

  it("checks each head <style> against Gmail's 16 KB on its own, in UTF-16 code units", () => {
    const style = (css: string) => `<style>${css}</style>`;
    const rules = (n: number) => `/*${"a".repeat(n - 4)}*/`;
    // Two of 10,000 each: neither is over, though together they are.
    expect(about(email({ head: [style(rules(10_000)), style(rules(10_000))] }), "KB")).toEqual([]);
    // One of 17,000: over.
    const over = documentNotes(email({ head: [style(rules(10_000)), style(rules(17_000))] })).filter((d) => d.code === "email/style-size");
    expect(over).toEqual([expect.objectContaining({ severity: "warning", line: 5, clients: ["gmail", "gmail-app"] })]);
    // 9,004 code units, over 16 KB in UTF-8 (each é is two bytes): under Gmail's limit, as Gmail counts.
    const accents = `/*${"é".repeat(9000)}*/`;
    expect(new TextEncoder().encode(accents).length).toBeGreaterThan(16_384);
    expect(documentNotes(email({ head: [style(accents)] })).filter((d) => d.code === "email/style-size")).toEqual([]);
  });

  it("warns where the whole email is over Gmail's clip, with no line", () => {
    const html = email({ body: [`<p>${"word ".repeat(21_000)}</p>`] });
    expect(documentNotes(html).filter((d) => d.code === "email/size")).toEqual([
      expect.objectContaining({ severity: "warning", path: "html", line: null, clients: ["gmail", "gmail-app", "gmail-app-other"] }),
    ]);
    expect(documentNotes(html).find((d) => d.code === "email/size")!.excerpt).toBeUndefined();
  });

  it("warns for each image in a format some clients don't show, at its line", () => {
    const html = email({ body: ['<img src="https://cdn.example/a.webp" alt="a">', '<img alt="b" src="https://cdn.example/b.png">', "<img src='https://cdn.example/c.avif?w=2'>", "<img src=https://cdn.example/d.webp alt=d>"] });
    const images = documentNotes(html).filter((d) => d.code === "email/image-format");
    expect(images.map(({ line, clients }) => ({ line, clients }))).toEqual([
      { line: 6, clients: ["outlook"] },
      { line: 8, clients: ["outlook", "fastmail", "gmx", "web-de", "orange", "sfr", "mail-ru", "ionos"] },
      { line: 9, clients: ["outlook"] },
    ]);
  });

  it("checks a fixture email as a whole document: its head <style>, @media, body <style> and opacity", () => {
    const html = email({
      head: ["<style>", ".col { display: inline-block; }", "@media (max-width: 620px) { .col { display: block !important; } }", "</style>"],
      body: ["<style>.note { color: #6b7280; }</style>", '<p style="opacity:0.9">Hi</p>'],
    });
    expect(notes(html).map(({ line, message }) => [line, message.replace(/^This email may have /, "").split(":")[0]])).toEqual([
      [4, "a <style>"],
      [4, "an @media in a <style>"],
      [10, "a <style> in its <body>"],
      [11, "opacity"],
    ]);
  });
});
