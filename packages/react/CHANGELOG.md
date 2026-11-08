# @hyper-elements/react

Versions before 0.3.0 were published as `@unlayer/react-elements`.

## Unreleased

### Phone and hover styles go in `style`

A component's phone and hover styles are blocks of its `style`, typed to what the component takes there. They replace
0.3.0's separate `mobile` and `hover` props.

```tsx
<Heading style={{ fontSize: 32, mobile: { fontSize: 24 } }}>Title</Heading>
<Button href="…" style={{ backgroundColor: "#111827", hover: { backgroundColor: "#374151" } }}>Go</Button>
```

### What's new

- `<Page breakpoints={{ mobile: 600 }}>` sets where a Page's phone styles start (480px where it isn't set).
- Hover styles apply on keyboard focus too. Each hover rule's class name changes.
- More is said about what an output doesn't show: hover in an email (a note: classic Outlook and some apps don't show
  it), and phone styles that were silently ignored (a Page root's phone text styles, a stacking Grid's phone `rowGap`,
  an email Image's or TableCell's phone `border`, an email phone `lineHeight: "normal"`).
- A warning inside a `component()`'s render is said at the component's place, instead of failing the render.

### Email clients in diagnostics

- New: a diagnostic about an Email's problems with particular email clients names them in `clients`, says what to
  change in `fix`, and, where it's known from caniemail.com's tables, links to its page there in `see`. All three are
  optional.
- New: 26 email clients. Four were measured, from captures of the real clients showing 0.3.0 emails (`"outlook"`,
  classic Outlook for Windows; `"outlook-com"`; `"gmail"`; `"apple-mail"`); what's known of the rest is from
  caniemail's tables (`"outlook-mac"`, `"outlook-app"`, `"gmail-app"`, `"gmail-app-other"`, `"yahoo"`, `"aol"`,
  `"samsung-email"`, `"thunderbird"`, `"protonmail"`, `"fastmail"`, `"hey"`, `"gmx"`, `"web-de"`, `"orange"`,
  `"sfr"`, `"laposte"`, `"free-fr"`, `"t-online-de"`, `"mail-ru"`, `"ionos"`, `"wp-pl"`, `"rainloop"`). A problem is
  reported at its own severity for either; only one Elements assumes, unchecked, is a note.
- New: `validate(element, { emailClients })`, `render(element, { emailClients })` and
  `prepare(element, { emailClients })` report problems for the clients named. The default is the clients most email is
  read in: the four measured, Outlook for Mac, the Outlook and Gmail apps, Yahoo, AOL and Samsung Email. `[]` leaves out every email client problem, not the email's own (`email/width`,
  `email/layer`). For a root that isn't an Email the option is ignored, with an `email/clients-ignored` note. An
  unknown client throws a `TypeError`.
- New: `EMAIL_CLIENTS`, what's known of each client, with how closely the four were measured on 0.3.0 emails
  (classic Outlook 0.85 of words within 4px; Outlook.com, Gmail and Apple Mail about 1), and the types
  `EmailClient`, `EmailClientInfo`, `EmailClientMeasurement` and `ValidateOptions`. `DEFAULT_EMAIL_CLIENTS` lists the
  default ones, to report for them and more (`[...DEFAULT_EMAIL_CLIENTS, "gmx"]`).
- Docs: `GUIDE.md` and the agent skill say what an email's warnings name (`clients`, `fix`, `see`) and how to check
  more clients, with a script that renders an email and prints its problems with `formatDiagnostics()`.
- New: `email/phone-styles`, said once for an Email with phone styles or hidden content, for the clients that don't
  apply them on phones (the Gmail app with another account, some webmail): a note, or a warning where something hidden
  on desktop would then show nowhere. What a built-in component hides itself (a Menu's separators) doesn't count.
- New: `email/image-format`, a warning on an Image or a Video's thumbnail whose file is WebP (classic Outlook), AVIF
  or SVG, by its data: type, the format an image CDN is asked for (`?fm=webp`, `f_avif`, which wins over the file's
  extension) or its extension.
- New: `email/html-css`, a note on an Html block whose markup may have CSS or HTML an email client removes
  (`position`, CSS variables, gradients, box and text shadows, flex and grid, opacity, `object-fit`,
  `aspect-ratio`, a `<style>` in the body, newer color syntax, negative margins, `!IMPORTANT` in capitals, rgb()
  with spaces).
- New notes from caniemail's tables: `fontWeight` under 600 (other than 400) and `textTransform: "lowercase"` in
  classic Outlook; `borderRadius` in GMX, WEB.DE and Orange; `textDecoration` lines in the Gmail app with another
  account and some others; a root's `lang` and `dir` where webmail removes them.
- Changed: the note on hover in an email names the clients that don't show it (`clients`), and its message no longer
  does. `email/outlook-degraded` has `clients: ["outlook"]`; `email/font-fallback` names every client that loads no
  web font, and its advice moves from the message to `fix`; the web fonts note (`email/degraded` on `fonts`) names them
  too; `email/size` and `email/style-size` name Gmail and its apps, with a `fix`.
- Changed: `formatDiagnostics()` adds a diagnostic's clients, fix and where to see it to its line, so lines about
  email clients are longer.

### Fixes

- **Email:** a `Button` narrower than its padding no longer draws its label a letter a line in Gmail and browsers. The
  email's `word-break: break-word`, there so a long link in text breaks rather than widen the email on phones, let the
  button size itself to one letter; its label now keeps its words whole (`word-break: normal` on the button's link) and
  the button grows to its longest word, as classic Outlook and Apple Mail already drew it. Found in captures of 0.3.0
  emails in Gmail on the web. Each button's link gains `word-break:normal` in its `style`; nothing else in the HTML
  changes.

## 0.3.0

### ⚠️ Breaking: every template written with Unlayer Elements has to migrate

Hyper Elements is a new package, `@hyper-elements/react`. The old syntax isn't in it, and there's no compatibility mode.
A name in both doesn't mean the code still works: `<Email>` is still there, but `<Email containerPadding={20}>` isn't,
and neither is `renderToHtml()`. `@unlayer/react-elements` stays at 0.2, so nothing changes until you move.

**To upgrade:** run `npx @hyper-elements/migrate src/emails --from unlayer-elements`. It lists what it would change; `--write`
replaces the templates (only those git can restore). It rewrites the imports and the JSX and keeps props, loops and
conditions; what it can't move is listed, and that file is left as it was to rewrite by hand.

| 0.2 | 0.3 |
|---|---|
| `renderToHtml(element)` | `const { html } = await render(element)` |
| `renderToPlainText(element)` | `const { text } = await render(element)` |
| `renderToJson(element)` | `const { design } = toDesign(element)`, from `@hyper-elements/react/builder` |
| `<Row layout="TwoEqual">`, `ColumnLayouts` | A `Row` of `Column`s |
| Styles as props (`backgroundColor="#000"`, `containerPadding`) | `style={{ backgroundColor: "#000" }}`, on the component they belong to |
| `headingType`, `altText` | `level`, `alt` |
| `<Paragraph>`, `ParagraphProps` | `<Text>`, `TextProps` (`ParagraphProps` stays as a deprecated alias) |

Also gone: `Body`, `UnlayerProvider`, `renderToHtmlParts` and the `values` prop. Designs saved in the builder aren't
affected: `fromDesign()` reads them, the older text tool's blocks included.

### What's new

A template has one root (`Email`, `Page`, `Document` or `Canvas`), its styles go in `style={{ }}`, and
`await render(element)` writes its HTML and plain text.

- New: the components, each with typed props and styles: `Section`, `Row`, `Column`, `Grid`, `Heading`, `Text`,
  `Span`, `Link`, `List`, `Button`, `Image`, `Divider`, `Menu`, `Social`, `Video`, `Table`, `Html`, page
  headers, footers and numbers for a `Document`, and shapes for a `Canvas`. `component()` and `prop()` make your own.
- New: `validate()` and `outline()` check a template without rendering it; `render()` returns its diagnostics.
- New: `Html`, markup written as it is (the builder's HTML block), given as `html` or as JSX in it.
- New: `@hyper-elements/react/builder`, `toDesign()` and `fromDesign()`, a template to the Unlayer builder's design
  JSON and back. What a text block's tool has no field for is drawn in the style of its own paragraph, and what else
  a tool has no field for is kept in the design as a hidden property of it; what the builder can't arrange comes back
  with the same look, flatter. `fromDesign()` takes a `toSafeHtml` for a
  design's markup.
- PDF and images: `@hyper-elements/react/pdf` and `@hyper-elements/react/image` write a `Document` as a PDF and
  a `Canvas` as a PNG or SVG, on the server, without a browser. Their engines (`@react-pdf/renderer`; `satori` and
  `@resvg/resvg-js`) are optional peer dependencies: install the ones you use. The main entry loads none.
- The package has no dependencies of its own (React is a peer): `@unlayer/exporters` and `@unlayer/types` are gone.
- Types for the main entry and `/builder` resolve under `moduleResolution: "node"` too.
- Docs: the READMEs, guides, examples and Storybook show the new components.

## 0.1.0

- Initial release
- React components for building emails, pages, and documents
- Server-side rendering support (Node.js, Next.js Server Components)
- Dependencies: @unlayer/exporters, @unlayer/types
