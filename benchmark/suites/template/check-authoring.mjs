// The template suite's authoring check: what the kit's reusable newsletter (a template, or a layout, includes or a
// starter file, with written rules) lets through. Copied into an authoring run as tools/check.mjs.
//
//   node tools/check.mjs [--json]
//
// 1. The reference issue (tools/bodies/reference.json), given to the newsletter through the kit's adapter
//    (tools/adapter.mjs), must render, pass the email checker (tools/email-check.mjs) and keep every guardrail
//    (tools/guardrails.mjs). That's the run's pass: the newsletter works.
// 2. Each hostile body (a literal color, a raw HTML block, an off-domain link, no call to action) is given the same
//    way. A refusal with a diagnostic is the guardrail holding. A body it takes is an escaped violation, and its HTML
//    goes to the guardrail checker, which says which guardrail it broke (the one the body names, `breaks`). A crash,
//    or no output, is a failure of its own.
// 3. Source and output are scored apart: a literal color in a body's source is a source finding where the body was
//    taken (the rendered HTML can't show one that's a palette color).
import { spawn } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const run = resolve(here, "..");
const json = process.argv.includes("--json");

function sh(cmd, args) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd: run, stdio: ["ignore", "pipe", "pipe"] });
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

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: ok ? "" : detail });
const bodies = {};
for (const f of (await readdir(join(here, "bodies"))).filter((f) => f.endsWith(".json")).sort()) bodies[f.slice(0, -5)] = JSON.parse(await readFile(join(here, "bodies", f), "utf8"));

let adapter;
try {
  adapter = await import(pathToFileURL(join(here, "adapter.mjs")).href);
} catch (e) {
  check("the kit's adapter", false, e.message);
}

const hostile = [];
let referenceParts = null;
if (adapter) {
  // 1. The reference issue: it must work.
  const ref = await adapter.apply(bodies.reference, join(run, "out/email.html"));
  if (!ref.html) check("the reference issue renders", false, ref.refused ? `the newsletter refused it: ${ref.refused.join(", ")}` : ref.error);
  else {
    check("the reference issue renders", true);
    const email = lastJson((await sh("node", ["tools/email-check.mjs", "--json"])).out);
    check("the reference issue passes the email check", email?.pass, email ? failedNames(email).join(", ") : "the email check didn't run");
    // Its header and footer are what every other body's must be: the newsletter's own, whatever the body.
    const parts = lastJson((await sh("node", ["tools/guardrails.mjs", "--parts"])).out);
    referenceParts = parts;
    await writeFile(join(run, "out/brand-reference.json"), JSON.stringify(parts ?? {}));
    const guard = lastJson((await sh("node", ["tools/guardrails.mjs", "--json", "--reference", "out/brand-reference.json"])).out);
    check("the reference issue keeps every guardrail", guard?.pass, guard ? failedNames(guard).join(", ") : "the guardrail check didn't run");
  }

  // 2. The hostile bodies: each refused, or taken with what it broke.
  for (const [id, body] of Object.entries(bodies)) {
    if (id === "reference") continue;
    const out = join(run, "out", `hostile-${id}.html`);
    const r = await adapter.apply(body, out);
    const literal = /#[0-9a-f]{3,8}\b|rgba?\(/i.test(body.body);
    if (r.refused) {
      hostile.push({ body: id, name: body.name, held: r.refused.length > 0, refused: r.refused });
      if (!r.refused.length) check(`${body.name}: refused with a diagnostic`, false, "refused, saying nothing");
      continue;
    }
    if (r.error || !r.html) {
      hostile.push({ body: id, name: body.name, held: false, crashed: true, error: (r.error ?? "no output").slice(0, 300) });
      check(`${body.name}: refused or rendered`, false, `it crashed: ${(r.error ?? "no output").slice(0, 200)}`);
      continue;
    }
    const guard = lastJson((await sh("node", ["tools/guardrails.mjs", "--json", "--html", `out/hostile-${id}.html`, ...(referenceParts ? ["--reference", "out/brand-reference.json"] : [])])).out);
    const broke = failedNames(guard);
    hostile.push({ body: id, name: body.name, held: false, escaped: true, broke, ...(literal ? { sourceFinding: "a literal color" } : {}), expected: body.breaks });
  }
}

const escaped = hostile.filter((h) => h.escaped).length;
const measures = { hostile: hostile.length, held: hostile.filter((h) => h.held).length, escaped, sourceFindings: hostile.filter((h) => h.sourceFinding).length, bodies: hostile };
const failed = results.filter((r) => !r.ok);
if (json) console.log(JSON.stringify({ pass: failed.length === 0, total: results.length, failed: failed.length, results, measures }));
else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
  for (const h of hostile) console.log(`  ${h.held ? "held" : h.crashed ? "crashed" : "escaped"}: ${h.name}${h.refused ? ` (${h.refused.join(", ")})` : h.broke ? ` (broke ${h.broke.join(", ") || "nothing the guardrails see"})` : ""}`);
  console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed: the newsletter works, and ${measures.held} of ${measures.hostile} hostile bodies were refused.`);
}
process.exit(failed.length ? 1 : 0);
