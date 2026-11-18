// Where a page's generated social card is, and the section its card names. Base.astro links a page to its card
// when the page gives no image of its own; scripts/og-cards.mjs draws each card a built page links to.

/** Under the site: /og/cards/<the page's path>.png, the home page's /og/cards/index.png. */
export const CARDS = "/og/cards/";

/** The card of the page at `pathname` ("/docs/quickstart" gives "/og/cards/docs/quickstart.png"). */
export function cardPath(pathname) {
  const page = pathname.replace(/\/+$/, "").replace(/^\/+/, "").replace(/\.html$/, "");
  return `${CARDS}${page || "index"}.png`;
}

/** The page a card is for: the reverse of cardPath(). */
export function cardPage(path) {
  const page = path.slice(CARDS.length).replace(/\.png$/, "");
  return page === "index" ? "/" : `/${page}`;
}

// The section each part of the site is, the longest prefix first.
const SECTIONS = [
  ["/docs/elements/", "Element reference"],
  ["/docs/", "Docs"],
  ["/blog", "Blog"],
  ["/elements", "Elements"],
  ["/compare/", "Compare"],
  ["/alternatives/", "Alternatives"],
  ["/templates", "Templates"],
  ["/playground", "Playground"],
  ["/migrate", "Migrate"],
  ["/skills", "Agent skills"],
  ["/ai", "AI"],
  ["/email-testing", "Email testing"],
];

const BRAND = "Hyper Elements";

/** The section of the site a page is in. */
function section(pathname) {
  const path = `${pathname.replace(/\/+$/, "")}/`;
  for (const [prefix, name] of SECTIONS) if (path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) return name;
  return BRAND;
}

/**
 * What the card of the page at `pathname` titled `title` says: the title, and above it the page's section (the brand
 * on a section's own page, "Blog" titled "Blog"), with the card's alternate text.
 */
export function cardValues(pathname, title) {
  const named = section(pathname);
  const kicker = named.toLowerCase() === title.toLowerCase() ? BRAND : named;
  return { title, kicker, alt: `${kicker === BRAND ? BRAND : `${BRAND} ${kicker}`}: ${title}` };
}
