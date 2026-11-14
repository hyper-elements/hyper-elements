import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { abs, docsInOrder, header, referenceInOrder } from "../lib/llms";
import { templates } from "../lib/examples";
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
  lines.push("## Components\n", `- [Components](${abs("components")}): how every component takes its props and its style, and the full list`);
  for (const r of reference) lines.push(`- [${r.data.title}](${abs(`components/${r.id}`)}): ${r.data.summary}`);
  // Each template's page has its full source, rendered output and diagnostics.
  lines.push("", "## Templates\n");
  for (const t of templates) lines.push(`- [${t.title}](${site.url}/templates/${t.slug}): <${t.root}>. ${t.description}`);
  lines.push("", "## Developer tutorials\n");
  const articles = (await getCollection("blog")).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  for (const article of articles) lines.push(`- [${article.data.title}](${site.url}/blog/${article.data.slug}): ${article.data.description}`);
  lines.push(
    "",
    "## Optional\n",
    `- [Everything in one file](${site.url}/llms-full.txt): every docs page, developer tutorial and the full component reference`,
    `- [For AI agents](${site.url}/ai): how Hyper Elements is built for coding agents`,
    // An agent with a browser can render a template there: by a link, by script, or by WebMCP tools.
    `- [Playground](${site.url}/playground): render a template in the browser with nothing to install, as an email, a page, a PDF or an image, with its outline and its diagnostics. A link carries the code (${site.url}/playground#code=<base64url of the UTF-8 code>); with script, window.hyperElementsPlayground.render(code); with WebMCP, the tool render_hyper_elements`,
    `- [Migrate from React Email](${site.url}/migrate): convert React Email templates in one command`,
    `- [Hyper Elements vs React Email](${site.url}/compare/react-email): when to pick each, feature by feature, and the agent benchmark`,
    `- [Hyper Elements vs MJML](${site.url}/compare/mjml): feature by feature, the same email in each, and the agent benchmark`,
    `- [Source](${site.github})`,
    "",
  );
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
};
