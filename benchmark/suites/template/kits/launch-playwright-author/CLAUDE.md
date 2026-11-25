# Conventions

You're writing Orbit's reusable launch graphic with Playwright (an HTML and CSS page, screenshotted by Chromium). What it must do is in BRIEF.md.

- Write it in templates/launch.ts: an exported `render(values, format)` that draws a launch's values (BRIEF.md says what they are) in `"square"` or `"landscape"` and returns the PNG's bytes, and say in it what values it takes.
- cards/render.tsx gives it designs/launch.json's values in each format.
- `node tools/check.mjs` writes a reference launch in designs/launch.json, draws it in both formats and checks them. It's done when that passes.
- `node tools/render-launch.mjs` draws designs/launch.json in both formats, to out/.
- Don't change anything in tools/, cards/, fonts/, assets/ or art/.
