import type { APIRoute } from "astro";
import guide from "../../../../../packages/react/GUIDE.md?raw";
import { site } from "../../lib/site";

// The package's own guide (written from the component definitions), for the playground's reference() and its
// WebMCP tool: what an agent reads before it writes a template.
const text = guide
  .replace(/<!--[\s\S]*?-->\n*/g, "")
  .replace("[REFERENCE.md](./REFERENCE.md)", `${site.url}/docs/components`);

export const GET: APIRoute = () => new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
