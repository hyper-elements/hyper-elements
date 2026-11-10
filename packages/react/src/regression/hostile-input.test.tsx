/**
 * Values that often come from users (a name, a link, an image's text, a language) can't add markup: each is given
 * markup that would add an element or an attribute, in every root, and the parsed output must have neither. A value
 * the components refuse (`render()` rejects with the template's problems) adds nothing either. Raw HTML is what the
 * Html block's markup is for, so it isn't tested; styles are typed values the components check.
 */
import { describe, expect, it } from "vitest";
import React from "react";
import {
  pageBackgroundStyle,
  pageBorderStyle,
  pageEffectsStyle,
  pageLayoutStyle,
  pagePlacementStyle,
  pagePositionStyle,
  pageSizeStyle,
  pageSpacingStyle,
  pageTextStyle,
} from "@unlayer-internal/elements-core";
import { Box, Button, Column, Document, ElementsError, Email, Heading, Html, Image, Layer, Link, List, ListItem, MergeTag, Menu, Page, Text, Row, Section, Social, Span, Table, TableCell, TableRow, Video, render } from "../primitives/index";

/** A Box's page styles, by group (Decision 5 of the themes and pages plan). */
const PAGE_GROUPS = { pageLayoutStyle, pagePlacementStyle, pageSizeStyle, pagePositionStyle, pageSpacingStyle, pageTextStyle, pageBackgroundStyle, pageBorderStyle, pageEffectsStyle };
import { toDesign } from "../builder/index";
import { textJsonHtml } from "../builder/text-json";

const PAYLOADS = [
  '"><x-pwn></x-pwn>', "'><x-pwn></x-pwn>", '" x-pwn="1', "' x-pwn='1", "</p></div></td></tr></table><x-pwn></x-pwn>",
  // A template tag's quote ends an attribute as well as any, with or without `=`.
  '{{ " }} x-pwn=1 y', '{{ x" x-pwn }}', '<%a%>" x-pwn="1',
  // An email service's tag holding markup: kept as it's written, it would be markup.
  "<%a><x-pwn></x-pwn>%>", "{{ <x-pwn></x-pwn> }}", "{% <x-pwn></x-pwn> %}", `{% assign x = '" x-pwn="1' %}`,
  // Outlook reads what's in its conditional comments as markup.
  "<!--[if mso]><x-pwn></x-pwn><![endif]-->", "--><x-pwn></x-pwn><!--",
  // An entity, and what looks like the marks the collecting render reads back (src/primitives/collect.tsx).
  "&#x22;><x-pwn></x-pwn>", '<elements-node data-n="x" data-i="0" data-e="o"></elements-node><x-pwn></x-pwn>',
];

/** Elements or attributes named x-pwn: what a payload adds if it gets out. */
function injected(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [];
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    if (el.tagName.toLowerCase() === "x-pwn") out.push("element");
    for (const attr of Array.from(el.attributes)) if (attr.name === "x-pwn") out.push(`attribute on <${el.tagName.toLowerCase()}>`);
  }
  // Outlook parses what's in its conditional comments as markup (`<!--[if mso]>`; what `<!--[if !mso]><!-->` holds
  // is markup to everyone else, which the parser above reads).
  for (const comment of html.match(/<!--\[if (?!!)[^\]]*\]>[\s\S]*?<!\[endif\]-->/g) ?? []) if (/x-pwn/.test(comment)) out.push("in an Outlook comment");
  return out;
}

const CASES: Record<string, (v: string) => React.ReactNode> = {
  "Text text": (v) => <Text>{v}</Text>,
  "Heading text": (v) => <Heading>{v}</Heading>,
  "Text and Span text": (v) => <Text>{v} <Span style={{ fontWeight: "bold" }}>{v}</Span></Text>,
  "Button text": (v) => <Button href="https://example.com">{v}</Button>,
  "Button link": (v) => <Button href={`https://example.com/${v}`}>Go</Button>,
  "Button title and label": (v) => <Button href="https://example.com" title={v} aria-label={v}>Go</Button>,
  "Button attribute": (v) => <Button href="https://example.com" attrs={{ "data-x": v }}>Go</Button>,
  "Link text, link, title and label": (v) => <Text><Link href={`https://example.com/${v}`} title={v} aria-label={v}>{v}</Link></Text>,
  "Image source, text and title": (v) => <Image src={`https://example.com/${v}.png`} alt={v} title={v} />,
  "Image in a Link": (v) => <Link href={`https://example.com/${v}`}><Image src="https://example.com/a.png" alt={v} /></Link>,
  "Menu items": (v) => <Menu items={[{ text: v, href: `https://example.com/${v}` }, { text: "B", href: "https://example.com" }]} separator="|" />,
  "Menu items, one under another": (v) => <Menu layout="vertical" items={[{ text: v, href: "https://example.com" }]} />,
  "Social icons": (v) => <Social icons={[{ name: `X${v}`, href: `https://example.com/${v}` }]} />,
  "Video title and thumbnail": (v) => <Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title={v} thumbnail={`https://example.com/${v}.png`} />,
  "List items": (v) => <List><ListItem>{v}</ListItem></List>,
  "Table cells": (v) => <Table><TableRow header><TableCell>{v}</TableCell></TableRow><TableRow><TableCell>{v}</TableCell></TableRow></Table>,
  "MergeTag name": (v) => <Text>Hi <MergeTag name={v} /></Text>,
  "an Html block's plain text": (v) => <Html html="<b>Kept</b>" text={v} />,
  "text in a Fragment, deep in a Section": (v) => <Section><Row><Column><Text><>{v}</>{[v, v]}</Text></Column></Row></Section>,
};
const ROOT_PROPS: Record<string, (v: string) => Record<string, unknown>> = {
  title: (v) => ({ title: v }),
  lang: (v) => ({ lang: v }),
  "font family": (v) => ({ fonts: [{ family: `Brand${v}`, src: "https://example.com/brand.woff2" }] }),
  "font URL": (v) => ({ fonts: [{ family: "Brand", src: `https://example.com/${v}.woff2` }] }),
};
const ROOTS = { Email, Page, Document } as const;

/** The template's HTML, or null where the components refuse a value (with the template's problems, never another error). */
async function htmlOf(template: React.ReactElement): Promise<string | null> {
  try {
    return (await render(template)).html;
  } catch (error) {
    expect(error).toBeInstanceOf(ElementsError);
    return null;
  }
}

describe.each(Object.entries(ROOTS))("%s", (_, Root) => {
  const R = Root as React.FC<Record<string, unknown> & { children?: React.ReactNode }>;

  it.each(Object.keys(CASES))("%s can't add markup", async (name) => {
    let rendered = 0;
    for (const payload of PAYLOADS) {
      const html = await htmlOf(<R>{CASES[name](payload)}</R>);
      if (html === null) continue;
      rendered++;
      expect(injected(html), payload).toEqual([]);
    }
    // Not a test of refusals: most of them render.
    expect(rendered).toBeGreaterThan(PAYLOADS.length / 2);
  });

  const extra = Root === Email ? { previewText: (v: string) => ({ previewText: v }) } : Root === Page ? { description: (v: string) => ({ description: v }) } : {};
  it.each(Object.entries({ ...ROOT_PROPS, ...extra }))("the root's %s can't add markup", async (_, props) => {
    for (const payload of PAYLOADS) {
      const html = await htmlOf(<R {...props(payload)}><Text>Hello</Text></R>);
      if (html !== null) expect(injected(html), payload).toEqual([]);
    }
  });
});

describe("a Page's CSS values (page styles, rich lengths, a Box's element)", () => {
  // Every page style, each payload as its whole value, in a url() and in a gradient: refused, or written where it adds
  // no element or attribute and can't leave its declaration.
  const keys = [...new Set(Object.values(PAGE_GROUPS).flatMap((group) => Object.keys(group)))];
  const values = (v: string) => [v, `url("https://example.com/${v}.png")`, `url(https://example.com/${v}.png)`, `linear-gradient(#000000, #ffffff ${v})`, `calc(100% - ${v})`, `1px solid ${v}`];

  // Payloads the kinds refuse aren't written: a harmless word is, so the cases below are known to render something.
  let rendered = 0;
  it.each(keys)("%s can't add markup", async (key) => {
    for (const payload of [...PAYLOADS, "safe"]) {
      for (const value of values(payload)) {
        const html = await htmlOf(<Page width={600}><Box style={{ [key]: key === "gridTemplateAreas" ? [value] : value } as never}><Text>Hi</Text></Box></Page>);
        if (html === null) continue;
        rendered++;
        expect(injected(html), `${key}: ${value}`).toEqual([]);
        // A value can't end its declaration: the Box's style attribute holds it whole.
        expect(html, `${key}: ${value}`).not.toMatch(/<div[^>]*style="[^"]*(?:<|>)/);
      }
    }
  });

  it("renders some of them: the cases above aren't all refused (backgrounds, masks, borders and lengths take these forms)", () => {
    expect(rendered).toBeGreaterThanOrEqual(5);
  });

  // An element's own text in an attribute (alt, title, a label, attrs) beside the page styles written into its style.
  it.each([
    ["an Image's alt and title", (v: string) => <Image src={{ src: "https://example.com/a.png", width: 10, height: 10 }} alt={v} title={v} style={{ objectFit: "cover", opacity: 0.5 }} />],
    ["a Button's title, label and attribute", (v: string) => <Button href="https://example.com" title={v} aria-label={v} attrs={{ "data-x": v }} style={{ boxShadow: "0 1px 2px #000000", opacity: 0.5 }}>Go</Button>],
    ["a Link's title and label", (v: string) => <Text><Link href="https://example.com" title={v} aria-label={v} style={{ order: 2 }}>a</Link></Text>],
  ])("%s can't take an element's page styles or add markup", async (_, element) => {
    for (const payload of [...PAYLOADS, "Set style=", 'a style="color:red"', "style= x"]) {
      const html = await htmlOf(<Page width={600}><Box>{element(payload)}</Box></Page>);
      if (html === null) continue;
      expect(injected(html), payload).toEqual([]);
      // Its page styles are in its own style attribute, and its text attributes are as given.
      const tag = /<(img|a)\b[^>]*>/.exec(html)![0];
      const style = / style="([^"]*)"/.exec(tag.replace(/ (alt|title|aria-label|data-x)="[^"]*"/g, ""))?.[1] ?? "";
      expect(style, payload).toMatch(/opacity:0.5|order:2/);
    }
  });

  it("a rich length or a padding can't add markup either", async () => {
    for (const payload of PAYLOADS) {
      for (const style of [{ width: `calc(1px + ${payload})` }, { padding: `1rem ${payload}` }, { fontSize: `clamp(1rem, ${payload}, 2rem)` }]) {
        const html = await htmlOf(<Page width={600}><Box style={style as never}><Text>Hi</Text></Box></Page>);
        if (html !== null) expect(injected(html), payload).toEqual([]);
      }
    }
  });
});

describe("the builder's design", () => {
  /** The values the builder takes as HTML: a text's, a heading's and a button's text, and an HTML block's markup. */
  const markupIn = (design: unknown): string[] => {
    const out: string[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") {
        const { type, values } = value as { type?: string; values?: Record<string, unknown> };
        if (values && (type === "heading" || type === "button") && typeof values.text === "string") out.push(values.text);
        if (values && type === "paragraph" && typeof values.textJson === "string") out.push(textJsonHtml(values.textJson).html);
        if (values && type === "html" && typeof values.html === "string") out.push(values.html);
        Object.values(value).forEach(visit);
      }
    };
    visit(design);
    return out;
  };

  // (An image's, a menu's, a social icon's and a video's values are data the builder writes as it writes its own.)
  it.each(Object.keys(CASES))("%s: holds the text as text where the builder reads HTML", (name) => {
    for (const payload of PAYLOADS) {
      let design: unknown;
      try {
        design = toDesign(<Email>{CASES[name](payload)}</Email>).design;
      } catch {
        continue;
      }
      for (const html of markupIn(design)) expect(injected(html), payload).toEqual([]);
    }
  });

  it("is checked where the builder reads HTML: texts, headings, buttons, and what's locked as markup", () => {
    const design = toDesign(<Email>{Object.values(CASES).map((make, index) => <React.Fragment key={index}>{make(PAYLOADS[0])}</React.Fragment>)}</Email>).design;
    expect(markupIn(design).filter((html) => html.includes("&lt;x-pwn&gt;")).length).toBeGreaterThanOrEqual(9);
  });
});

/**
 * A URL written into CSS (an Email Layer's image, the root's fonts) can't end its string: a line break or form feed
 * there (`\n`, `\r`, `\f` end a CSS string) followed by CSS would be read as CSS, a style on the cell or a rule of the
 * stylesheet, where `<`, `>` and quotes never get out of it as markup.
 */
describe("a URL written into CSS", () => {
  const BREAKS = ["\n", "\r", "\f", "\r\n"];
  /**
   * The page's CSS (its style attributes, as parsed, and its stylesheets) once each `url("…")` that's one whole string
   * (nothing inside that ends one) is taken out. The URL is in HTML attributes too (`background`, VML's `src`), where
   * a line break is nothing.
   */
  const outsideUrls = (html: string) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const css = [...Array.from(doc.querySelectorAll("[style]"), (el) => el.getAttribute("style") ?? ""), ...Array.from(doc.querySelectorAll("style"), (el) => el.textContent ?? "")].join("\n");
    return css.replace(/url\("(?:[^"\\\n\r\f]|\\[0-9a-f]{1,6} ?)*"\)/gi, "url()");
  };

  it.each(BREAKS.map((brk) => [JSON.stringify(brk), brk]))("can't add CSS after %s, in a Layer's image", async (_, brk) => {
    const src = `https://cdn.example.com/hero.png${brk});position:fixed;x-pwn:1;x:(`;
    const html = await htmlOf(
      <Email>
        <Layer>
          <Image src={{ src, width: 600, height: 300 }} alt="Hero" />
          <Text>Sale</Text>
        </Layer>
      </Email>
    );
    expect(html).not.toBeNull();
    expect(outsideUrls(html!)).not.toContain("x-pwn");
  });

  it.each(Object.entries(ROOTS).flatMap(([name, Root]) => BREAKS.map((brk) => [name, JSON.stringify(brk), Root, brk] as const)))("can't add a rule after %s %s, in a font's URL", async (_, __, Root, brk) => {
    const R = Root as React.FC<Record<string, unknown> & { children?: React.ReactNode }>;
    const html = await htmlOf(
      <R fonts={[{ family: "Brand", src: `https://fonts.example.com/brand.woff2${brk});}x-pwn{display:none}x{` }]}>
        <Text>Hello</Text>
      </R>
    );
    expect(html).not.toBeNull();
    expect(outsideUrls(html!)).not.toContain("x-pwn");
  });
});
