# Conventions

You're writing Orbit's reusable launch graphic, as a template. What it must do is in BRIEF.md.

- Write it in templates/launch.tsx with `template()` from `@hyper-elements/react/template`: a Canvas with two formats, `square` and `landscape`, and the fields `headline`, `features`, `launchDate`, `locale`, `screenshot` and `artwork`.
- cards/render.tsx draws a design made from it (designs/launch.tsx, `export default () => <Launch … />`) in each format, from the snapshot its check returns.
- `node tools/check.mjs` writes a reference launch in designs/launch.tsx, draws it in both formats and checks them. It's done when that passes.
- `node tools/render-launch.mjs` draws designs/launch.tsx in both formats, to out/.
- `npx tsc --noEmit` type-checks it.
- Don't change anything in tools/, cards/, fonts/, assets/ or art/.

@docs/TEMPLATES.md
@docs/GUIDE.md
