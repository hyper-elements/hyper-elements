# @hyper-elements/cli

## Unreleased

### Fixed

- **A Document's PDF in a project without `"type": "module"`.** tsx's CommonJS register compiles every file it is
  given, a dependency's own ES modules among them, and resolves the `import()` in one as a `require`. A package
  whose "exports" names an `import` condition alone can't be found that way, and react-pdf loads its text engine
  like that: every Document failed with `Package subpath './en-us' is not defined by "exports" in
  @react-pdf/hyphenate`, in any project `npm init` made. A dependency's own JavaScript is left to Node now;
  TypeScript, and the template's own files, are still tsx's to compile. That needs a Node that can `require` an ES
  module itself (20.19 and 22.12 on). On one before those every file stays tsx's, as it was: a template that imports
  a dependency written as an ES module renders as before, and a Document in such a project still fails this way.
- **`describe` said a container holds nothing.** A Section, a Row, a Column and each root said `children: none`,
  because a container holds categories of components rather than named types. It says what it holds, in the words
  the package's guide uses: `children: layout, blocks`. `--json` is unchanged, and was always right.
- **A template whose project has no React** said `Cannot find module 'react/jsx-runtime'`. It's a `cli/react-missing`
  error now, with `npm i @hyper-elements/react react react-dom` to fix it.

### Changed

- `preview --findings` draws each preview in Chromium's sandbox, which Playwright leaves off unless it's asked for:
  a preview holds an email the CLI was given, which is content from outside. A browser that can't start sandboxed
  (a container without the kernel's user namespaces) is started as it was, with a line on stderr saying so. A
  browser that was too slow to start isn't taken for one that can't be sandboxed.

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
