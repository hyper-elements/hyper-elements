/**
 * The stand-in fonts the previews draw with: every file the models name for a client is in fonts/ (with its licence),
 * one preview's inlined fonts stay within the budget, and fonts: "url" points at this package's own files by its version.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fontFiles } from "@hyper-elements/email-client-models";
import { fontSources, fontUrl, INLINE_BUDGET, namedFamilies, readPackageFont } from "../src/fonts";
import { PREVIEW_CLIENTS } from "../src/clients";
import { withoutFaces } from "../src/runtime/frames";
import { version } from "../package.json";

const fonts = resolve(__dirname, "../fonts");

describe("the stand-in fonts", () => {
  it("are each in fonts/, as WOFF2, beside their licences", () => {
    const files = new Set(PREVIEW_CLIENTS.flatMap((client) => fontFiles(client)));
    expect([...files].sort()).toEqual(readdirSync(fonts).filter((f) => f.endsWith(".woff2")).sort());
    for (const licence of ["selawik-LICENSE.txt", "carlito-OFL.txt", "inter-LICENSE.txt"]) expect(existsSync(join(fonts, licence)), licence).toBe(true);
  });

  it("inline within the budget for each client: 2,000,000 base64 bytes at most", () => {
    for (const client of PREVIEW_CLIENTS) {
      const base64 = fontFiles(client).reduce((sum, file) => sum + Math.ceil(statSync(join(fonts, file)).size / 3) * 4, 0);
      expect([client, base64 <= INLINE_BUDGET]).toEqual([client, true]);
    }
  });

  it("load from this package's own files by URL, or inline as data: URLs", async () => {
    expect(fontUrl("selawk.woff2")).toBe(`https://cdn.jsdelivr.net/npm/@hyper-elements/email-clients@${version}/fonts/selawk.woff2`);
    const url = await fontSources("outlook", "url");
    expect(url["selawk.woff2"]).toBe(fontUrl("selawk.woff2"));
    expect(Object.keys(url).sort()).toEqual([...fontFiles("outlook")].sort());
    const inline = await fontSources("outlook-com", "inline");
    expect(Object.keys(inline).sort()).toEqual([...fontFiles("outlook-com")].sort());
    expect(inline["selawk.woff2"]).toBe(`data:font/woff2;base64,${await readPackageFont("selawk.woff2")}`);
    expect(await fontSources("gmail", "inline")).toEqual({});
  });

  it("finds Inter where a font-family names it: inline (escaped quotes too), in a <style>, in an Html block; not Inter Display", () => {
    expect([...namedFamilies('<td style="font-family:Inter, Arial, sans-serif">')]).toEqual(["Inter"]);
    expect([...namedFamilies('<p style="font-family:&quot;Inter&quot;, Arial">')]).toEqual(["Inter"]);
    expect([...namedFamilies("<p style=\"font-family:'inter',Arial\">")]).toEqual(["Inter"]);
    expect([...namedFamilies('<style>.a{font-family: "Inter", Arial;}</style>')]).toEqual(["Inter"]);
    expect([...namedFamilies('<p style="font-family:&quot;Inter Display&quot;, Arial">Inter</p>')]).toEqual([]);
    expect([...namedFamilies('<p style="font-family:Arial">Inter</p>')]).toEqual([]);
  });

  it("leaves a family's @font-face rules out of the preview's font CSS, and nothing else", () => {
    const css = '@font-face{font-family:"Segoe UI";src:url(a)}@font-face{font-family:"Inter";src:url("undefined");font-style:italic}@font-face{font-family:Inter;src:url(b)}*{x:1}';
    expect(withoutFaces(css, ["Inter"])).toBe('@font-face{font-family:"Segoe UI";src:url(a)}*{x:1}');
    expect(withoutFaces(css, [])).toBe(css);
  });

  it("leaves out the files it's told to skip", async () => {
    const skip = new Set(["InterVariable.woff2", "InterVariable-Italic.woff2"]);
    expect(Object.keys(await fontSources("outlook", "url", undefined, skip)).sort()).toEqual(fontFiles("outlook").filter((f) => !skip.has(f)).sort());
  });

  it("says why inlining fails where the font files aren't beside the code (a bundled package)", async () => {
    const error = await readPackageFont("not-a-font.woff2").catch((e: Error) => e);
    expect(error).toMatchObject({ name: "email-clients/fonts-unreadable" });
    expect((error as Error).message).toMatch(/serverExternalPackages.*fonts: "url"/);
  });
});
