/** What the template rules and the HTML rules both check: link words, link targets, merge syntax, alternate text. */
import { quote } from "./quote";

/** Words that don't say where a link goes, compared without case and with the punctuation and arrows around them. */
const GENERIC = new Set(["click here", "here", "read more", "learn more", "more", "link", "this", "go"]);

/** Whether a link's words are only one of the generic ones. */
export function genericWords(words: string): boolean {
  const bare = words
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ");
  return GENERIC.has(bare);
}

/** Merge syntax as sending services write it: `{{…}}`, `*|…|*`, `%%…%%`, `<%…%>`, `${…}`. */
const MERGE = /\{\{[^{}]*\}\}|\*\|[^|]*\|\*|%%[^%\s][^%]*%%|<%[^%]*%>|\$\{[^{}]*\}/;

/** The first merge syntax in some text, if any. */
export function mergeSyntaxIn(text: string): string | undefined {
  return MERGE.exec(text)?.[0];
}

/** What's wrong with where a link goes, as the rest of a message (`goes nowhere: "#"`), or undefined. */
export function targetProblem(href: string): string | undefined {
  const url = href.trim();
  const lower = url.toLowerCase();
  if (url === "") return "has an empty link";
  if (url === "#") return 'goes nowhere ("#")';
  if (lower.startsWith("http:")) return `links over http:, not https: ${quote(url)}`;
  if (lower.startsWith("mailto:") && !lower.slice(7).trim()) return "has a mailto: with no address";
  if (lower.startsWith("tel:") && !/\d/.test(lower)) return `has a tel: with no number: ${quote(url)}`;
  return undefined;
}

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i;
const NO_MEANING = new Set(["image", "photo", "picture", "img", "logo", "banner", "icon"]);

/** Whether an image's alternate text says nothing about it: a file name, a URL, or a word like "image". */
export function meaninglessAlt(alt: string): boolean {
  const text = alt.trim().toLowerCase();
  if (!text) return false;
  return IMAGE_FILE.test(text) || /^(https?:|www\.|\/\/)/.test(text) || NO_MEANING.has(text);
}
