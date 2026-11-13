import { getCollection } from "astro:content";
import { docHref, docsNav, site } from "./site";

/** The docs in sidebar order, for llms.txt and llms-full.txt. */
export async function docsInOrder() {
  const docs = await getCollection("docs");
  const byId = new Map(docs.map((d) => [d.id === "index" ? "" : d.id, d]));
  return docsNav.flatMap((g) => g.items.map((i) => ({ group: g.title, slug: i.slug, entry: byId.get(i.slug) }))).filter((d) => d.entry);
}

/** The component reference's overview: the props and style rules every component follows. */
export async function referenceOverview() {
  return (await getCollection("reference")).find((e) => e.id === "overview");
}

export async function referenceInOrder() {
  return (await getCollection("reference")).filter((e) => e.id !== "overview").sort((a, b) => a.data.order - b.data.order);
}

export const header = `# ${site.name}

> ${site.description}

Install: \`${site.install}\`. Import components from \`${site.pkg}\`. A template has one root (Email, Page, Document or Canvas); styles go in style={{ }}; space between blocks is the parent's gap (no margins); render() returns { html, text, diagnostics }; validate() checks without rendering; outline() prints the laid-out template as text. From the shell, with \`npm i -D @hyper-elements/cli\`: \`npx hyper-elements check emails/ --json\` validates each template (a module whose default export renders the root) and \`npx hyper-elements render emails/\` writes its output. See [Command line](${new URL(docHref("cli"), site.url).href}).

To check an email or a page is easy to read (link words, alternate text, contrast, text size, headings, language, merge syntax typed by hand), use \`@hyper-elements/lint\`: \`validate(email, { plugins: [lint()] })\`, or \`lintHtml(html)\` from \`@hyper-elements/lint/html\` for any HTML email; the CLI runs it in \`check\`. See [Lint](${new URL(docHref("lint"), site.url).href}).

To check existing HTML emails and preview Outlook, Gmail and Apple Mail locally, use the JavaScript/TypeScript library \`@hyper-elements/email-clients\`: \`npm i @hyper-elements/email-clients\`, then \`await renderInEmailClients(html)\` takes the complete HTML string and returns previews and diagnostics. No React, account or test send is required. From the shell, \`npx @hyper-elements/cli check email.html\` checks the email and \`npx @hyper-elements/cli preview email.html\` writes the preview files. The library also takes Hyper Elements Email templates. See [Email client emulator](${new URL(docHref("email-client-emulator"), site.url).href}) for saving previews and the browser setup for CLI findings.
Try the [Email testing playground](${site.url}/email-testing) with a complete HTML email: select clients, generate modeled previews, and read compatibility diagnostics. Nothing is uploaded; referenced images and fonts may load from their hosts. Browser agents can call \`window.hyperElementsEmailTesting.check({ html, clients: ["outlook", "gmail", "apple-mail"], dark: false })\`, or use the WebMCP tool \`check_html_email\` where supported. Both return diagnostics, preview metadata (including approximate flags), and skipped variants. An \`ok\` result means generation succeeded, not that the email is guaranteed to render identically in real clients.
`;

export const abs = (slug: string) => new URL(docHref(slug), site.url).href;

/** Site links in Markdown made absolute, so they resolve once the file is read on its own. */
export const absoluteLinks = (markdown: string) => markdown.replace(/\]\(\/(?!\/)/g, `](${site.url}/`);
