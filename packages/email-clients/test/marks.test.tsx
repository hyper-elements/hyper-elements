/**
 * The runtime's path markers (src/runtime/marks.ts): each block's template path written into the email at its
 * block-map offset, so what a client draws can be traced back to the template.
 */
import React from "react";
import { Button, Column, Email, Heading, Html, Row, render, Text } from "@hyper-elements/react";
import { markPaths } from "../src/runtime/marks";

const email = (
  <Email width={600} title="Ünïcödé 📬">
    <Heading level={1}>Grüße 👋</Heading>
    <Row>
      <Column>
        <Text>你好</Text>
      </Column>
      <Column>
        <Button href="https://example.test/?a=1&b=2">Go</Button>
      </Column>
    </Row>
    <Html html={'<p data-x="1">raw</p>'} />
  </Email>
);

describe("markPaths()", () => {
  it("writes each block's path just after its element's tag name, the rest of the email unchanged", async () => {
    const { html, blocks } = await render(email, { blockMap: true });
    const marked = markPaths(html, blocks!.entries);
    const paths = [...marked.matchAll(/<[a-zA-Z][a-zA-Z0-9]* data-el-path="([^"]+)"/g)].map((m) => m[1]);
    expect(paths).toEqual([...new Set(blocks!.entries.map((e) => e.path))]);
    expect(marked.replace(/ data-el-path="[^"]*"/g, "")).toBe(html);
  });

  it("gives an element blocks share the innermost one's path, and leaves offsets past a limit unmarked", () => {
    const html = "<table><tr><td>a</td></tr></table><p>b</p>";
    const entries = [
      { path: "root.children[0]", offset: 6 },
      { path: "root.children[0].children[0]", offset: 6 },
      { path: "root.children[1]", offset: 36 },
    ];
    expect(markPaths(html, entries)).toBe('<table data-el-path="root.children[0].children[0]"><tr><td>a</td></tr></table><p data-el-path="root.children[1]">b</p>');
    expect(markPaths(html, entries, 30)).toBe('<table data-el-path="root.children[0].children[0]"><tr><td>a</td></tr></table><p>b</p>');
  });
});
