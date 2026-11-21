import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { abs, docsInOrder, header, referenceInOrder } from "../lib/llms";
import { galleryTemplates, templateUrl } from "../lib/gallery";
import { site } from "../lib/site";

export const GET: APIRoute = async () => {
  const docs = await docsInOrder();
  const reference = await referenceInOrder();
  const groups = [...new Set(docs.map((d) => d.group))];
  const lines = [header];
  for (const g of groups) {
    lines.push(`## ${g}\n`);
    for (const d of docs.filter((x) => x.group === g)) lines.push(`- [${d.entry!.data.title}](${abs(d.slug)}): ${d.entry!.data.description}`);
    lines.push("");
  }
  lines.push("## Elements\n", `- [Elements](${abs("elements")}): how every element takes its props and its style, and the full list`);
  for (const r of reference) lines.push(`- [${r.data.title}](${abs(`elements/${r.id}`)}): ${r.data.summary}`);
  // Each template's page has its output in each sample brand and the one file to copy, which takes your brand.
  lines.push("", "## Templates\n", `- [Templates](${site.url}/templates): ready-made emails, pages, PDFs and images as plain Elements JSX, each drawn in a brand; copy one and its brand.ts`);
  for (const t of galleryTemplates) lines.push(`- [${t.label}](${site.url}${templateUrl(t)}): ${t.output}. ${t.description}`);
  lines.push("", "## Developer tutorials\n");
  const articles = (await getCollection("blog")).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  for (const article of articles) lines.push(`- [${article.data.title}](${site.url}/blog/${article.data.slug}): ${article.data.description}`);
  lines.push(
    "",
    "## Optional\n",
    `- [Everything in one file](${site.url}/llms-full.txt): every docs page, developer tutorial and the full element reference`,
    `- [For AI agents](${site.url}/ai): how Hyper Elements is built for coding agents`,
    `- [email-testing skill](${site.url}/skills/email-testing.md): the agent skill to preview and check any email in Outlook, Gmail, Apple Mail, Yahoo Mail and AOL Mail, with each client's screenshot`,
    `- [hyper-elements skill](${site.url}/skills/hyper-elements.md): the agent skill to write Hyper Elements designs`,
    // An agent with a browser can render a design there: by a link, by script, or by WebMCP tools.
    `- [Playground](${site.url}/playground): render a design in the browser with nothing to install, as an email, a page, a PDF or an image, with its outline and its diagnostics. A link carries the code (${site.url}/playground#code=<base64url of the UTF-8 code>); with script, window.hyperElementsPlayground.render(code); with WebMCP, the tool render_hyper_elements`,
    `- [Migrate from React Email](${site.url}/migrate): convert React Email templates in one command`,
    `- [Hyper Elements vs React Email](${site.url}/compare/react-email): when to pick each, feature by feature, and the agent benchmark`,
    `- [Hyper Elements vs MJML](${site.url}/compare/mjml): feature by feature, the same email in each, and the agent benchmark`,
    `- [React Email alternatives](${site.url}/alternatives/react-email): Hyper Elements, MJML, Maizzle and jsx-email, when to pick each, and the agent benchmark`,
    `- [MJML alternatives](${site.url}/alternatives/mjml): Hyper Elements, React Email, Maizzle and jsx-email, when to pick each, and the agent benchmark`,
    `- [Litmus alternatives](${site.url}/alternatives/litmus): Hyper Elements, Parcel and Mailosaur for building reliable emails and seeing them in real email clients, when to pick each`,
    `- [Source](${site.github})`,
    "",
  );
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
};
