# @hyper-elements/lint

## 0.1.0

- **`lint()`**, a plugin for `validate()` and `render()`: 17 rules for what makes an Email or a Page hard to read,
  reported as `email/lint-<rule>` and `page/lint-<rule>` warnings and notes, each with a fix and a link to its docs.
  It reads the laid-out template at desktop and at phone width, as each output writes it.
- **Options**: each rule's severity or `off`, and `kind: "marketing"` for `unsubscribe`. An unknown rule, severity or
  kind throws a `TypeError`.
- **`rules`**: every rule's id, default severity, roots, summary, fix and docs link.
