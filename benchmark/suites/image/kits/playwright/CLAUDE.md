# Conventions

You're building one image. The brief is in BRIEF.md.

- Make the image as an HTML page that Playwright screenshots (`playwright`; its Chromium is installed). Write the page's HTML and CSS however you like.
- Write cards/render.ts: its default export is an async function that renders the page and returns the PNG's bytes. Put anything else you write in cards/.
- The fonts are in fonts/ and the images in assets/. There's no network, in Node or in the browser.
- `node tools/render.mjs` runs cards/render.ts and writes out/card.png.
- `npx tsc --noEmit` type-checks it.
- `node tools/check.mjs` checks out/card.png. The image is done when it passes.
- The checker reads the text as the page shows it: each element's text and computed style, and the font files your `@font-face` rules load.
- Don't change anything in tools/, fonts/ or assets/.
