# Image output: `@hyper-elements/react/image`

Image output for [Hyper Elements](https://github.com/hyper-elements/hyper-elements): a `<Canvas>` from `@hyper-elements/react` written as PNG or SVG on the server, with Satori and resvg, without a browser or the network. A social card, a banner, an Open Graph image: laid out as the Canvas's HTML is, at the same widths.

## Installation

```bash
npm install @hyper-elements/react satori@^0.33.5 @resvg/resvg-js react
```

Give satori's range as above: pnpm and yarn otherwise add satori's newest version, outside the range `/image` is built for, with only a warning. In Next.js, list both engines in `next.config.ts` (`serverExternalPackages: ["@resvg/resvg-js", "satori"]`): resvg is a native addon and Satori reads a WebAssembly file, which Next.js can't bundle.

`/image` is an entry of `@hyper-elements/react`. Its engines are optional peer dependencies, so a project that doesn't import `/image` installs nothing for them, and the main entry never loads them:

| Package | Version | Why |
|---------|---------|-----|
| `@hyper-elements/react` | `^0.3.0` | The elements, and this entry |
| `satori` | `^0.33.5` | Lays out the Canvas and draws its text as paths, as SVG (optional: only for `/image`) |
| `@resvg/resvg-js` | `^2.6.2` | Draws that SVG as a PNG (optional: only for `/image`) |
| `react` | `>=18` | |

The tree `prepare()` lays out says its format (its layout version), and `renderImage` reads the one it's built with. Where the `@hyper-elements/react` it loads writes another (a second install beside it), it throws an `ElementsError` (`image/version`) rather than drawing the design wrong.

Node.js only: it writes the image on the server.

## Quick Start

```tsx
import { readFile, writeFile } from "node:fs/promises";
import { Canvas, Heading, Text } from "@hyper-elements/react";
import { renderImage } from "@hyper-elements/react/image";

const SocialCard = () => (
  <Canvas width={1200} height={630} style={{ backgroundColor: "#0f172a", padding: 64, gap: 24, color: "#ffffff", fontFamily: "Inter, sans-serif" }}>
    <Heading level={1} style={{ fontSize: 64 }}>
      Launch week
    </Heading>
    <Text style={{ fontSize: 28, color: "#cbd5e1" }}>Five days of new things, one a day.</Text>
  </Canvas>
);

const { image, width, height, diagnostics } = await renderImage(<SocialCard />, {
  fonts: [
    { family: "Inter", src: await readFile("fonts/Inter-Regular.ttf") },
    { family: "Inter", src: await readFile("fonts/Inter-Bold.ttf"), weight: 700 },
  ],
});
await writeFile("card.png", image);
```

`renderImage(element, options)` returns `{ image, width, height, diagnostics }`: the file's bytes, its size in pixels, and the warnings and notes. Errors reject with an `ElementsError` listing them. The same design writes the same bytes.

| Option | |
|--------|---|
| `fonts` | Font files, by family (below) |
| `images` | Image files, by URL (below) |
| `format` | `"png"` (the default) or `"svg"`. An SVG's text is drawn as paths, so it shows without the fonts |
| `scale` | Pixels per px of a PNG: 2 for a phone's screen |

## Fonts and images are given as bytes

Nothing is fetched. Give each file the design needs:

- **Fonts** in `fonts`: `{ family, src, weight?, style? }`, one entry per file, `src` a TTF, OTF or WOFF file's bytes. `family` is the name the design's `fontFamily` stacks use. A Canvas's own `fonts` given as `data:` URIs are drawn too; ones given by URL aren't loaded. An image needs at least one font: text whose `fontFamily` has no file given is drawn in the first font given.
- **Images** in `images`, by the URL the design gives them (`{ "https://…/photo.png": bytes }`), or as `data:` URIs in the design: PNG, JPEG, GIF or SVG.

## Fitting text

A Heading or a Text in a Canvas takes `fit`: the sizes it may be drawn at, and the lines it may take. `renderImage`
measures it with the fonts it's given and draws the largest size at which its lines, its widest piece that can't
break and any box of a fixed height around it all fit:

```tsx
<Heading fit={{ sizes: [88, 76, 64], maxLines: 3 }}>{title}</Heading>
<Text fit={{ sizes: { min: 40, max: 72, step: 4 }, maxLines: 4 }}>{quote}</Text>
<Text fit={{ maxLines: 2 }} style={{ fontSize: 24 }}>{caption}</Text>
```

- `sizes` is a list of px sizes or a range, largest first, at most 32. With `sizes`, `fit` sets the font size: a
  `fontSize` beside it is `style/fit`. With only `maxLines`, it checks the size the text has.
- Where no size fits, it's `image/fit`, an error, with the lines it needs and roughly how many characters to cut.
- A piece that can't break is measured as lines break: a word, words a no-break space holds together, the part of a
  compound up to its hyphen. Chinese and Japanese text breaks between its characters.
- Several fitted nodes are sized in document order, each tried with the ones after it at their smallest size: the
  first takes the largest size that leaves the rest room, and never fails for a later one that can still shrink.
- Runs inside it (a Span, a Link) are in its own size, font, weight and line height: one in another is `fit/inline`.
- `fit` is a Canvas's: under an Email, a Page or a Document it's `prop/not-supported`. The Canvas's HTML preview draws
  the largest size.

## Measuring without drawing: layoutImage()

`layoutImage(design, { fonts, images, scale, strict })` measures a Canvas as `renderImage` would, and draws nothing:

- `nodes`: each block's box (`x`, `y`, `width`, `height`, by its `path`), and a block of text's `lines` and `fontSize`;
- `fits`: each fitted node's sizes that fit, the one chosen, and the next one up, which doesn't;
- `glyphs`: the text no font given covers, by node;
- `diagnostics`: what it found.

A template's `checkLayout()` reads it (see the templates guide).

## Strict

`renderImage(design, { strict: true })` makes what's drawn other than written an error: a font not given (`image/font`),
a weight or style not given (`image/font-weight`), content past the Canvas (`image/overflow`), a character no font has
(`image/glyph`), and text whose font stack names no font given. A template's design is drawn strict.

## Diagnostics

| Code | Severity | When |
|------|----------|------|
| `image/root` | error | The design isn't a Canvas |
| `image/version` | error | The `@hyper-elements/react` loaded lays the design out in another layout version than `/image` reads |
| `image/font` | error | The Canvas has text and no font is given |
| `image/font` | warning | A font in the Canvas's `fonts` isn't given, or a file given is WOFF2 |
| `image/font-weight` | warning | Text in a weight or style of a family that isn't given: it's drawn in the nearest file given |
| `image/image` | error | An image isn't given, or its file isn't a PNG, JPEG, GIF or SVG |
| `image/unsupported` | warning | What an image can't show that the HTML can: a hover, a Video's player |
| `canvas/overflow` | warning | The content looks taller than the Canvas (an estimate, which `validate()` gives too) |
| `image/overflow` | warning (error strict) | Content runs past the Canvas, measured |
| `image/glyph` | warning (error strict, or in fitted text) | A character no font given has: it's drawn as an empty box |
| `image/fit` | error | Fitted text doesn't fit at any of its sizes |
| `fit/inline` | error | A fitted node holds a run in another size, font, weight or line height |

`validate()` from `@hyper-elements/react` reports `image/unsupported` and `canvas/overflow` without rendering. What needs the fonts and files (fitting, glyphs, measured overflow) only `renderImage` and `layoutImage` find.

## Known limits

- **WOFF2 isn't drawn**: Satori reads TTF, OTF and WOFF. Give one of those.
- **Text is drawn only in the fonts given**: a character none of them has comes out as an empty box (`image/glyph`). Give a font that has it.
- **What doesn't fit is cut off** at the Canvas's edges.
- **No hover, no video**: a Button shows its own colors, a Video its title.

## License

MIT
