# Conventions

You're writing Orbit's reusable newsletter kit for MJML. What it must guarantee is in BRIEF.md.

- Write it as three files in emails/: head.mjml (mj-head content: the brand's fonts and styles), header.mjml and footer.mjml (an mj-section each, with `css-class="brand-header"` and `css-class="brand-footer"`).
- `node tools/check.mjs` puts a reference issue between them and checks it in a browser, then puts in bodies that break the brand and reports what got through. It's done when the reference issue passes.
- `node tools/render.mjs emails/x.mjml` compiles an email to out/email.html.
- The images are hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.
