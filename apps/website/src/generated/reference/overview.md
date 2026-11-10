---
title: "Components"
group: "Overview"
order: -1
summary: "Every component, what it holds, and every prop and style it takes."
---

Every component, what it holds, and every prop and style it takes, with its default and what it does. [Templates and roots](/docs/templates) shows how a template is written; `validate()` checks one against what's here.

Every component also takes:

- `style={{ … }}`: the styles listed under it. A number is px (`padding: 16` is `16px`).
- `style={{ mobile: { … } }}`: style overrides on phones, in an `Email` or a `Page`, for the styles listed under "`style.mobile`".
- `style={{ hover: { … } }}`: styles on hover, for the ones listed under "`style.hover`".
- `hidden={{ mobile: true }}` or `hidden={{ desktop: true }}`: shown on one only.
- `id`: an id of your own, written into the HTML.


A template is one of these, and the root decides the output: `render()` writes an Email's HTML, a Page's HTML, and a Document's print HTML. `renderPdf()` (`@hyper-elements/react/pdf`) writes a Document's PDF, and `renderImage()` (`@hyper-elements/react/image`) a Canvas's PNG or SVG (`render()` writes a Canvas's HTML, to look at).


Bands and boxes that arrange blocks. None is required: a root stacks its children.


Content, stacked down whatever holds it.


Inside text: a styled run, a link, a line break, a merge tag.


Only inside the component named: a list's items, a table's rows and cells, a document's pages, header and footer.


Only inside an Svg, in its viewBox's units.


`await render(email, { blockMap: true })` also gives `blocks`, for a tool that previews an Email and needs to know which block of the template it's looking at: `{ version, unit: "utf8", entries: [{ path, nodeId?, offset }] }`.

- Each block written as an element has an entry: its place in the template (`root.children[2]`, as diagnostics give it), its `id` where it has one, and the UTF-8 byte offset in `html` just after its outermost element's tag name (`<table`, `<div`). That's the first element every email client but classic Outlook reads, else its first in Outlook's own markup.
- Entries are in the order of their offsets; at one offset, the outer block comes first. A `LineBreak` and a `MergeTag` have none, nor a `Layer`'s `Image` (drawn as the Layer's background).
- The HTML is the same bytes as without the option. Merge tags are written before the offsets are taken, and the offsets count the whole document, `<head>` included.
- `version` is `BLOCK_MAP_VERSION`, which changes only when this format does.
- Not with `pretty`, which indents the HTML after the offsets are taken (`render/block-map-pretty`). Another root than an Email has no `blocks`.
