/**
 * Every email client list the plugin takes from caniemail's tables matches them: the clients a feature isn't shown as
 * written in, from test/fixtures/caniemail.json (refreshed by scripts/caniemail.mjs), less those left out here with
 * the reason. A list that differs from the data fails, naming the clients. (The checks only captures found are the
 * models package's, and aren't checked here.)
 */
import { readFileSync } from "node:fs";
import { EMAIL_CLIENTS, type EmailClient } from "../src/email-clients";
import { HTML_CSS } from "../src/html";
import { HOVER_LIMIT, IMAGE_FORMATS, NO_MEDIA_QUERIES, NO_PHONE_STYLES, NO_WEB_FONTS, ROOT_LIMITS, STYLE_LIMITS, STYLE_REMOVED, type Limit } from "../src/limits";

interface Feature {
  title: string;
  /** Each platform's results, [version, result], oldest to latest. */
  stats: Record<string, Record<string, Array<[string, string]>>>;
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
 * What caniemail notes on a yes, for every feature a list takes: where a note says part of the feature isn't supported
 * after all, the uses it's about (`""`: a list that names no use), whose lists then count that client; otherwise why
 * it doesn't matter to what Elements checks. A note on a yes not listed here fails the test, so a refresh that adds
 * one gets read.
 */
const YES_NOTES: Record<string, Record<string, { uses: string[] } | { reason: string }>> = {
  "css-aspect-ratio": { "1": { reason: "needs iOS 15, from 2021: only older iPhones" } },
  "css-at-font-face": { "8": { reason: "only with an Outlook or Hotmail account, which Elements can't tell apart" } },
  "css-at-media": { "1": { reason: "only nested media queries aren't, and Elements writes none" } },
  "css-display-flex": { "2": { uses: ["inline"] } },
  "css-position": { "2": { uses: ["", "relative"] }, "5": { reason: "only fixed is buggy, and no check is about fixed" } },
  "image-avif": {
    "1": { reason: "depends on the reader's browser or system, which shows AVIF in their current versions" },
    "2": { reason: "only animation isn't, and the check is about the image showing" },
  },
  "image-webp": { "2": { reason: "depends on the reader's browser, which shows WebP in every current version" } },
};

/** The latest result on each platform a client is tested on, as its level and its notes' references. */
function latest(feature: Feature, client: EmailClient): Array<{ family: string; level: string; refs: string[] }> {
  return PLATFORMS[client].flatMap(([family, platform]) =>
    Object.entries(feature.stats[family] ?? {})
      .filter(([name]) => platform === "*" || name === platform)
      .map(([, results]) => {
        const [level, ...refs] = results[results.length - 1]![1].split(/\s+/);
        return { family, level: level!, refs: refs.map((ref) => ref.slice(1)) };
      })
  );
}

/**
 * The clients where caniemail's latest test of a feature isn't a plain yes, on any of their platforms, for a list with
 * this use: a no, a partial, or a yes whose note says this use isn't supported (YES_NOTES). A partial result whose
 * notes are all about another account than Google's is the Gmail apps' with another account; one only supported with
 * another account is theirs with a Google account.
 */
function affected(slug: string, use = ""): EmailClient[] {
  const feature = data.features[slug];
  if (!feature) throw new Error(`test/fixtures/caniemail.json has no "${slug}": run node scripts/caniemail.mjs`);
  return (Object.keys(PLATFORMS) as EmailClient[]).filter((client) =>
    latest(feature, client).some(({ family, level, refs }) => {
      if (level === "y") {
        return refs.some((ref) => {
          const read = YES_NOTES[slug]?.[ref];
          if (!read) throw new Error(`caniemail notes "${feature.notes[ref]}" on ${family}'s yes for ${slug}: say in YES_NOTES which uses it's about, or why it doesn't matter`);
          return "uses" in read && read.uses.includes(use);
        });
      }
      if (level !== "n" && level !== "a") return false;
      if (family !== "gmail" || level !== "a" || !refs.length) return true;
      const notes = refs.map((ref) => feature.notes[ref] ?? "");
      if (notes.every((note) => /not supported with non google/i.test(note))) return client === "gmail-app-other";
      if (notes.every((note) => /only (supported|works) with non google/i.test(note))) return client !== "gmail-app-other";
      return true;
    })
  );
}

/**
 * The clients that don't support a feature at all, for the HTML entry's checks on a whole email: caniemail's latest test
 * is a no on any of their platforms, or (`account`) a partial on the Gmail apps whose notes say it isn't supported with
 * another account than Google's, which is the Gmail apps with another account. A partial for any other reason (where in
 * the email, a bug) doesn't count: unlike affected(), which counts every partial.
 */
function unsupported(slug: string, { account = false } = {}): EmailClient[] {
  const feature = data.features[slug];
  if (!feature) throw new Error(`test/fixtures/caniemail.json has no "${slug}": run node scripts/caniemail.mjs`);
  return (Object.keys(PLATFORMS) as EmailClient[]).filter((client) =>
    latest(feature, client).some(({ family, level, refs }) => {
      if (level === "n") return true;
      if (!account || level !== "a" || family !== "gmail" || client !== "gmail-app-other") return false;
      return refs.some((ref) => /not supported with non google/i.test(feature.notes[ref] ?? ""));
    })
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
    "samsung-email": "only with an Outlook or Hotmail account, which Elements can't tell apart",
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
  "css-linear-gradient": {
    "samsung-email": "only with an Outlook or Hotmail account, which Elements can't tell apart",
  },
  "css-position@relative": {
    "apple-mail": "keeps relative",
    "samsung-email": "keeps relative",
    orange: "keeps relative",
    fastmail: "keeps relative",
    yahoo: "keeps relative (only absolute, sticky and fixed aren't)",
    aol: "keeps relative (only absolute, sticky and fixed aren't)",
    hey: "keeps relative",
    sfr: "keeps relative",
    laposte: "keeps relative",
  },
  "css-position": {
    "apple-mail": "keeps absolute (only sticky and fixed aren't)",
    "samsung-email": "keeps absolute (only sticky and fixed aren't)",
    orange: "keeps absolute (only sticky and fixed aren't)",
    fastmail: "keeps absolute (only sticky and fixed aren't)",
  },
};

/** A feature as a list reads it, `slug` or `slug@use`, as affected()'s arguments. */
const parts = (feature: string) => feature.split("@") as [string, string?];

/** What a list should be: caniemail's clients for its features, less those left out. */
function expected(...features: string[]): EmailClient[] {
  const left = (client: EmailClient) => features.some((feature) => LEFT_OUT[feature]?.[client]);
  return [...new Set(features.flatMap((feature) => affected(...parts(feature))).filter((client) => !left(client)))].sort();
}

const sorted = (clients: readonly EmailClient[]) => [...new Set(clients)].sort();

/** Every limit of a style, a root prop or the hover block that names a caniemail feature, with the clients its rules name. */
function declarations(): Array<{ label: string; feature: string; clients: EmailClient[] }> {
  const out = new Map<string, { label: string; feature: string; clients: EmailClient[] }>();
  const read = (label: string, limits: readonly Limit[]) => {
    for (const limit of limits) {
      if (!limit.feature) continue;
      const key = `${label} ${limit.feature}`;
      const entry = out.get(key) ?? { label, feature: limit.feature, clients: [] };
      entry.clients.push(...(limit.clients ?? (limit.level === "outlook" ? ["outlook" as const] : [])));
      out.set(key, entry);
    }
  };
  for (const [key, limits] of Object.entries(STYLE_LIMITS)) read(`style.${key}`, limits);
  for (const [key, limits] of Object.entries(ROOT_LIMITS)) read(`Email.props.${key}`, limits);
  read("hover", [HOVER_LIMIT]);
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
    for (const { removes, clients, feature, use } of HTML_CSS) if (feature) expect([removes, sorted(clients)]).toEqual([removes, expected(use ? `${feature}@${use}` : feature)]);
  });

  it("names, for a whole email, the clients that don't support a <style> or a media query at all, and only those", () => {
    // Every <style> removed: a no, or the Gmail apps with another account. Gmail and its apps with a Google account only
    // remove one in the <body>, which BODY_STYLE_REMOVED says.
    expect(sorted(STYLE_REMOVED)).toEqual(sorted(unsupported("html-style", { account: true })));
    expect(STYLE_REMOVED).not.toContain("gmail");
    expect(STYLE_REMOVED).not.toContain("gmail-app");
    // No media query at all: the noes only, without affected()'s partials (a form, such as height, some don't read).
    expect(sorted(NO_MEDIA_QUERIES)).toEqual(sorted(unsupported("css-at-media")));
    expect(sorted(NO_MEDIA_QUERIES).length).toBeLessThan(affected("css-at-media").length);
  });

  it("leaves a client out only where caniemail lists it, with a reason", () => {
    for (const [feature, clients] of Object.entries(LEFT_OUT)) {
      for (const [client, reason] of Object.entries(clients)) {
        expect([feature, client, affected(...parts(feature)).includes(client as EmailClient)]).toEqual([feature, client, true]);
        expect(reason!.length).toBeGreaterThan(10);
      }
    }
  });

  it("reads only notes caniemail puts on a yes, each with its uses or a reason", () => {
    for (const [slug, notes] of Object.entries(YES_NOTES)) {
      const feature = data.features[slug]!;
      const clients = Object.keys(PLATFORMS) as EmailClient[];
      const onYes = new Set(clients.flatMap((client) => latest(feature, client).filter((r) => r.level === "y").flatMap((r) => r.refs)));
      for (const [ref, read] of Object.entries(notes)) {
        expect([slug, ref, onYes.has(ref)]).toEqual([slug, ref, true]);
        expect("uses" in read ? read.uses.length : read.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it("knows every client it names", () => {
    expect(Object.keys(PLATFORMS).sort()).toEqual(Object.keys(EMAIL_CLIENTS).sort());
  });
});
