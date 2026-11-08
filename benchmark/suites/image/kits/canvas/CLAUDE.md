# Conventions

You're building one image. The brief is in BRIEF.md.

- Draw the image with `@napi-rs/canvas` (Skia: `createCanvas`, `GlobalFonts`, `loadImage`).
- Write cards/render.ts: its default export is an async function that draws the image and returns the PNG's bytes. Put anything else you write in cards/.
- The fonts are in fonts/ and the images in assets/. There's no network.
- `node tools/render.mjs` runs cards/render.ts and writes out/card.png.
- `npx tsc --noEmit` type-checks it.
- `node tools/check.mjs` checks out/card.png. The image is done when it passes.
- The checker reads the text as you draw it: each `fillText`'s text, with the context's `font` and `fillStyle`, and the font files you register.
- Don't change anything in tools/, fonts/ or assets/.
