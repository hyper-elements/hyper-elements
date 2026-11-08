/**
 * The stand-in fonts the previews draw with: every file each client names is in fonts/ (with its licence), one
 * preview's inlined fonts stay within the budget, and fonts: "url" points at this package's own files by its version.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { FACES, fontCss, fontSources, fontUrl, INLINE_BUDGET, OUTLOOK_COM_FILES, readPackageFont } from "../src/fonts";
import { PREVIEW_CLIENTS } from "../src/clients";
import { version } from "../package.json";

const fonts = resolve(__dirname, "../fonts");

describe("the stand-in fonts", () => {
  it("are each in fonts/, as WOFF2, beside their licences", () => {
    const files = new Set(PREVIEW_CLIENTS.flatMap((client) => FACES[client].map((face) => face.file)));
    expect([...files].sort()).toEqual(readdirSync(fonts).filter((f) => f.endsWith(".woff2")).sort());
    for (const licence of ["selawik-LICENSE.txt", "carlito-OFL.txt", "inter-LICENSE.txt"]) expect(existsSync(join(fonts, licence)), licence).toBe(true);
    expect(Object.values(OUTLOOK_COM_FILES).every((file) => files.has(file))).toBe(true);
  });

  it("inline within the budget for each client: 2,000,000 base64 bytes at most", () => {
    for (const client of PREVIEW_CLIENTS) {
      const base64 = [...new Set(FACES[client].map((face) => face.file))].reduce((sum, file) => sum + Math.ceil(statSync(join(fonts, file)).size / 3) * 4, 0);
      expect([client, base64 <= INLINE_BUDGET]).toEqual([client, true]);
    }
  });

  it("load from this package's own files by URL, or inline as data: URLs", async () => {
    expect(fontUrl("selawk.woff2")).toBe(`https://cdn.jsdelivr.net/npm/@hyper-elements/email-clients@${version}/fonts/selawk.woff2`);
    const url = await fontSources("outlook", "url");
    expect(fontCss("outlook", url)).toContain(`@font-face{font-family:"Segoe UI";src:url("${fontUrl("selawk.woff2")}") format("woff2");font-weight:400;font-style:normal}`);
    const inline = await fontSources("outlook-com", "inline");
    expect(Object.keys(inline).sort()).toEqual(Object.values(OUTLOOK_COM_FILES).sort());
    expect(inline["selawk.woff2"]).toBe(`data:font/woff2;base64,${await readPackageFont("selawk.woff2")}`);
    expect(await fontSources("gmail", "inline")).toEqual({});
  });

  it("says why inlining fails where the font files aren't beside the code (a bundled package)", async () => {
    const error = await readPackageFont("not-a-font.woff2").catch((e: Error) => e);
    expect(error).toMatchObject({ name: "email-clients/fonts-unreadable" });
    expect((error as Error).message).toMatch(/serverExternalPackages.*fonts: "url"/);
  });
});
