# Contributing templates

This folder holds templates anyone can copy: emails, web pages, PDFs and images, each a design written in plain
Hyper Elements JSX. You're welcome to add yours.

Every design here works in any brand. It sets the layout and the words, and takes its colors, fonts, logo and company
details from a brand it's given. The website shows each one in the sample brands, and people copy it with their own.

## What you can contribute

- **A design:** an email, a page, a PDF or an image, for a job in `_categories/`. Most contributions are designs.
- **A category:** a job the list doesn't have yet.
- **A sample brand:** an invented one that covers a look the others don't.
- **A recreation:** a faithful rebuild of something a real company makes, in its own brand.

To ask for one rather than write it, open an [issue](https://github.com/hyper-elements/hyper-elements/issues/new).

## How the folder works

```text
templates/
  emails/            one file per design: emails/sign-in-code.tsx
  pages/
  documents/         PDFs: documents/invoice.tsx
  images/            images: images/og-card.tsx
  _brand.ts          the Brand type, the tokens a design may use, and checkBrand()
  _brands/           the sample brands
  _companies/        a real company's brand, for its recreations
  _categories/       the jobs: one file each
  _assets/           fonts, and the brands', designs' and companies' images
```

- **A design's folder says what it makes:** an email, a web page, a PDF (`documents/`) or an image. Its `meta` says
  its job (`category`). `.preview/`, `.single/` and `node_modules/` aren't committed.
- **A design's name** is lowercase words joined by hyphens, for what it is. The first design for a category can take
  the category's name (`documents/invoice.tsx`); the next one says what sets it apart (`documents/invoice-studio.tsx`,
  or `documents/stripe-invoice.tsx` for a recreation).

## Before you start

1. Read [Designs](https://hyperelements.dev/docs/designs) in the docs: roots, elements, styles and themes.
2. Pick its category from `_categories/`, or from the list in [README.md](./README.md) and below.
3. Look at the other designs for that category on [hyperelements.dev/templates](https://hyperelements.dev/templates).
   Yours should look clearly different, not only in color, since the brand sets the colors.

## Write a design

A design is a component that takes a brand and returns its root, with real words in it:

```tsx
import { Column, Document, Heading, Image, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = { label: "Invoice", category: "invoice", description: "An invoice as a PDF, with its lines in a table" };

export default function Invoice({ brand }: { brand: Brand }) {
  return (
    <Document size="A4" theme={brand.theme} fonts={brand.fonts} lang={brand.lang ?? "en"} dir={brand.dir}>
      <Document.Page>
        <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
          <Image src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }} alt={brand.logo.alt} style={{ width: 140 }} />
          <Heading level={1}>Invoice INV-0417</Heading>
          <Text style={{ color: token("colors.muted") }}>From {brand.name}, {brand.address}</Text>
        </Column>
      </Document.Page>
    </Document>
  );
}
```

The website gives it to copy as it is, with the brand moved to a `brand.ts` beside it, or as one file. The rules
every design follows:

- **No colors or fonts of its own.** Use the brand's tokens: `token("colors.primary")`, `token("fontSizes.small")`.
  `_brand.ts` lists the ones you can use (`CONTRACT`). Heading sizes and weights come from the brand too.
- **Draw text only in the brand's pairs:** `foreground`, `muted` or `primary` on `background` or `surface`, and
  `primaryForeground` on `primary`. Text inside a Layer needs a background color set on its own box, and text that's
  fitted to its box always needs a 4.5:1 contrast, whatever its largest size.
- **Take everything about the company from the brand:** its name, address, logo and links. Pass its fonts, language
  and direction to your root, and write links on its site (`` `${brand.links.site}/billing` ``), so they're on the
  brand's own domain in every brand.
- **Say what it is** in `meta`: its `label`, its `category` and a one-sentence `description`, and your name as
  `author` (it's "Hyper Elements" where it isn't set).
- **Import only** React, `@hyper-elements/react` and `_brand.ts` (for its types). Don't rename imports. Export your
  design as the default, a component taking `{ brand }`, and its `meta`. That's what lets the website give your
  design as files anyone can copy.
- **Make it work everywhere it's shown:** on phones, as plain text, with a screen reader, and in a dark brand as well
  as a light one. An email or a page passes lint's `contrast`, `text-size`, `link-text` and `alt-text`; nothing is
  wider than its layout; an image's text fits its box.
- **Use invented sample words,** never real people's names or details.
- **Keep it evergreen:** no years, and no weekday with a date. Write "March 31", not "March 31, 2026" or
  "Tuesday, March 31" (a weekday is right for a date only in some years), and "© Acme", not "© 2026 Acme".
- **No `Html` blocks.** Raw markup can't be checked for brand colors, contrast or alternate text.
- **Images** you add must be yours to share, or under a license that lets anyone use them. They go under
  `_assets/images/`, each with a name no other image has, and are named by their URL under
  `https://hyperelements.dev/generated/gallery/assets/images/`; no other image addresses are allowed. Use PNG or JPEG files: some email clients don't show WebP or SVG, and a PDF
  can't draw an SVG. A recreation's images are the exception: see "A recreation".

A design has one size. To make another (a square image beside a landscape one), add it as its own design, with a
name of its own. Each design is one file, so it can be copied on its own.

## A new category

Copy an existing file in `_categories/` and fill it in. Its export is the category's name in camel case
(`signInCode` for `sign-in-code.ts`):

- `group`: one of Account, Billing, Orders, Launches, Content, Events, Social, People, Records, Marketing
- `label`
- `roots`: which outputs the job makes sense for
- `useWhen` and `avoidWhen`: one sentence each, for people and agents choosing

Name it for what the reader gets or does (`sign-in-code`, not `otp`), never for its output (`invoice`, not
`invoice-pdf`). Different sizes of the same thing are the same category.

These names are agreed, so a pull request can add one of them as it is: welcome, verify-email,
sign-in-code, magic-link, password-reset, security-alert, invoice, receipt, quote, statement, payment-failed,
trial-ending, subscription-changed, order-confirmation, shipping, delivered, refund, packing-slip, shipping-label,
announcement, changelog, waitlist, landing, pricing, newsletter, digest, article, og-card, thumbnail, event, ticket,
speaker, social-post, quote-card, testimonial, stat-card, job-post, invitation, mention, comment, feedback-request,
certificate, report, letter, contract, proposal, resume, promotion, ad, re-engagement. Any other name, or a new root
for an existing category, needs a maintainer's approval in the pull request, with a reason no category does that job.

## A recreation

A recreation rebuilds something a real company makes (an email, a page, a document, an image) in the company's own
look. It takes a brand like any other, so anyone can use the layout with their own brand, and the company's brand is
used only for the company's recreations. It adds:

- the company's brand in `_companies/<company>.ts`, one declaration like a sample brand's, if it isn't there yet
- `meta.recreates`: the company, what it rebuilds (as it reads after "a recreation of Stripe's"), and where the original can be seen, either a public archive of it
  or your screenshot under `_assets/companies/<company>/`

  ```ts
  export const meta = {
    label: "Welcome",
    category: "welcome",
    description: "…",
    recreates: { company: "stripe", what: "welcome email", original: "https://…" },
  };
  ```

The rules:

- **Only what the company really makes.** Rebuild a kind of email, page, document or image the company sends or
  publishes, as close to its own as you can. No made-up kinds in a real company's brand, and no lookalike companies.
- **Each design in a category,** like any design, or bring the category.
- **Logos and images only as they appear in the company's own work,** saved under `_assets/companies/<company>/`.
- **No names or details of real people.** Sample words are invented.
- **Every check still passes,** in the company's brand and in every sample brand. There are no exceptions: if the
  original fails one, such as low contrast, adjust the company brand's color until it passes, and say so in
  `meta.recreates`.
- **The company's brand may hold extra tokens** where the original needs a color the contract doesn't have. A design
  reads one with a fallback to a contract token (`brand.theme.colors.highlight ?? brand.theme.colors.accent`), so the
  sample brands still work.

A recreation is taken down if its company asks, with no discussion: an
[issue](https://github.com/hyper-elements/hyper-elements/issues/new) naming it is how.

## A sample brand

Sample brands are invented: no real companies, and nothing that looks like one. A new brand should cover a look the
others don't (`_test/range.test.ts` prints how they differ). It's one declaration of literals,
`export const brand: Brand = { … }`, importing only `defineTheme` and the `Brand` type, with every token in
`CONTRACT`, text pairs of at least 4.5:1, and its fonts as TTF or OTF files under `_assets/fonts/` (with their
licenses). Draw its logo with `pnpm --filter ./templates logos`.

## Check your work

```bash
pnpm install
pnpm build
pnpm --filter ./templates typecheck
pnpm --filter ./templates test
pnpm --filter ./templates preview documents/invoice
```

`pnpm build` builds the packages the designs import; run it again after you change one.

- `test` checks every design in every sample brand: it renders it, checks its colors and fonts come from
  the brand, its text is readable, its layout fits, it shows no other brand's name, and its copyable files work on
  their own.
- `preview` draws your design in every brand into `templates/.preview/`; open its `index.html`. Name a folder
  (`emails`) to draw all of its designs, or nothing to draw them all.

Then record what your design adds, and commit all of it with your pull request:

```bash
UPDATE_TEMPLATES=1 pnpm --filter ./templates test
pnpm --filter ./templates readme
pnpm --filter @hyper-elements/website generate:gallery
```

The first records your design's output, the second updates this folder's `README.md`, and the last writes the
website's previews and copyable files for it.

## Open a pull request

Tick each item:

- [ ] Each design is one file in its root's folder, named as above.
- [ ] Each design is in a category that takes its root, and says its `label`, `category` and `description` in `meta`.
- [ ] No colors, fonts or company details of its own; only the brand's.
- [ ] `pnpm --filter ./templates typecheck` and `test` pass, and the output, `README.md` and the website's files are
  regenerated and committed.
- [ ] I looked at every design in the preview, in light and dark brands.
- [ ] Sample words are invented. Images are mine to share or openly licensed, or, for a recreation, as in the
  original.
- [ ] A new category, or a new root for one, has a maintainer's approval; a listed category doesn't need it.
- [ ] For a recreation: only what the company really makes, with where the original can be seen, and its images as
  in the company's own work.

A maintainer reviews it for a look that's clearly different from the other designs for the same category.

By contributing, you agree your contribution is released under this repository's MIT license. Images, and a
recreation's brand, belong to their owners.
