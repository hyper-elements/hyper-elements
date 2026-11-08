/**
 * Every email client list Elements takes from caniemail's tables matches them: the clients a feature isn't shown as
 * written in, from test/fixtures/caniemail.json (refreshed by scripts/caniemail.mjs), less those left out here with
 * the reason, plus those our own captures add. A list that differs from the data fails, naming the clients.
 */
import { readFileSync } from "node:fs";
import { COMPONENTS, CONDITIONS, type Support, type SupportByTarget } from "../src";
import { EMAIL_CLIENTS, type EmailClient } from "../src/email-clients";
import { NO_WEB_FONTS } from "../src/roots";
import { HTML_CSS, IMAGE_FORMATS, NO_PHONE_STYLES } from "../src/writers/email/support";

interface Feature {
  title: string;
  stats: Record<string, Record<string, Record<string, string>>>;
  notes: Record<string, string>;
}
const data = JSON.parse(readFileSync(new URL("fixtures/caniemail.json", import.meta.url), "utf8")) as { features: Record<string, Feature> };

/** Each client as caniemail's family and platforms (`*`: all of them). The Gmail apps differ by account. */
const PLATFORMS: Record<EmailClient, ReadonlyArray<[string, string]>> = {
  outlook: [["outlook", "windows"]],
  "outlook-com": [["outlook", "outlook-com"]],
  "outlook-mac": [["outlook", "macos"]],
  "outlook-app": [
    ["outlook", "ios"],
    ["outlook", "android"],
  ],
  gmail: [["gmail", "desktop-webmail"]],
  "gmail-app": [
    ["gmail", "ios"],
    ["gmail", "android"],
  ],
  "gmail-app-other": [
    ["gmail", "ios"],
    ["gmail", "android"],
  ],
  "apple-mail": [
    ["apple-mail", "macos"],
    ["apple-mail", "ios"],
  ],
  yahoo: [["yahoo", "*"]],
  aol: [["aol", "*"]],
  "samsung-email": [["samsung-email", "*"]],
  thunderbird: [["thunderbird", "*"]],
  protonmail: [["protonmail", "*"]],
  fastmail: [["fastmail", "*"]],
  hey: [["hey", "*"]],
  gmx: [["gmx", "*"]],
  "web-de": [["web-de", "*"]],
  orange: [["orange", "*"]],
  sfr: [["sfr", "*"]],
  laposte: [["laposte", "*"]],
  "free-fr": [["free-fr", "*"]],
  "t-online-de": [["t-online-de", "*"]],
  "mail-ru": [["mail-ru", "*"]],
  ionos: [["ionos-1and1", "*"]],
  "wp-pl": [["wp-pl", "*"]],
  rainloop: [["rainloop", "*"]],
};

/**
 * The clients where caniemail's latest test of a feature isn't a plain yes, on any of their platforms. A partial
 * result whose notes are all about another account than Google's is the Gmail apps' with another account; one only
 * supported with another account is theirs with a Google account.
 */
function affected(slug: string): EmailClient[] {
  const feature = data.features[slug];
  if (!feature) throw new Error(`test/fixtures/caniemail.json has no "${slug}": run node scripts/caniemail.mjs`);
  return (Object.keys(PLATFORMS) as EmailClient[]).filter((client) =>
    PLATFORMS[client].some(([family, platform]) =>
      Object.entries(feature.stats[family] ?? {})
        .filter(([name]) => platform === "*" || name === platform)
        .some(([, versions]) => {
          const results = Object.values(versions);
          const [level, ...refs] = results[results.length - 1]!.split(/\s+/);
          if (level !== "n" && level !== "a") return false;
          if (family !== "gmail" || level !== "a" || !refs.length) return true;
          const notes = refs.map((ref) => feature.notes[ref.slice(1)] ?? "");
          if (notes.every((note) => /not supported with non google/i.test(note))) return client === "gmail-app-other";
          if (notes.every((note) => /only (supported|works) with non google/i.test(note))) return client !== "gmail-app-other";
          return true;
        })
    )
  );
}

/**
 * Clients caniemail lists that a list leaves out, and why: what Elements writes isn't what the table is about. Keyed by
 * feature, or by feature@use where one feature is read two ways (Elements' own <style>, in the head, and one in an Html
 * block, in the body).
 */
const LEFT_OUT: Record<string, Partial<Record<EmailClient, string>>> = {
  "css-border-radius": {
    yahoo: "only the slash shorthand for elliptical corners isn't, which radius() doesn't take",
    aol: "only the slash shorthand for elliptical corners isn't, which radius() doesn't take",
  },
  "css-pseudo-class-hover": {
    "outlook-app": "a phone app, where nothing hovers",
    "gmail-app": "a phone app, where nothing hovers",
    "gmail-app-other": "a phone app, where nothing hovers",
    aol: "only its phone apps, where nothing hovers",
  },
  "css-at-media": {
    outlook: "on desktop, where phone styles don't apply anyway (Elements writes classic Outlook's layout without them)",
    thunderbird: "on desktop, where phone styles don't apply anyway",
    "outlook-com": "only nested media queries aren't, and Elements writes none",
    "outlook-mac": "only nested media queries aren't, and Elements writes none",
    "outlook-app": "only nested media queries aren't, and Elements writes none",
    gmail: "only height media queries aren't, and Elements writes max-width ones",
    "gmail-app": "with a Google account, only height media queries aren't",
    yahoo: "only screen and width or height media queries are, and Elements writes a max-width one",
    aol: "only screen and width or height media queries are, and Elements writes a max-width one",
    protonmail: "only landscape media queries aren't",
    "mail-ru": "only nested and height media queries aren't",
  },
  "html-style@head": {
    outlook: "its rules must come before what they style, as Elements' <style> in the head does",
    gmail: "only a <style> in the body or over 16 KB isn't (email/style-size checks the size)",
    "gmail-app": "with a Google account, only a <style> in the body or over 16 KB isn't",
    protonmail: "only a <style> in the body isn't, and Elements writes its own in the head",
  },
  "html-style": {
    outlook: "its rules must come before what they style, which a <style> in an Html block does for its own markup",
  },
  "image-webp": {
    gmail: "shown, converted to JPEG (an animated one stays still)",
    "gmail-app": "shown, converted to JPEG (an animated one stays still)",
    "gmail-app-other": "shown, converted to JPEG (an animated one stays still)",
  },
  "image-avif": {
    gmail: "shown; only its animation isn't",
    "gmail-app": "shown; only its animation isn't",
    "gmail-app-other": "shown; only its animation isn't",
  },
  "image-svg": {
    gmail: "shown, as a PNG",
    "gmail-app": "shown, as a PNG",
    "gmail-app-other": "shown, as a PNG",
  },
  "html-dir": {
    outlook: "only on links, where Elements doesn't write dir",
    orange: "removed only from <table> and <td>, and Elements writes dir on <html> and a <div>",
  },
  "html-lang": {
    yahoo: "removed only from <td>, and Elements writes lang on <html> and a <div>",
    aol: "removed only from <td>, and Elements writes lang on <html> and a <div>",
  },
  "css-font-weight": {
    yahoo: "only weights other than 100 to 900 in hundreds aren't, which fontWeight() doesn't take",
    aol: "only weights other than 100 to 900 in hundreds aren't, which fontWeight() doesn't take",
    orange: "only weights other than 100 to 900 in hundreds aren't, which fontWeight() doesn't take",
  },
  "css-text-decoration": {
    outlook: "only several lines at once and overline aren't, which textDecoration doesn't take",
    gmx: "only the line's style, color and thickness aren't: textDecoration sets the line",
    "web-de": "only the line's style, color and thickness aren't: textDecoration sets the line",
  },
  "css-position": {
    "apple-mail": "keeps absolute (only sticky and fixed aren't)",
    "samsung-email": "keeps absolute (only sticky and fixed aren't)",
    orange: "keeps absolute (only sticky and fixed aren't)",
    fastmail: "keeps absolute (only sticky and fixed aren't)",
  },
};

/** Clients our captures add to caniemail's for a pattern: what Gmail or Outlook.com on the web were seen removing. */
const CAPTURED: Record<string, readonly EmailClient[]> = {};

const slugOf = (feature: string) => feature.split("@")[0]!;

/** What a list should be: caniemail's clients for its features, less those left out, plus those captured. */
function expected(...features: string[]): EmailClient[] {
  const left = (client: EmailClient) => features.some((feature) => LEFT_OUT[feature]?.[client]);
  const out = new Set(features.map(slugOf).flatMap(affected).filter((client) => !left(client)));
  for (const slug of features) for (const client of CAPTURED[slug] ?? []) out.add(client);
  return [...out].sort();
}

const sorted = (clients: readonly EmailClient[]) => [...new Set(clients)].sort();

/** Every declaration of a style, a prop or a condition that names a caniemail feature, with the clients its rules name. */
function declarations(): Array<{ label: string; feature: string; clients: EmailClient[] }> {
  const out = new Map<string, { label: string; feature: string; clients: EmailClient[] }>();
  const read = (label: string, declared: SupportByTarget[keyof SupportByTarget] | undefined) => {
    for (const rule of ([] as Support[]).concat(declared ?? [])) {
      if (rule.level === "full" || !rule.feature) continue;
      const key = `${label} ${rule.feature}`;
      const entry = out.get(key) ?? { label, feature: rule.feature, clients: [] };
      entry.clients.push(...(rule.clients ?? (rule.level === "outlook" ? ["outlook" as const] : [])));
      out.set(key, entry);
    }
  };
  for (const definition of Object.values(COMPONENTS)) {
    for (const [key, spec] of Object.entries(definition.style)) read(`${definition.type}.style.${key}`, (spec as { support?: SupportByTarget }).support?.email);
    for (const [key, spec] of Object.entries(definition.props)) read(`${definition.type}.props.${key}`, (spec as { support?: SupportByTarget }).support?.email);
  }
  for (const condition of CONDITIONS) read(condition.name, condition.support.email);
  return [...out.values()];
}

describe("email clients from caniemail's tables", () => {
  it("names caniemail's clients in each declaration that says it's from there", () => {
    const found = declarations();
    expect(found.map((d) => d.feature)).toEqual(expect.arrayContaining(["css-at-font-face", "css-border-radius", "css-pseudo-class-hover", "html-lang", "html-dir", "css-font-weight", "css-text-transform", "css-text-decoration"]));
    for (const { label, feature, clients } of found) expect([label, sorted(clients)]).toEqual([label, expected(feature)]);
  });

  it("names them where a check names them itself", () => {
    expect(sorted(NO_WEB_FONTS)).toEqual(expected("css-at-font-face"));
    expect(sorted(NO_PHONE_STYLES)).toEqual(expected("css-at-media", "html-style@head"));
    for (const [format, { clients, feature }] of Object.entries(IMAGE_FORMATS)) expect([format, sorted(clients)]).toEqual([format, expected(feature)]);
    for (const { pattern, clients, feature } of HTML_CSS) if (feature) expect([String(pattern), sorted(clients)]).toEqual([String(pattern), expected(feature)]);
  });

  it("leaves a client out only where caniemail lists it, with a reason", () => {
    for (const [feature, clients] of Object.entries(LEFT_OUT)) {
      for (const [client, reason] of Object.entries(clients)) {
        expect([feature, client, affected(slugOf(feature)).includes(client as EmailClient)]).toEqual([feature, client, true]);
        expect(reason!.length).toBeGreaterThan(10);
      }
    }
  });

  it("knows every client it names", () => {
    expect(Object.keys(PLATFORMS).sort()).toEqual(Object.keys(EMAIL_CLIENTS).sort());
  });
});
