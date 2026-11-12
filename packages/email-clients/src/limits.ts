/**
 * What email clients do with styles and props Elements writes, as data (moved from core's component definitions in
 * 0.4.0): caniemail's tables, keyed by style or prop. Core's writer writes each of these; these are what a client then
 * shows otherwise. Reported as core 0.3 did: `email/outlook-degraded` for classic Outlook, `email/degraded` for others.
 */
import type { EmailClient } from "./email-clients";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Limit {
  /** `outlook`: classic Outlook shows `shows` instead; `partial`: the clients named do. */
  level: "outlook" | "partial";
  shows: string;
  /** Only these values (all of them where absent). */
  values?: readonly Json[];
  /** The clients (`outlook` is classic Outlook's). */
  clients?: readonly EmailClient[];
  /** caniemail's feature, its slug. */
  feature?: string;
}

/** The email clients that load no web font (caniemail's css-at-font-face; Apple Mail, Samsung Email and others do). */
export const NO_WEB_FONTS: readonly EmailClient[] = ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol", "protonmail", "fastmail", "gmx", "web-de", "orange", "sfr", "laposte", "mail-ru", "ionos"];

/**
 * The clients that show an email on a phone without its phone styles (caniemail's css-at-media and html-style): with
 * another account in the Gmail app, and in some webmail, the email's <style> or its media queries are removed. What
 * Elements does without them (a Row stacks) still happens.
 */
export const NO_PHONE_STYLES: readonly EmailClient[] = ["gmail-app-other", "sfr", "laposte", "gmx", "web-de", "rainloop"];

/** By style, on any component that takes it. */
export const STYLE_LIMITS: Readonly<Record<string, readonly Limit[]>> = {
  fontWeight: [{ level: "outlook", values: [100, 200, 300, 500], shows: "normal weight: Word draws only normal and bold (600 and over)", feature: "css-font-weight" }],
  textTransform: [{ level: "outlook", values: ["lowercase"], shows: "the text as written: Word doesn't lowercase it", feature: "css-text-transform" }],
  textDecoration: [{ level: "partial", values: ["underline", "line-through"], shows: "no line: the client removes it", feature: "css-text-decoration", clients: ["gmail-app-other", "protonmail", "orange", "sfr"] }],
  borderRadius: [
    { level: "outlook", shows: "square corners", feature: "css-border-radius" },
    { level: "partial", shows: "square corners", feature: "css-border-radius", clients: ["gmx", "web-de", "orange"] },
  ],
  overflow: [{ level: "outlook", values: ["hidden"], shows: "content past the height: Word doesn't cut it off" }],
};

/** By prop, on the Email itself. */
export const ROOT_LIMITS: Readonly<Record<string, readonly Limit[]>> = {
  lang: [{ level: "partial", shows: "no language: the client removes it, and a screen reader reads the email in its own", feature: "html-lang", clients: ["hey", "gmx", "web-de", "orange", "ionos"] }],
  dir: [{ level: "partial", values: ["rtl", "auto"], shows: "left to right: the client removes the direction", feature: "html-dir", clients: ["gmx", "web-de"] }],
  fonts: [{ level: "partial", shows: "no web font loads: the next font in each stack shows", feature: "css-at-font-face", clients: NO_WEB_FONTS }],
};

/**
 * A block of hover styles. On type selectors only in Outlook.com and Outlook for Mac (Elements' are classes); the phone
 * apps' results don't matter, as nothing hovers there.
 */
export const HOVER_LIMIT: Limit = {
  level: "partial",
  shows: "no change (where it shows, keyboard focus gets it too)",
  feature: "css-pseudo-class-hover",
  clients: ["outlook", "outlook-com", "outlook-mac", "gmx", "web-de", "sfr", "laposte", "mail-ru"],
};

/**
 * Image formats some clients don't show (caniemail's image-webp, image-avif, image-svg): by the file's extension, its
 * data: type, or the format an image CDN is asked for (`?fm=webp`, `?format=avif`, Cloudinary's `f_webp`).
 */
export const IMAGE_FORMATS: Readonly<Record<string, { clients: readonly EmailClient[]; feature: string; name: string }>> = {
  webp: { clients: ["outlook"], feature: "image-webp", name: "a WebP" },
  avif: { clients: ["outlook", "fastmail", "gmx", "web-de", "orange", "sfr", "mail-ru", "ionos"], feature: "image-avif", name: "an AVIF" },
  svg: { clients: ["mail-ru"], feature: "image-svg", name: "an SVG" },
};

/**
 * Where an image's format is said, first to last: its data: type, then the format an image CDN is asked for (which it
 * serves whatever the file's extension), then its extension. The first found is the format, even one every client shows.
 */
export const FORMAT_IN: readonly RegExp[] = [/^data:image\/([a-z]+)/i, /[?&](?:fm|format|f)=(webp|avif|svg|png|jpe?g|gif)\b/i, /\/f_(webp|avif|svg|png|jpe?g|gif)[,/]/i, /\.([a-z]+)(?:[?#]|$)/i];

/** The format of the image at `src` some clients don't show (IMAGE_FORMATS), or undefined. */
export function imageFormatOf(src: string): (typeof IMAGE_FORMATS)[string] | undefined {
  const format = FORMAT_IN.map((pattern) => pattern.exec(src)?.[1]).find(Boolean)?.toLowerCase();
  return format && Object.prototype.hasOwnProperty.call(IMAGE_FORMATS, format) ? IMAGE_FORMATS[format] : undefined;
}

/**
 * The clients that remove every <style>, wherever it is in the email, which then shows with its inline styles only
 * (caniemail's html-style): those it marks as not supporting it, and the Gmail apps with another account than Google's
 * ("not supported with non Google accounts"). Partial support for another reason (not inside the <body>) doesn't count.
 */
export const STYLE_REMOVED: readonly EmailClient[] = ["gmail-app-other", "gmx", "web-de", "sfr", "laposte", "rainloop"];

/** The clients that apply no media query at all (caniemail's css-at-media: not supported), so phones get the desktop layout. */
export const NO_MEDIA_QUERIES: readonly EmailClient[] = ["outlook", "thunderbird", "sfr", "laposte"];

/** Gmail clips a message at this many bytes of HTML ("[Message clipped]"). */
export const GMAIL_CLIP_BYTES = 102_400;
/** Gmail reads this much of a `<style>`. */
export const GMAIL_STYLE_BYTES = 16_384;
/** Measured in Gmail on the web; the apps are likely the same. */
export const GMAILS: readonly EmailClient[] = ["gmail", "gmail-app", "gmail-app-other"];
