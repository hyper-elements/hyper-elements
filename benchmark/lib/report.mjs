// Summarizes results (one or more .jsonl files) per suite and kit: pass rate, and the median of each cost; then,
// for Hyper Elements against each other kit, how often it was faster within a brief and a one-sided Mann–Whitney test.
// The skill suite has its own report (lib/report-skill.mjs), read against the batch's plan.json and a maintainer's
// marks.json beside the results file, where they exist.
//   node lib/report.mjs results/a.jsonl [results/b.jsonl …] [--json] [--compare <base>,<other>]
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { formatSkillReport, parseResults, skillReport } from "./report-skill.mjs";

const flagValue = (name) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const compare = flagValue("compare")?.split(",");
const files = process.argv.slice(2).filter((a, i, xs) => !a.startsWith("--") && xs[i - 1] !== "--compare");
const parsed = parseResults(await Promise.all(files.map((f) => readFile(f, "utf8"))));
const beside = async (ext) => {
  const found = files.map((f) => f.replace(/\.jsonl$/, ext)).filter((f) => existsSync(f));
  return Promise.all(found.map(async (f) => JSON.parse(await readFile(f, "utf8"))));
};
const skillOut = {};
if (parsed.rows.some((r) => r.suite === "skill")) {
  const plans = await beside(".plan.json");
  // One batch's plan; several results files are read as one batch only without plans.
  if (plans.length > 1) throw new Error("the skill report reads one batch's plan.json at a time: pass one results file");
  const marks = Object.assign({}, ...(await beside(".marks.json")));
  const rep = skillReport({ rows: parsed.rows.filter((r) => r.suite === "skill"), partial: parsed.partial, plan: plans[0] ?? null, marks, compare });
  console.log(`# skill\n\n${formatSkillReport(rep)}`);
  skillOut.skill = rep;
}
const all = parsed.rows.filter((r) => r.suite !== "skill").map((r) => ({ suite: "email", ...r }));
// A run that reached outside its own directory (lib/audit.mjs) counts for nothing: it may have read another's work.
const invalid = all.filter((r) => r.valid === false);
const rows = all.filter((r) => r.valid !== false);
if (invalid.length) {
  console.log(`Left out, reached outside their run directory (${invalid.length}):`);
  for (const r of invalid) console.log(`- ${r.suite} ${r.kit} ${r.brief} #${r.rep}: ${[...new Set(r.outside.filter((o) => o.got && !o.own).map((o) => o.path))].slice(0, 2).join(", ")}`);
}
const unaudited = rows.filter((r) => r.valid === undefined).length;
if (unaudited) console.log(`${unaudited} rows predate the audit (no "valid" field): their runs weren't isolated.`);
const median = (xs) => { const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
const total = (r) => r.inputTokens + r.cacheWriteTokens + r.cacheReadTokens + r.outputTokens;

/** One-sided Mann–Whitney U (normal approximation with tie correction): P(a's values are not smaller than b's). */
function mannWhitney(a, b) {
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  const ranks = new Array(all.length);
  let ties = 0;
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    for (let k = i; k <= j; k++) ranks[k] = (i + j) / 2 + 1;
    const t = j - i + 1;
    ties += t ** 3 - t;
    i = j + 1;
  }
  const n1 = a.length, n2 = b.length, n = n1 + n2;
  const r1 = all.reduce((s, x, i) => s + (x.g === 0 ? ranks[i] : 0), 0);
  const u = r1 - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2, sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - ties / (n * (n - 1))));
  const z = (u - mu + 0.5) / sigma;
  // Φ(z), the probability of a U this small if neither is faster.
  const phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp((-x * x) / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
  return { u, p: phi(z) };
}

const out = { ...skillOut };
for (const suite of [...new Set(rows.map((r) => r.suite))]) {
  const rs = rows.filter((r) => r.suite === suite);
  const kits = [...new Set(rs.map((r) => r.kit))];
  console.log(`\n# ${suite} (${rs.length} runs)`);
  const table = kits.map((kit) => {
    const k = rs.filter((r) => r.kit === kit);
    const ok = k.filter((r) => r.pass);
    return {
      kit, runs: k.length, passed: ok.length, passRate: ok.length / k.length,
      firstCheckPass: k.filter((r) => r.firstCheckPassed).length,
      medSeconds: median(k.map((r) => r.wallMs / 1000)),
      medTurns: median(k.map((r) => r.turns)),
      medCheckRuns: median(k.map((r) => r.checkRuns)),
      medRenderRuns: median(k.map((r) => r.renderRuns)),
      medRenderErrors: median(k.map((r) => r.renderErrors ?? NaN)),
      firstRenderOk: k.filter((r) => r.firstRenderOk).length,
      medImageReads: median(k.map((r) => r.imageReads ?? NaN)),
      medOutputTokens: median(k.map((r) => r.outputTokens)),
      medTotalTokens: median(k.map(total)),
      medCost: median(k.map((r) => r.costUsd)),
      sumCost: sum(k.map((r) => r.costUsd)),
      medSourceTokens: median(k.map((r) => r.sourceTokens)),
    };
  });
  console.table(table.map((t) => ({ ...t, passRate: `${Math.round(t.passRate * 100)}%`, medSeconds: Math.round(t.medSeconds), medCost: t.medCost?.toFixed(3), sumCost: t.sumCost.toFixed(2) })));

  // Per brief: median seconds per kit, to see where the difference comes from.
  const briefs = [...new Set(rs.map((r) => r.brief))].sort();
  console.log("Median seconds (pass/runs) per brief:");
  console.table(Object.fromEntries(briefs.map((b) => [b, Object.fromEntries(kits.map((k) => {
    const x = rs.filter((r) => r.kit === k && r.brief === b);
    return [k, `${Math.round(median(x.map((r) => r.wallMs / 1000)))}s (${x.filter((r) => r.pass).length}/${x.length})`];
  }))])));

  // Hyper Elements against each other kit: within each brief, every pairing of its runs with the other's.
  const tests = [];
  if (kits.includes("he")) {
    for (const other of kits.filter((k) => k !== "he")) {
      let faster = 0, pairs = 0;
      for (const b of briefs) {
        const a = rs.filter((r) => r.kit === "he" && r.brief === b), o = rs.filter((r) => r.kit === other && r.brief === b);
        for (const x of a) for (const y of o) { pairs++; if (x.wallMs < y.wallMs) faster++; }
      }
      const time = mannWhitney(rs.filter((r) => r.kit === "he").map((r) => r.wallMs), rs.filter((r) => r.kit === other).map((r) => r.wallMs));
      const tokens = mannWhitney(rs.filter((r) => r.kit === "he").map((r) => r.outputTokens), rs.filter((r) => r.kit === other).map((r) => r.outputTokens));
      const ratio = median(rs.filter((r) => r.kit === other).map((r) => r.wallMs)) / median(rs.filter((r) => r.kit === "he").map((r) => r.wallMs));
      tests.push({ other, fasterInBrief: `${faster} of ${pairs}`, timeRatio: +ratio.toFixed(2), pTime: +time.p.toPrecision(2), pOutputTokens: +tokens.p.toPrecision(2) });
    }
    console.log("Hyper Elements against each (one-sided Mann–Whitney: p that it isn't faster / doesn't write fewer tokens):");
    console.table(tests);
  }

  // The email client problems left in each finished email (kits whose render tool gives diagnostics), and Hyper
  // Elements printing them with their clients, fix and link (he) against without (he-plain).
  const measured = kits.filter((kit) => rs.some((r) => r.kit === kit && r.emailClients && !r.emailClients.error));
  if (measured.length) {
    const left = (kit) => rs.filter((r) => r.kit === kit && r.emailClients && !r.emailClients.error).map((r) => r.emailClients);
    const clients = measured.map((kit) => {
      const k = left(kit);
      const codes = {};
      for (const e of k) for (const [code, n] of Object.entries(e.codes)) codes[code] = (codes[code] ?? 0) + n;
      return {
        kit, measured: k.length, noWarnings: k.filter((e) => e.warnings === 0).length,
        medWarnings: median(k.map((e) => e.warnings)), sumWarnings: sum(k.map((e) => e.warnings)), medNotes: median(k.map((e) => e.notes)),
        codes: Object.entries(codes).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", "),
      };
    });
    console.log("Email client warnings left in the finished email:");
    console.table(clients);
    if (measured.includes("he") && measured.includes("he-plain")) {
      const t = mannWhitney(left("he").map((e) => e.warnings), left("he-plain").map((e) => e.warnings));
      console.log(`he (clients, fix and link printed) against he-plain (without): one-sided Mann–Whitney p = ${t.p.toPrecision(2)} that he doesn't leave fewer warnings.`);
      tests.push({ other: "he-plain", measure: "emailClientWarnings", pWarnings: +t.p.toPrecision(2) });
    }
    const failed = rs.filter((r) => r.emailClients?.error);
    if (failed.length) console.log(`Not measured (the render tool failed): ${failed.map((r) => `${r.kit} ${r.brief} #${r.rep}`).join(", ")}`);
    out[suite] = { ...out[suite], clients };
  }

  // The template suite: the guardrails each finished issue broke (escaped violations), and, for the authoring runs,
  // the hostile bodies each kit's newsletter refused or let through.
  if (rs.some((r) => r.violations !== undefined || r.measures)) {
    const guarded = kits.filter((kit) => rs.some((r) => r.kit === kit && Array.isArray(r.violations)));
    if (guarded.length) {
      const escapes = guarded.map((kit) => {
        const k = rs.filter((r) => r.kit === kit && Array.isArray(r.violations));
        const names = {};
        for (const r of k) for (const v of r.violations) names[v] = (names[v] ?? 0) + 1;
        return { kit, measured: k.length, clean: k.filter((r) => !r.violations.length).length, violations: sum(k.map((r) => r.violations.length)), which: Object.entries(names).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(", ") };
      });
      console.log("Guardrails each finished issue broke (violations that escaped):");
      console.table(escapes);
      out[suite] = { ...out[suite], escapes };
    }
    // The launch graphic: each format's outcome (correct, failed with a reason, or a violation that escaped), per kit,
    // and the hostile launches' by variant.
    const launched = kits.filter((kit) => rs.some((r) => r.kit === kit && r.measures?.outcomes));
    if (launched.length) {
      const outcomes = launched.map((kit) => {
        const all = rs.filter((r) => r.kit === kit && r.measures?.outcomes).flatMap((r) => Object.values(r.measures.outcomes));
        return { kit, formats: all.length, correct: all.filter((o) => o === "correct").length, failed: all.filter((o) => o === "failed").length, escaped: all.filter((o) => o === "escaped").length };
      });
      console.log("Launch graphics: each format's outcome (failed: not drawn, with the reason; escaped: drawn off the brand):");
      console.table(outcomes);
      const hostile = rs.filter((r) => r.measures?.outcomes && /^launch-h-/.test(r.brief));
      if (hostile.length) {
        const byVariant = {};
        for (const r of hostile) {
          const v = (byVariant[r.brief.slice("launch-h-".length)] ??= {});
          const o = Object.values(r.measures.outcomes);
          v[r.kit] = o.includes("escaped") ? "escaped" : o.includes("failed") ? "failed" : "correct";
        }
        console.log("Hostile launches, by variant:");
        console.table(byVariant);
      }
      out[suite] = { ...out[suite], launchOutcomes: outcomes };
    }
    // Break-even: how many assets before a template's authoring pays for itself against a baseline, from the medians
    // (authoring's extra cost over the baseline's, divided by the per-asset saving in production), in time and tokens.
    const tasks = [
      { task: "newsletter", he: "he", others: ["react-email", "mjml", "html"], production: (r) => /^news-/.test(r.brief) },
      { task: "launch", he: "launch-he", others: ["launch-satori", "launch-playwright"], production: (r) => /^launch-(?!h-|r-|authoring)/.test(r.brief) },
    ];
    const breakEven = [];
    for (const t of tasks) {
      const med = (kit, pick, value) => median(rs.filter((r) => r.kit === kit && pick(r) && r.pass).map(value));
      const cost = { seconds: (r) => r.wallMs / 1000, tokens: total };
      for (const other of t.others) {
        const row = { task: t.task, against: other };
        for (const [unit, value] of Object.entries(cost)) {
          const authoring = med(`${t.he}-author`, () => true, value) - med(`${other}-author`, () => true, value);
          const saving = med(other, t.production, value) - med(t.he, t.production, value);
          row[`${unit}PerAsset`] = Number.isFinite(saving) ? +saving.toFixed(1) : null;
          row[`breakEven${unit === "seconds" ? "Time" : "Tokens"}`] = Number.isFinite(authoring) && Number.isFinite(saving) ? (saving > 0 ? Math.max(0, Math.ceil(authoring / saving)) : "never") : null;
        }
        if (Object.values(row).some((v) => v !== null && v !== t.task && v !== other)) breakEven.push(row);
      }
    }
    if (breakEven.length) {
      console.log("Break-even (assets, from passing runs' medians: the template's extra authoring cost over the per-asset saving):");
      console.table(breakEven);
      out[suite] = { ...out[suite], breakEven };
    }
    const authored = kits.filter((kit) => rs.some((r) => r.kit === kit && r.measures && !r.measures.outcomes));
    if (authored.length) {
      const authoring = authored.map((kit) => {
        const k = rs.filter((r) => r.kit === kit && r.measures).map((r) => r.measures);
        return { kit, runs: k.length, medHeld: median(k.map((m) => m.held)), medEscaped: median(k.map((m) => m.escaped)), sumSourceFindings: sum(k.map((m) => m.sourceFindings)) };
      });
      console.log("Authoring: hostile bodies each kit's newsletter refused, and those that escaped (medians):");
      console.table(authoring);
      out[suite] = { ...out[suite], authoring };
    }
  }

  // Two-phase suites (a `changePrompt`): each phase on its own. The change runs only after a passing build.
  if (rs.some((r) => r.build)) {
    console.log("Per phase (medians; the change phase only where the build passed):");
    console.table(kits.flatMap((kit) => ["build", "change"].map((phase) => {
      const k = rs.filter((r) => r.kit === kit && r[phase]).map((r) => r[phase]);
      return {
        kit, phase, runs: k.length, passed: k.filter((x) => x.pass).length,
        firstCheckPass: k.filter((x) => x.firstCheckPassed).length,
        medSeconds: Math.round(median(k.map((x) => x.wallMs / 1000))),
        medTurns: median(k.map((x) => x.turns)),
        medOutputTokens: median(k.map((x) => x.outputTokens)),
        medCost: median(k.map((x) => x.costUsd))?.toFixed(3),
        ...(phase === "change" ? { medFilesChanged: median(k.map((x) => x.filesChanged)), medLinesChanged: median(k.map((x) => x.linesAdded + x.linesRemoved)) } : {}),
      };
    })));
    if (kits.includes("he")) {
      const phaseTests = kits.filter((k) => k !== "he").flatMap((other) => ["build", "change"].map((phase) => {
        const a = rs.filter((r) => r.kit === "he" && r[phase]).map((r) => r[phase].wallMs), b = rs.filter((r) => r.kit === other && r[phase]).map((r) => r[phase].wallMs);
        return { other, phase, timeRatio: +(median(b) / median(a)).toFixed(2), pTime: a.length && b.length ? +mannWhitney(a, b).p.toPrecision(2) : null };
      }));
      console.log("Hyper Elements against each, per phase (one-sided Mann–Whitney on wall time):");
      console.table(phaseTests);
      tests.push(...phaseTests.map((t) => ({ ...t, perPhase: true })));
    }
  }

  const fails = rs.filter((r) => !r.pass);
  if (fails.length) {
    console.log("Failures:");
    for (const r of fails) console.log(`- ${r.kit} ${r.brief} #${r.rep}: ${r.failed.join(" | ").slice(0, 300)}`);
  }
  out[suite] = { ...out[suite], table, tests };
}
if (process.argv.includes("--json")) console.log(JSON.stringify(out));
