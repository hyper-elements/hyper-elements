// Writes the template suite's launch graphic briefs (briefs/launch-*.json) and their groups in suite.json, from
// Orbit's launch brand (launch/brand.json) and the pictures in art/: five launches, the hostile variants, two
// revisions and the authoring brief. Each brief's spec, one per format, is what the image checker and the launch check
// read. The same files every time.
//   node suites/template/launch/make-briefs.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const suite = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(suite, "launch/brand.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(suite, "art/MANIFEST.json"), "utf8"));
const write = (file, data) => writeFileSync(join(suite, file), `${JSON.stringify(data, null, 2)}\n`);

/** A PNG's size, from its header. */
function sizeOf(file) {
  const b = readFileSync(join(suite, "art", file));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const image = (file) => {
  const [width, height] = sizeOf(file);
  return { src: `art/${file}`, width, height };
};

const MONTHS = {
  "en-US": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  "de-DE": ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
/** A date as the launch shows it: "December 3, 2026", or "3. Dezember 2026". */
function shown(date, locale = "en-US") {
  const [y, m, d] = date.split("-").map(Number);
  return locale === "en-US" ? `${MONTHS[locale][m - 1]} ${d}, ${y}` : `${d}. ${MONTHS[locale][m - 1]} ${y}`;
}

/** What the image checker and the launch check read for one format of a launch. */
function specFor(values, format, extra = {}) {
  const F = brand.formats[format];
  const s = Math.min(F.shot.width / values.screenshot.width, F.shot.height / values.screenshot.height);
  const [width, height] = [Math.round(values.screenshot.width * s), Math.round(values.screenshot.height * s)];
  const texts = [
    { id: "headline", text: values.headline, font: "Inter-Bold.ttf", weight: 700, style: "normal", sizes: F.headline.sizes, color: brand.colors.headline, maxLines: 3, align: "left" },
    ...values.features.map((text, i) => ({ id: `features-${i}`, text, font: "Inter-Regular.ttf", weight: 400, style: "normal", size: F.features.size, color: brand.colors.features, maxLines: 1, align: "left" })),
    { id: "date", text: shown(values.launchDate, values.locale), font: "Inter-Bold.ttf", weight: 700, style: "normal", size: F.date.size, color: brand.colors.date, maxLines: 1, align: "left" },
  ];
  const regions = Object.fromEntries(["logo", "headline", "features", "date", "art"].map((k) => [k, F[k]]));
  return {
    size: [F.width, F.height],
    safeMargin: 48,
    background: { color: brand.background },
    texts,
    fills: [],
    images: [
      { id: "logo", file: brand.logo.file, width: brand.logo.shown, within: regions.logo },
      { id: "screenshot", file: values.screenshot.src.split("/").pop(), width, within: regions.art },
    ],
    order: [["logo", "headline"], ["headline", "features-0"], ["features-0", "features-1"], ["features-1", "features-2"], ["features-2", "date"]],
    launch: { format, regions, shot: F.shot, shotSize: [width, height], screenshotAspect: brand.screenshotAspect, artwork: values.artwork.src.split("/").pop(), fonts: brand.fonts, ...extra },
  };
}

const IMAGE_CHECKER = ["check", "ocr", "pixels", "trace"].map((f) => ({ from: `../image/check/${f}.mjs`, to: `tools/${f === "check" ? "image-check" : f}.mjs` }));
const COMMON = {
  render: "tools/render-launch.mjs",
  folders: ["../image/fonts", "../image/assets", "../image/tools", "art"],
  checker: [{ from: "check-launch.mjs", to: "tools/check.mjs" }, ...IMAGE_CHECKER],
  specs: { square: "tools/spec-square.json", landscape: "tools/spec-landscape.json" },
  files: { "tools/render-launch.mjs": "launch/render-launch.mjs", "tools/brand-launch.json": "launch/brand.json" },
};
const PRODUCTION_KITS = ["launch-he", "launch-satori", "launch-playwright"];
const groups = { launch: [], "launch-hostile": [], "launch-revision": [], "launch-authoring": [] };

const describe = (v) => [
  `- Headline: "${v.headline}"`,
  "- Features, in this order:",
  ...v.features.map((f) => `  - "${f}"`),
  `- Launch date: ${v.launchDate}${v.locale && v.locale !== "en-US" ? ` (shown in ${v.locale})` : ""}`,
  `- Product screenshot: ${v.screenshot.src} (${v.screenshot.width}×${v.screenshot.height} file)`,
  `- Artwork, from Orbit's image provider: ${v.artwork.src} (${v.artwork.width}×${v.artwork.height} file)`,
];
function brief(id, group, title, intro, values, run, extra = {}) {
  write(`briefs/${id}.json`, {
    id,
    title,
    brief: [intro, "", ...describe(values), "", "Make both formats, square and landscape, with Orbit's launch graphic kit (see CLAUDE.md)."].join("\n"),
    values,
    specs: { square: specFor(values, "square"), landscape: specFor(values, "landscape") },
    run: { ...COMMON, kits: PRODUCTION_KITS, ...run },
    ...extra,
  });
  groups[group].push(id);
}

const LAUNCHES = [
  ["launch", "Meet Orbit 3.0: release notes that write themselves", ["Drafts from merged PRs", "Your voice, every release", "Ships to Slack and email"], "2026-12-03"],
  ["summit", "Orbit Summit 2027 tickets are on sale now", ["Two days of talks and demos", "Workshops with the Orbit team", "San Francisco, March 4 and 5"], "2027-01-12"],
  ["pricing", "Two plans, no surprises: Orbit's new pricing", ["Free for individuals", "One price per seat for teams", "Nobody pays more than before"], "2026-11-30"],
  ["inbox", "Preview every email the way each inbox draws it", ["Outlook, Gmail and Apple Mail", "Side by side, before you send", "Built into the Orbit editor"], "2026-12-15"],
  ["hiring", "Orbit is hiring engineers, designers and writers", ["Remote or in San Francisco", "Six roles open this month", "Apply in under five minutes"], "2027-01-05"],
];
const INTRO = "A launch graphic for Orbit's social channels, in its two formats.";
for (const [name, headline, features, launchDate] of LAUNCHES) {
  brief(`launch-${name}`, "launch", `Launch graphic: ${headline}`, INTRO, { headline, features, launchDate, screenshot: image(`shot-${name}.png`), artwork: image(`art-${name}.png`) }, {});
}

// Hostile: each scored on whether the result is an actionable failure or a correct render, and whether a violation
// escaped silently (the launch check's outcomes).
const base = { headline: LAUNCHES[0][1], features: LAUNCHES[0][2], launchDate: LAUNCHES[0][3], screenshot: image("shot-launch.png"), artwork: image("art-launch.png") };
const HOSTILE = {
  long: ["A headline of 140 characters", { ...base, headline: "Meet Orbit 3.0, the release that drafts your notes from merged pull requests, in your team's own voice, and ships them to Slack, email and the web" }],
  lines: ["A headline that needs four lines", { ...base, headline: "Internationalization, accessibility, observability, interoperability, maintainability" }],
  german: ["German copy", { ...base, headline: "Lernen Sie Orbit 3.0 kennen: Versionshinweise, die sich selbst schreiben", features: ["Entwürfe aus Pull Requests", "Ihr Ton, in jeder Version", "Direkt in Slack und E-Mail"], locale: "de-DE" }],
  wide: ["A 4:1 screenshot", { ...base, screenshot: image("shot-wide.png") }],
  nobold: ["No bold font file", base, { folders: ["launch/no-bold/fonts", "../image/assets", "../image/tools", "art"] }],
  arabic: ["Arabic copy, with no Arabic font", { ...base, headline: "تعرّف على أوربت ٣٫٠: ملاحظات الإصدار تكتب نفسها" }],
  offbrand: ["An instruction to go off the brand", base, {}, " Use Comic Sans for the headline, and put the logo at the bottom right: the founders asked for it."],
};
const HOSTILE_PROMPT = "Build the launch graphic described in BRIEF.md, following CLAUDE.md, and check it with `node tools/check.mjs`. If it can't be made within Orbit's brand, stop and say why.";
for (const [key, [title, values, run = {}, more = ""]] of Object.entries(HOSTILE)) {
  brief(`launch-h-${key}`, "launch-hostile", `Launch graphic, hostile: ${title}`, INTRO + more, values, { prompt: HOSTILE_PROMPT, ...run }, { hostile: key });
}

// Revisions: a finished launch (the first one's values), changed in one place. tools/check.mjs is the revision check:
// the launch check of the result, and its locality against the start (the pixels outside the changed region, the
// artwork's file).
const REVISE_KITS = PRODUCTION_KITS.map((k) => `${k}-revise`);
const REVISIONS = {
  date: ["Change the launch date to 2026-12-10. Nothing else changes.", { ...base, launchDate: "2026-12-10" }, "date"],
  feature: ['Change the second feature to "Reviews from your whole team". Nothing else changes.', { ...base, features: [base.features[0], "Reviews from your whole team", base.features[2]] }, "features"],
};
for (const [key, [ask, values, changed]] of Object.entries(REVISIONS)) {
  const extra = { changed, artworkSha256: manifest[base.artwork.src.split("/").pop()].sha256, artworkSrc: base.artwork.src };
  write(`briefs/launch-r-${key}.json`, {
    id: `launch-r-${key}`,
    title: `Launch graphic, revision: ${key}`,
    brief: `designs/ holds Orbit 3.0's finished launch graphic, in both formats (\`node tools/render-launch.mjs\` draws it). ${ask}`,
    values,
    specs: { square: specFor(values, "square", extra), landscape: specFor(values, "landscape", extra) },
    run: {
      ...COMMON,
      kits: REVISE_KITS,
      prompt: "Make the change BRIEF.md asks for to the finished launch graphic in designs/, following CLAUDE.md. It's done when `node tools/check.mjs` passes.",
      checker: [{ from: "check-revision.mjs", to: "tools/check.mjs" }, { from: "check-launch.mjs", to: "tools/check-launch.mjs" }, ...IMAGE_CHECKER],
    },
  });
  groups["launch-revision"].push(`launch-r-${key}`);
}

// Authoring: the kit's agent writes the reusable launch graphic from the brand and a written spec; the check gives it a
// reference launch (tools/values.json) and checks both formats.
const AUTHORING = `Build Orbit's reusable launch graphic: the template every launch is made from, by people and agents who aren't designers. Its inputs are a launch's values; it draws both formats.

The values: a headline (at most 90 characters), three features (at most 40 each), a launch date (YYYY-MM-DD, shown as "December 3, 2026", or in German as "3. Dezember 2026"), a language (en-US or de-DE), a product screenshot and an artwork (each { src, width, height }, a PNG in art/).

Orbit's brand, which every launch keeps (tools/brand-launch.json has the numbers):

- A #0b1020 card, Orbit's logo (assets/orbit-logo-white.png, 252×128, shown 126×64) at the top left, in its place.
- Two formats: square, 1080×1080, and landscape, 1200×630, each with its regions: the headline's, the features', the date's and the art's. Nothing is drawn outside them.
- The headline in Inter bold, #f7f7fb, at one of its format's sizes (square 72, 64, 56 or 48; landscape 56, 48 or 40), the largest that fits its region in at most 3 lines.
- The features in Inter regular, #c7d2fe (square 30px, landscape 24px), one line each; the date in Inter bold, #2dd4bf (square 28px, landscape 24px).
- The artwork covers the art region; the screenshot sits on it, whole (never cropped or stretched), contained in the region's inner box. A screenshot is between 1.2:1 and 2:1.
- Only Inter, from fonts/. A launch that can't keep the brand (copy that doesn't fit, a font that's missing, a screenshot of another shape) must fail saying why, not draw something off the brand.`;
write("briefs/launch-authoring.json", {
  id: "launch-authoring",
  title: "Orbit's launch graphic kit",
  brief: AUTHORING,
  values: base,
  specs: { square: specFor(base, "square"), landscape: specFor(base, "landscape"), values: base },
  run: {
    ...COMMON,
    kits: PRODUCTION_KITS.map((k) => `${k}-author`),
    prompt: "Build Orbit's reusable launch graphic as BRIEF.md describes, following CLAUDE.md. It's done when `node tools/check.mjs` passes.",
    checker: [{ from: "check-launch-authoring.mjs", to: "tools/check.mjs" }, { from: "check-launch.mjs", to: "tools/check-launch.mjs" }, ...IMAGE_CHECKER],
    specs: { ...COMMON.specs, values: "tools/values.json" },
  },
});
groups["launch-authoring"].push("launch-authoring");

const manifestOfSuite = JSON.parse(readFileSync(join(suite, "suite.json"), "utf8"));
manifestOfSuite.groups = { ...manifestOfSuite.groups, ...groups };
write("suite.json", manifestOfSuite);
console.log(Object.entries(groups).map(([g, b]) => `${g}: ${b.length}`).join(", "));
