# @hyper-elements/cli

## Unreleased

### Fixed

- **A Document in a project without `"type": "module"` failed with an error that named nothing to change**:
  `Package subpath './en-us' is not defined by "exports" in @react-pdf/hyphenate`, in any project `npm init` made.
  Such a project's templates load through tsx's CommonJS register, which compiles a dependency's ES modules to
  CommonJS too, each `import` in one into a `require()`, and Node refuses a `require()` of a package that only an
  `import` loads ("exports" with an `import` condition and no `require` one), which react-pdf's text engine
  imports. It's a `cli/commonjs-import` error now (exit 2), for any such package: it names the package and says to
  add `"type": "module"` to the package.json, or to put the templates in a folder with a package.json of
  `{"type": "module"}` (a `.cts` template: to rename it `.mts`). Loaded as an ES module, the PDF is written.
- **`describe` said a container holds nothing.** A Section, a Row, a Column and each root said `children: none`,
  because a container holds categories of components rather than named types. It says what it holds, in the words
  the package's guide uses: `children: layout, blocks`. `--json` is unchanged, and was always right.
- **A template whose project has no React** said `Cannot find module 'react/jsx-runtime'`. It's a `cli/react-missing`
  error now, with `npm i @hyper-elements/react react react-dom` to fix it.

### Changed

- `preview --findings` draws each preview in Chromium's sandbox, which Playwright leaves off unless it's asked for:
  a preview holds an email the CLI was given, which is content from outside. A browser that can't start sandboxed
  (a container without the kernel's user namespaces, and GitHub's Ubuntu runners) is started as it was, with a line
  on stderr saying so and `, no sandbox` after its name (`"browser": "chromium 148.0.7778.96, playwright, no
  sandbox"`): what reads that name should expect both. The sandbox is dropped at once only where the failed start
  names it (`No usable sandbox!`, `Running as root without --no-sandbox`); any other failed start is tried in the
  sandbox once more first, so one crash doesn't draw a run's previews without it. A browser that was too slow to
  start, or isn't there, is never started without it.

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
