# Conventions

You're building one web page. The brief is in BRIEF.md.

- Write it in src/template.tsx with Hyper Elements (`@hyper-elements/react`). The file's default export is a component that returns the page. Put anything else you write in src/.
- `node tools/render.mjs --page` renders src/template.tsx to out/page.html.
- `npx tsc --noEmit` type-checks it.
- `node tools/check.mjs` checks the output in a browser, at a desktop and a phone width. The page is done when it passes.
- The images are already hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.
