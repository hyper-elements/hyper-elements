# Conventions

You're writing Orbit's reusable newsletter, as a template. What it must guarantee is in BRIEF.md.

- Write it in templates/newsletter.tsx with `template()` from `@hyper-elements/react/template`, its id `orbit.Newsletter`, with three fields: `preview` and `heading` (text) and `body` (a slot).
- `node tools/check.mjs` gives the template a reference issue and checks it in a browser, then gives it bodies that break the brand and reports which it refused. It's done when the reference issue passes.
- `node tools/render.mjs designs/x.tsx` renders a design made from it (`export default () => <Newsletter … />`) to out/email.html.
- `npx tsc --noEmit` type-checks it.
- The images are hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.

@docs/TEMPLATES.md
@docs/GUIDE.md
