/**
 * tree.ts against Chromium: each run of text's size, color and whether it's shown, at desktop and at phone width, as
 * Chromium computes them from the rendered HTML. Over the gallery and stress templates (each run whose words are found
 * once) and the cases in test/cases.tsx (whose expected sizes tree.test.tsx also holds tree.ts to).
 * Needs `playwright install chromium`.
 */
import { chromium, type Browser } from "playwright";
import { render, type PluginNode } from "@hyper-elements/react";
import type { ReactElement } from "react";
import { parseColor } from "../../src/color";
import { readTree, WIDTHS, type Info, type Width } from "../../src/tree";
import { cases } from "../cases";
import { screenTemplates } from "../templates";

let browser: Browser;
beforeAll(async () => (browser = await chromium.launch()));
afterAll(() => browser?.close());

interface Seen {
  size: number;
  color: string;
  shown: boolean;
}

/** The rendered HTML and the laid-out tree lint reads. */
async function both(template: ReactElement): Promise<{ html: string; root: PluginNode }> {
  let root: PluginNode | undefined;
  const { html } = await render(template, { plugins: [{ name: "grab", api: 1, check: (input) => ((root = input.root), []) }] });
  return { html, root: root! };
}

/** What Chromium shows of the first text node whose trimmed text is each of `texts`, at a window width. */
async function seen(html: string, width: number, texts: string[]): Promise<Array<Seen | null>> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(html);
    return await page.evaluate((texts: string[]) => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
      return texts.map((text) => {
        const node = nodes.find((n) => n.nodeValue!.trim() === text);
        if (!node) return null;
        const element = node.parentElement!;
        const style = getComputedStyle(element);
        return { size: parseFloat(style.fontSize), color: style.color, shown: element.getClientRects().length > 0 && style.visibility !== "hidden" };
      });
    }, texts);
  } finally {
    await page.close();
  }
}

/** Below each root's phone width: an Email's is its width + 20px, a Page's 480px. */
const windows = (root: PluginNode): Record<Width, number> => ({ desktop: 1200, mobile: root.type === "Email" ? (root.width ?? 600) : 400 });

describe("tree.ts as Chromium shows it", () => {
  it("every run of the gallery and stress templates found once", async () => {
    let checked = 0;
    const wrong: string[] = [];
    for (const { name, template } of screenTemplates()) {
      const { html, root } = await both(template);
      const tree = readTree(root);
      if (!tree) continue;
      const first = (info: Info) => info.node.children.find((c): c is string => typeof c === "string" && c.trim().length > 3)?.trim();
      const counts = new Map<string, number>();
      for (const info of tree.nodes) for (const c of info.node.children) if (typeof c === "string") counts.set(c.trim(), (counts.get(c.trim()) ?? 0) + 1);
      const runs = tree.nodes.filter((info) => first(info) && counts.get(first(info)!) === 1);
      for (const width of WIDTHS) {
        const got = await seen(html, windows(root)[width], runs.map((info) => first(info)!));
        runs.forEach((info, i) => {
          const g = got[i];
          if (!g) return;
          checked++;
          const color = parseColor(info.node.text.color)!;
          const [r, gr, b] = g.color.match(/[\d.]+/g)!.map(Number);
          const sameColor = Math.abs(r! - color.r) < 1.5 && Math.abs(gr! - color.g) < 1.5 && Math.abs(b! - color.b) < 1.5;
          const visible = info.visible[width];
          if (g.shown !== visible || (visible && (Math.abs(g.size - info.size[width]) > 0.05 || !sameColor))) {
            wrong.push(`${name} ${width} ${info.node.path}: Chromium ${JSON.stringify(g)}, lint ${JSON.stringify({ size: info.size[width], color: info.node.text.color, shown: visible })}`);
          }
        });
      }
    }
    expect(wrong).toEqual([]);
    expect(checked).toBeGreaterThan(900);
  });

  for (const c of cases) {
    it(c.name, async () => {
      const { html, root } = await both(c.template);
      for (const width of WIDTHS) {
        const texts = Object.keys(c.runs);
        const got = await seen(html, windows(root)[width], texts);
        texts.forEach((text, i) => {
          const want = c.runs[text]![width === "desktop" ? 0 : 1];
          const g = got[i]!;
          expect(g, text).not.toBeNull();
          if (want === null) expect(g.shown, `${text} on ${width}`).toBe(false);
          else expect([g.shown, Math.round(g.size * 100) / 100], `${text} on ${width}`).toEqual([true, want]);
        });
      }
    });
  }
});
