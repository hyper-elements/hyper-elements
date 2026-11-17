---
title: "Templates in the command line"
description: "Values files, design new and design set, TSX template designs, slots as modules, trusted templates, --require-template and template extract, with the hyper-elements CLI."
---

How the [`hyper-elements` command](/docs/cli) works with templates. [Template examples](/docs/templates/examples)
runs these commands on real templates, with what each writes.

Every command exits `0` when it's done, `1` when a design has errors, and `2` when it couldn't run at all: a wrong
option, a missing package. [JSON and exit codes](/docs/cli#json-and-exit-codes) has the rest.

## The commands

| Command | What it does |
|---------|--------------|
| `describe templates/launch-graphic.tsx` | What a template takes: its formats, fields, image regions and rules. `--json` has all of it |
| `design new <template> -o <name.values.json>` | Makes a design from a template: a values file |
| `design set <name.values.json> field=value` | Changes values in a design; the rest stays as it was |
| `check <design>` | Checks a design: its values, its images against their files, fitted text, each format |
| `render <design>` | Checks it the same way, then writes its output: one file per format |
| `check <template>` | Checks a template module with its example in every format: a template's CI |
| `template extract <design> --id … --field … -o <template>` | Makes a template from a design a person approved |

A design is a values file (`name.values.json`) or a TSX file whose root is a template. Both are checked the same way.

## Values files

A values file names its template's module, the formats wanted and the values:

```bash
npx hyper-elements design new templates/launch-graphic.tsx -o designs/orbit.values.json \
  --values brief.json --set artwork=@art/shapes.png --source artwork=source.json
npx hyper-elements design set designs/orbit.values.json launchDate=2026-12-10
```

| You give | It's read as |
|----------|--------------|
| `--values brief.json` | The values to start from (`design new`) |
| `--set field=value`, or `field=value` after the file (`design set`) | JSON where it parses, else text. A nested value goes by its path: `customer.name=Northwind`, `lines[2].price=30`, `features[0]=…` |
| `field=@path/to/image.png` | An image file: its size is read from it, and its hash goes in the file's `assets` |
| `field=@path/to/body.tsx` | A slot's content, stored as its module |
| `--source field=source.json` | Where an image came from, recorded beside its hash: a JSON object with a `kind` (`"supplied"`, `"generated"`, `"stock"` or your own) and whatever else you keep, such as a provider, a model and a prompt, or a license |
| `--draft` | Writes the file even where values are missing, with `"draft": true` and what's `missing` |

- **A value the template refuses exits `1`**, and the file stays as it was.
- **`design new` lists every format the template has.** To render fewer, take one out of the file's `formats`.
- **`design set` first brings the file up to the template's current version:** its migrations run, for a draft too.
  So a set can repair a file whose values the template refuses. A file of another template, or of a newer version, is
  left alone.
- **A draft isn't rendered** (`cli/draft`) until a `design set` completes it.
- **An image's entry follows its file.** Moved to another field, it keeps its hash and source. Changed under the same
  name, it has no source until one is given (`template/asset-changed`). `check` lists an image with no source under
  `review`.

### Paths

| A path | Is relative to |
|--------|----------------|
| The template's module, in a values file | The values file (or it's a package specifier, kept as given) |
| A template's own files: its logo, its fonts, its example's pictures | The template's module |
| A Canvas's or a Document's image, in a design | The design: its values file or its TSX file. The command line reads it to draw it |
| An Email's or a Page's image `src` | Nothing: it's written into the HTML as it's given (a URL, a service's tag such as `{{logo_url}}`, `cid:`). Where it's a file's path, the file is read relative to the design, only to check it |
| A slot's module | The values file |

## Checking and rendering

`render`, `check`, `inspect` and `outline` run a values file once per format it lists. Each format has its own line
(`templateFormat` with `--json`) and its own file, `<name>.<format>.<ext>`.

| Flag | What it does |
|------|--------------|
| `--template-format square` | Runs one of the template's formats |
| `--format svg` | The file type of a Canvas's image (`png` or `svg`), as for any Canvas. Not a template's format |
| `--scale 2` | Pixels per px, in place of the format's own scale |
| `--require-template [id]` | Fails every input that isn't a design a template checked, or is one of another template |
| `--props file.json` | A TSX design's props, as for any design |

What's checked, in order:

1. **The values**, by the template: a wrong one is a `template/…` error.
2. **The design**, as any design is, with lint and the email client checks where they apply.
3. **A Canvas, measured** at the scale it's rendered at, strict: a font that isn't given fails, fitted text is sized,
   and each image is checked against its region and its file.
4. **Image files, for the other roots too:** an image that's a file beside the design is read and checked for its
   type, its transparency and the size it's given as. One that isn't read (a URL) leaves those undecided, said as
   `template/asset-unread`.

`check --json` adds `fits`, `regions` (each image's box and the pixels it needs), `rules` and `review` (what a
reviewer looks at by eye, which never fails a run). `render` checks the same, and writes nothing for a format that
fails.

`outline` and `--stdout` take one input, so a file of two formats needs `--template-format`. A template with formats
checks a file that lists none as `template/format`.

## TSX template designs

A design can be TSX with the template as its root:

```tsx
import { Column, Heading, Text } from "@hyper-elements/react";
import Newsletter from "../templates/newsletter";

export default () => <Newsletter subject="What's new in June" body={<Column><Heading level={2}>Faster exports</Heading><Text>…</Text></Column>} />;
```

The command line runs the design file only far enough to read which template it uses and the props it gives it. Then
it checks and renders those as it does a values file, one output per format. Running it is running code:
[a TSX design is reviewed as code](#what-that-guarantees-and-what-it-doesnt).

- It's rendered with the props any design gets: `--props file.json`, else the sample props its file gives
  ([`PreviewProps`](/docs/cli)).
- A design whose template isn't among its own imports, or whose props aren't data (a function), is
  `cli/template-design`.
- `design new <template> --from designs/june.tsx -o june.values.json` writes its values file.

## Slots stored as modules

A values file's slot can be its module, relative to the file:

```bash
npx hyper-elements design set designs/june.values.json body=@designs/_slots/june.body.tsx
```

[A slot module](/docs/templates/slots#a-slot-stored-as-data) is a component that renders the content. It runs
in a process of its own, which can reply only with what it rendered. It's still code, with that process's access to
the machine: [review it as code](#what-that-guarantees-and-what-it-doesnt). One that throws, sends anything
else, sends more than 8 MB or exits first is `cli/slot-module` (exit `1`), and nothing is written. Its hash is kept
in `assets`, as an image's is.

Keep slot modules in a folder whose name starts with `_` (`designs/_slots/june.body.tsx`) where you check or render a
whole folder: a folder run takes every module with a default export for a design.

## Trusted templates

A values file names its own template, and so does a TSX design. Without a list, a design could name any template:
one somebody wrote to let anything through. So list the templates a project's designs may use, in the nearest
`package.json`:

```json
{ "hyperElements": { "templates": ["templates/**", "@acme/brand-templates"] } }
```

Paths and globs are relative to it; a name is a package.

| With the list | What happens |
|---------------|--------------|
| A template outside it | `cli/template-untrusted`, exit `1` |
| A template inside it | Loaded in a process that refuses anything it imports outside the list and your installed packages: statically, dynamically or with `require()`, before it runs, naming who imported it |
| A file in a listed folder that isn't a template (a design someone kept there) | Runs as any design does |
| A `package.json` that can't be read as JSON | The run stops, exit `2`: it can't say there's no list |
| On Bun | Bun's plugins can't see every load, so a project with the list runs its templates on Node (exit `2` on Bun) |

Without the list, templates load as any design does, with `"trusted": false` and a `cli/template-untrusted` warning.

In CI, `--require-template` on `check` and `render` fails anything a template didn't check:

```bash
npx hyper-elements check designs/ --require-template acme.Newsletter
```

### What that guarantees, and what it doesn't

`--require-template` checks what a design gives its template. It doesn't check what a design's code does.

| A design that is | Is | Take it from an agent, or unreviewed? |
|------------------|----|----------------------------------------|
| A values file with no slot module | Data. Nothing in it runs | Yes. `--require-template` then means the design is what the template checked |
| A TSX design | Code. The command line runs it to read its props, before the template checks anything | No: review it as you review any code |
| A values file with a slot module | Data that names code. The module runs to render the slot's content | No: review the module |

Code that runs can do what its process can: read and write files, the template's among them. A TSX design could
change a trusted template for the length of a run and put it back, and the run would pass. The list and the guard
stop a template from loading code outside the list; they don't stop a design's own code.

So for agents, and for designs nobody reviews, use templates whose open parts are data (fields and blocks), filled as
values files. Review TSX designs and slot modules like the rest of your code.

A template guarantees what it checks, not who may edit it. Commit templates and review changes to them (with
CODEOWNERS, for example), and don't give whatever fills them write access to the templates folder.

## A template from an existing design

A design a person approved can become a template. Give each part that changes an `id`, then extract it:

```bash
npx hyper-elements template extract designs/orbit.tsx --id acme.LaunchGraphic \
  --field headline --field features --field launchDate --field artwork -o templates/launch-graphic.tsx
```

| In the design | In the template |
|---------------|-----------------|
| A literal text child of the node with that `id` | A `prop.text` field, the literal its `example` |
| An Image's literal `src={{ src, width, height }}` | A `field.image`, the literal its `example` |
| Siblings with ids `features-0`, `features-1`, … | One `prop.list` |
| The node itself | Keeps its `id`, and gains `field` |
| The rest of the file: its theme, variants and components | As written, with relative imports and `src` paths rewritten for the template's folder |

It writes a template with `fields`, an `example` and a `render`, at version `0.1.0`. A value that isn't a literal is
`extract/not-literal`, with its line and column, and nothing is written. Then add the template's rules and formats,
set its `version`, and `check` it.

## Diagnostics

The template's own diagnostics (`template/…`) are on [Rules, checks and diagnostics](/docs/templates/rules#diagnostics).
These are the command line's:

| Code | What triggers it | Exit |
|------|------------------|------|
| `cli/values-file` | A values file that isn't one: not JSON, the wrong shape, a template module that isn't found or is given by an absolute path | `1` |
| `cli/template-format` | A format the file or the template doesn't have; or `outline` or `--stdout` given more than one | `1` or `2` |
| `cli/draft` | `render` of a draft | `1` |
| `cli/render-template` | `render` of a template module: render a design made from it | `2` |
| `cli/not-a-template-module` | A values file's module whose default export isn't a template | `1` |
| `cli/template-design` | A TSX design whose template can't be found among its imports, or whose props aren't data | `1` |
| `cli/slot-module` | A slot's module that throws, replies with anything but its capture, or exits first | `1` |
| `cli/template-untrusted` | A template outside the trusted list (an error), or loaded with no list (a warning) | `1` |
| `cli/template-required` | With `--require-template`, an input no template checked, or one of another template | `1` |
| `cli/engine-missing` | A Canvas template's design, where the image engines aren't installed | `2` |
| `cli/elements-version` | A template or a values file, with an `@hyper-elements/react` from before templates | `2` |
| `extract/not-literal` | A field's value that isn't a literal | `1` |
| `extract/no-id` | No element in the design has the `id` a `--field` names | `1` |
| `extract/props` | A design that takes props | `1` |
| `extract/no-design`, `extract/no-root` | A default export that isn't a component written in the file, or no root in its JSX | `1` |
