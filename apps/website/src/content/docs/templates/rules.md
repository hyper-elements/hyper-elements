---
title: "Rules, checks and diagnostics"
description: "The rules a template holds every design to, what its check() returns, the order it checks in, snapshots, the rules decided by measuring a Canvas, and every template diagnostic with what triggers it."
---

A **rule** is something that must hold on the finished design, whatever filled it. A **check** is the template
testing one design: its values, then the design they build, then its rules. A **diagnostic** is what a check says when
something fails, with what to change.

<div class="concept-grid single">
<a class="concept" href="#rules-over-the-result"><img src="/generated/templates-guide/concept-rule.svg" width="600" height="400" alt="An email whose button links to another company's site, the button outlined in red and the email refused: a rule"><strong>Rule</strong><span>This template's links go to its own domains. An email with any other link is refused, and the check says which.</span></a>
</div>

[Template examples](/docs/templates/examples) shows checks from the command line; this page is the reference.

## Rules over the result

Rules are checked on the finished design, whatever filled it: values, blocks or a slot's content.

```tsx
import { lint } from "@hyper-elements/lint";

rules: {
  plugins: { lint: lint({ kind: "marketing" }) },
  require: {
    lint: ["unsubscribe", "preview-text", "contrast", "link-text", "lang"],
    core: ["layout/overflow"],
  },
  links: { domains: ["acme.com", "*.acme.com"], params: { utm_source: "newsletter" }, schemes: ["mailto"] },
  root: { lang: true },
},
```

| Rule | It requires | Where it fails |
|------|-------------|----------------|
| `require.lint` | [Lint's rules](/docs/lint), by id: a finding of one is an error, with "(required by …)" | The lint rule's own code |
| `require.core` | Checks of Elements' own, by their codes: the [list below](#what-requirecore-takes) | That code |
| `links.domains` | Every http(s) link's host: `acme.com` itself, `*.acme.com` its subdomains | `template/link-domain` |
| `links.params` | A query parameter on every link | `template/link-param` |
| `links.schemes` | The other schemes a link may use (`mailto`) | `template/link-scheme` |
| | A relative link is refused | `template/link-relative` |
| `root` | Root props that must be set. For a prop `render` takes from a value that may be missing, such as an optional language | `template/root-prop` |

Each required rule ends `passed`, `failed` or `not-run`, in `check()`'s `rules`. One that didn't run never counts as
passed.

- **`plugins.lint`** is `lint()` from `@hyper-elements/lint`, as you'd configure it for any design. `require.lint`
  names the rules of it a design must pass.
- **Whether lint has each required rule is checked when the template is defined,** before any design. A rule lint
  doesn't have, one that's off as lint is configured (`unsubscribe` needs `kind: "marketing"`), or one that doesn't
  run on the template's root (lint checks Emails and Pages) is `template/rule-unavailable`. If lint itself throws, its
  rules are `not-run`, an error (`template/rule-not-run`).
- **A Canvas's `image/…` rules are decided when the image is measured.** `check()` leaves them `not-run`, and
  `renderImage()` decides them as it draws. See [measured rules](#measured-rules-and-checklayout).
- **Links are checked everywhere:** in locked parts and a Menu's too. A URL with a sending service's tag (`{{…}}`) is
  listed for review, or refused with `tags: "deny"` (`template/link-tag`).
- **`plugins.other`** runs other plugins (email-clients'), whose findings are reported but can't be required.

### What require.core takes

| Code | What it finds | Runs on |
|------|---------------|---------|
| `layout/overflow` | Content wider than the space it has | Every root |
| `layout/shrunk` | A Row's children narrowed, because their widths add up to more than it has | Every root |
| `document/overflow` | A page's content that looks taller than the page (an estimate) | Document |
| `canvas/overflow` | A Canvas's content that looks taller than the Canvas (an estimate, made before it's measured) | Canvas |
| `image/overflow` | Content that runs past the Canvas, measured | Canvas |
| `image/glyph` | A character no font given has | Canvas |
| `image/fit` | [Fitted text](/docs/templates/fields#fitted-text) that fits at none of its sizes | Canvas |

Requiring a check does two things. A finding of it is an error, with "(required by …)", where on a design of its own
most of these are warnings. And the check has to have run: `check()` reports it `not-run` until it has, and a design
with a required rule that hasn't run can't be rendered. That's what stops a Canvas passing on its values alone, before
anything measured it.

## check()

`check()` is a template's own method. `launch.check(values, { format })` never throws. It checks one format: a
template with several needs one named. It returns
`{ valid, values, diagnostics, review, rules, snapshots, template }`:

```ts
import { formatDiagnostics } from "@hyper-elements/react";
import launch from "./templates/launch-graphic";

const checked = launch.check(values, { format: "square" });
if (!checked.valid) console.error(formatDiagnostics(checked.diagnostics));
```

[The same from code](/docs/templates/examples#the-same-from-code) is a whole script: it checks a launch's
values, then draws the image with its fonts and pictures.

| It returns | What it is |
|------------|------------|
| `valid` | Whether nothing is an error |
| `values` | The values as read: defaults filled in |
| `diagnostics` | What it found, each with its `code`, `path` and `message` |
| `review` | Each field's `guidance` and the template's own, for a person to judge. Never an error |
| `rules` | Each required rule: `passed`, `failed` or `not-run` |
| `snapshots` | The checked design, by the format's name (`default` for a template with one size), where it's valid |
| `template` | Its `id` and `version` |

It checks in two steps:

1. **The values**, by their fields: unknown fields, missing required ones, values a field refuses, lists outside their
   counts, and each image's declared size and name against its rules.
2. **The design it builds in each format**, as `validate()` checks any design, and what only the template knows: its
   root and its format's size, its bindings, how each bound image is shown, a slot's content against its limits, and
   the rules over the result.

The second step catches the template's own mistakes, not only bad values: a `contain` image drawn at another aspect
than its file's, say.

`check(element)`, a function imported from `@hyper-elements/react/template`, checks a design whose root is a template
(`<Launch … />`), in its `format` or, without one, in every format, as the command line does.

## Snapshots

A **snapshot** is the checked design, built once and recorded as plain data. `check()` returns one for each format.
`render()`, `validate()`, `prepare()`, `inspect()`, `renderPdf()` and `renderImage()` take one in place of an element,
and never build it again.

So what was checked is what's rendered: a slot's content that would render something else the second time never gets
a second time. Rendering `launch.design()`'s element instead runs a slot's code again, unchecked.

## Measured rules and checkLayout()

Some things can only be known by laying the design out with its real fonts and files: whether fitted text fits,
whether anything runs past the Canvas, whether a font has every character. That's **measuring**, and only a Canvas is
measured. A required rule that needs it is `not-run` after `check()`.

You rarely measure by hand:

| To | Use | What it does with the measured rules |
|----|-----|--------------------------------------|
| Draw the image | `renderImage()` | Measures as it draws, strictly: a missing font or content past the Canvas is an error, not a warning. A required rule that fails rejects, naming the rule |
| Check or render from the shell | The command line | Measures each format, and reports each rule |
| Get the report without drawing | `layoutImage()`, then `checkLayout()` | Returns each image's region, each fitted size and each rule's result. It doesn't draw, and doesn't change the snapshot |

Anything else that writes output from a Canvas's snapshot with a required rule still `not-run` refuses it
(`template/rule-not-run`): `render()`, which writes a Canvas's HTML preview, can't measure, and a rule that didn't
run never counts as passed.

```ts
import { layoutImage } from "@hyper-elements/react/image";
import { checkLayout, sniffImage } from "@hyper-elements/react/template";

// fonts and images: as renderImage() takes them, each as bytes.
const checked = launch.check(values, { format: "square" });
const layout = await layoutImage(checked.snapshots.square!, { fonts, images, scale: 2 });
const report = checkLayout(launch, checked.values, { format: "square", layout, files: { artwork: sniffImage(artworkBytes)! }, checked });
// report: { regions, fits, rules, diagnostics }
```

It takes the checked values (to find each image field), the measured `layout`, each image's `files` where you have
them, and `checked` itself so `rules` comes back whole: what `check()` decided, with the measured ones added.

`checkLayout()` is synchronous and pure. It gives:

| It gives | What it is |
|----------|------------|
| `regions` | Each bound image's box, and the pixels it needs at the scale it's rendered |
| `fits` | Each fitted field's sizes that fit, and the one chosen |
| `rules` | The complete rules: the measured ones a template requires (`image/overflow`, `image/glyph`, `image/fit`) decided, by format |
| `diagnostics` | What it found: each image's file against its declared size, its type and its transparency, and whether it would be upscaled in its region |

- **An image's region is the template's own element** bound to its field. A slot's content that names the field is
  never read as one.
- **It checks image files for the other roots too.** An Email, a Page or a Document has no layout to measure, so to
  check its image files in your own code, give an empty layout and the files:
  `checkLayout(template, values, { layout: { nodes: [], fits: [], diagnostics: [] }, files })`.
## Diagnostics

Every diagnostic has a `code`, a `path` into the values or the design, and a `message` that says what to change. One
on a bound node also names its `field`. Errors make a design invalid; warnings and notes don't.

### The values

| Code | What triggers it |
|------|------------------|
| `template/unknown-field` | A value for a field the template doesn't have. The message names the fields it has |
| `template/required` | A required field isn't given, or required text is empty or only spaces |
| `template/value` | A value its field refuses: the wrong type, text over its `maxLength` or outside its `pattern`, a block of an unknown type |
| `template/count` | A list or blocks outside its `min` and `max` |
| `template/format` | A format the template doesn't have; none named where it has several; or a design built at another size than its format's |

### Images

| Code | What triggers it |
|------|------------------|
| `template/asset-aspect` | The size given is outside the field's `aspect` |
| `template/asset-pixels` | The size given is under `minWidth` or `minHeight`, or the image would be upscaled in its region |
| `template/asset-type` | Its type isn't one the field `accepts`: by its name, or by its file |
| `template/asset-size` | The size given isn't its file's |
| `template/asset-alpha` | Its file's transparency isn't what `transparent` asks |
| `template/asset-unread` (note) | A rule only the file decides (`transparent`, a type its name doesn't give) wasn't decided: the file wasn't read |
| `template/asset-distorted` | A `contain` image is drawn at another aspect than its file's. Size it with `fitInside()` |
| `template/asset-cropped` | A `contain` image is a Layer's base (drawn as a cover), or a `cover` image loses more than `maxCrop` |
| `template/unbound` (warning) | An image field with rules that no node shows with `field` |

### The design and its bindings

| Code | What triggers it |
|------|------------------|
| `template/render` | The template's `render` threw |
| `template/root` | Its `render` returned another root than the template's, or another template |
| `template/unknown-binding` | A `field` that names no field with a value |
| `template/field-path` | A `field` that isn't a field's path (`headline`, `features[1]`, `stories[1].image`) |
| `field/dropped` (note) | A `field` inside a custom element's own render: it's left out |
| `template/not-root` | A template used beside or inside another node, or twice: a template is a design's root |
| `template/not-template` | `check(element)` given a design whose root isn't a template |

### Slots

| Code | What triggers it |
|------|------------------|
| `template/slot-element` | Content uses an element the slot doesn't allow, a root, an `Html` block, or its own definition of a custom element |
| `template/slot-style` | A style or a brand value the slot's `styles` doesn't take: a literal under `"theme"`, any style under `"none"` |
| `template/slot-tokens` | Content sets `tokens` or `theme` |
| `template/slot-attrs` | Content sets `attrs` |
| `template/slot-count` | A type's count is outside the slot's `count` |
| `template/slot-field` (note) | A `field` inside the content: it's the content's own |
| `template/slot-host` | The template places the slot nowhere, more than once, or in a node that isn't bound to it |
| `template/slot-unloaded` | A slot stored as its module, with no capture given in `fragments` |
| `template/slot-twice` | A slot's content given both in the values and in `fragments` |

### Rules over the result

| Code | What triggers it |
|------|------------------|
| `template/link-domain` | A link to a host that isn't in `links.domains` |
| `template/link-param` | A link without a parameter `links.params` requires |
| `template/link-scheme` | A link with a scheme that isn't in `links.schemes` |
| `template/link-relative` | A relative link |
| `template/link-tag` | A link with a sending service's tag: a note for review, or an error with `tags: "deny"` |
| `template/root-prop` | A root prop `rules.root` requires isn't set |
| `template/rule-not-run` | A required rule that didn't run: a note for a measured rule until the image is measured; an error if lint failed, or an output function was given the snapshot first |
| A lint rule's code, `image/overflow`, `layout/overflow`… | A finding of a required rule: an error, its message ending "(required by …)" |

### Fitted text and measuring

| Code | What triggers it |
|------|------------------|
| `image/fit` | Fitted text fits at none of its sizes. The message has the lines it takes and roughly how much to cut |
| `image/overflow` | Content runs past the Canvas |
| `image/glyph` | A character no font given has |
| `image/font`, `image/font-weight` | A family, or a weight, with no font file given |
| `fit/inline` | A run inside fitted text is in another size, font, weight or line height |
| `style/fit` | A `fontSize` written beside `fit`'s `sizes` |

`image/overflow`, `image/glyph` and the font codes are warnings for a design on its own, and errors where it's drawn strictly, as a design made from a template always is. The others are always errors.

### Defining a template

These are thrown by `template()` itself, when the module loads:

| Code | What triggers it |
|------|------------------|
| `template/spec` | A spec that isn't a template's: a bad `id` or `version`, a missing `example`, `fields` beside `design` |
| `template/field-name` | A field named `format`, `key`, `ref` or `children` |
| `template/block-type` | A block type with a field named `type` |
| `template/slot-allow` | A slot's `allow` isn't a list of elements or `"all"` |
| `template/rule-unavailable` | A required rule that lint doesn't have, that's off as lint is configured, or that doesn't run on the template's root |
| `template/plugin` | A plugin in `rules.plugins.other` that's a Promise: await it first |

An [annotated template](/docs/templates/slots#annotated-templates)'s markers have their own:

| Code | What triggers it |
|------|------------------|
| `template/inline-kind` | A marker for a field that isn't text, a link, an image or a slot |
| `template/inline-target` | A marker that isn't on a built-in element |
| `template/inline-content` | A text marker's node holds something other than one string |
| `template/inline-unplaced` | A field in `open` whose marker isn't in `design` |
| `template/inline-unlisted` | A marker in `design` that isn't named in `open` |
| `template/inline-twice` | One marker given two names |
| `template/inline-nested` | A marker inside a slot's host, where the slot's content replaces it |
| `template/inline-hidden` | A marker inside the render of a function or a custom element of your own |

### Values files

| Code | What triggers it |
|------|------------------|
| `template/values-file` | A file that isn't `{ version: 1, template: { module, id, version }, values, … }` |
| `template/id` | A file made for another template |
| `template/version` | A file made with a newer version; a new major with no migration from the file's; or a migration that threw |
| `template/upgraded` (note) | A file made with an older version, read with this one |
| `template/changed` (warning) | The template's module changed under the same version (the command line) |
| `template/asset-changed` (warning) | A file a design recorded changed under the same name (the command line) |

### Snapshots and captured content

| Code | What triggers it |
|------|------------------|
| `jsx/value` | A value that isn't plain data: a function, a class instance |
| `jsx/fragment` | A capture that isn't one: its kind, its version, a node's keys, more than 64 levels deep or 8 MB |
| `jsx/slot-mark` | `slotMark()` used outside a snapshot |
| `builder/snapshot`, `builder/template` | `toDesign()` given a snapshot or a template design: it takes a design's element (`design(values)`) |

The command line's own codes (`cli/…`, `extract/…`) are on [Templates in the command line](/docs/templates/cli#diagnostics).
