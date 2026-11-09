# Conventions

You're building one printed document, as a PDF. The brief is in BRIEF.md.

- Write it in src/template.tsx with Hyper Elements (`@hyper-elements/react`). The file's default export is a component that returns the document. Put anything else you write in src/.
- `node tools/render.mjs --pdf` renders src/template.tsx to out/document.pdf with `renderPdf` from `@hyper-elements/react/pdf`. It gives it the Inter font, from fonts/Inter-Regular.ttf (weight 400) and fonts/Inter-Bold.ttf (weight 700), as the family "Inter".
- `npx tsc --noEmit` type-checks it.
- `node tools/check.mjs` checks out/document.pdf. The document is done when it passes.
- There's no network.
- Don't change anything in tools/ or fonts/.
