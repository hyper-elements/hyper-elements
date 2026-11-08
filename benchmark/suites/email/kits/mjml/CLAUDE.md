# Conventions

You're building one email. The brief is in BRIEF.md.

- Write it in emails/email.mjml with MJML (`mjml`).
- `node tools/render.mjs` compiles emails/email.mjml to out/email.html, and prints MJML's validation errors.
- `node tools/check.mjs` checks out/email.html in a browser, at a desktop and a phone width. The email is done when it passes.
- The images are already hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.
