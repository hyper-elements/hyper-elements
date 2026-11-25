/** Names and links in one place, so the rename is one edit. */
export const site = {
  name: "Hyper Elements",
  url: "https://www.hyperelements.dev",
  github: "https://github.com/hyper-elements/hyper-elements",
  npm: "https://www.npmjs.com/org/hyper-elements",
  pkg: "@hyper-elements/react",
  install: "npm i @hyper-elements/react",
  migrate: "npx @hyper-elements/migrate",
  skill: "npx skills add hyper-elements/hyper-elements",
  /** The start of a prompt that installs the hyper-elements skill (or reads it from the site), as the email-testing prompt does. */
  skillPromptStart:
    "Install the hyper-elements skill (npx skills add hyper-elements/hyper-elements --skill hyper-elements -y, or read https://www.hyperelements.dev/skills/hyper-elements.md) and follow it to",
  /** The skill's job as a rule in CLAUDE.md or AGENTS.md, for an agent without it: true before the package is installed too. */
  agentRule:
    "Designs use Hyper Elements (@hyper-elements/react).\nIf it isn't installed, install it with react and react-dom.\nBefore writing a design, read\nnode_modules/@hyper-elements/react/GUIDE.md.",
  /** The email-testing skill alone, and a prompt that installs it and previews an email with it. */
  emailTestingSkill: "npx skills add hyper-elements/hyper-elements --skill email-testing",
  emailTestingPrompt:
    "Install the email-testing skill (npx skills add hyper-elements/hyper-elements --skill email-testing -y, or read https://www.hyperelements.dev/skills/email-testing.md) and follow it to preview [my email: an HTML file or a design] in Outlook, Gmail, Yahoo Mail and Apple Mail, light and dark. Show me each client's screenshot and what it changed.",
  /** The engine's version line, shown in the header; links to the releases. */
  version: "0.5",
  releases: "https://github.com/hyper-elements/hyper-elements/releases",
  repo: "hyper-elements/hyper-elements",
  description:
    "The content engine for agents: React components your agent writes, rendered to emails, pages, PDFs and images, checked in every client, with the fix for what's wrong.",
};

export const mainNav = [
  { href: "/docs", label: "Docs" },
  { href: "/elements", label: "Elements" },
  { href: "/templates", label: "Templates" },
  { href: "/ai", label: "AI" },
];

export const resourcesNav = [
  { href: "/blog", label: "Blog" },
  { href: "/playground", label: "Playground" },
  { href: "/email-testing", label: "Email testing" },
];

export type DocLink = { slug: string; label: string };
export type DocGroup = { title: string; items: DocLink[] };

/** The docs sidebar. A slug is the path after /docs/ ("" is /docs). Element pages are added from the reference. */
export const docsNav: DocGroup[] = [
  {
    title: "Get started",
    items: [
      { slug: "", label: "Introduction" },
      { slug: "quickstart", label: "Quickstart" },
    ],
  },
  {
    title: "Core concepts",
    items: [
      { slug: "designs", label: "Designs" },
      { slug: "layout", label: "Layout" },
      { slug: "styles", label: "Styles" },
      { slug: "rendering", label: "Rendering" },
      { slug: "themes", label: "Themes" },
      { slug: "custom-elements", label: "Custom elements" },
      { slug: "cli", label: "Command line" },
    ],
  },
  {
    title: "Outputs",
    items: [
      { slug: "outputs/email", label: "Email" },
      { slug: "outputs/page", label: "Web pages" },
      { slug: "outputs/pdf", label: "Documents and PDF" },
      { slug: "outputs/image", label: "Images" },
    ],
  },
  {
    title: "Templates",
    items: [
      { slug: "templates", label: "Templates" },
      { slug: "templates/examples", label: "Examples" },
      { slug: "templates/fields", label: "Values: fields and images" },
      { slug: "templates/slots", label: "Content: slots and blocks" },
      { slug: "templates/rules", label: "Rules and checks" },
      { slug: "templates/cli", label: "In the command line" },
    ],
  },
  {
    title: "Validation",
    items: [
      { slug: "diagnostics", label: "Diagnostics" },
      { slug: "email-client-emulator", label: "Email client emulator" },
      { slug: "lint", label: "Lint" },
    ],
  },
  {
    title: "Reference",
    items: [
      { slug: "themes/reference", label: "Theme reference" },
      { slug: "cli/reference", label: "Command line reference" },
    ],
  },
  {
    title: "Guides",
    items: [
      { slug: "guides/sending", label: "Sending email" },
      { slug: "guides/nextjs", label: "Next.js" },
      { slug: "guides/ai-agents", label: "AI agents" },
      { slug: "benchmark", label: "Agent benchmark" },
      { slug: "guides/visual-editor", label: "Visual editing" },
    ],
  },
  {
    title: "Migrate",
    items: [
      { slug: "migrate/react-email", label: "From React Email" },
      { slug: "migrate/unlayer-elements", label: "From Unlayer Elements" },
    ],
  },
];

/** Order of element groups in the sidebar and on /components. */
export const componentGroups = ["Roots", "Sections and layout", "Blocks", "Inline", "Parts", "Shapes", "Reference"];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");
