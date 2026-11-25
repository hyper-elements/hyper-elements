import type { APIRoute } from "astro";
import skill from "../../../../../skills/hyper-elements/SKILL.md?raw";

// The hyper-elements skill as it is in the repository, beside the email-testing one: an agent that can't run
// `npx skills add` reads it here before writing a design.
export const GET: APIRoute = () => new Response(skill, { headers: { "content-type": "text/markdown; charset=utf-8" } });
