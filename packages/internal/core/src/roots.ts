/** What every root (Email, Page, Document) takes: its title, language, direction and fonts, and its own style. */
import { prop, type SupportByTarget } from "./define";
import { enumOf, fontFaces, text } from "./kinds";
import { boxStyle, inheritedTextStyle, layoutStyle, pick } from "./styles";

const WRITTEN: SupportByTarget = { email: { level: "full", source: "writer" }, web: { level: "full", source: "writer" } };


export const ROOT_PROPS = {
  title: prop(text(), { support: WRITTEN, label: "Title", description: "The document's title (shown in a browser tab, and by some email clients)." }),
  lang: prop(text({ maxLength: 35 }), {
    support: {
      ...WRITTEN,
      email: { level: "full", source: "writer" },
    },
    label: "Language",
    description: 'Its language, as a BCP 47 tag ("en", "ar").',
  }),
  dir: prop(enumOf(["ltr", "rtl", "auto"]), {
    support: {
      ...WRITTEN,
      email: { level: "full", source: "writer" },
    },
    label: "Text direction",
  }),
  fonts: prop(fontFaces(), {
    support: {
      email: { level: "full", source: "writer" },
      web: { level: "full", source: "writer" },
    },
    label: "Web fonts",
    description: "The font files the template loads: a family's file for each weight and style it uses. Text names a family in its fontFamily stack, before the fonts to show where it can't load.",
  }),
};

/**
 * The theme's tokens a root (and a scope, for those it sets) reads as its background and its body text: color, font,
 * size and line height, which Text, table cells and list items inherit.
 */
export const SURFACE_ROLES = { backgroundColor: "colors.background", color: "colors.foreground", fontFamily: "fonts.body", fontSize: "fontSizes.body", lineHeight: "lineHeights.body" } as const;

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
