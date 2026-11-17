---
title: "Templates"
description: "Reusable designs with guardrails: locked parts, typed fields, blocks and slots with their limits, and a check of the result before anything is rendered."
---

A template is written once, by your team: the brand's parts are locked, and a few parts are left open. People and
agents make designs from it by filling the open parts, and the template checks each one before anything is drawn. It's
`@hyper-elements/react/template`, and it runs wherever a design does: no service, account or engine of its own.

<div class="output-gallery">
<figure><a href="/generated/templates-guide/orbit-square.png" title="Open the square launch graphic at full size"><img src="/generated/templates-guide/orbit-square.png" width="1080" height="1080" alt="The square launch graphic: Orbit's logo, the launch date, the headline and three features, and the product screenshot in a window over a panel of bold, colorful shapes"></a><figcaption>square, 1080×1080</figcaption></figure>
<figure><a href="/generated/templates-guide/orbit-landscape.png" title="Open the landscape launch graphic at full size"><img src="/generated/templates-guide/orbit-landscape.png" width="1200" height="630" alt="The landscape launch graphic: the same copy on the left, and on the right the product screenshot in its window over the same shapes"></a><figcaption>landscape, 1200×630</figcaption></figure>
</div>

Both images came from one template and one set of values. [Template examples](/docs/templates/examples) builds
that template step by step, and three more: an email with a locked header and footer around an open body, a
newsletter whose body takes only what the brand allows, and an invoice filled from data. Every option is in the
reference:

- [Values: fields, images and formats](/docs/templates/fields)
- [Content: slots and blocks](/docs/templates/slots)
- [Rules, checks and diagnostics](/docs/templates/rules)
- [Templates in the command line](/docs/templates/cli)

## What a template is

<figure class="diagram"><a href="/generated/templates-guide/parts.svg" title="Open the diagram at full size"><img src="/generated/templates-guide/parts.svg" width="884" height="486" alt="The square launch graphic with its parts outlined. The logo is locked. The headline, the three features, the launch date, the screenshot and the artwork are open fields. Everything else (layout, colors, fonts, sizes) is locked."></a></figure>

- **Locked parts** are the template's: the logo, the layout of each format, the colors and the fonts. No value can
  change them.
- **Open parts** are what a design gives. Here they're six **fields**, each with its limits: the five outlined, and
  the language, which has nothing to outline. A template can also open **blocks** (approved section types, picked and
  ordered as data) and **slots** (JSX someone writes, with only the elements and styles the template allows).
- **Rules over the result** are checked on the finished design: here, that nothing runs past the Canvas, every
  character has a font, and the headline fits.

A **design** is one finished piece: this launch's graphic, this month's newsletter. Any Email, Page, Document or
Canvas is a design. One made from a template is checked by it.

## The parts, one at a time

A template has six kinds of part. Four hold what a design gives (a field, an image field, blocks, a slot), one sets
the sizes it's made in (formats), and one checks the result (rules):

<div class="concept-grid">
<a class="concept" href="/docs/templates/fields#fields"><img src="/generated/templates-guide/concept-field.svg" width="600" height="400" loading="lazy" alt="The launch graphic with only its headline lit and outlined: a field"><strong>Field</strong><span>One typed value a design gives: text, a date, a number, a choice, a list.</span></a>
<a class="concept" href="/docs/templates/fields#image-limits"><img src="/generated/templates-guide/concept-image.svg" width="600" height="400" loading="lazy" alt="A product screenshot at 1.6 to 1 marked taken, and a banner at 4 to 1 marked refused: an image field's rules"><strong>Image field</strong><span>A picture, with limits on its shape, size and type.</span></a>
<a class="concept" href="/docs/templates/fields#formats-and-the-example"><img src="/generated/templates-guide/concept-format.svg" width="600" height="400" loading="lazy" alt="The launch graphic as a square image and as a landscape image: two formats"><strong>Format</strong><span>The same design at another size, from the same values.</span></a>
<a class="concept" href="/docs/templates/slots#slots"><img src="/generated/templates-guide/concept-slot.svg" width="600" height="400" loading="lazy" alt="An email with only its body lit and outlined: a slot"><strong>Slot</strong><span>A region someone writes freely, as JSX, inside limits the template sets.</span></a>
<a class="concept" href="/docs/templates/slots#blocks"><img src="/generated/templates-guide/concept-blocks.svg" width="600" height="400" loading="lazy" alt="Two emails made of the same three section types, story, quote and button, in different orders: blocks"><strong>Blocks</strong><span>Approved sections, picked and ordered as data.</span></a>
<a class="concept" href="/docs/templates/rules#rules-over-the-result"><img src="/generated/templates-guide/concept-rule.svg" width="600" height="400" loading="lazy" alt="An email whose button links to another company's site, the button outlined in red and the email refused: a rule"><strong>Rule</strong><span>Something that must hold on the finished design, whatever filled it.</span></a>
</div>

## Which one do I need?

| You want | Use | Whoever fills it gives |
|----------|-----|------------------------|
| A value to change: a headline, a date, a price | A [field](/docs/templates/fields#fields) | Data |
| A picture to change, kept to a shape and size | An [image field](/docs/templates/fields#image-limits) | An image file |
| The same design at several sizes | [Formats](/docs/templates/fields#formats-and-the-example) | Nothing more: the same values |
| Sections chosen from a set you approve | [Blocks](/docs/templates/slots#blocks) | Data: each section's type and its values |
| Content someone writes, in your look or freely | A [slot](/docs/templates/slots#slots) | JSX |
| Something that's always true of the result | A [rule](/docs/templates/rules#rules-over-the-result) | Nothing: the template checks it |

Start with fields. Reach for blocks when the sections vary, and for a slot only when the content can't be listed ahead
of time: the more a template leaves open, the more its rules have to carry.

All four open parts are declared the same way, in the template's `fields`. Blocks and slots are listed apart here
because what they hold is content, not one value.

## What each root takes

Every part works in an Email, a Page, a Document and a Canvas, except formats. What differs is how much the template
can check:

| Part | Email | Page | Document | Canvas |
|------|-------|------|----------|--------|
| Field | Yes | Yes | Yes | Yes |
| Image field | Yes. Its shape, size and type are checked. Its file is read only where it sits beside the design, not at a URL | Yes, as in an Email | Yes. The command line reads its file | Yes, and measured where it's drawn: an image that would be upscaled is refused |
| Format | Not needed: one width, which phone styles adapt | Not needed: it fits the window | Page sizes: A4, Letter | Image sizes: square, landscape |
| Slot, blocks | Yes | Yes | Yes | Yes |
| Rules | Links, layout overflow, and lint's rules for an email: an unsubscribe link, preview text, contrast, alternate text | Links, layout overflow, and lint's rules for a page: a title, headings in order, contrast, alternate text | Links, layout and page overflow | Links, and what measuring decides: fitted text, overflow, a font for every character |

## What you need

| To | Install |
|----|---------|
| Write templates and designs | `@hyper-elements/react`, with `react` and `react-dom`. Templates are its `/template` entry |
| Run the commands on these pages | `@hyper-elements/cli`, which gives `npx hyper-elements` |
| Require lint's rules in a template | `@hyper-elements/lint` |
| Have email client checks reported | `@hyper-elements/email-clients` |
| Draw a Canvas as an image | `satori` and `@resvg/resvg-js` |
| Draw a Document as a PDF | `@react-pdf/renderer` |

```bash
npm i @hyper-elements/react react react-dom
npm i -D @hyper-elements/cli
```

## How it's used

1. **Write the template** once: `template({ … })`, with its fields, its rules and a `render` that builds the design.
2. **Make a design** from it: a values file (the design as JSON, which `design new` writes), or TSX with the template
   as its root.
3. **Check it.** The template checks the values, the design they build, and what can only be known by measuring it.
4. **Render it.** One output per format, and nothing for a design that fails.

```bash
npx hyper-elements design new templates/launch-graphic.tsx -o designs/orbit.values.json \
  --values brief.json --set screenshot=@designs/art/screenshot.png --set artwork=@designs/art/shapes.png
npx hyper-elements check designs/orbit.values.json
npx hyper-elements render designs/orbit.values.json
```

[Template examples](/docs/templates/examples) runs each step on four templates, with what every command
wrote and what each template refuses, and does the same [from code](/docs/templates/examples#the-same-from-code).

## What template() takes

A template is a module whose default export is `template({ … })`:

| Key | What it is |
|-----|------------|
| `id` | A namespace, a dot and a capitalized name: `acme.LaunchGraphic` |
| `version` | Semver. A values file records the version it was made with. Raise it when the template changes: an older file is read again, and migrated across a major version |
| `label`, `guidance` | Its name for people, and advice in plain English for whoever fills it. Guidance is never enforced: it's listed for a person to judge |
| `root` | What it makes: `"Email"`, `"Page"`, `"Document"` or `"Canvas"` |
| `formats` | Its named sizes, for a Canvas or a Document. See [formats](/docs/templates/fields#formats-and-the-example) |
| `fields` | What's open: [values and images](/docs/templates/fields), [blocks and slots](/docs/templates/slots) |
| `rules` | What must hold on the finished design. See [rules](/docs/templates/rules#rules-over-the-result) |
| `example` | A full set of values. Required: it's checked with the template, and it's what whoever fills the template is shown |
| `render(values, { format })` | Builds the design from the values. Whatever it writes that isn't a field is locked |
| `migrate` | For each major version, how an older values file's values become this one's. See [values as data](/docs/templates/fields#values-as-data) |

A simple template can instead be written as the design itself, with its open parts marked:
[annotated templates](/docs/templates/slots#annotated-templates).

## Keeping templates trusted

A template guarantees what it checks, not who may edit it: a process that can write the template's file can change
it. Two things follow.

- **Protect the templates.** Commit them, review changes to them (with CODEOWNERS, for example), and don't give
  whatever fills them write access to the templates folder.
- **Know which designs are code.** A values file is data: nothing in it runs, so it's the form to take from an agent
  or anyone unreviewed. A TSX design, and a slot stored as a module, are code that runs before the template checks
  anything. Review those as you review any code.

[Templates in the command line](/docs/templates/cli#trusted-templates) shows how to list the templates a project
trusts, and what `--require-template` does and doesn't guarantee.
