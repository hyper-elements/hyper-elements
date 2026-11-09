/**
 * A PDF's text (what's copied, searched and read aloud) after other PDFs in the same process. react-pdf keeps one font
 * for the process, so what one PDF does to it reaches every later one. Its own file: the PDFs before must be the
 * first this process draws with the font.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Document, Text } from "@hyper-elements/react";
import { renderPdf } from "../../src/pdf";

/** Liberation Sans (SIL OFL), as pdf.js ships it: its accented letters are drawn from their base letter and an accent. */
const liberation = (name: string) => readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", name));
const fonts = [
  { family: "Liberation Sans", src: liberation("LiberationSans-Regular.ttf") },
  { family: "Liberation Sans", src: liberation("LiberationSans-Bold.ttf"), weight: 700 },
];

async function text(words: string, weight: 400 | 700 = 400): Promise<string> {
  const { pdf } = await renderPdf(
    <Document style={{ fontFamily: "Liberation Sans" }}>
      <Text style={{ fontWeight: weight }}>{words}</Text>
    </Document>,
    { fonts }
  );
  const page = await (await getDocument({ data: pdf.slice(), verbosity: 0 }).promise).getPage(1);
  return (await page.getTextContent()).items.map((item) => ("str" in item ? item.str : "")).join("");
}

describe("a PDF's text after other PDFs", () => {
  it("keeps the letters an earlier PDF drew only with an accent", async () => {
    // Each first PDF draws an accented letter and never the plain one; the next draws the plain one.
    expect(await text("Café")).toBe("Café");
    expect(await text("Peter Jones")).toBe("Peter Jones");
    expect(await text("Über", 700)).toBe("Über");
    expect(await text("Unit price", 700)).toBe("Unit price");
    expect(await text("Zoë Ångström")).toBe("Zoë Ångström");
    expect(await text("Amount Owing")).toBe("Amount Owing");
  });

  it("keeps them when PDFs are drawn at the same time", async () => {
    const words = ["Ñandú Œuvre", "Nandu Oeuvre", "Émile", "Ending", "Çà", "Cash"];
    const drawn = await Promise.all(Array.from({ length: 24 }, (_, i) => text(words[i % words.length], i % 3 ? 400 : 700)));
    expect(drawn).toEqual(Array.from({ length: 24 }, (_, i) => words[i % words.length]));
  });
});
