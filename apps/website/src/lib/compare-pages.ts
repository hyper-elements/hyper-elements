/**
 * Every comparison and alternatives page, in one place: each page links to the others from here, and hub pages at
 * /compare and /alternatives can list them from here once there are enough pages for them. Add a page here when you
 * add one to src/pages/compare/ or src/pages/alternatives/.
 */
export type ComparePageLink = {
  /** The other tool, as it names itself. */
  name: string;
  path: string;
  /** The page's H1. */
  title: string;
  /** One line about the page. */
  summary: string;
};

/** Hyper Elements against one other tool. */
export const comparisons: ComparePageLink[] = [
  {
    name: "React Email",
    path: "/compare/react-email",
    title: "Hyper Elements vs React Email",
    summary: "Both write emails in React. Layout, checks, email client previews, themes and agent speed, side by side.",
  },
  {
    name: "MJML",
    path: "/compare/mjml",
    title: "Hyper Elements vs MJML",
    summary: "Both write responsive emails that work in Outlook. React and TypeScript, checks, previews and themes, side by side.",
  },
];

/** One tool's alternatives, as a list. */
export const alternatives: ComparePageLink[] = [
  {
    name: "React Email",
    path: "/alternatives/react-email",
    title: "React Email alternatives",
    summary: "Hyper Elements, MJML, Maizzle and jsx-email: when to pick each, and how fast a coding agent writes an email with it.",
  },
  {
    name: "MJML",
    path: "/alternatives/mjml",
    title: "MJML alternatives",
    summary: "Hyper Elements, React Email, Maizzle and jsx-email: when to pick each, and how fast a coding agent writes an email with it.",
  },
  {
    name: "Litmus",
    path: "/alternatives/litmus",
    title: "Litmus alternatives",
    summary: "Hyper Elements, Parcel and Mailosaur: build reliable emails and preview them in real email clients, with free previews built for agents.",
  },
];

