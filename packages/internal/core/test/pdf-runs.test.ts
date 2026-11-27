/**
 * A block of text cut between two of its lines (src/pdf/runs.ts): its lines matched to its text as the engine laid
 * them out, and its runs cut at a character; and its part on a page drawn line by line (src/pdf/paint.ts).
 */
import type { PlannedLine } from "../src/plan";
import type { Block, Run } from "../src/pdf/model";
import { Painter } from "../src/pdf/paint";
import { lineEnds, runsText, splitRuns } from "../src/pdf/runs";

describe("a block of text's lines, matched to its text", () => {
  it("ends each where its characters end, a line break between two lines in neither", () => {
    expect(lineEnds("One two three\nfour", ["One two ", "three", "four"])).toEqual([
      { end: 8, next: 8, hyphenated: false },
      { end: 13, next: 14, hyphenated: false },
      { end: 18, next: 18, hyphenated: false },
    ]);
  });

  it("knows a line that ends in a word broken by a hyphen (the hyphen isn't in the text)", () => {
    expect(lineEnds("Supercalifragilistic words", ["Supercali-", "fragilistic words"])).toEqual([
      { end: 9, next: 9, hyphenated: true },
      { end: 26, next: 26, hyphenated: false },
    ]);
  });

  it("matches nothing where the lines aren't the text, or don't reach its end", () => {
    expect(lineEnds("One two", ["One ", "three"])).toBeUndefined();
    expect(lineEnds("One two three", ["One ", "two "])).toBeUndefined();
  });
});

describe("a block of text's runs", () => {
  const runs: Run[] = ["Start ", { kind: "span", style: { fontWeight: 700 }, runs: ["bold ", { kind: "link", href: "https://x.test", style: {}, runs: ["link"] }] }, " end"];

  it("are its text as laid out, an image a character", () => {
    expect(runsText(runs, {})).toBe("Start bold link end");
    expect(runsText(["a", { kind: "image", src: "data:image/png;base64,", style: {} }, "b"], {})).toBe("a￼b");
  });

  it("are transformed as drawn, and can't be matched where a transform changes the text's length", () => {
    expect(runsText(["Straße"], { textTransform: "lowercase" })).toBe("straße");
    expect(runsText(["Straße"], { textTransform: "uppercase" })).toBeUndefined();
  });

  it("cut at a character, each run's style kept on both sides", () => {
    expect(splitRuns(runs, 8)).toEqual([
      ["Start ", { kind: "span", style: { fontWeight: 700 }, runs: ["bo"] }],
      [{ kind: "span", style: { fontWeight: 700 }, runs: ["ld ", { kind: "link", href: "https://x.test", style: {}, runs: ["link"] }] }, " end"],
    ]);
    // Inside the link: the link on both sides.
    expect(splitRuns(runs, 13)[1][0]).toEqual({ kind: "span", style: { fontWeight: 700 }, runs: [{ kind: "link", href: "https://x.test", style: {}, runs: ["nk"] }] });
    expect(splitRuns(runs, 0)).toEqual([[], runs]);
    expect(splitRuns(runs, 19)).toEqual([runs, []]);
  });
});

describe("a block of text's part drawn line by line", () => {
  // A paragraph of 1,000 items, each followed by a blank line (two line breaks, the second in a larger size): its first
  // 40 lines on a page.
  const path = "root.children[0]";
  const runs: Run[] = [];
  const lines: PlannedLine[] = [];
  for (let item = 0, at = 0; item < 1000; item++) {
    const word = `Item ${item}`;
    runs.push(word, "\n", { kind: "span", style: { fontSize: 24 }, runs: ["\n"] });
    lines.push({ start: at, end: at + word.length, height: 18, wordSpacing: 0, hyphenated: false });
    at += word.length + 1;
    lines.push({ start: at, end: at, height: 36, wordSpacing: 0, hyphenated: false });
    at++;
  }
  const part = { path, part: 0, first: true, last: false, lines: lines.slice(0, 40) };

  it("draws a blank line as the line break after it, a space in its style, as tall as it was measured", () => {
    const painted = new Painter(new Map([[path, { kind: "text", path, style: {}, runs } as Block]])).part(part);
    const [, blank] = painted.kind === "box" ? painted.children : [];
    expect(blank).toEqual({ kind: "text", of: path, style: { height: 36 }, runs: [{ kind: "span", style: { fontSize: 24 }, runs: [" "] }] });
    const [first, , second] = painted.kind === "box" ? painted.children : [];
    expect([first, second].map((line) => line.kind === "text" && line.runs)).toEqual([["Item 0"], ["Item 1"]]);
  });

  it("reads the paragraph's runs once for the page, not again for each blank line", () => {
    let reads = 0;
    const counted = new Proxy(runs, {
      get(target, key, receiver) {
        if (typeof key === "string" && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver);
      },
    });
    new Painter(new Map([[path, { kind: "text", path, style: {}, runs: counted } as Block]])).part(part);
    // 3,000 runs; reading them again for each of the 20 blank lines is 63,000 reads.
    expect(reads).toBeLessThan(2 * runs.length);
  });
});
