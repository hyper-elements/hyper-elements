# Templates

Ready-made [Hyper Elements](https://hyperelements.dev) designs: emails, web pages, PDFs and images, each one plain JSX
of Elements' own elements. None of them carries a brand: each takes its colors, fonts, logo and company details
from a brand it's given, and is tested in every sample brand for readable text and a layout that fits.

**To use one,** open it on [hyperelements.dev/templates](https://hyperelements.dev/templates), pick a sample brand,
and copy it with its `brand.ts` (or as one file). It imports only Elements' own packages. Put your own brand in
`brand.ts`, and change anything else you like.

**To add one,** see [CONTRIBUTING.md](./CONTRIBUTING.md).

This file is written by `pnpm --filter ./templates readme`. Don't edit it by hand.

## Emails

- [Review received](./emails/airbnb-review.tsx): A guest's review, shown to the host once the review period ends: the logo, the reviewer's photo, their words in a shaded box, a button to reply, and common questions (a recreation of Airbnb's review email, by joaom00)
- [App Store receipt](./emails/apple-receipt.tsx): A subscription's receipt: the order's details in a gray table, the app with its icon and price, the total, an offer, and the fine print (a recreation of Apple's App Store receipt, by zehfernandes)
- [CodePen Challenges](./emails/codepen-challenges.tsx): A weekly challenge: header art on a dark band, a yellow heading, the brief and a boxed challenge, a picture, a PRO panel, how to take part, ideas and resources side by side, and a button to the challenge (a recreation of CodePen's Challenges newsletter)
- [Event invitation](./emails/event.tsx): An invitation: the event's name on a band of the brand's color, when and where, a button to register, and the day's schedule
- [Invoice email](./emails/invoice.tsx): The email that sends an invoice: the amount due, the due date, the lines, and a button to pay online
- [Magic link](./emails/magic-link.tsx): A one-time link that signs the reader in, how long it works, and a note for when they didn't ask
- [Newsletter](./emails/newsletter.tsx): A regular issue: a masthead with the issue and date, a lead story, more stories with thumbnails, a closing note, and an unsubscribe footer
- [It's on its way](./emails/nike-shipping.tsx): An order that has shipped: the tracking number and a button up top, a bold headline, where it's going, the item with its picture, picks for you, and help (a recreation of Nike's shipping confirmation, by zehfernandes)
- [Order confirmation](./emails/order-confirmation.tsx): An order confirmed: its number and date, the items with the total, and where it's going
- [Password reset](./emails/password-reset.tsx): A link to choose a new password, how long it works, and what to do if the reader didn't ask
- [Receipt](./emails/receipt.tsx): A payment receipt that leads with the amount paid, then the items, the total, and how it was paid
- [Shipping](./emails/shipping.tsx): An order on its way: when it should arrive, who's carrying it, a button to track it, and what's in the box
- [Sign-in code](./emails/sign-in-code.tsx): A one-time code, large and centered in a box of its own, with when it expires and what to do if it wasn't you
- [Welcome to Premium](./emails/spotify-premium.tsx): A paid plan that has just started: a big headline, what it gives you, one pill button, the plan and its price, and the apps (a recreation of Spotify's Premium welcome email)
- [Stack Overflow tips](./emails/stack-overflow-tips.tsx): A tips issue: the logo on the page, a banner with the headline beside its art, ruled sections with a list of tips, one button, and a footer with the email's settings and the address (a recreation of Stack Overflow's search tips newsletter, by bruno88cabral)
- [Stripe welcome](./emails/stripe-welcome.tsx): The email once an account can take live payments: the logo, short paragraphs with links into the docs, one button, and the address (a recreation of Stripe's welcome email, by zenorocha)
- [Verify email](./emails/verify-email.tsx): One step before the account is ready: confirm the email address it was made with
- [Welcome](./emails/welcome.tsx): A greeting on a band of the brand's color, three numbered next steps, and one button

## Pages

- [Event page](./pages/event.tsx): An event's web page: its name and tagline on a band of the brand's color, when and where, the schedule, and the speakers

## PDFs

- [Trip receipt](./documents/airbnb-receipt.tsx): A stay's receipt as a PDF: the logo and receipt ID, where and when, the guests, the price night by night with fees and taxes, how it was paid, and the cancellation policy (a recreation of Airbnb's trip receipt)
- [Certificate](./documents/certificate.tsx): A certificate on a landscape page: a double frame, the recipient's photo and name, what they achieved, the date, a seal, and the signer's signature
- [Invoice](./documents/invoice.tsx): An invoice as a PDF: the letterhead, who it's billed to, the lines with their sums, the total due, and page numbers
- [Quote](./documents/quote.tsx): A quote as a PDF: who it's for, the work with its prices, the estimated total, how long it holds, and lines to sign it
- [Receipt](./documents/receipt.tsx): A receipt as a PDF: paid in full, with the items, the total, the date and how it was paid
- [Stripe invoice](./documents/stripe-invoice.tsx): An invoice as Stripe's PDFs lay it out: the title and logo, its numbers and dates, from and bill to, the amount due with a link to pay, the lines, the totals, and a footer on every page (a recreation of Stripe's invoice PDF)
- [Ticket](./documents/ticket.tsx): A ticket as a PDF: the event on a band of the brand's color, who it's for, when and where, and the code to show at the door

## Images

- [Launch graphic](./images/announcement.tsx): A product launch for social posts: the date, a headline fitted to three lines, three features, and the product shown in a window over artwork
- [Product drop post](./images/nike-drop.tsx): A new product for a social feed, 1080 by 1080: a huge headline in capitals, what it is and when, and the product's photo on a pale panel (a recreation of Nike's product drop post)
- [Open Graph card](./images/og-card.tsx): A link preview, 1200 by 630: the title fitted to three lines, the brand's logo and site, and shapes in its colors
- [Speaker card](./images/speaker.tsx): A card announcing one speaker, for social posts: their photo in a circle over shapes in the brand's colors, their name and role, their talk in a block of color, and the event and date
- [Wrapped share card](./images/spotify-wrapped.tsx): A year in listening as a story to share, 1080 by 1920: bold shapes, the minutes listened, the top artists and songs, and the top genre (a recreation of Spotify's Wrapped share card)

## Sample brands

Every design is tested in each of these invented brands. None is a real company.

- **Casa Albero** ([`_brands/casa-albero.ts`](./_brands/casa-albero.ts))
- **Ember** ([`_brands/ember.ts`](./_brands/ember.ts))
- **Keel** ([`_brands/keel.ts`](./_brands/keel.ts))
- **Orbit** ([`_brands/orbit.ts`](./_brands/orbit.ts))
- **Oyen** ([`_brands/oyen.ts`](./_brands/oyen.ts))
- **Pell & Ashby** ([`_brands/pell-ashby.ts`](./_brands/pell-ashby.ts))
- **Pith** ([`_brands/pith.ts`](./_brands/pith.ts))
- **Quarry** ([`_brands/quarry.ts`](./_brands/quarry.ts))
- **Slow Signals** ([`_brands/slow-signals.ts`](./_brands/slow-signals.ts))
