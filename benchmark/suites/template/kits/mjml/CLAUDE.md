# Conventions

You're making one issue of Orbit's newsletter, The Orbit Dispatch. The brief is in BRIEF.md.

- Write it in emails/email.mjml with MJML (`mjml` 5.4.1).
- emails/ holds Orbit's newsletter kit: head.mjml (the brand's fonts and styles; `<mj-include path="./head.mjml" />` in mj-head), header.mjml (first in mj-body) and footer.mjml (last), each included as it is. A story's title is an mj-text with `css-class="title"`.

Orbit's brand, which every issue keeps:

- Orbit's header (the logo) and footer (the address and the Unsubscribe link) exactly as the kit writes them.
- Colors only from Orbit's palette: page #f1f2f6, card #ffffff, text #1f2937, muted #6b7280, accent #4f46e5 (buttons), and #ffffff on the accent.
- Text in Helvetica, Arial, sans-serif.
- Every link on orbit.dev (or a subdomain), with ?utm_source=newsletter.
- Alt text on every image, a preview text, and at least one button.

- `node tools/render.mjs` compiles emails/email.mjml to out/email.html, with MJML's warnings.
- `node tools/check.mjs` checks out/email.html in a browser, at a desktop and a phone width. The newsletter is done when it passes.
- The images are already hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.
- Don't change head.mjml, header.mjml or footer.mjml.
