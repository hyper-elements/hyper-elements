---
"title": "Document"
"group": "Roots"
"order": 3
"summary": "A printed document: its children on pages of its size (Document.Page, or split by PageBreaks), a PageHeader and a PageFooter on each. Renders to print HTML, and to PDF with @hyper-elements/react/pdf."
---

A printed document: its children on pages of its size (Document.Page, or split by PageBreaks), a PageHeader and a PageFooter on each. Renders to print HTML, and to PDF with @hyper-elements/react/pdf.

Holds: Section, Row, Column, Box, Grid, Layer, Svg, Text, Heading, Link, Button, Image, Divider, List, Table, Video, Social, Menu, Html, Document.Page, PageBreak, PageHeader, PageFooter.

Props:
- `size`: one of "A3", "A4", "A5", "Letter", "Legal", "Tabloid" (default `"A4"`)
- `orientation`: one of "portrait", "landscape" (default `"portrait"`)
- `margin`: *insets* (default `{"top":48,"right":48,"bottom":48,"left":48}`). Around each page's content (its header and footer too), in px: 96 to the inch.
- `title`: text. The document's title (shown in a browser tab, and by some email clients).
- `lang`: text. Its language, as a BCP 47 tag ("en", "ar").
- `dir`: one of "ltr", "rtl", "auto"
- `fonts`: *fontFaces*. The font files the template loads: a family's file for each weight and style it uses. Text names a family in its fontFamily stack, before the fonts to show where it can't load.

`style`:
- `color`: *color* (default `"#000000"`, inherited, Typography)
- `fontFamily`: *fontFamily* (default `"Arial, Helvetica, sans-serif"`, inherited, Typography)
- `fontSize`: a length (a number of px) (default `16`, inherited, Typography)
- `fontWeight`: *fontWeight* (default `400`, inherited, Typography)
- `fontStyle`: one of "normal", "italic" (inherited, Typography)
- `lineHeight`: *lineHeight* (default `1.5`, inherited, Typography)
- `letterSpacing`: a length (a number of px) (inherited, Typography)
- `textAlign`: one of "left", "center", "right", "justify" (default `"left"`, inherited, Typography)
- `textTransform`: one of "none", "uppercase", "lowercase", "capitalize" (inherited, Typography)
- `backgroundColor`: *color* (Background). Each page's background, out to its edges.
- `gap`: a length (a number of px) (Spacing). Space between children.
- `alignItems`: one of "start", "center", "end", "stretch" (Layout). Where children sit across the layout's direction (vertically in a Row, horizontally in a Column), as CSS align-items. Across a Column it places what has its own size (a Button, an Image, an Svg, a box with a width); a block of text fills the width, so its words move with its textAlign.
