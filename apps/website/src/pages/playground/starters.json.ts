import type { APIRoute } from "astro";
import { starters } from "../../lib/playground";

// Every starter's code (and the site's examples' HTML, for their thumbnails), fetched when the gallery opens.
export const GET: APIRoute = () => new Response(JSON.stringify(starters), { headers: { "content-type": "application/json; charset=utf-8" } });
