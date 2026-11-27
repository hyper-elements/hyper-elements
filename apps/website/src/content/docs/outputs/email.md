---
title: "Email"
description: "What the email writer produces from an Email root. Tables with px widths, Outlook's markup in conditional comments, phone styles, preview text and known limits."
---

An `<Email>` root renders to email-safe HTML: tables with px widths, inline styles, and Outlook's markup in conditional comments. You write the layout once in elements, and the writer handles the client quirks.

```tsx
import { Column, Email, Text, Row, render } from "@hyper-elements/react";

const { html, text } = await render(
  <Email previewText="Two columns" title="Hi">
    <Row style={{ gap: 16 }}>
      <Column><Text>Left</Text></Column>
      <Column style={{ width: 180 }}><Text style={{ mobile: { fontSize: 14 } }}>Right</Text></Column>
    </Row>
  </Email>
);
```

## The rules it writes by

1. **Right without `<style>`.** Layout at desktop width, colors, fonts, sizes and spacing are inline. The stylesheet only adds phone styles, hiding, hover and client resets. Gmail drops `<style>` for some accounts, and the email still holds its desktop layout.
2. **Widths are decided before writing.** Every table, cell and image gets a px width attribute from the layout resolver. Outlook's Word engine sizes by attributes and ignores the sizes of `div`s.
3. **Tables for layout**, with `role="presentation"`, no spacing and no borders. Spacing is cell padding.
4. **Outlook-only markup only inside `<!--[if mso]>`**, and nothing other clients need inside one.

## What you get

The document is the Unlayer editor's email shell: an XHTML doctype, Office settings for Outlook, `x-apple-disable-message-reformatting`, `X-UA-Compatible`, `-webkit-text-size-adjust`, `color-scheme`, a `border-collapse` reset, and the preview text. The content sits in a full-width table with the window's background, inside a centered table of the content's width. The language, direction and background are also on a `role="article"` wrapper, since Gmail drops `<html>` and `<body>`.

How each element is written:

| Element | In the email |
|-----------|--------------|
| `Section` | A full-width row with its background, its content at the content width inside it |
| `Row` | Each child an inline-block `div`, with an Outlook-only table of the same widths in conditional comments. With `stackOnMobile={false}`, a table row |
| `Column` and other boxes | A one-cell table around the content (Word has no box on a `div` or `p`), its children as table rows |
| Text blocks | The semantic tag with `margin:0`, every text style on it (Outlook doesn't pass styles down through tables), and line heights in px with `mso-line-height-rule: exactly` |
| `Button` | A one-cell table: background, border and corners on the cell, the padding on the link so all of it is clickable, and as the cell's `mso-padding-alt` for Outlook |
| `Image` | An `<img>` with a px `width` attribute, fluid elsewhere (`width:100%` up to its width), its height in proportion when the file's size is known |
| `Divider` | A table with a top border and an empty cell Word can't make taller |
| `List` | A table: an item a row, its marker right-aligned in a cell of the indent's width, with `role="list"` and `"listitem"` |
| `Table` | A data table with fixed layout: column widths in a `colgroup` and on each cell, header rows in `thead` with `th` |
| `Span` | A `<span>`, or `<sup>` and `<sub>` with no line height of their own, so a line keeps its height |
| `Video` | Its thumbnail, linked to the video. An email can't play one |

The Button is a table, not VML: captures of classic Outlook show Word drawing a VML button's label in its own font, wrapped inside the shape's fixed size.

## Rows that stack without media queries

A Row is written "fluid hybrid": each child is an inline-block as wide as its desktop width at most, and 100% otherwise. The children sit side by side where there's room and stack where there isn't, without a media query, so they stack in clients that ignore `<style>` too. Outlook gets a table of the same widths inside conditional comments.

The stylesheet adds the rest for phones: a stacked child goes full width, and your `mobile` styles apply. In an email, phones are below the content width plus 20px, so a 600px email's phone rules apply at 620px and narrower.

## Preview text

`previewText` is shown after the subject in inbox lists, not in the email. It's written as a hidden block at the top of the body, and left out of the plain text.

## Merge tags

A `MergeTag` is written in your sending service's syntax, `{{name}}` by default, in the HTML and the plain text. A link's `href` can be a merge tag too. See [Rendering](/docs/rendering#merge-tags).

## Fonts

Web fonts in `fonts` are written as `@font-face` rules where classic Outlook doesn't read them, so Outlook draws the next font in the stack. Apple Mail and iOS Mail load web fonts. Gmail and classic Outlook don't. End every stack on a font the client has: `"Inter, Arial, sans-serif"`. See [Styles](/docs/styles#fonts).

## Size budgets

Gmail clips a message after about 100 KB of HTML, and reads 16 KB of a `<style>`. `@hyper-elements/email-clients`' plugin warns about both when it's passed to `render()` (`email/size`, `email/style-size`).

## Seeing it in the clients

The email client emulator, `renderInEmailClients()` from `@hyper-elements/email-clients`, shows the email as each email client shows it, as HTML files you open in a browser, with what each client changed listed. Nothing is sent or uploaded. See [Email client emulator](/docs/email-client-emulator).

## A Canvas

A `Canvas` in an email is a picture: a banner, a chart or a badge, laid out as any Canvas is, drawn as a PNG file the email links to. An `Svg` on its own in an email is a picture too. Email clients drop inline SVG (Gmail, Outlook, Yahoo) and images given in the email as `data:` URIs (every Gmail), and classic Outlook shows a hosted SVG as a broken image, so every client gets the same PNG, at twice its size. Say where the files are hosted, and give the fonts its text is in, with `render()`'s `assets` option. Upload the files it returns before you send:

```tsx
import { render } from "@hyper-elements/react";
import { emailImages } from "@hyper-elements/react/image";

const { html, files } = await render(<Launch />, {
  assets: {
    baseUrl: "https://cdn.example.com/email/",
    draw: emailImages({
      fonts: [
        { family: "Inter", src: interRegular },
        { family: "Inter", src: interBold, weight: 700 },
      ],
    }),
  },
});
for (const file of files ?? []) await upload(`email/${file.name}`, file.bytes, file.contentType);
```

```tsx
<Section>
  <Link href="https://example.com/launch">
    <Canvas width={552} height={240} alt="Launch night: doors at 8" style={{ backgroundColor: "#1e1b4b", color: "#ffffff", fontFamily: "Inter", padding: 32 }}>
      <Heading>Launch night</Heading>
      <Text>Doors at 8</Text>
    </Canvas>
  </Link>
  <Text>Bring a friend: tickets are at the door.</Text>
</Section>
```

- **It's drawn as a Canvas.** Its text takes the text styles and fonts of where it is in the email. `emailImages()` draws with Satori and resvg: install the image entry's optional peers, `satori` and `@resvg/resvg-js`, as for `renderImage()`. Nothing is fetched: give the file of each font its text is in (`fonts`: TTF, OTF or WOFF) and of each image in it (`images`, by URL). A web font the email loads (its `fonts`) that the picture's text is in, without its file here, or a character no font given has, is an error (a picture with no text in it, as an icon, needs no font's file). Text in another family whose file isn't given (a system font, as Georgia) is drawn in the first font given, with a warning. Text in a script written right to left (Hebrew, Arabic) is an error: an image draws it left to right, so keep it in a `Text` beside or over the picture. Text that runs past the picture is a warning, as for any Canvas.
- **Each file is named by what's drawn and what draws it**: the scale, the fonts and images, and the versions of Elements, Satori and resvg. The same picture is the same file, and a name never changes what it shows, so cache the files for good.
- **Where images don't load** (classic Outlook doesn't load them by default), it shows its `alt` on its background color, in a color that reads on it. Give a Canvas with text an `alt` that says what it says, and a `backgroundColor`: a transparent picture's dark text can vanish in a dark mode.
- **Put it in a `Link` to link it** (an Svg, in a Canvas in the Link). A link inside it is part of the picture, and can't be clicked.
- **Keep body copy in `Text`.** Text in a picture doesn't show where images don't load, can't be selected or found, and scores worse with spam filters. A `MergeTag` in a picture would be drawn as written, never filled in: that's an error.
- **Make it no wider than its column.** Phones and most clients shrink it to fit, but classic Outlook shows it at its width.

Without `assets`, `render()` rejects an Email with a Canvas or an Svg (`email/canvas-assets`), saying what to pass. `validate()` doesn't need them. In the Unlayer builder, `toDesign()` takes the same `assets`: each picture is an image linking the same file (see [Visual editor](/docs/guides/visual-editor#what-the-builder-holds)).

## What email can't do

`validate()` tells you each of these for your design, with the path; the ones about particular clients come from `@hyper-elements/email-clients`' plugin:

- **An image in the email as a `data:` URI.** Every Gmail drops it. Host the file and link to it. The plugin warns (`email/image-data`).
- **Layer.** An email draws one shape of it: an Image as wide as the Layer, with one child over it. The image is the cell's background, with VML for Outlook.
- **`justifyContent: "space-between"`.** The children start at the left.
- **Rounded corners and letter spacing in classic Outlook.** Corners are square, and letter spacing is normal. The plugin notes it (`email/outlook-degraded`).
- **A Vimeo video's thumbnail.** It can't be found without the network, so give the `Video` a `thumbnail`.
- **An Image without its file's size.** Outlook shows it at the file's size, however wide that is. Give `src` its `width` and `height`.

There are no dark-mode styles yet. The head declares `color-scheme` as light.

## How it's checked

- Unit tests of each element's markup.
- A hostile-input test: user text, links and font URLs with markup in them add no element or attribute, including inside Outlook's comments.
- Chromium tests that every box is as wide as the layout says on desktop, with and without the stylesheet, that Rows stack on phones either way, that hover, fonts and superscripts work, and that Row widths match the page in every min, max and gap case.
- Checks against a model of classic Outlook's layout, built from captures of real Outlook, at 96 and 192 DPI.

> **Warning:** Chromium and a model of Outlook aren't email clients. The output hasn't been checked in real email clients yet, and button padding through `mso-padding-alt` hasn't been measured in real Outlook. Send tests to the clients your users have before you rely on a layout.

The layout doesn't measure text, either. A box with less room than its words needs looks different in email, where the table cell widens to its longest word, than on a page. See [Layout](/docs/layout#how-widths-are-worked-out).
