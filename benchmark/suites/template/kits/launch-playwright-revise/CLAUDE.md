# Conventions

You're changing a finished launch graphic for Orbit, in its two formats, square and landscape: it's in designs/. The change is in BRIEF.md: make that change and nothing else.

- Orbit's launch graphic is templates/launch.ts, its `render(values, format)` drawing a launch with Playwright (an HTML and CSS page, screenshotted by Chromium): its layout, fonts, colors and logo are its own. Write the launch's values in designs/launch.json, as templates/launch.ts says it takes them:

  ```json
  { "headline": "…", "features": ["…", "…", "…"], "launchDate": "2026-12-03", "screenshot": { "src": "art/….png", "width": 1200, "height": 750 }, "artwork": { "src": "art/….png", "width": 1080, "height": 680 } }
  ```

- An image's src is its path in the project (art/…), with its file's size. A date is YYYY-MM-DD; `"locale": "de-DE"` shows it in German.
- Orbit's brand, which every launch keeps: the headline in at most 3 lines at one of its format's sizes, nothing drawn outside its regions, the screenshot whole and between 1.2:1 and 2:1, only Inter. A launch that can't keep it: say so, don't work around it.
- `node tools/render-launch.mjs` draws both formats, out/square.png and out/landscape.png (out/render.json says how each went).
- `node tools/check.mjs` checks both, and that nothing but the change was redrawn. The change is done when it passes.
- Don't change anything in tools/, cards/, fonts/, assets/ or art/.
- Don't change templates/.
