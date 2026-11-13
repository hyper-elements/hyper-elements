/**
 * The rules: one registry for the template and for HTML, so an id means the same check wherever it runs. `/docs/lint`
 * has a section per rule, written from this list (test/docs.test.ts keeps them the same).
 */

/** A rule's severity, or `off`. */
export type RuleSetting = "off" | "info" | "warning";

/** The roots a template rule runs on. */
export type LintRoot = "Email" | "Page";

export interface Rule {
  /** Its id: what options and the docs call it. A template's diagnostic is `email/lint-<id>` or `page/lint-<id>`, HTML's `lint/<id>`. */
  readonly id: string;
  /** Its severity unless the options say otherwise. */
  readonly severity: "info" | "warning";
  /** The template roots it runs on (none: an HTML rule only). */
  readonly roots: readonly LintRoot[];
  /** Where it runs on HTML: in an `Html` block and `lintHtml` (`both`), only on a whole document, or not at all. */
  readonly html: "both" | "document" | null;
  /** What it checks, in a sentence. */
  readonly summary: string;
  /** What to do about a finding. */
  readonly fix: string;
  /** What to do about it in HTML, where that's said another way (`<html lang>`, not the root's `lang`). */
  readonly htmlFix?: string;
  /** Its section of the docs. */
  readonly see: string;
}

export const DOCS = "https://www.hyperelements.dev/docs/lint";

const BOTH: readonly LintRoot[] = ["Email", "Page"];
const rule = (id: string, severity: Rule["severity"], roots: readonly LintRoot[], html: Rule["html"], summary: string, fix: string, htmlFix?: string): Rule =>
  Object.freeze({ id, severity, roots, html, summary, fix, ...(htmlFix ? { htmlFix } : {}), see: `${DOCS}#${id}` });

/** Every rule, in the docs' order. */
export const rules: readonly Rule[] = Object.freeze([
  rule(
    "image-alt",
    "warning",
    BOTH,
    "both",
    "A link holds only images with no alternate text, so a screen reader has nothing to read out for it. In HTML, any link with nothing to name it, and an image with no alt attribute at all.",
    "give the image an alt that says where the link goes, or the link an aria-label"
  ),
  rule(
    "alt-text",
    "info",
    BOTH,
    null,
    'An image\'s alternate text is a file name, a URL or a word like "image" or "logo", which says nothing about it.',
    'say what the image shows ("Tarn\'s logo", "A blue bowl"), or leave alt empty if it\'s only decoration'
  ),
  rule(
    "link-text",
    "warning",
    BOTH,
    "both",
    'A link or button says only "click here", "read more" or the like: screen readers list links by their words alone.',
    'say where it goes ("Confirm your email"), or give it an aria-label'
  ),
  rule("link-empty", "warning", BOTH, null, "A link or button has no words, alternate text, aria-label or title: nothing names it.", "give it words, or an aria-label"),
  rule(
    "link-target",
    "warning",
    BOTH,
    "both",
    "A link goes nowhere (empty, #, a mailto: or tel: with no address or number), over http: rather than https:, or (in HTML) runs a script.",
    "link to the page it's for, over https:"
  ),
  rule("heading-order", "warning", BOTH, "document", "A heading is more than one level below the heading before it (an h2 followed by an h4).", "use the next level down, and style it as you want it to look"),
  rule("heading-one", "info", BOTH, "document", "There's more than one level-1 heading.", "keep one level-1 heading, the title, and use level 2 for the rest"),
  rule("heading-empty", "warning", BOTH, "both", "A heading has no words.", "give it words, or take it out"),
  rule(
    "contrast",
    "warning",
    BOTH,
    null,
    "Text is too faint against its background to read easily: under WCAG AA's 4.5:1, or 3:1 for large text.",
    "darken the text or lighten the background (or the reverse) until it reaches the ratio"
  ),
  rule("text-size", "info", BOTH, null, "Body text is under 14px, hard to read on a phone.", "make it 14px or larger, on phones at least (style.mobile.fontSize)"),
  rule("lang", "warning", BOTH, "document", "The email or page doesn't say its language, so a screen reader may read it in the wrong one.", 'give the root a lang ("en", "fr")', 'give <html> a lang ("en", "fr")'),
  rule("dir", "warning", BOTH, null, "The language is written right to left, but the root doesn't say so.", 'give the root dir="rtl"'),
  rule("title", "info", ["Page"], "document", "The page has no title for the browser's tab and for screen readers.", "give the root a title", "give the email a <title> in its <head>"),
  rule("preview-text", "info", ["Email"], null, "The email has no preview text, or a very short one: inboxes show its first words instead.", "give the Email a previewText of 30 characters or more"),
  rule(
    "merge-syntax",
    "warning",
    BOTH,
    null,
    "Merge syntax ({{name}}, *|NAME|*, %%name%%) is typed into the text, where a MergeTag would write it.",
    'use <MergeTag name="…" />, which writes your sending service\'s syntax (the mergeTag option)'
  ),
  rule(
    "unsubscribe",
    "warning",
    ["Email"],
    null,
    'A marketing email (kind: "marketing") has no unsubscribe link.',
    "add a link to unsubscribe or manage preferences, or the service's MergeTag for one"
  ),
  rule("video-title", "info", BOTH, null, 'A video\'s title is the default, "Video": the alternate text of its thumbnail in an email.', "give it a title that says what the video is"),
  rule("role-button", "warning", [], "both", 'A link has role="button": screen readers announce a button, which a link in an email isn\'t.', 'take the role off: a link is a link, however it looks'),
]);

const byId = new Map(rules.map((r) => [r.id, r]));
/** A rule by its id. */
export const ruleById = (id: string): Rule | undefined => byId.get(id);
