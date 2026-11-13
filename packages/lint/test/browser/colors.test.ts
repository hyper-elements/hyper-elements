/** The CSS color names' values, as Chromium computes them. Needs `playwright install chromium`. */
import { chromium } from "playwright";
import { namedColors } from "../../src/color";

it("has Chromium's value for every CSS color name", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const names = [...namedColors().keys()];
    const computed = await page.evaluate((names: string[]) => {
      const el = document.createElement("div");
      document.body.append(el);
      return names.map((name) => {
        el.style.color = name;
        const [r, g, b] = getComputedStyle(el).color.match(/\d+/g)!.map(Number);
        return [r, g, b].map((c) => c!.toString(16).padStart(2, "0")).join("");
      });
    }, names);
    expect(Object.fromEntries(names.map((name, i) => [name, computed[i]]))).toEqual(Object.fromEntries(namedColors()));
  } finally {
    await browser.close();
  }
});
