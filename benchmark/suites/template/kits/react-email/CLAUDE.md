# Conventions

You're making one issue of Orbit's newsletter, The Orbit Dispatch. The brief is in BRIEF.md.

- Write it in emails/email.tsx with React Email (`@react-email/components`). The file's default export is the email.
- emails/brand.tsx is Orbit's newsletter kit: `<Layout preview="…" heading="…">…</Layout>` (the header, the heading and the footer), `palette` and `styles` (text, title, button, image). Write the issue inside the Layout, styled with them.

Orbit's brand, which every issue keeps:

- Orbit's header (the logo) and footer (the address and the Unsubscribe link) exactly as the kit writes them.
- Colors only from Orbit's palette: page #f1f2f6, card #ffffff, text #1f2937, muted #6b7280, accent #4f46e5 (buttons), and #ffffff on the accent.
- Text in Helvetica, Arial, sans-serif.
- Every link on orbit.dev (or a subdomain), with ?utm_source=newsletter.
- Alt text on every image, a preview text, and at least one button.

- `node tools/render.mjs` renders emails/email.tsx to out/email.html.
- `npx tsc --noEmit` type-checks it.
- `node tools/check.mjs` checks out/email.html in a browser, at a desktop and a phone width. The newsletter is done when it passes.
- The images are already hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.
- Don't change emails/brand.tsx.
