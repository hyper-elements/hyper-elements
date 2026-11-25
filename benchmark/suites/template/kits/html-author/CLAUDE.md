# Conventions

You're writing Orbit's reusable newsletter kit for hand-written HTML. What it must guarantee is in BRIEF.md.

- Write it in emails/starter.html: a whole email with Orbit's header (`id="brand-header"`) and footer (`id="brand-footer"`), {{preview}} and {{heading}} where those go, and a `<!-- BODY … -->` comment where an issue's content goes, saying how to style it.
- `node tools/check.mjs` puts a reference issue in the comment's place and checks it in a browser, then puts in bodies that break the brand and reports what got through. It's done when the reference issue passes.
- The images are hosted at https://assets.orbit.dev/img/.
- Don't change anything in tools/.
