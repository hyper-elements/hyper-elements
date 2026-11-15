import type { APIRoute } from "astro";
import skill from "../../../../../skills/email-testing/SKILL.md?raw";

// The email-testing skill as it is in the repository, at a short address for the copy-paste prompt: an agent that
// can't run `npx skills add` reads it here and follows it.
export const GET: APIRoute = () => new Response(skill, { headers: { "content-type": "text/markdown; charset=utf-8" } });
