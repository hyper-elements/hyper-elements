// The template suite's own test, before any agent runs (no API):
//
//   node suites/template/selftest.mjs [--only refs,negative,authoring,launch-refs,launch-negative,launch-hostile,launch-revision,launch-authoring]
//     [--kits he,react-email,mjml,html] [--launch-kits launch-he,launch-satori,launch-playwright] [--write-references]
//
// 1. refs: each kit's reference issue of each brief (suites/template/reference) renders, passes the email checker and
//    keeps every guardrail; its header and footer are the kit's own (tools/brand-reference.json, which
//    --write-references writes from the first brief's).
// 2. negative: references broken on purpose (a changed header or footer, no unsubscribe link or preview text, a link
//    off the domains or without its UTM tag, a color or font off the brand, an image without alt, no button) each
//    fail the guardrail named; and the Hyper Elements kit's template refuses its broken issues, saying why.
// 3. authoring: each kit's newsletter as Orbit's maintainers wrote it, given the authoring check: the reference issue
//    passes; the template refuses every hostile body (none escapes), and in every other kit each hostile body is
//    taken and breaks the guardrail it names, so the check can see each escape.
//
// The launch graphic (the launch groups):
// 4. launch-refs: each kit's reference launch of each brief draws both formats and passes the launch check.
// 5. launch-negative: references broken on purpose (the logo moved, the screenshot cropped, another font, a feature
//    cut short, no artwork, the headline's color) each fail the check named.
// 6. launch-hostile: each kit's reference template given each hostile launch. The template's results are an
//    actionable failure or a correct render, never an escape; and no kit's off-brand result passes the check.
// 7. launch-revision: each kit's finished launch changed as the revision briefs ask passes the revision check (only
//    the change redrawn, the artwork unchanged), and a change that redraws more fails it.
// 8. launch-authoring: each kit's maintainers' template, as an authoring agent would leave it, passes the authoring
//    check.
import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { briefOf, briefsOf, makeRun } from "../../lib/make-run.mjs";

const bench = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const suiteDir = join(bench, "suites/template");
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const only = arg("only", "refs,negative,authoring,launch-refs,launch-negative,launch-hostile,launch-revision,launch-authoring").split(",");
const kits = arg("kits", "he,react-email,mjml,html").split(",");
const launchKits = arg("launch-kits", "launch-he,launch-satori,launch-playwright").split(",");
const writeReferences = process.argv.includes("--write-references");
const briefs = await briefsOf("template", "email");
const root = join(bench, "runs", "selftest-template");
await rm(root, { recursive: true, force: true });

function sh(cmd, args, cwd) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => done({ code, out, err }));
  });
}
const lastJson = (text) => {
  try {
    return JSON.parse(text.trim().split("\n").pop());
  } catch {
    return null;
  }
};
const failedNames = (r) => (r?.results ?? []).filter((x) => !x.ok).map((x) => x.name);
const referenceOf = async (kit) => (await import(pathToFileURL(join(suiteDir, "reference", `${kit}.mjs`)).href)).files;

/** A sub that must apply: a negative control that changes nothing would pass for the wrong reason. */
const sub = (from, to) => (text) => {
  if (!text.includes(from)) throw new Error(`selftest: "${from.slice(0, 60)}" isn't in the reference`);
  return text.replace(from, to);
};

/** A kit's reference issue of a brief, edited, in a fresh run: rendered, then checked. */
async function attempt(name, kit, brief, edit = (_path, text) => text) {
  const dir = await makeRun("template", kit, brief, name, root);
  const files = (await referenceOf(kit))((await briefOf("template", brief)).content);
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), edit(path, text));
  }
  const render = existsSync(join(dir, "tools/render.mjs")) ? await sh("node", ["tools/render.mjs"], dir) : { code: 0, out: "", err: "" };
  const email = render.code === 0 ? lastJson((await sh("node", ["tools/check.mjs", "--json"], dir)).out) : null;
  const guard = render.code === 0 ? lastJson((await sh("node", ["tools/guardrails.mjs", "--json"], dir)).out) : null;
  const parts = render.code === 0 ? lastJson((await sh("node", ["tools/guardrails.mjs", "--parts"], dir)).out) : null;
  return { dir, render, email, guard, parts };
}

let failures = 0;
const fail = (message) => {
  failures++;
  console.log(`  ✗ ${message}`);
};

if (writeReferences) {
  console.log("Writing each kit's tools/brand-reference.json from its first brief's reference.");
  for (const kit of kits) {
    const { render, parts } = await attempt("parts", kit, briefs[0]);
    if (render.code !== 0 || !parts?.header || !parts?.footer) {
      fail(`${kit}: no header and footer to write (${render.err.slice(0, 200)})`);
      continue;
    }
    const to = join(suiteDir, "kits", kit, "tools/brand-reference.json");
    await mkdir(dirname(to), { recursive: true });
    await writeFile(to, `${JSON.stringify(parts, null, 2)}\n`);
    console.log(`  ✓ ${kit}`);
  }
}

if (only.includes("refs")) {
  console.log("References: each renders, passes the email check and keeps every guardrail, its header and footer the kit's own.");
  for (const brief of briefs) {
    for (const kit of kits) {
      const { render, email, guard } = await attempt("ref", kit, brief);
      if (render.code !== 0) fail(`${kit} ${brief}: the render failed: ${(render.err || render.out).slice(0, 300)}`);
      else if (!email?.pass) fail(`${kit} ${brief}: the email check: ${email ? email.results.filter((r) => !r.ok).map((r) => `${r.name} — ${r.detail}`).join(" | ") : "didn't run"}`);
      else if (!guard?.pass) fail(`${kit} ${brief}: the guardrails: ${guard ? guard.results.filter((r) => !r.ok).map((r) => `${r.name} — ${r.detail}`).join(" | ") : "didn't run"}`);
      else console.log(`  ✓ ${kit} ${brief} (${email.total} email checks, ${guard.total} guardrails)`);
    }
  }
}

if (only.includes("negative")) {
  console.log("Broken references: each fails the guardrail named.");
  const brief = briefs[0];
  const at = (file, from, to) => (path, text) => (path === file ? sub(from, to)(text) : text);
  const NEGATIVE = [
    ["html", "brand header", "a header with a logo of another size", at("out/email.html", 'width="126" height="64" alt="Orbit"', 'width="120" height="61" alt="Orbit"')],
    ["html", "brand footer", "a footer with another address", at("out/email.html", "Orbit Labs, 500 Market St, San Francisco.", "Orbit Labs, San Francisco.")],
    ["html", "unsubscribe link", "no unsubscribe link", at("out/email.html", 'href="https://orbit.dev/unsubscribe?utm_source=newsletter"', 'href="https://orbit.dev/?utm_source=newsletter"')],
    ["html", "preview text", "no preview text", (path, text) => (path === "out/email.html" ? text.replace(/(opacity: 0;">)[^<]*/, "$1Another issue's preview") : text)],
    ["react-email", "link domains", "a button off Orbit's domains", (path, text) => (path === "emails/email.tsx" ? text.replace(/href="https:\/\/[a-z.]*orbit\.dev\/[^"]*"/, 'href="https://elsewhere.example/?utm_source=newsletter"') : text)],
    ["react-email", "UTM parameter", "a button without its UTM tag", (path, text) => (path === "emails/email.tsx" ? text.replace("?utm_source=newsletter", "") : text)],
    ["mjml", "palette colors", "a text in a color off the palette", at("emails/email.mjml", "<mj-text>", '<mj-text color="#ff0066">')],
    ["html", "brand fonts", "a text in another font", at("out/email.html", 'color: #1f2937; font-family: Helvetica, Arial, sans-serif; font-size: 16px;', 'color: #1f2937; font-family: Georgia, serif; font-size: 16px;')],
    ["html", "image alt", "an image without alt text", (path, text) => (path === "out/email.html" ? text.replace(/(<img src="https:\/\/assets\.orbit\.dev\/img\/(?!orbit-logo)[^"]+" width="536") alt="[^"]*"/, '$1 alt=""') : text)],
    ["html", "call to action", "no button", (path, text) => (path === "out/email.html" ? text.replace(/<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px;">[\s\S]*?<\/table>/g, "") : text)],
  ];
  for (const [kit, named, what, edit] of NEGATIVE) {
    if (!kits.includes(kit)) continue;
    const { render, guard } = await attempt(`neg-${named.replace(/\W+/g, "-")}`, kit, brief, edit);
    const failed = failedNames(guard);
    if (render.code !== 0) fail(`${kit}, ${what}: the render failed: ${render.err.slice(0, 200)}`);
    else if (!failed.includes(named)) fail(`${kit}, ${what}: expected "${named}" to fail; failed: ${failed.join(", ") || "nothing"}`);
    else console.log(`  ✓ ${kit}, ${what}: ${named}`);
  }
  // The template refuses what the others would take: the issue isn't written.
  if (kits.includes("he")) {
    const HE = [
      ["template/slot-style", "a body with a style of its own", sub("<Text>", '<Text style={{ color: "#ff0066" }}>')],
      ["template/link-domain", "a button off Orbit's domains", (text) => text.replace(/href="https:\/\/[a-z.]*orbit\.dev\/[^"]*"/, 'href="https://elsewhere.example/?utm_source=newsletter"')],
      ["template/slot-count", "a body with no button", (text) => text.replace(/\n\s*<Button[^\n]*<\/Button>/g, "")],
    ];
    for (const [code, what, edit] of HE) {
      const { dir, render } = await attempt(`neg-he-${code.replace(/\W+/g, "-")}`, "he", brief, (path, text) => (path === "designs/newsletter.tsx" ? edit(text) : text));
      const said = render.out + render.err;
      if (render.code === 0) fail(`he, ${what}: rendered; the template should refuse it with ${code}`);
      else if (!said.includes(code)) fail(`he, ${what}: refused, but not with ${code}: ${said.slice(0, 300)}`);
      else if (existsSync(join(dir, "out/email.html"))) fail(`he, ${what}: refused, but out/email.html was written`);
      else console.log(`  ✓ he, ${what}: refused, ${code}`);
    }
  }
}

if (only.includes("authoring")) {
  console.log("Authoring: each kit's newsletter as its maintainers wrote it, given the reference issue and the hostile bodies.");
  for (const kit of kits) {
    const dir = await makeRun("template", `${kit}-author`, "authoring", "maintainers", root);
    // What the authoring agent would write: the production kit's own files (its template, layout, includes or starter).
    const own = join(suiteDir, "kits", kit);
    for (const entry of await readdir(own)) {
      if (["kit.json", "CLAUDE.md", "tools"].includes(entry)) continue;
      await cp(join(own, entry), join(dir, entry), { recursive: true });
    }
    const ran = await sh("node", ["tools/check.mjs", "--json"], dir);
    const result = lastJson(ran.out);
    if (!result?.pass) {
      fail(`${kit}: the reference issue didn't pass: ${result ? result.results.filter((r) => !r.ok).map((r) => `${r.name} — ${r.detail}`).join(" | ") : (ran.err || ran.out).slice(0, 300)}`);
      continue;
    }
    const { held, escaped, hostile, bodies } = result.measures;
    if (kit === "he") {
      if (escaped !== 0 || held !== hostile) fail(`he: ${escaped} hostile bodies escaped: ${bodies.filter((b) => !b.held).map((b) => b.name).join(", ")}`);
      else console.log(`  ✓ he: the template refused all ${hostile} (${bodies.map((b) => b.refused.join("+")).join(", ")})`);
      continue;
    }
    const unseen = bodies.filter((b) => !b.escaped || !b.broke.includes(b.expected));
    if (unseen.length) fail(`${kit}: hostile bodies the check didn't see break their guardrail: ${unseen.map((b) => `${b.name} (broke ${b.broke?.join(", ") || "nothing"}, expected ${b.expected})`).join("; ")}`);
    else console.log(`  ✓ ${kit}: ${escaped} of ${hostile} escaped, each breaking its guardrail (${bodies.map((b) => b.expected).join(", ")})`);
  }
}

// ─── The launch graphic ─────────────────────────────────────────────────────

/** A launch kit's reference (or `values`) in a fresh run, edited, drawn in both formats and checked. */
async function launchAttempt(name, kit, brief, { values, design = kit.replace(/-(revise|author)$/, ""), edit = (_path, text) => text } = {}) {
  const dir = await makeRun("template", kit, brief, name, root);
  for (const [path, text] of Object.entries((await referenceOf(design))(values ?? (await briefOf("template", brief)).values))) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), text);
  }
  // An edit of the kit's own files, in this run (a broken template).
  for (const path of ["templates/launch.tsx", "templates/launch.ts"]) if (existsSync(join(dir, path))) await writeFile(join(dir, path), edit(path, await readFile(join(dir, path), "utf8")));
  const render = await sh("node", ["tools/render-launch.mjs"], dir);
  const check = lastJson((await sh("node", ["tools/check.mjs", "--json"], dir)).out);
  return { dir, render, check };
}
const failing = (check) => (check?.results ?? []).filter((r) => !r.ok);
const briefsIn = (group) => briefsOf("template", group);

if (only.includes("launch-refs")) {
  console.log("Launch references: each draws both formats and passes the launch check.");
  for (const brief of await briefsIn("launch")) {
    for (const kit of launchKits) {
      const { render, check } = await launchAttempt("ref", kit, brief);
      if (!check?.pass) fail(`${kit} ${brief}: ${check ? failing(check).map((r) => `${r.name} — ${r.detail}`).join(" | ").slice(0, 600) : (render.err || render.out).slice(0, 400)}`);
      else console.log(`  ✓ ${kit} ${brief} (${check.total} checks)`);
    }
  }
}

if (only.includes("launch-negative")) {
  console.log("Broken launch references: each fails the check named.");
  const brief = "launch-launch";
  const at = (file, from, to) => (path, text) => (path === file ? sub(from, to)(text) : text);
  const NEGATIVE = [
    ["launch-satori", "square: inside its regions", "the logo moved", at("templates/launch.tsx", "logo: { left: 72, top: 72,", "logo: { left: 880, top: 72,")],
    ["launch-satori", 'square: image "screenshot"', "the screenshot cropped to fill its box", at("templates/launch.tsx", "const s = Math.min(inner.width / v.screenshot.width, inner.height / v.screenshot.height);", "const s = Math.max(inner.width / v.screenshot.width, inner.height / v.screenshot.height);")],
    ["launch-playwright", "square: only Inter", "the headline in another font", at("templates/launch.ts", "#headline { ${box(f.headline)} color: #f7f7fb;", "#headline { ${box(f.headline)} font-family: Georgia, serif; color: #f7f7fb;")],
    ["launch-satori", 'square: copy "features-0"', "a feature cut short", at("templates/launch.tsx", "lineHeight: 1.3 }}>{feature}</div>", "lineHeight: 1.3 }}>{feature.slice(0, 10)}</div>")],
    ["launch-satori", "square: artwork fills its region", "no artwork", (path, text) => (path === "templates/launch.tsx" ? text.replace(/\n\s*<img src=\{await dataUri\(v\.artwork\.src\)\}[^\n]*/, "") : text)],
    ["launch-he", 'square: font "headline"', "the headline in another color", at("templates/launch.tsx", 'style={{ color: "#f7f7fb", fontWeight: 700, lineHeight: 1.1 }}', 'style={{ color: "#ffd166", fontWeight: 700, lineHeight: 1.1 }}')],
  ];
  for (const [kit, named, what, edit] of NEGATIVE) {
    if (!launchKits.includes(kit)) continue;
    const { check } = await launchAttempt(`neg-${named.replace(/\W+/g, "-")}`, kit, brief, { edit });
    const names = failing(check).map((r) => r.name);
    if (!names.includes(named)) fail(`${kit}, ${what}: expected "${named}" to fail; failed: ${names.join(", ") || "nothing"}`);
    else console.log(`  ✓ ${kit}, ${what}: ${named}`);
  }
}

if (only.includes("launch-hostile")) {
  console.log("Hostile launches: the template fails each loudly or draws it right; no off-brand result passes.");
  const table = [];
  for (const brief of await briefsIn("launch-hostile")) {
    const { hostile } = await briefOf("template", brief);
    const row = { hostile };
    for (const kit of launchKits) {
      const { check } = await launchAttempt("hostile", kit, brief);
      const outcomes = Object.values(check?.measures?.outcomes ?? {});
      const outcome = outcomes.includes("escaped") ? "escaped" : outcomes.includes("failed") ? "failed" : outcomes.length ? "correct" : "no result";
      row[kit] = outcome;
      // An off-brand launch can't be drawn right: the check must not pass one.
      if (["long", "lines", "wide", "arabic", "nobold"].includes(hostile) && outcome === "correct") fail(`${kit} ${hostile}: the check passed an off-brand launch`);
      if (kit === "launch-he" && outcome === "escaped") fail(`launch-he ${hostile}: a violation escaped the template: ${failing(check).map((r) => r.name).join(", ")}`);
      if (kit === "launch-he" && ["german", "offbrand"].includes(hostile) && outcome !== "correct") fail(`launch-he ${hostile}: expected a correct render: ${failing(check).map((r) => `${r.name} — ${r.detail}`).join(" | ").slice(0, 400)}`);
    }
    table.push(row);
  }
  console.table(table);
}

if (only.includes("launch-revision")) {
  console.log("Revisions: the change, and only the change, redrawn.");
  for (const brief of await briefsIn("launch-revision")) {
    for (const kit of launchKits.map((k) => `${k}-revise`)) {
      const { check } = await launchAttempt("revise", kit, brief);
      if (!check?.pass) fail(`${kit} ${brief}: ${failing(check).map((r) => `${r.name} — ${r.detail}`).join(" | ").slice(0, 500)}`);
      else console.log(`  ✓ ${kit} ${brief}`);
    }
  }
  if (launchKits.includes("launch-he")) {
    const values = { ...(await briefOf("template", "launch-r-date")).values, headline: "Meet Orbit 3.0: release notes, written for you" };
    const { check } = await launchAttempt("revise-more", "launch-he-revise", "launch-r-date", { values });
    const names = failing(check).map((r) => r.name);
    if (!names.includes("square: only the change is redrawn")) fail(`launch-he-revise, a change that redraws the headline too: expected "square: only the change is redrawn" to fail; failed: ${names.join(", ") || "nothing"}`);
    else console.log("  ✓ launch-he-revise, a change that redraws the headline too: only the change is redrawn");
  }
}

if (only.includes("launch-authoring")) {
  console.log("Launch authoring: each kit's maintainers' template, as an authoring agent would leave it, passes.");
  for (const kit of launchKits) {
    const dir = await makeRun("template", `${kit}-author`, "launch-authoring", "maintainers", root);
    await cp(join(suiteDir, "kits", kit, "templates"), join(dir, "templates"), { recursive: true });
    const ran = await sh("node", ["tools/check.mjs", "--json"], dir);
    const result = lastJson(ran.out);
    if (!result?.pass) fail(`${kit}: ${result ? failing(result).map((r) => `${r.name} — ${r.detail}`).join(" | ").slice(0, 500) : (ran.err || ran.out).slice(0, 300)}`);
    else console.log(`  ✓ ${kit}-author (${result.total} checks)`);
  }
}

console.log(failures ? `\n${failures} failed.` : "\nAll passed.");
process.exit(failures ? 1 : 0);
