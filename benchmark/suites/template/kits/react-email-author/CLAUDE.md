# Conventions

You're writing Orbit's reusable newsletter kit for React Email. What it must guarantee is in BRIEF.md.

- Write it in emails/brand.tsx: a `Layout` component, `<Layout preview="…" heading="…">…</Layout>` (Orbit's header, the heading, the issue's content, Orbit's footer), and the `palette` and `styles` an issue is written with.
- `node tools/check.mjs` puts a reference issue in the Layout and checks it in a browser, then puts in bodies that break the brand and reports what got through. It's done when the reference issue passes.
- `node tools/render.mjs emails/x.tsx` renders an email to out/email.html.
- `npx tsc --noEmit` type-checks it.
- The images are hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.
