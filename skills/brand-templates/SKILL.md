---
name: brand-templates
description: Make an email, a page, a document or an image from a brand template with Hyper Elements, inside the guardrails it sets (fixed parts, typed fields, slots of allowed elements, rules over the result), and write such templates. Use when asked to make a newsletter, a launch graphic or any design from a team's template, to change one value of a design made from one, or to turn a brand brief into a template.
---

# Brand templates

A template (`template()` from `@hyper-elements/react/template`) is a design with fields: what may change, and the rules each value must meet. Everything that isn't a field (the layout, typography, colors, the fixed text and images) is the template's. A design made from one is checked by it, so what passes is on brand.

## Using a template

You fill a template; you never change it.

1. **Read it first.** `npx hyper-elements describe templates/newsletter.tsx --json` lists its formats, every field (its kind, whether it's required, its guidance), each slot's allowed elements, each image's region and the pixels it needs, and the rules. Write within them.
2. **Write the design as TSX**, the template as its root, its fields as props. A TSX design is code a person reviews; where what you write is rendered unreviewed, make a values file instead (`npx hyper-elements design new <template> -o designs/<name>.values.json --values <values>.json`), which runs nothing. Slots are JSX written only with the elements their `allow` lists (and, with `styles: "theme"`, the theme's tokens and named styles):

   ```tsx
   // designs/june.tsx
   import { Column, Heading, Text } from "@hyper-elements/react";
   import Newsletter from "../templates/newsletter";

   export default () => (
     <Newsletter subject="What's new in June" preview="Three updates from the team, and a date for the open house"
       body={<Column><Heading level={2}>Faster exports</Heading><Text>Exports finish in half the time.</Text></Column>} />
   );
   ```

   A template with formats (`square`, `landscape`) gives one output per format; `format="square"` makes one.
3. **Check it, and fix what it says**, by each diagnostic's `field`, `message` and `fix`, until it exits 0: `npx hyper-elements check designs/june.tsx --json`. `review` items are what a person looks at by eye; they never fail the run.
4. **Render it**: `npx hyper-elements render designs/june.tsx` writes `out/designs/june.html` (`june.square.png`, `june.landscape.png` for formats).

Images: give each one the size its region needs (`describe`'s `regions`, at the format's scale). `check` reads each file and fails one that's too small (`template/asset-pixels`), cropped past what the template allows, or the wrong type.

**The values form** is the same design as data, for batches, one-value changes and generated images' provenance:

- `npx hyper-elements design new templates/launch.tsx -o designs/orbit.values.json --values brief.json --set artwork=@art/waves.png --source artwork=source.json` writes `designs/orbit.values.json` once the template accepts it (`@path` reads an image's size, `--source` records where it came from; `--draft` writes an unfinished one).
- `npx hyper-elements design set designs/orbit.values.json launchDate=2026-12-10` changes one value and nothing else; the file stays as it was if the template refuses it. `body=@designs/june.body.tsx` points a slot at a module.
- `npx hyper-elements design new templates/newsletter.tsx --from designs/june.tsx -o designs/june.values.json` turns a TSX design into its values file.
- `check` and `render` take values files as they take designs.

**When the template is in the way, report it.** A value it refuses, a field it doesn't have (`template/unknown-field`), an element a slot doesn't allow, a rule you can't meet: say so, and ask for a change or a new version of the template. Never edit the template, its fixed parts or its rules to get a design past a check, even when you can write the file: templates are reviewed changes, and `template/changed` shows one edited under its version.

In CI, `npx hyper-elements check designs/ --require-template acme.Newsletter` fails anything a template didn't check. The project lists its trusted templates in package.json, `"hyperElements": { "templates": ["templates/**"] }`, so a design can only use those (on Node).

## Writing a template

Start from the brand brief. [`example.tsx`](example.tsx) is a whole one.

1. **Decide each part:** fixed (logos, footer, legal text), a field (`prop.text`, `prop.date`, `field.image` with its fit and minimum size, a list), blocks (`prop.blocks`: a list of approved section types), or a slot (`field.slot`: JSX the filler writes). Give a slot the strictest `allow`, `styles` and `count` that still does the job.
2. **For one size and fields of text, links, images or slots**, write the design and mark what's open with `open()`; otherwise `fields` and `render(values, { format })`. From a design a person approved, give each part that changes an `id` and extract it: `npx hyper-elements template extract designs/orbit.tsx --id acme.LaunchGraphic --field headline --field artwork -o templates/launch-graphic.tsx` (a computed value is reported, and nothing is written).
3. **Write the rules the brief asks for**: lint's (`require.lint`: `unsubscribe`, `link-text`, `lang`, `contrast`), core's (`layout/overflow`; a Canvas's `image/fit`), the links' domains (`links.domains`), the hosts images load from (`images.domains`), the root's props. Write `guidance` where a value needs judgment.
4. **Write `example`**: every required field, and the slots' content as a filler would write it.
5. **Check it**: `npx hyper-elements check templates/newsletter.tsx` renders `example` in every format and runs every rule. Fix what it says: a rule that can't run (`template/rule-unavailable`), a slot placed twice or not at all (`template/slot-host`).
6. **Compare `describe` with the brief**: `npx hyper-elements describe templates/newsletter.tsx`. It's what a filler sees; a guardrail missing there is missing. `check` can't tell you a rule the brief asks for isn't there.
7. **Version it**: set `version`, and bump it on every change once it's in use, a change to a theme or anything else it imports included. A major version takes `migrate` to read older designs.

Never weaken a rule or a slot policy so content passes: change the template only when the brief does. Keep what a template imports (its theme, its own elements and functions, its example's parts) beside it, in the folders the project trusts.
