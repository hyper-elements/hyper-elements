// The hand-written HTML kit's reference issue: the kit's starter file, filled in as its BODY comment says.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const starter = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../kits/html/emails/starter.html"), "utf8");
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const P = 'style="margin: 0 0 12px; color: #1f2937; font-family: Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;"';
const H2 = 'style="margin: 16px 0 8px; color: #1f2937; font-family: Helvetica, Arial, sans-serif; font-size: 20px; line-height: 28px;"';
const IMG = 'style="display: block; width: 100%; max-width: 536px; height: auto; margin: 8px 0; border: 0;"';
const button = (b) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px;"><tr><td style="background-color: #4f46e5; border-radius: 6px;"><a href="${b.href}" style="display: inline-block; padding: 12px 20px; color: #ffffff; font-family: Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px; text-decoration: none;">${esc(b.text)}</a></td></tr></table>`;
export const files = (c) => ({
  "out/email.html": starter
    .replace(/<!-- BODY[\s\S]*?-->/, [`<p ${P}>${esc(c.intro)}</p>`, ...c.stories.map((s) => `<img src="${s.image.src}" width="536" alt="${esc(s.image.alt)}" ${IMG}>\n<h2 ${H2}>${esc(s.title)}</h2>\n<p ${P}>${esc(s.text)}</p>\n${button(s.button)}`)].join("\n"))
    .replace(/<!--[\s\S]*?-->\n/, "")
    .replaceAll("{{preview}}", esc(c.preview))
    .replaceAll("{{heading}}", esc(c.heading)),
});
