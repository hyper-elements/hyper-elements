# Conventions

You're building one image. The brief is in BRIEF.md.

- Make the image with Hyper Elements (`@hyper-elements/react`): a `<Canvas>`, rendered to a PNG with `renderImage` from `@hyper-elements/react/image`.
- Write cards/render.tsx: its default export is an async function that renders the image and returns the PNG's bytes. Put anything else you write in cards/.
- The fonts are in fonts/ and the images in assets/. There's no network.
- `node tools/render.mjs` runs cards/render.tsx and writes out/card.png.
- `npx tsc --noEmit` type-checks it.
- `node tools/check.mjs` checks out/card.png. The image is done when it passes.
- The checker reads the text as the template gives it: each text's words, and the font, size, weight and color in its `style`, and the font files you pass to `renderImage`.
- Don't change anything in tools/, fonts/ or assets/.
