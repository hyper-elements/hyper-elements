# Templates

Ready-made [Hyper Elements](https://hyperelements.dev) designs: emails, web pages, PDFs and images, each one plain JSX
of Elements' own elements. None of them carries a brand: each takes its colors, fonts, logo and company details
from a brand it's given, and is tested in every sample brand for readable text and a layout that fits.

**To use one,** open it on [hyperelements.dev/templates](https://hyperelements.dev/templates), pick a sample brand,
and copy it with its `brand.ts` (or as one file). It imports only Elements' own packages. Put your own brand in
`brand.ts`, and change anything else you like.

**To add one,** see [CONTRIBUTING.md](./CONTRIBUTING.md).

This file is written by `pnpm --filter ./templates readme`. Don't edit it by hand.

## By category

### Account

- **Magic link** (`magic-link`): A one-time link that signs the reader in without a password.
  - [Magic link](./emails/magic-link.tsx), as an email
- **Password reset** (`password-reset`): A link to choose a new password, after someone asked to reset theirs.
  - [Password reset](./emails/password-reset.tsx), as an email
- **Sign-in code** (`sign-in-code`): A one-time code the reader types to sign in or to confirm an action.
  - [Sign-in code](./emails/sign-in-code.tsx), as an email
- **Verify email** (`verify-email`): A link that confirms an email address belongs to the person who signed up with it.
  - [Verify email](./emails/verify-email.tsx), as an email
- **Welcome** (`welcome`): The first email after someone signs up: a greeting, a few next steps and one button.
  - [Welcome to Premium](./emails/spotify-premium.tsx), as an email: a recreation of Spotify's Premium welcome email
  - [Stripe welcome](./emails/stripe-welcome.tsx), as an email: a recreation of Stripe's welcome email, by zenorocha
  - [Welcome](./emails/welcome.tsx), as an email

### Billing

- **Invoice** (`invoice`): A bill the reader has to pay: what it's for, how much, and when it's due.
  - [Invoice email](./emails/invoice.tsx), as an email
  - [Invoice](./documents/invoice.tsx), as a PDF
  - [Stripe invoice](./documents/stripe-invoice.tsx), as a PDF: a recreation of Stripe's invoice PDF
- **Quote** (`quote`): An estimate before work starts: what's included, what it costs, and how long the price holds.
  - [Quote](./documents/quote.tsx), as a PDF
- **Receipt** (`receipt`): Proof of a payment already made: what was bought, what it cost, and when it was paid.
  - [App Store receipt](./emails/apple-receipt.tsx), as an email: a recreation of Apple's App Store receipt, by zehfernandes
  - [Receipt](./emails/receipt.tsx), as an email
  - [Trip receipt](./documents/airbnb-receipt.tsx), as a PDF: a recreation of Airbnb's trip receipt
  - [Receipt](./documents/receipt.tsx), as a PDF

### Orders

- **Order confirmation** (`order-confirmation`): Confirming an order was placed: what's in it, what it costs, and where it's going.
  - [Order confirmation](./emails/order-confirmation.tsx), as an email
- **Shipping** (`shipping`): Telling someone their order is on its way: who's carrying it, when it should arrive, and how to track it.
  - [It's on its way](./emails/nike-shipping.tsx), as an email: a recreation of Nike's shipping confirmation, by zehfernandes
  - [Shipping](./emails/shipping.tsx), as an email

### Launches

- **Announcement** (`announcement`): One launch or piece of news: a headline, a date, and what's new.
  - [Launch graphic](./images/announcement.tsx), as an image
  - [Product drop post](./images/nike-drop.tsx), as an image: a recreation of Nike's product drop post

### Content

- **Newsletter** (`newsletter`): A regular issue of written news: a subject, a lead, and sections the writer fills in.
  - [CodePen Challenges](./emails/codepen-challenges.tsx), as an email: a recreation of CodePen's Challenges newsletter
  - [Newsletter](./emails/newsletter.tsx), as an email
  - [Stack Overflow tips](./emails/stack-overflow-tips.tsx), as an email: a recreation of Stack Overflow's search tips newsletter, by bruno88cabral
- **Open Graph card** (`og-card`): The picture a link shows when it's shared: an article's or a page's title, with the brand.
  - [Open Graph card](./images/og-card.tsx), as an image

### Events

- **Event** (`event`): An event people can come to: what it is, when and where, and how to register.
  - [Event invitation](./emails/event.tsx), as an email
  - [Event page](./pages/event.tsx), as a page
- **Speaker** (`speaker`): Announcing one speaker for an event: who they are, what they'll talk about, and when.
  - [Speaker card](./images/speaker.tsx), as an image
- **Ticket** (`ticket`): A ticket someone holds for an event: who it's for, when and where, and the code to show at the door.
  - [Ticket](./documents/ticket.tsx), as a PDF

### Social

- **Stat card** (`stat-card`): A few numbers worth sharing as one picture: someone's year, a milestone, the results of a period.
  - [Wrapped share card](./images/spotify-wrapped.tsx), as an image: a recreation of Spotify's Wrapped share card

### People

- **Feedback request** (`feedback-request`): Asking someone for their view after something happened (a stay, a purchase, a call), or showing them a review and inviting their reply.
  - [Review received](./emails/airbnb-review.tsx), as an email: a recreation of Airbnb's review email, by joaom00

### Records

- **Certificate** (`certificate`): Recognizing someone for finishing or achieving something: who, what, when, and who signs it.
  - [Certificate](./documents/certificate.tsx), as a PDF

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
