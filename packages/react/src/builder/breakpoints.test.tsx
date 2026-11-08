/** A Page's own phone width (breakpoints.mobile): the builder's design has no place for it, so it's reported; a block the builder keeps as markup still switches there. */
import { describe, expect, it } from "vitest";
import { Column, Layer, Image, Page, Text } from "../primitives";
import { toDesign } from "./index";

describe("a Page's phone width in the builder's design", () => {
  it("is reported as left out, and nothing is said where it isn't set", () => {
    const template = (breakpoints?: { mobile: number }) => (
      <Page width={900} breakpoints={breakpoints}>
        <Column>
          <Text>Words</Text>
        </Column>
      </Page>
    );
    expect(toDesign(template({ mobile: 600 })).report).toContainEqual(expect.stringContaining("props.breakpoints"));
    expect(toDesign(template()).report.filter((line) => line.includes("breakpoints"))).toEqual([]);
    expect(toDesign(<Page width={900} breakpoints={{}}><Column><Text>Words</Text></Column></Page>).report.filter((line) => line.includes("breakpoints"))).toEqual([]);
  });

  it("keeps it in a block drawn as markup, so the block's phone styles switch where the page's do", () => {
    const template = (
      <Page width={900} breakpoints={{ mobile: 600 }}>
        <Layer style={{ height: 200 }}>
          <Image src={{ src: "https://example.com/a.png", width: 900, height: 200 }} alt="" style={{ width: "100%" }} />
          <Column style={{ padding: 24, mobile: { padding: 8 } }}>
            <Text>Over</Text>
          </Column>
        </Layer>
      </Page>
    );
    const html = JSON.stringify(toDesign(template).design);
    expect(html).toContain("@media (max-width: 600px)");
    expect(html).not.toContain("@media (max-width: 480px)");
  });
});
