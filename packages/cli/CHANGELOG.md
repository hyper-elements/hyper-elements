# @hyper-elements/cli

## 0.2.0

- **Lint**: `check`, `render` and `dev` run `@hyper-elements/lint` on each Email and Page, and `check` runs its HTML
  rules on an HTML email. Its findings are warnings and notes (`email/lint-…`, `page/lint-…`, `lint/…` with a line), so
  exit codes change only past `--max-warnings`. `--no-lint` leaves them out.
- Lint's options are `"hyperElements": { "lint": { … } }` in the nearest `package.json`. A shape lint can't take, or a
  rule, severity or kind the copy of lint that runs doesn't know, exits 2.
- Lint is the project's copy where the template resolves one, else the CLI's own (a dependency), with an `info` note,
  `cli/lint-copy`.
- `dev`'s page links each diagnostic's docs.

## 0.1.0

- `render`, `check`, `outline`, `preview`, `inspect`, `describe`, `dev` and `migrate`, on Node 20.6+ and Bun 1.3+.
