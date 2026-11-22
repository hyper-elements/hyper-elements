# Templates

Ready-made [Hyper Elements](https://hyperelements.dev) templates: emails, web pages, PDFs and images. Each is a
template (`template()` from `@hyper-elements/react/template`): what stays the same is locked, and what changes is a
field, with the limits and rules every design made from it is checked against. None of them carries a brand: each
is made from one (`newsletter(brand)`), which gives it its colors, fonts, logo, company details and the domains its
links may go to.

```text
emails/newsletter/
  template.tsx          newsletter(brand) makes the template; its default export is made from a sample brand
  designs/*.tsx         designs made from it: <Newsletter subject="…" body={…} />
```

**To use one,** open it on [hyperelements.dev/templates](https://hyperelements.dev/templates), pick a sample brand,
and copy the template with its `brand.ts` (or as one file). Put your own brand in `brand.ts`, then write designs
from it, and check them: `npx hyper-elements describe template.tsx` lists its fields, and `npx hyper-elements check`
checks a design against them.

This file is written by `pnpm --filter ./templates readme`. Don't edit it by hand.

## Emails

- [Review received](./emails/airbnb-review/template.tsx): A guest's review, shown to the host once the review period ends: the logo, the reviewer's photo, their words in a shaded box, a button to reply, and common questions (a recreation of Airbnb's review email, by joaom00). Designs: [Alex's review](./emails/airbnb-review/designs/alex.tsx), [Marta's review](./emails/airbnb-review/designs/marta.tsx)
- [App Store receipt](./emails/apple-receipt/template.tsx): A subscription's receipt: the order's details in a gray table, the app with its icon and price, the total, an offer, and the fine print (a recreation of Apple's App Store receipt, by zehfernandes). Designs: [Monthly subscription](./emails/apple-receipt/designs/monthly.tsx), [Yearly plan and a filter pack](./emails/apple-receipt/designs/yearly-and-pack.tsx)
- [Event invitation](./emails/event/template.tsx): An invitation: the event's name on a band of the brand's color, when and where, a button to register, and the day's schedule. Designs: [Build Day](./emails/event/designs/build-day.tsx), [Design Systems Evenings, online](./emails/event/designs/design-evening.tsx)
- [Invoice email](./emails/invoice/template.tsx): The email that sends an invoice: the amount due, the due date, the lines, and a button to pay online. Designs: [Team plan](./emails/invoice/designs/team-plan.tsx), [Onboarding workshop, overdue, with a credit](./emails/invoice/designs/workshop.tsx)
- [Magic link](./emails/magic-link/template.tsx): A one-time link that signs the reader in, how long it works, and a note for when they didn't ask. Designs: [Fifteen-minute link](./emails/magic-link/designs/fifteen-minutes.tsx), [Thirty-minute link](./emails/magic-link/designs/thirty-minutes.tsx)
- [Newsletter](./emails/newsletter/template.tsx): A regular issue: a locked masthead and footer, with the issue, an unsubscribe link and the company's address, around a body of sections the issue writes. Designs: [Product update](./emails/newsletter/designs/product-update.tsx), [Community roundup](./emails/newsletter/designs/roundup.tsx)
- [It's on its way](./emails/nike-shipping/template.tsx): An order that has shipped: the tracking number and a button up top, a bold headline, where it's going, the item with its picture, picks for you, and help (a recreation of Nike's shipping confirmation, by zehfernandes). Designs: [An away jersey](./emails/nike-shipping/designs/away-jersey.tsx), [A jacket, shipped](./emails/nike-shipping/designs/jacket.tsx)
- [Order confirmation](./emails/order-confirmation/template.tsx): An order confirmed: its number and date, the items with the total, and where it's going. Designs: [Notebook and pen](./emails/order-confirmation/designs/notebook-and-pen.tsx), [Studio kit, no name on file, shipped abroad](./emails/order-confirmation/designs/studio-kit.tsx)
- [Password reset](./emails/password-reset/template.tsx): A link to choose a new password, how long it works, and what to do if the reader didn't ask. Designs: [One-hour link](./emails/password-reset/designs/one-hour.tsx), [Thirty-minute link](./emails/password-reset/designs/thirty-minutes.tsx)
- [Receipt](./emails/receipt/template.tsx): A payment receipt that leads with the amount paid, then the items, the total, and how it was paid. Designs: [Monthly plan](./emails/receipt/designs/monthly-plan.tsx), [Yearly plan, with a discount and tax](./emails/receipt/designs/yearly-plan.tsx)
- [Shipping](./emails/shipping/template.tsx): An order on its way: when it should arrive, who's carrying it, a button to track it, and what's in the box. Designs: [Notebook and pen](./emails/shipping/designs/notebook-and-pen.tsx), [Studio kit](./emails/shipping/designs/studio-kit.tsx)
- [Sign-in code](./emails/sign-in-code/template.tsx): A one-time code, large and centered in a box of its own, with when it expires and what to do if it wasn't you. Designs: [Ten-minute code](./emails/sign-in-code/designs/ten-minutes.tsx), [Short-lived code](./emails/sign-in-code/designs/two-minutes.tsx)
- [Welcome to Premium](./emails/spotify-premium/template.tsx): A paid plan that has just started: a big headline, what it gives you, one pill button, the plan and its price, and the apps (a recreation of Spotify's Premium welcome email). Designs: [Premium Individual](./emails/spotify-premium/designs/individual.tsx), [Premium Family](./emails/spotify-premium/designs/premium-family.tsx)
- [Stack Overflow tips](./emails/stack-overflow-tips/template.tsx): A tips issue: the logo on the page, a banner with the headline beside its art, ruled sections with a list of tips, one button, and a footer with the email's settings and the address (a recreation of Stack Overflow's search tips newsletter, by bruno88cabral). Designs: [Search tips](./emails/stack-overflow-tips/designs/search-tips.tsx), [Asking tips](./emails/stack-overflow-tips/designs/tips-for-asking.tsx)
- [Stripe welcome](./emails/stripe-welcome/template.tsx): The email once an account can take live payments: the logo, short paragraphs with links into the docs, one button, and the address (a recreation of Stripe's welcome email, by zenorocha). Designs: [Ready for live payments](./emails/stripe-welcome/designs/live-payments.tsx), [Payouts turned on](./emails/stripe-welcome/designs/payouts.tsx)
- [Verify email](./emails/verify-email/template.tsx): One step before the account is ready: confirm the email address it was made with. Designs: [New account](./emails/verify-email/designs/new-account.tsx), [Work address](./emails/verify-email/designs/work-address.tsx)
- [Welcome](./emails/welcome/template.tsx): A greeting on a band of the brand's color, three numbered next steps, and one button. Designs: [First week](./emails/welcome/designs/first-week.tsx), [Invited teammate](./emails/welcome/designs/invited-teammate.tsx)

## Pages

- [Event page](./pages/event/template.tsx): An event's web page: its name and tagline on a band of the brand's color, when and where, the schedule, and the speakers. Designs: [Build Day](./pages/event/designs/build-day.tsx), [Maker Meetup, hybrid, with a waitlist](./pages/event/designs/maker-meetup.tsx)

## PDFs

- [Trip receipt](./documents/airbnb-receipt/template.tsx): A stay's receipt as a PDF: the logo and receipt ID, where and when, the guests, the price night by night with fees and taxes, how it was paid, and the cancellation policy (a recreation of Airbnb's trip receipt). Designs: [Lisbon loft](./documents/airbnb-receipt/designs/lisbon-loft.tsx), [Mountain cabin](./documents/airbnb-receipt/designs/mountain-cabin.tsx)
- [Certificate](./documents/certificate/template.tsx): A certificate on a landscape page: a double frame, the recipient's photo and name, what they achieved, the date, a seal, and the signer's signature. Designs: [Accessible design](./documents/certificate/designs/accessible-design.tsx), [Mentorship](./documents/certificate/designs/mentorship.tsx)
- [Invoice](./documents/invoice/template.tsx): An invoice as a PDF: the letterhead, who it's billed to, the lines with their sums, the total due, and page numbers. Designs: [Monthly plan](./documents/invoice/designs/monthly-plan.tsx), [Studio project](./documents/invoice/designs/studio-project.tsx)
- [Quote](./documents/quote/template.tsx): A quote as a PDF: who it's for, the work with its prices, the estimated total, how long it holds, and lines to sign it. Designs: [Design system](./documents/quote/designs/design-system.tsx), [Website rebuild](./documents/quote/designs/website-rebuild.tsx)
- [Receipt](./documents/receipt/template.tsx): A receipt as a PDF: paid in full, with the items, the total, the date and how it was paid. Designs: [Monthly plan](./documents/receipt/designs/monthly-plan.tsx), [Yearly upgrade](./documents/receipt/designs/yearly-upgrade.tsx)
- [Stripe invoice](./documents/stripe-invoice/template.tsx): An invoice as Stripe's PDFs lay it out: the title and logo, its numbers and dates, from and bill to, the amount due with a link to pay, the lines, the totals, and a footer on every page (a recreation of Stripe's invoice PDF). Designs: [Growth plan](./documents/stripe-invoice/designs/growth-plan.tsx), [Workshop series](./documents/stripe-invoice/designs/workshop-series.tsx)
- [Ticket](./documents/ticket/template.tsx): A ticket as a PDF: the event on a band of the brand's color, who it's for, when and where, and the code to show at the door. Designs: [Build Day](./documents/ticket/designs/build-day.tsx), [Product Summit](./documents/ticket/designs/product-summit.tsx)

## Images

- [Launch graphic](./images/announcement/template.tsx): A product launch for social posts: a line above a headline fitted to three lines, up to four features, and the product shown in a window over artwork. Designs: [Release notes launch](./images/announcement/designs/release-notes.tsx), [Shared boards launch](./images/announcement/designs/shared-boards.tsx)
- [Product drop post](./images/nike-drop/template.tsx): A new product for a social feed, 1080 by 1080: a huge headline in capitals, what it is and when, and the product's photo on a pale panel (a recreation of Nike's product drop post). Designs: [Jersey drop](./images/nike-drop/designs/big-night.tsx), [Back in stock](./images/nike-drop/designs/restock.tsx)
- [Open Graph card](./images/og-card/template.tsx): A link preview, 1200 by 630: the title fitted to three lines, the brand's logo and site, and shapes in its colors. Designs: [Engineering post](./images/og-card/designs/build-times.tsx), [Pricing page](./images/og-card/designs/pricing.tsx)
- [Speaker card](./images/speaker/template.tsx): A card announcing one speaker, for social posts: their photo in a circle over shapes in the brand's colors, their name and role, their talk in a block of color, and the event and date. Designs: [Build Day speaker](./images/speaker/designs/build-day.tsx), [Design Week keynote](./images/speaker/designs/design-week.tsx)
- [Wrapped share card](./images/spotify-wrapped/template.tsx): A year in listening as a story to share, 1080 by 1920: bold shapes, the minutes listened, the top artists and songs, and the top genre (a recreation of Spotify's Wrapped share card). Designs: [Indie pop listener](./images/spotify-wrapped/designs/indie-pop.tsx), [Jazz listener](./images/spotify-wrapped/designs/jazz.tsx)

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
