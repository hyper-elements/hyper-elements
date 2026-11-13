/** tokenize.ts: HTML read as browsers read what the rules need, never throwing, linear in its length. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { decode, namedReferences, readHtml, type HtmlElement, type HtmlText } from "../src/tokenize";

const require = createRequire(import.meta.url);

/** The tree as a short string: elements as name(children), text as "text". */
function shape(node: HtmlElement | HtmlText): string {
  if (node.type === "text") return JSON.stringify(node.text);
  const attrs = [...node.attrs].map(([k, v]) => `${k}=${JSON.stringify(v.value)}`).join(" ");
  return `${node.name}${attrs ? `[${attrs}]` : ""}(${node.children.map(shape).join(",")})`;
}
const read = (html: string) => readHtml(html).root.children.map(shape).join(",");

describe("tokens", () => {
  it("reads attributes quoted, unquoted and valueless, lower-cases names, and keeps a repeated one's first value", () => {
    expect(read(`<A HREF="x" Title='y' data-z=w hidden alt=>t</A>`)).toBe('a[href="x" title="y" data-z="w" hidden="" alt=""]("t")');
    expect(read(`<img alt="first" alt="second">`)).toBe('img[alt="first"]()');
    expect(read(`<a href = "spaced" >x</a>`)).toBe('a[href="spaced"]("x")');
  });

  it("reads a < that doesn't start a tag as text, and ignores a doctype, a processing instruction and comments", () => {
    expect(read("a < b <3 </ c")).toBe('"a < b <3 </ c"');
    expect(read("<!DOCTYPE html><?xml version='1.0'?><!-- note --><p>x</p>")).toBe('p("x")');
  });

  it("skips Outlook's conditional comments whole, and only the markers of a downlevel-revealed one", () => {
    expect(read(`<p>a</p><!--[if mso]><table><tr><td><a href="x">Outlook</a></td></tr></table><![endif]--><p>b</p>`)).toBe('p("a"),p("b")');
    expect(read(`<!--[if mso]><!-- inner --><p>o</p><![endif]--><p>b</p>`)).toBe('p("b")');
    expect(read(`<!--[if !mso]><!--><a href="y">Others</a><!--<![endif]-->`)).toBe('a[href="y"]("Others")');
    expect(read(`<!--[if !mso]><!-- --><p>shown</p><!--<![endif]-->`)).toBe('p("shown")');
    expect(read(`<![if !mso]><p>shown</p><![endif]>`)).toBe('p("shown")');
  });

  it("reads raw text to its end tag, and plaintext to the end", () => {
    expect(read(`<style>a < b { color: red }</style><p>x</p>`)).toBe('style("a < b { color: red }"),p("x")');
    expect(read(`<xmp><a href="#">not a link</a></xmp>`)).toBe('xmp("<a href=\\"#\\">not a link</a>")');
    expect(read(`<script>if (a</scripts) {}</script>`)).toBe('script("if (a</scripts) {}")');
    expect(read(`<title>A &amp; B</title><textarea>&lt;b&gt;</textarea>`)).toBe('title("A & B"),textarea("<b>")');
    expect(read(`<script>&amp;</script>`)).toBe('script("&amp;")');
    expect(read(`<style>never closed <p>x</p>`)).toBe('style("never closed <p>x</p>")');
    expect(read(`<plaintext><a></plaintext>`)).toBe('plaintext("<a></plaintext>")');
  });
});

describe("character references", () => {
  it("reads numeric ones with or without a ;, and named ones from the table", () => {
    expect(decode("&#65;&#x42&#X43;&#0000000068;").value).toBe("ABCD");
    expect(decode("&#0;&#x110000;&#xD800;&#99999999999;").value).toBe("\ufffd\ufffd\ufffd\ufffd");
    expect(decode("java&Tab;script&colon;alert&lpar;1&rpar;").value).toBe("java\tscript:alert(1)");
    expect(decode("&nbsp&amp &emsp;&zwj;").value).toBe("\u00a0& \u2003\u200d");
  });

  it("leaves an unknown named one as written, and says where it is", () => {
    expect(decode("a&copy;b&colon").value).toBe("a&copy;b&colon");
    expect(decode("a&copy;b&bogus;").unknown).toEqual([1, 8]);
    // The table's names need their ;, but the five legacy ones and nbsp.
    expect(decode("&colon").unknown).toEqual([0]);
  });

  it("has every WHATWG named reference whose code point is ASCII punctuation, a space or a format character, and the XML five", () => {
    const whatwg: Record<string, string> = JSON.parse(readFileSync(require.resolve("entities/lib/maps/entities.json"), "utf8"));
    const want = Object.entries(whatwg)
      .filter(([name, value]) => {
        if ([...value].length !== 1) return false;
        const c = value.codePointAt(0)!;
        const punctuation = c < 128 && /[!-/:-@[-`{-~]/.test(value);
        return punctuation || /[\t\n\f\r ]/.test(value) || /\p{Zs}|\p{Cf}/u.test(value) || ["amp", "lt", "gt", "quot", "apos"].includes(name);
      })
      .sort(([a], [b]) => (a < b ? -1 : 1));
    expect([...namedReferences()].sort(([a], [b]) => (a < b ? -1 : 1))).toEqual(want);
  });
});

describe("the tree", () => {
  it("never opens a void element, and ignores /> on another", () => {
    expect(read(`<p>a<br>b<img src=x>c</p>`)).toBe('p("a",br(),"b",img[src="x"](),"c")');
    expect(read(`<div/>inside</div>after`)).toBe('div("inside"),"after"');
  });

  it("closes an open <a> at another <a>", () => {
    expect(read(`<a href="1">one<a href="2">two</a>`)).toBe('a[href="1"]("one"),a[href="2"]("two")');
    expect(read(`<a href="1"><b>one<a href="2">two</a></b>`)).toBe('a[href="1"](b("one")),a[href="2"]("two")');
  });

  it("closes the nearest open element of an end tag's name and those above it, and ignores one with none", () => {
    expect(read(`<div><p><b>x</div>y`)).toBe('div(p(b("x"))),"y"');
    expect(read(`</span></p>x</div>`)).toBe('"x"');
    expect(read(`<p>unclosed<b>still`)).toBe('p("unclosed",b("still"))');
  });

  it("is a document with an <html> or a <body>, else a fragment", () => {
    expect(readHtml("<body><p>x</p></body>").document).toBe(true);
    expect(readHtml("<p>x</p>").document).toBe(false);
  });

  it("gives each element and text its line and column", () => {
    const { root } = readHtml("<div>\n  <a href=x>one</a>\n</div>");
    const a = (root.children[0] as HtmlElement).children[1] as HtmlElement;
    expect([a.name, a.line, a.column]).toEqual(["a", 2, 3]);
    expect((a.children[0] as HtmlText)).toMatchObject({ text: "one", line: 2, column: 13 });
  });

  it("keeps offsets right after characters whose lower case is longer", () => {
    const { root } = readHtml("<p>\u0130\u0130\u0130</p><a href=x>here</a>");
    expect((root.children[1] as HtmlElement).column).toBe(11);
  });
});

describe("hostile input", () => {
  const time = (html: string) => {
    const start = performance.now();
    const tree = readHtml(html);
    return { ms: performance.now() - start, tree };
  };

  it("never throws on malformed markup", () => {
    for (const html of ["<", "<a", "<a href", '<a href="', "<a href='x", "<!--", "<!--[if mso]>", "<![endif]-->", "</", "<a/", "&#", "&", "<p>&#x;", "<\u0000>", "<a\u0000b>"]) {
      expect(() => readHtml(html), JSON.stringify(html)).not.toThrow();
    }
  });

  it("reads a megabyte of deep nesting and unmatched end tags, an element with 100,000 attributes, and unclosed raw text, each in under a second", () => {
    const deep = `${"<div><span>".repeat(60_000)}x${"</em></strong></i>".repeat(20_000)}`;
    const attrs = `<a ${Array.from({ length: 100_000 }, (_, i) => `attr${i}=v`).join(" ")}>x</a>`;
    const raw = `<script>${"</scrip x ".repeat(110_000)}`;
    for (const html of [deep, attrs, raw]) {
      expect(html.length).toBeGreaterThan(900_000);
      const { ms } = time(html);
      expect(ms).toBeLessThan(1000);
    }
    expect(time(attrs).tree.root.children[0]).toMatchObject({ name: "a" });
  });

  it("stays linear: ten times the input, about ten times the time", () => {
    const html = (n: number) => `<div>${'<a href="https://example.test">here</a><p>text &amp; more</p>'.repeat(n)}</div>`;
    readHtml(html(2000));
    const t1 = time(html(5000)).ms;
    const t10 = time(html(50000)).ms;
    expect(t10).toBeLessThan(Math.max(t1, 2) * 30);
  });
});
