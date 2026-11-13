/** Each template rule fires on one template and not on a near miss, at each width where it applies. */
import type { ReactElement } from "react";
import { Button, Canvas, Column, Document, Email, Heading, Image, Link, MergeTag, Page, Section, Span, Text, Video, validate } from "@hyper-elements/react";
import { lint, rules, version } from "../src/index";
import { layers } from "./cases";
import { codes, linted, rendered } from "./helpers";

const IMG = { src: "https://example.test/a.png", width: 100, height: 50 };
/** An Email with nothing for lint to say, around `children`. */
const email = (children: ReactElement | ReactElement[], props: Record<string, unknown> = {}) => (
  <Email width={600} lang="en" previewText="Your order has shipped and is on its way to you" {...props}>
    {children}
  </Email>
);
const page = (children: ReactElement | ReactElement[], props: Record<string, unknown> = {}) => (
  <Page width={600} lang="en" title="Orders" {...props}>
    {children}
  </Page>
);
/** One rule's findings. */
const only = (id: string, template: ReactElement, options?: Parameters<typeof lint>[0]) => linted(template, options).filter((d) => d.code.endsWith(`/lint-${id}`));

describe("the plugin", () => {
  it("is named lint, for plugin api 1, and frozen", () => {
    const plugin = lint();
    expect(plugin).toMatchObject({ name: "lint", api: 1 });
    expect(Object.isFrozen(plugin)).toBe(true);
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("reports email/lint-<rule> on an Email and page/lint-<rule> on a Page, with the rule's fix and docs", () => {
    const [d] = linted(email(<Text>Hi</Text>, { lang: undefined }));
    expect(d).toEqual({
      code: "email/lint-lang",
      severity: "warning",
      message: "The Email has no lang, so screen readers guess its language",
      path: "root.props.lang",
      fix: 'give the root a lang ("en", "fr")',
      see: "https://www.hyperelements.dev/docs/lint#lang",
    });
    expect(codes(linted(page(<Text>Hi</Text>, { lang: undefined })))).toEqual(["page/lint-lang"]);
  });

  it("says nothing on a Document or a Canvas", () => {
    expect(linted(<Document><Text style={{ color: "#eeeeee" }}>Faint</Text></Document>)).toEqual([]);
    expect(linted(<Canvas width={400} height={200}><Text style={{ color: "#eeeeee" }}>Faint</Text></Canvas>)).toEqual([]);
  });

  it("says nothing on a template with nothing wrong, and core keeps every finding (no plugin/invalid)", () => {
    expect(linted(email(<Text>Your order has shipped.</Text>))).toEqual([]);
    expect(linted(page(<Text>Your order has shipped.</Text>))).toEqual([]);
    const all = validate(email(<Link href="#">here</Link>, { lang: undefined, previewText: undefined }), { plugins: [lint()] }).diagnostics;
    expect(all.some((d) => d.code.startsWith("plugin/"))).toBe(false);
  });

  it("reports the template's own paths and ids", () => {
    const [d] = only("link-target", email(<Link id="cta" href="#">Your order</Link>));
    expect(d).toMatchObject({ path: "root.children[0].props.href", nodeId: "cta" });
  });

  it("takes each rule's severity, or off, and kind", () => {
    const template = email(<Text>Hi</Text>, { lang: undefined, previewText: undefined });
    expect(linted(template, { rules: { lang: "info", "preview-text": "off" } }).map((d) => [d.code, d.severity])).toEqual([["email/lint-lang", "info"]]);
    expect(codes(linted(template, { kind: "transactional" }))).toEqual(["email/lint-lang", "email/lint-preview-text"]);
  });

  it("throws a TypeError for an option it doesn't know, when lint() is called", () => {
    expect(() => lint({ rules: { "no-such-rule": "warning" } })).toThrow(new TypeError('[lint] There\'s no rule "no-such-rule": see https://www.hyperelements.dev/docs/lint for the rules'));
    expect(() => lint({ rules: { contrast: "error" as never } })).toThrow(/The rule "contrast" takes "off", "info" or "warning", not "error"/);
    expect(() => lint({ kind: "newsletter" as never })).toThrow(/kind is "marketing" or "transactional", not "newsletter"/);
    expect(() => lint({ rules: [] as never })).toThrow(/rules takes an object/);
    expect(() => lint({ severity: "info" } as never)).toThrow(/has no option "severity"/);
    expect(() => lint("strict" as never)).toThrow(/takes an options object/);
    expect(() => lint({})).not.toThrow();
  });

  it("lists its rules, each with a default, its roots, a fix and a docs link", () => {
    expect(rules.map((r) => r.id)).toEqual([
      "image-alt", "alt-text", "link-text", "link-empty", "link-target", "heading-order", "heading-one", "heading-empty", "contrast",
      "text-size", "lang", "dir", "title", "preview-text", "merge-syntax", "unsubscribe", "video-title", "role-button",
    ]);
    for (const r of rules) {
      expect(r.see).toBe(`https://www.hyperelements.dev/docs/lint#${r.id}`);
      expect(r.fix).toBeTruthy();
      expect(Object.isFrozen(r)).toBe(true);
    }
    expect(rules.filter((r) => r.roots.length)).toHaveLength(17);
  });
});

describe("links and images", () => {
  it("image-alt: a link holding only images with no alt", () => {
    expect(only("image-alt", email(<Link href="https://example.test"><Image src={IMG} /></Link>))).toHaveLength(1);
    expect(only("image-alt", email(<Link href="https://example.test"><Image src={IMG} alt="Tarn's shop" /></Link>))).toEqual([]);
    expect(only("image-alt", email(<Link href="https://example.test" aria-label="Tarn's shop"><Image src={IMG} /></Link>))).toEqual([]);
    expect(only("image-alt", email(<Link href="https://example.test" title="Tarn's shop"><Image src={IMG} /></Link>))).toEqual([]);
    // An image on its own with an empty alt is decoration.
    expect(only("image-alt", email(<Image src={IMG} />))).toEqual([]);
  });

  it("link-empty: a link or button with nothing to name it (and not image-alt's)", () => {
    expect(codes(linted(email(<Text>See <Link href="https://example.test">{" "}</Link></Text>)))).toEqual(["email/lint-link-empty"]);
    expect(codes(linted(email(<Button href="https://example.test">{" "}</Button>)))).toEqual(["email/lint-link-empty"]);
    expect(codes(linted(email(<Link href="https://example.test"><Image src={IMG} /></Link>)))).toEqual(["email/lint-image-alt"]);
    expect(linted(email(<Button href="https://example.test" aria-label="Pay">{" "}</Button>))).toEqual([]);
  });

  it("alt-text: an alt that's a file name, a URL or a word that says nothing", () => {
    for (const alt of ["hero.png", "IMG_2041.JPG", "https://example.test/a.png", "logo", "Image"]) expect(only("alt-text", email(<Image src={IMG} alt={alt} />)), alt).toHaveLength(1);
    for (const alt of ["", "Tarn's logo", "A blue bowl, glazed"]) expect(only("alt-text", email(<Image src={IMG} alt={alt} />)), alt).toEqual([]);
    expect(only("alt-text", email(<Image src={IMG} alt="logo.svg" />))[0]).toMatchObject({ severity: "info", path: "root.children[0].props.alt", message: 'The image\'s alt, "logo.svg", says nothing about what it shows' });
  });

  it("link-text: words that don't say where the link goes, unless it has an aria-label", () => {
    expect(only("link-text", email(<Text>To confirm, <Link href="https://example.test">click here</Link>.</Text>))[0]).toMatchObject({
      message: 'The Link says "click here": a screen reader lists links by their words alone',
    });
    expect(only("link-text", email(<Button href="https://example.test">Read more →</Button>))).toHaveLength(1);
    expect(only("link-text", email(<Button href="https://example.test" aria-label="Read more about pricing">Read more</Button>))).toEqual([]);
    expect(only("link-text", email(<Button href="https://example.test">Read more about pricing</Button>))).toEqual([]);
  });

  it("link-target: empty, #, http:, a mailto: or tel: with nothing to reach", () => {
    const target = (href: string) => only("link-target", email(<Button href={href}>Your order</Button>)).map((d) => d.message);
    expect(target("#")).toEqual(['This button goes nowhere ("#")']);
    expect(target("http://example.test/order")).toEqual(['This button links over http:, not https: "http://example.test/order"']);
    expect(target("mailto:")).toEqual(["This button has a mailto: with no address"]);
    expect(target("tel:+")).toEqual(['This button has a tel: with no number: "tel:+"']);
    for (const ok of ["https://example.test", "mailto:help@example.test", "tel:+441234", "{{order_url}}", "/orders"]) expect(target(ok), ok).toEqual([]);
    expect(only("link-target", email(<Link href={{ href: "#", target: "_blank" }}>Your order</Link>))).toHaveLength(1);
  });
});

describe("headings", () => {
  it("heading-order: a heading more than one level below the one before, at the widths it's found at", () => {
    const skip = email([<Heading key="1" level={1}>Shipped</Heading>, <Heading key="2" level={3}>Your items</Heading>]);
    expect(only("heading-order", skip)[0]).toMatchObject({ path: "root.children[1].props.level", message: "This level-3 heading follows a level-1 one: a screen reader's list of headings skips a level" });
    expect(only("heading-order", email([<Heading key="1" level={1}>Shipped</Heading>, <Heading key="2" level={2}>Your items</Heading>, <Heading key="3" level={2}>Totals</Heading>]))).toEqual([]);
    // Going back up is fine; the first heading can be any level.
    expect(only("heading-order", email([<Heading key="1" level={3}>Small</Heading>, <Heading key="2" level={1}>Big</Heading>]))).toEqual([]);
    // On phones only, where a level-2 between them is hidden.
    const phones = email([
      <Heading key="1" level={1}>Shipped</Heading>,
      <Heading key="2" level={2} hidden={{ mobile: true }}>Desktop</Heading>,
      <Heading key="3" level={3}>Items</Heading>,
    ]);
    expect(only("heading-order", phones).map((d) => d.message)).toEqual(["This level-3 heading follows a level-1 one on phones: a screen reader's list of headings skips a level"]);
  });

  it("heading-one: a second level-1 heading", () => {
    expect(only("heading-one", email([<Heading key="1">One</Heading>, <Heading key="2">Two</Heading>])).map((d) => d.path)).toEqual(["root.children[1].props.level"]);
    // One for each width is fine.
    expect(only("heading-one", email([<Heading key="1" hidden={{ mobile: true }}>Wide</Heading>, <Heading key="2" hidden={{ desktop: true }}>Narrow</Heading>]))).toEqual([]);
  });

  it("heading-empty: a heading with no words", () => {
    expect(only("heading-empty", email(<Heading>{" "}</Heading>))).toHaveLength(1);
    expect(only("heading-empty", email(<Heading>Shipped</Heading>))).toEqual([]);
  });
});

describe("contrast", () => {
  it("fails body text under 4.5:1 and large text under 3:1", () => {
    expect(only("contrast", email(<Text style={{ color: "#777777" }}>Faint</Text>))[0]!.message).toBe("This text is 4.47:1 against its background (#777777 on #ffffff): body text needs 4.5:1");
    expect(only("contrast", email(<Text style={{ color: "#767676" }}>Just enough</Text>))).toEqual([]);
    expect(only("contrast", email(<Text style={{ color: "#949494", fontSize: 24 }}>Large</Text>))).toEqual([]);
    expect(only("contrast", email(<Text style={{ color: "#949494", fontSize: 19, fontWeight: 700 }}>Bold</Text>))).toEqual([]);
    expect(only("contrast", email(<Text style={{ color: "#949494", fontSize: 19 }}>Not bold</Text>))).toHaveLength(1);
  });

  it("at phone width, by the size shown there", () => {
    const shrinks = email(<Text style={{ color: "#949494", fontSize: 24, mobile: { fontSize: 16 } }}>Smaller on phones</Text>);
    expect(only("contrast", shrinks).map((d) => d.message)).toEqual(["This text is 3.03:1 against its background (#949494 on #ffffff) on phones: body text needs 4.5:1"]);
  });

  it("composites a translucent color and background", () => {
    expect(only("contrast", email(<Text style={{ color: "rgba(0, 0, 0, 0.4)" }}>Half</Text>))[0]!.message).toMatch(/\(#999999 on #ffffff\)/);
    expect(only("contrast", email(<Section style={{ backgroundColor: "#000000" }}><Text style={{ color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.9)" }}>Washed</Text></Section>))).toHaveLength(1);
  });

  it("reads a Span's own color over its Text's background, and doesn't repeat its Text's finding", () => {
    const template = email(
      <Text style={{ color: "#999999" }}>
        Faint <Span>still faint</Span> <Span style={{ color: "#cccccc" }}>fainter</Span> <Span style={{ color: "#000000" }}>dark</Span>
      </Text>
    );
    expect(only("contrast", template).map((d) => d.path)).toEqual(["root.children[0]", "root.children[0].children[3]"]);
    expect(only("contrast", email(<Text>Dark <Span style={{ color: "#dddddd" }}>light</Span></Text>)).map((d) => d.path)).toEqual(["root.children[0].children[1]"]);
  });

  it("skips text over a Layer's image where it's drawn, and checks it where it isn't", () => {
    expect(only("contrast", layers.emailHiddenOnDesktop)).toEqual([]);
    expect(only("contrast", layers.emailHiddenOnPhones).map((d) => d.message)).toEqual(["This text is 1:1 against its background (#ffffff on #ffffff) on phones: body text needs 4.5:1"]);
    expect(only("contrast", layers.pageHiddenOnDesktop).map((d) => d.message)).toEqual(["This text is 1:1 against its background (#ffffff on #ffffff) on desktop: body text needs 4.5:1"]);
  });

  it("counts a Button's own background", () => {
    expect(only("contrast", email(<Button href="https://example.test" style={{ backgroundColor: "#ffeeee", color: "#ffffff" }}>Pay</Button>))).toHaveLength(1);
    expect(only("contrast", email(<Button href="https://example.test">Pay</Button>))).toEqual([]);
  });
});

describe("text size", () => {
  it("text-size: body text under 14px, at the widths it's shown", () => {
    expect(only("text-size", email(<Text style={{ fontSize: 13 }}>Small</Text>))[0]).toMatchObject({ severity: "info", message: "This text is 13px, under 14px" });
    expect(only("text-size", email(<Text style={{ fontSize: 14 }}>Fine</Text>))).toEqual([]);
    expect(only("text-size", email(<Text style={{ fontSize: 16, mobile: { fontSize: 12 } }}>Small on phones</Text>)).map((d) => d.message)).toEqual(["This text is 12px on phones, under 14px"]);
    expect(only("text-size", email(<Text style={{ fontSize: 13, mobile: { fontSize: 12 } }}>Small</Text>)).map((d) => d.message)).toEqual(["This text is 13px on desktop and 12px on phones, under 14px"]);
  });

  it("only body text: not headings, buttons or a block link", () => {
    expect(linted(email([<Heading key="1" level={6} style={{ fontSize: 12 }}>Small</Heading>, <Button key="2" href="https://example.test" style={{ fontSize: 12 }}>Small</Button>, <Link key="3" href="https://example.test" style={{ fontSize: 12 }}>Small</Link>]))).toEqual([]);
    // A link inside body text is body text.
    expect(only("text-size", email(<Text>Body <Link href="https://example.test" style={{ fontSize: 11 }}>small link</Link></Text>)).map((d) => d.path)).toEqual(["root.children[0].children[1]"]);
  });

  it("not where it's hidden: a block hidden on desktop with a phone size", () => {
    const hidden = email(
      <Column hidden={{ desktop: true }}>
        <Text style={{ fontSize: 12, mobile: { fontSize: 15 } }}>Phones only</Text>
      </Column>
    );
    expect(only("text-size", hidden)).toEqual([]);
  });

  it("a raised Span at its parent's size divided by 1.2, as the HTML writes it (no size of its own)", async () => {
    const template = email(<Text style={{ fontSize: 16 }}>Base <Span style={{ verticalAlign: "super" }}>note</Span></Text>);
    const { html, diagnostics } = await rendered(template);
    expect(diagnostics.map((d) => d.message)).toEqual(["This text is 13.33px, under 14px"]);
    expect(html).toMatch(/<sup style="[^"]*line-height:0[^"]*">note<\/sup>/);
    expect(html).not.toMatch(/<sup style="[^"]*font-size/);
  });

  it("a Span repeating its Text's desktop size takes the Text's phone size, as the HTML writes it (no size of its own)", async () => {
    const template = email(<Text style={{ fontSize: 16, mobile: { fontSize: 12 } }}>Around <Span style={{ fontSize: 16, color: "#333333" }}>the span</Span></Text>);
    const { html, diagnostics } = await rendered(template);
    expect(diagnostics.map((d) => [d.path, d.message])).toEqual([["root.children[0]", "This text is 12px on phones, under 14px"]]);
    expect(html).toMatch(/<span style="color:#333(333)?">the span<\/span>/);
  });

  it("a Page root's phone size isn't written; a Section's is", async () => {
    const root = page(<Text>Root</Text>, { style: { fontSize: 16, mobile: { fontSize: 12 } } });
    expect(only("text-size", root)).toEqual([]);
    const section = page(<Section style={{ mobile: { fontSize: 12 } }}><Text>Section</Text></Section>);
    const { html, diagnostics } = await rendered(section);
    expect(diagnostics.map((d) => d.message)).toEqual(["This text is 12px on phones, under 14px"]);
    expect(html).toMatch(/font-size:12px!important/);
  });
});

describe("the root", () => {
  it("lang, and dir for a right-to-left language", () => {
    expect(only("lang", email(<Text>Hi</Text>, { lang: "" }))).toHaveLength(1);
    expect(only("dir", email(<Text>مرحبا</Text>, { lang: "ar-EG" }))[0]).toMatchObject({ path: "root.props.dir", message: 'Its language, "ar-EG", is written right to left, but the Email has no dir' });
    expect(only("dir", email(<Text>مرحبا</Text>, { lang: "ar", dir: "rtl" }))).toEqual([]);
    expect(only("dir", email(<Text>Hi</Text>, { lang: "en" }))).toEqual([]);
  });

  it("title, on a Page only", () => {
    expect(only("title", page(<Text>Hi</Text>, { title: undefined }))).toHaveLength(1);
    expect(only("title", email(<Text>Hi</Text>))).toEqual([]);
  });

  it("preview-text: none, or under 30 characters, on an Email only", () => {
    expect(only("preview-text", email(<Text>Hi</Text>, { previewText: undefined })).map((d) => d.message)).toEqual(["The Email has no previewText, so inboxes show its first words after the subject"]);
    expect(only("preview-text", email(<Text>Hi</Text>, { previewText: "Shipped" })).map((d) => d.message)).toEqual(['The Email\'s previewText is 7 characters ("Shipped"): inboxes fill the rest with its first words']);
    expect(only("preview-text", page(<Text>Hi</Text>))).toEqual([]);
  });

  it("unsubscribe: only on a marketing email", () => {
    const none = email(<Text>Our autumn range</Text>);
    expect(only("unsubscribe", none)).toEqual([]);
    expect(only("unsubscribe", none, { kind: "marketing" })[0]).toMatchObject({ path: "root" });
    for (const has of [
      <Link key="1" href="https://example.test/u">Unsubscribe</Link>,
      <Link key="2" href="https://example.test/unsubscribe?u=1">Stop these</Link>,
      <Text key="3"><Link href="https://example.test/p">Manage preferences</Link></Text>,
      <Text key="4"><MergeTag name="unsubscribe_link" /></Text>,
      <Button key="5" href="https://example.test/o">Opt out</Button>,
    ]) {
      expect(only("unsubscribe", email(has), { kind: "marketing" })).toEqual([]);
    }
    expect(only("unsubscribe", page(<Text>Hi</Text>), { kind: "marketing" })).toEqual([]);
  });
});

describe("merge syntax and videos", () => {
  it("merge-syntax: service syntax typed into text, once on the block that holds it", () => {
    for (const typed of ["Hi {{first_name}}", "Hi *|FNAME|*", "Hi %%FirstName%%", "Hi <%= name %>", "Hi ${name}"]) {
      expect(only("merge-syntax", email(<Text>{typed}</Text>)), typed).toHaveLength(1);
    }
    expect(only("merge-syntax", email(<Text>Hi <Span>{"{{first_name}}"}</Span></Text>)).map((d) => d.path)).toEqual(["root.children[0]"]);
    expect(only("merge-syntax", email(<Text>Hi <MergeTag name="first_name" /></Text>))).toEqual([]);
    expect(only("merge-syntax", email(<Text>100% off, 50% today</Text>))).toEqual([]);
    // Props take text only: service syntax is how a placeholder goes there.
    expect(only("merge-syntax", email(<Image src={IMG} alt="{{brand}} logo" />, { previewText: "Hello {{first_name}}, your order has shipped" }))).toEqual([]);
  });

  it("video-title: a Video with the default title", () => {
    expect(only("video-title", email(<Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />))).toHaveLength(1);
    expect(only("video-title", email(<Video src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="How we glaze a bowl" />))).toEqual([]);
  });
});

describe("hostile input", () => {
  it("adds nothing to a message but escaped text, cut to 80 characters", () => {
    const evil = 'x"\u001b[31m\u202e</p><script>alert(1)</script>\n' + "y".repeat(200);
    const found = linted(
      email(
        [
          <Image key="1" src={IMG} alt={`${evil}.png`} />,
          <Button key="2" href={`http://${evil}`}>{`${evil}`}</Button>,
          <Text key="3">{`{{${evil}}}`}</Text>,
        ],
        { lang: "ar-\u202e", previewText: "short\u2028" }
      )
    );
    expect(found.length).toBeGreaterThan(3);
    for (const d of found) {
      expect(d.message).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/);
      for (const quoted of d.message.match(/"(?:[^"\\]|\\.)*"/g) ?? []) expect([...JSON.parse(quoted)].length).toBeLessThanOrEqual(80);
    }
    expect(found.find((d) => d.code === "email/lint-dir")!.message).toContain('"ar-\\u202e"');
  });
});
