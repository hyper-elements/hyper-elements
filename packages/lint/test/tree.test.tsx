/** tree.ts: what a reader gets of each node at each width, as the writers write it. */
import { Button, Column, Email, Image, LineBreak, Link, MergeTag, Page, Section, Span, Text } from "@hyper-elements/react";
import { cases, layers } from "./cases";
import { read, run } from "./helpers";
import { hrefOf, imagesIn, insideText, nameOf, ownsText, readTree, wordsOf } from "../src/tree";

describe("text size at each width", () => {
  for (const c of cases) {
    it(c.name, () => {
      const tree = read(c.template);
      for (const [words, [desktop, mobile]] of Object.entries(c.runs)) {
        const info = run(tree, words);
        expect([info.visible.desktop ? info.size.desktop : null, info.visible.mobile ? info.size.mobile : null], words).toEqual([desktop, mobile]);
      }
    });
  }

  it("leaves out a node hidden at both widths, with everything in it", () => {
    const tree = read(
      <Email width={600} lang="en">
        <Column hidden={{ desktop: true, mobile: true }}>
          <Text>Never shown</Text>
        </Column>
        <Text>Shown</Text>
      </Email>
    );
    expect(tree.nodes.map((info) => info.node.type)).toEqual(["Email", "Text"]);
  });

  it("reads only an Email or a Page", () => {
    expect(readTree({ type: "Document" } as never)).toBeUndefined();
    expect(readTree({ type: "Canvas" } as never)).toBeUndefined();
  });
});

describe("what's behind the text", () => {
  const behind = (template: Parameters<typeof read>[0], words: string) => run(read(template), words).under;

  it("is the nearest opaque background, translucent ones composited over it, white with none", () => {
    expect(behind(<Email width={600}><Text>On white</Text></Email>, "On white").desktop).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    const under = behind(
      <Email width={600} style={{ backgroundColor: "#000000" }}>
        <Section style={{ backgroundColor: "rgba(255, 255, 255, 0.5)" }}>
          <Text style={{ backgroundColor: "transparent" }}>Over grey</Text>
        </Section>
      </Email>,
      "Over grey"
    );
    expect(under.desktop).toMatchObject({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
    expect(under.mobile).toEqual(under.desktop);
  });

  it("counts a Button's own background, and a Span's", () => {
    const tree = read(
      <Email width={600}>
        <Button href="https://example.test" style={{ backgroundColor: "#112233" }}>Go there</Button>
        <Text>
          Plain <Span style={{ backgroundColor: "yellow" }}>marked</Span>
        </Text>
      </Email>
    );
    expect(run(tree, "Go there").under.desktop).toEqual({ r: 0x11, g: 0x22, b: 0x33, a: 1 });
    expect(run(tree, "marked").under.desktop).toEqual({ r: 255, g: 255, b: 0, a: 1 });
  });

  it("is a Layer's image where the writer draws it: an Email's on desktop always, and on phones unless it's hidden there", () => {
    expect(behind(layers.emailHiddenOnDesktop, "Over the image")).toEqual({ desktop: "image", mobile: "image" });
    expect(behind(layers.emailHiddenOnPhones, "Over the image")).toEqual({ desktop: "image", mobile: { r: 255, g: 255, b: 255, a: 1 } });
  });

  it("is a Page Layer's image where the image is shown", () => {
    expect(behind(layers.pageHiddenOnPhones, "Over the image")).toEqual({ desktop: "image", mobile: { r: 255, g: 255, b: 255, a: 1 } });
    expect(behind(layers.pageHiddenOnDesktop, "Over the image")).toEqual({ desktop: { r: 255, g: 255, b: 255, a: 1 }, mobile: "image" });
  });

  it("is an opaque background over a Layer's image, below it", () => {
    const tree = read(
      <Email width={600}>
        <Image src={{ src: "https://example.test/a.jpg", width: 600, height: 300 }} alt="" />
        <Column style={{ backgroundColor: "#ffffff" }}>
          <Text>Not over it</Text>
        </Column>
      </Email>
    );
    expect(run(tree, "Not over it").under.desktop).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
});

describe("words and names", () => {
  const tree = read(
    <Email width={600}>
      <Text>
        Hello <MergeTag name="first_name" />,<LineBreak />
        <Span>see   <Link href={{ href: "https://example.test/x", target: "_blank" }}>the   plans</Link></Span>
      </Text>
      <Link href="https://example.test/y" title="Our home">
        <Image src={{ src: "https://example.test/a.png", width: 10, height: 10 }} alt="Tarn" />
        <Image src={{ src: "https://example.test/b.png", width: 10, height: 10 }} alt="" />
      </Link>
      <Link href="https://example.test/z" title="Only a title">
        <Image src={{ src: "https://example.test/a.png", width: 10, height: 10 }} alt="" />
      </Link>
      <Button href="https://example.test/w" aria-label="Pay the invoice">Pay</Button>
    </Email>
  );
  const nodes = tree.nodes.map((info) => info.node);
  const text = nodes.find((n) => n.type === "Text");
  const [inlineLink, imageLink, titled] = nodes.filter((n) => n.type === "Link");
  const button = nodes.find((n) => n.type === "Button");

  it("collapses a node's words, a MergeTag as its name and a LineBreak as a space", () => {
    expect(wordsOf(text!)).toBe("Hello first_name , see the plans");
    expect(wordsOf(text!, { mergeTags: false })).toBe("Hello , see the plans");
  });

  it("names a link by its aria-label, its words, its images' alt, then its title", () => {
    expect(nameOf(button!)).toBe("Pay the invoice");
    expect(nameOf(inlineLink!)).toBe("the plans");
    expect(nameOf(imageLink!)).toBe("Tarn");
    expect(imagesIn(imageLink!)).toHaveLength(2);
    expect(nameOf(titled!)).toBe("Only a title");
  });

  it("unwraps an href, and has none for a node without one", () => {
    expect(hrefOf(inlineLink!)).toBe("https://example.test/x");
    expect(hrefOf(imageLink!)).toBe("https://example.test/y");
    expect(hrefOf(text!)).toBeUndefined();
  });

  it("knows which nodes own text", () => {
    expect(ownsText(text!)).toBe(true);
    expect(ownsText(imageLink!)).toBe(false);
  });

  it("marks an Email's runs inside text, and a Page has none", () => {
    const inside = (t: typeof tree) => t.nodes.filter((info) => insideText(info.node, info.parent?.node ?? null, t.rootType));
    expect(inside(tree).map((info) => info.node.type)).toEqual(["MergeTag", "LineBreak", "Span", "Link"]);
    const page = read(
      <Page width={600}>
        <Text>
          A <Span>span</Span>
        </Text>
      </Page>
    );
    expect(inside(page)).toEqual([]);
  });
});
