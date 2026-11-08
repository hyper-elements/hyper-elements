/** What every root (Email, Page, Document) takes: its title, language, direction and fonts, and its own style. */
import { prop, type SupportByTarget } from "./define";
import type { EmailClient } from "./email-clients";
import { enumOf, fontFaces, text } from "./kinds";
import { boxStyle, inheritedTextStyle, layoutStyle, pick } from "./styles";

const WRITTEN: SupportByTarget = { email: { level: "full", source: "writer" }, web: { level: "full", source: "writer" } };

/** The email clients that load no web font (caniemail's css-at-font-face; Apple Mail, Samsung Email and others do). */
export const NO_WEB_FONTS: readonly EmailClient[] = ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "protonmail", "fastmail", "gmx", "web-de", "orange", "sfr", "laposte", "mail-ru", "ionos"];

export const ROOT_PROPS = {
  title: prop(text(), { support: WRITTEN, label: "Title", description: "The document's title (shown in a browser tab, and by some email clients)." }),
  lang: prop(text({ maxLength: 35 }), {
    support: {
      ...WRITTEN,
      email: { level: "partial", shows: "no language: the client removes it, and a screen reader reads the email in its own", source: "caniemail", feature: "html-lang", clients: ["hey", "gmx", "web-de", "orange", "ionos"] },
    },
    label: "Language",
    description: 'Its language, as a BCP 47 tag ("en", "ar").',
  }),
  dir: prop(enumOf(["ltr", "rtl", "auto"]), {
    support: {
      ...WRITTEN,
      email: { level: "partial", values: ["rtl", "auto"], shows: "left to right: the client removes the direction", source: "caniemail", feature: "html-dir", clients: ["gmx", "web-de"] },
    },
    label: "Text direction",
  }),
  fonts: prop(fontFaces(), {
    support: {
      email: { level: "partial", shows: "no web font loads: the next font in each stack shows", source: "caniemail", feature: "css-at-font-face", clients: NO_WEB_FONTS },
      web: { level: "full", source: "writer" },
    },
    label: "Web fonts",
    description: "The font files the template loads: a family's file for each weight and style it uses. Text names a family in its fontFamily stack, before the fonts to show where it can't load.",
  }),
};

/** A root's own style: the window's background, the text styles its content inherits, and how it stacks its children. */
export const ROOT_STYLE = {
  ...inheritedTextStyle,
  backgroundColor: { ...boxStyle.backgroundColor, label: "Background color", description: "The window's background, behind the content." },
  ...pick(layoutStyle, "gap", "alignItems"),
};

export const ROOT_DEFAULT_STYLE = {
  color: "#000000",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.5,
  textAlign: "left",
} as const;

export const TEXT_EDITOR = { title: "Text", paths: ["style.fontFamily", "style.fontSize", "style.fontWeight", "style.color", "style.lineHeight", "style.letterSpacing", "style.textAlign"] };
