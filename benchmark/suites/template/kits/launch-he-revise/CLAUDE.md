# Conventions

You're changing a finished launch graphic for Orbit, in its two formats, square and landscape: it's in designs/. The change is in BRIEF.md: make that change and nothing else.

- Orbit's launch graphic is a template, templates/launch.tsx (`orbit.LaunchGraphic`): its layout, fonts, colors and logo are its own, and its headline is fitted to its region. Write the launch in designs/launch.tsx, a design whose root is the template, its fields as props:

  ```tsx
  import Launch from "../templates/launch";

  export default () => (
    <Launch headline="…" features={["…", "…", "…"]} launchDate="2026-12-03" screenshot={{ src: "art/….png", width: 1200, height: 750 }} artwork={{ src: "art/….png", width: 1080, height: 680 }} />
  );
  ```

- An image's src is its path in the project (art/…), with its file's size. A date is YYYY-MM-DD; `locale="de-DE"` shows it in German.
- The template refuses a launch that can't keep the brand (copy that doesn't fit, a glyph or font that's missing, a screenshot of another shape), and says why: then say so, don't work around it.
- `node tools/render-launch.mjs` draws both formats, out/square.png and out/landscape.png (out/render.json says how each went).
- `node tools/check.mjs` checks both, and that nothing but the change was redrawn. The change is done when it passes.
- `npx tsc --noEmit` type-checks it.
- Don't change anything in tools/, cards/, fonts/, assets/ or art/.
- Don't change templates/.

@docs/TEMPLATES.md
@docs/GUIDE.md
