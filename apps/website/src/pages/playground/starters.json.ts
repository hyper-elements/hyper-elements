import type { APIRoute } from "astro";
import { starters } from "../../lib/playground";

// Every design's code, and the site's rendering of each for its thumbnail: fetched when the Design menu first
// opens (or by loadStarter()).
export const GET: APIRoute = () => new Response(JSON.stringify(starters), { headers: { "content-type": "application/json; charset=utf-8" } });
