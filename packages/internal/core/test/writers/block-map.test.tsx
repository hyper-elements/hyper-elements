/**
 * The marks behind render()'s `blockMap` (src/writers/shared/block-map.ts): where a node's mark goes in its markup, that
 * marking keeps the markup's pieces and their kinds (so neighbouring comments still merge as without marks), and reading
 * the marks back. render()'s own tests (packages/react/src/primitives/block-map.test.tsx) check the map over whole emails.
 */
import type { ResolvedNode } from "../../src/resolve";
import { BlockMarks, markBlock, readMarks, withBlockMarks } from "../../src/writers/shared/block-map";
import { Fragment, h, Merged, NotOutlook, Outlook, raw, type Html } from "../../src/writers/jsx";

const node = (path: string) => ({ path }) as ResolvedNode;

/** `write`'s markup, marked as the email writer marks it, read back: the text without marks and where each node's mark was. */
function marked(write: (mark: (html: Html, path: string) => Html) => Html): { text: string; at: Record<string, string> } {
  const marks = new BlockMarks(0);
  const written = String(withBlockMarks(marks, () => write((html, path) => markBlock(html, node(path)))));
  const read = readMarks(marks, written)!;
  // Each mark as the text around it: `<tag|`.
  return { text: read.text, at: Object.fromEntries(read.found.map(({ node, at }) => [node.path, `${read.text.slice(Math.max(0, at - 8), at)}|${read.text.slice(at, at + 4)}`])) };
}

describe("a block's mark", () => {
  it("goes just after the tag name of the first element, past comments and what only phones show", () => {
    const { text, at } = marked((mark) => (
      <>
        {mark(<NotOutlook><tr><td>a</td></tr></NotOutlook>, "a")}
        {mark(<>{raw("<!-- <p> -->")}<p class="x">b</p></>, "b")}
      </>
    ));
    expect(text).toBe('<!--[if !mso]><!--><tr><td>a</td></tr><!--<![endif]--><!-- <p> --><p class="x">b</p>');
    expect(at).toEqual({ a: "<!--><tr|><td", b: "p> --><p| cla" });
  });

  it("goes on the first element every client but classic Outlook reads, and in Outlook's markup only where there's none", () => {
    const { at } = marked((mark) => (
      <>
        {mark(<><Outlook><table><tr><td>{""}</td></tr></table></Outlook><div>c</div></>, "c")}
        {mark(<Outlook>{raw("<v:rect>d</v:rect>")}</Outlook>, "d")}
      </>
    ));
    expect(at).toEqual({ c: "]--><div|>c</", d: " mso]><v|:rec" });
  });

  it("keeps the markup's pieces and kinds: neighbouring comments of a kind still merge", () => {
    const write = (mark: (html: Html, path: string) => Html) => (
      <Merged>
        {mark(<NotOutlook><div>e</div></NotOutlook>, "e")}
        {mark(<NotOutlook><div>f</div></NotOutlook>, "f")}
      </Merged>
    );
    const { text, at } = marked(write);
    expect(text).toBe(String(write((html) => html)));
    expect(text).toBe("<!--[if !mso]><!--><div>e</div><div>f</div><!--<![endif]-->");
    expect(at).toEqual({ e: "!--><div|>e</", f: "div><div|>f</" });
  });

  it("puts an outer block's mark before an inner one's at the same element", () => {
    const { at, text } = marked((mark) => mark(mark(<table><tr><td>g</td></tr></table>, "inner"), "outer"));
    expect(text).toBe("<table><tr><td>g</td></tr></table>");
    const marks = new BlockMarks(0);
    const written = String(withBlockMarks(marks, () => markBlock(markBlock(<table />, node("inner")), node("outer"))));
    expect(readMarks(marks, written)!.found.map((f) => f.node.path)).toEqual(["outer", "inner"]);
    expect(at).toEqual({ inner: "<table|><tr", outer: "<table|><tr" });
  });

  it("marks nothing where nothing is collecting, or where the markup has no element", () => {
    const html = <p>h</p>;
    expect(markBlock(html, node("h"))).toBe(html);
    const marks = new BlockMarks(0);
    withBlockMarks(marks, () => markBlock(raw("just text"), node("i")));
    expect(marks.nodes).toEqual([]);
  });

  it("reads back nothing where the text holds the pair: a mark repeated, unknown, after no tag name, or left over", () => {
    const marks = new BlockMarks(0);
    const written = String(withBlockMarks(marks, () => markBlock(<p>j</p>, node("j"))));
    const [open, close] = [marks.open, marks.close];
    expect(readMarks(marks, written)).not.toBeNull();
    expect(readMarks(marks, written + `<b${open}0${close}>`)).toBeNull();
    expect(readMarks(marks, written + `<b${open}7${close}>`)).toBeNull();
    marks.nodes.push(node("k"));
    expect(readMarks(marks, written + `text ${open}1${close}`)).toBeNull();
    expect(readMarks(marks, written + open)).toBeNull();
  });
});
