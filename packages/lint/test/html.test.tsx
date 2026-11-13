/** The HTML rules: lintHtml() on any HTML, and an Html block's markup in a template. */
import { Email, Html, Page, Text } from "@hyper-elements/react";
import { lintHtml } from "../src/html";
import { linted } from "./helpers";

const ids = (html: string, options?: Parameters<typeof lintHtml>[1]) => lintHtml(html, options).diagnostics.map((d) => d.code);
/** A whole email with nothing for lint to say, around `body`. */
const doc = (body: string, { lang = ' lang="en"', title = "<title>Shipped</title>" } = {}) => `<!DOCTYPE html><html${lang}><head>${title}</head><body>${body}</body></html>`;

describe("lintHtml()", () => {
  it("says nothing about a good email, and gives each finding its line, column, fix and docs", () => {
    expect(lintHtml(doc('<h1>Shipped</h1><p>See <a href="https://example.test/order">your order</a>.</p><img src="a.png" alt="">')).diagnostics).toEqual([]);
    const [d] = lintHtml('<p>\n  <img src="hero.png">\n</p>').diagnostics;
    expect(d).toEqual({
      code: "lint/image-alt",
      severity: "warning",
      message: 'This image has no alt attribute: a screen reader reads out its file name instead (src "hero.png")',
      line: 2,
      column: 3,
      fix: "give the image an alt that says where the link goes, or the link an aria-label",
      see: "https://www.hyperelements.dev/docs/lint#image-alt",
    });
  });

  it("image-alt: an <img> with no alt attribute, or a link with nothing to name it", () => {
    expect(ids('<a href="https://example.test"><img src="logo.png" alt=""></a>')).toEqual(["lint/image-alt"]);
    expect(ids('<a href="https://example.test"> &nbsp;&zwnj; </a>')).toEqual(["lint/image-alt"]);
    for (const ok of [
      '<a href="https://example.test"><img src="logo.png" alt="Tarn"></a>',
      '<a href="https://example.test" aria-label="Tarn"><img src="logo.png" alt=""></a>',
      '<a href="https://example.test" title="Tarn"><img src="logo.png" alt=""></a>',
      '<a href="https://example.test">&copy;</a>',
      '<a name="top"></a>',
    ]) {
      expect(ids(ok), ok).toEqual([]);
    }
  });

  it("link-text: words that don't say where the link goes, unless it has an aria-label", () => {
    expect(lintHtml('<a href="https://example.test">Click&nbsp;here</a>').diagnostics.map((d) => d.message)).toEqual(['The link says "Click here": a screen reader lists links by their words alone']);
    expect(ids('<a href="https://example.test" aria-label="Read more about pricing">Read more</a>')).toEqual([]);
    expect(ids('<a href="https://example.test">Read the pricing</a>')).toEqual([]);
  });

  it("link-target: a script's scheme however it's disguised, one it can't read, then the template's checks", () => {
    const target = (href: string) => lintHtml(`<a href="${href}">Your order</a>`).diagnostics.map((d) => d.message);
    expect(target("javascript:alert(1)")).toEqual(["This link runs a script (javascript:)"]);
    expect(target(" JaVa&Tab;script&colon;alert(1)")).toEqual(["This link runs a script (javascript:)"]);
    expect(target("java&#x0A;script:alert(1)")).toEqual(["This link runs a script (javascript:)"]);
    expect(target("vb{{x}}script:msgbox")).toEqual(["This link runs a script (vbscript:)"]);
    expect(target("java&bogus;script:alert(1)")).toEqual(['This link has a link whose scheme lint can\'t read: "java&bogus;script:alert(1)"']);
    expect(target("#")).toEqual(['This link goes nowhere ("#")']);
    expect(target("http://example.test")).toEqual(['This link links over http:, not https: "http://example.test"']);
    for (const ok of ["https://example.test/?a=1&amp;b=2", "{{unsubscribe_url}}", "mailto:help@example.test", "/order?x=&copy;"]) expect(target(ok), ok).toEqual([]);
  });

  it("role-button and heading-empty", () => {
    expect(ids('<a href="https://example.test" role="button">Pay your invoice</a>')).toEqual(["lint/role-button"]);
    expect(ids("<h2>&emsp;&zwj;</h2><h3><img src=a.png alt=Logo></h3>")).toEqual(["lint/heading-empty"]);
  });

  it("on a whole document only: heading order, one <h1>, lang and title", () => {
    const fragment = "<h1>A</h1><h3>B</h3><h1>C</h1>";
    expect(ids(fragment)).toEqual([]);
    expect(ids(doc(fragment))).toEqual(["lint/heading-order", "lint/heading-one"]);
    expect(ids(doc("<p>x</p>", { lang: "", title: "<title> </title>" }))).toEqual(["lint/lang", "lint/title"]);
    expect(ids('<html><body lang="fr"><title>t</title><p>x</p></body></html>')).toEqual([]);
  });

  it("skips Outlook's conditional comments, and reads the content every other client shows", () => {
    expect(ids('<!--[if mso]><a href="#">here</a><![endif]-->')).toEqual([]);
    expect(ids('<!--[if !mso]><!--><a href="#">Order</a><!--<![endif]-->')).toEqual(["lint/link-target"]);
  });

  it("takes lint()'s options, and throws a TypeError for one it doesn't know or for HTML that isn't a string", () => {
    expect(ids('<img src="a.png">', { rules: { "image-alt": "off" } })).toEqual([]);
    expect(lintHtml('<img src="a.png">', { rules: { "image-alt": "info" } }).diagnostics[0]!.severity).toBe("info");
    // A template rule's id is known (the same options serve both), and does nothing here.
    expect(ids('<img src="a.png">', { rules: { contrast: "off" } })).toEqual(["lint/image-alt"]);
    expect(() => lintHtml("<p>x</p>", { rules: { nope: "off" } })).toThrow(TypeError);
    expect(() => lintHtml(undefined as never)).toThrow(/takes HTML as a string/);
  });

  it("escapes what it quotes", () => {
    const [d] = lintHtml(`<img src="\u001b[31m\u202e${"x".repeat(200)}">`).diagnostics;
    expect(d!.message).not.toMatch(/[\u001b\u202e]/);
    expect(d!.message).toContain("\\u001b[31m\\u202e");
  });
});

describe("an Html block in a template", () => {
  it("is linted as a fragment: its findings at its html, with the line in its markup", () => {
    const found = linted(
      <Email width={600} lang="en" previewText="Your order has shipped and is on its way">
        <Text>Shipped</Text>
        <Html html={'<p>\n<img src="a.png">\n<a href="#" role="button">here</a></p><h1>Two</h1><h3>Skips</h3>'} />
      </Email>
    );
    expect(found.map((d) => [d.code, d.path, d.message])).toEqual([
      ["email/lint-image-alt", "root.children[1].props.html", 'In its HTML, line 2: This image has no alt attribute: a screen reader reads out its file name instead (src "a.png")'],
      ["email/lint-link-text", "root.children[1].props.html", 'In its HTML, line 3: The link says "here": a screen reader lists links by their words alone'],
      ["email/lint-link-target", "root.children[1].props.html", 'In its HTML, line 3: This link goes nowhere ("#")'],
      ["email/lint-role-button", "root.children[1].props.html", 'In its HTML, line 3: This link has role="button": a screen reader announces a button, and a link in an email is a link'],
    ]);
  });

  it("on a Page too, with each rule's severity or off", () => {
    const page = (
      <Page width={600} lang="en" title="t">
        <Html html='<img src="a.png"><a href="https://example.test" role="button">Pay your invoice</a>' />
      </Page>
    );
    expect(linted(page).map((d) => d.code)).toEqual(["page/lint-image-alt", "page/lint-role-button"]);
    expect(linted(page, { rules: { "role-button": "off", "image-alt": "info" } }).map((d) => [d.code, d.severity])).toEqual([["page/lint-image-alt", "info"]]);
  });

  it("not where it's hidden at both widths", () => {
    expect(linted(<Email width={600} lang="en" previewText="Your order has shipped and is on its way"><Html hidden={{ desktop: true, mobile: true }} html='<img src="a.png">' /></Email>)).toEqual([]);
  });
});
