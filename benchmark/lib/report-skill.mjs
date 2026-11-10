// The skill suite's report: per arm (kit), how often the agent's first try was valid, how many fix rounds it took,
// whether the result passed, which mistakes it made and what it cost; and, between arms, the difference averaged over
// the tasks both ran, with a 95% bootstrap interval over tasks.
//
// Rows come from bench.mjs. A row left out (valid: false) is a harness error, tampered (the tamper hashes, the
// static scan, or a maintainer's mark) or reached outside its run; it's counted, never rated. A row's first try and
// fix rounds count only where the replay verified them (lib/replay.mjs); each arm shows its coverage, and a
// comparison where either arm has under 80% verified is "inconclusive: coverage". Rates are shown only for cells
// (task × arm) whose planned runs all finished, against the batch's plan.json.

const COVERAGE = 0.8;
const NAMING = /\b(mobile|hover)\b/;
const Z = 1.959964;

export const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Wilson's 95% interval for k successes in n. */
export function wilson(k, n) {
  if (!n) return null;
  const p = k / n, d = 1 + (Z * Z) / n;
  const c = (p + (Z * Z) / (2 * n)) / d, h = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** A seeded generator, so the same results give the same report. */
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The mean of per-task differences, and its 95% percentile bootstrap interval, resampling tasks. */
export function pairedInterval(diffs, { resamples = 10000, seed = 1 } = {}) {
  if (!diffs.length) return null;
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const rand = mulberry32(seed), means = new Float64Array(resamples);
  for (let i = 0; i < resamples; i++) {
    let s = 0;
    for (let j = 0; j < diffs.length; j++) s += diffs[Math.floor(rand() * diffs.length)];
    means[i] = s / diffs.length;
  }
  means.sort();
  const at = (q) => means[Math.min(resamples - 1, Math.max(0, Math.round(q * (resamples - 1))))];
  return { mean, lo: at(0.025), hi: at(0.975) };
}

/** Results files' lines: the rows, and any `partial` marker the batch ended with. */
export function parseResults(texts) {
  const lines = texts.flatMap((t) => t.split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  return { rows: lines.filter((l) => !l.partial), partial: lines.filter((l) => l.partial) };
}

export const rowId = (r) => `${r.kit} ${r.brief} #${r.rep}`;

/**
 * A maintainer's marks (`<results>.marks.json`: `{ "<kit> <brief> #<rep>": { "tampered": "why" } }`), the only way a
 * `mismatch` becomes `tampered`. A marked row is left out.
 */
export function applyMarks(rows, marks = {}) {
  return rows.map((r) => {
    const m = marks[rowId(r)];
    if (!m?.tampered) return r;
    return { ...r, tampered: [...(r.tampered ?? []), `maintainer: ${m.tampered}`], valid: false, marked: m.tampered };
  });
}

const leftOutAs = (r) => (r.harnessError ? "harness error" : r.tampered?.length ? "tampered" : "reached outside");

/** What made a row's cutoff, grouped: the reason, with anything after a colon cut to its first word. */
export function cutoffKind(r) {
  if (r.replay?.cutoff) {
    const { reason, mismatch } = r.replay.cutoff;
    if (mismatch) return "mismatch";
    const i = reason.indexOf(": ");
    return i < 0 ? reason : `${reason.slice(0, i)}: ${reason.slice(i + 2).split(/\s+/)[0]}`;
  }
  if (r.replay?.unverified) return "sources differ from the replay's at the end";
  return null;
}

const ftRated = (r) => r.firstTry?.verified && r.firstTry.valid !== null && r.firstTry.valid !== undefined;
const total = (r) => (r.inputTokens ?? 0) + (r.cacheWriteTokens ?? 0) + (r.cacheReadTokens ?? 0) + (r.outputTokens ?? 0);
const count = (xs, f) => xs.filter(f).length;
const choose = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return c; };

/** Each key, by how many runs made it (a run counts once per key). */
export function histogram(rows) {
  const h = new Map();
  for (const r of rows) {
    const keys = new Set((r.mistakes ?? []).map((m) => (m.severity === "warning" ? `${m.key} (warning)` : m.key)));
    for (const k of keys) h.set(k, (h.get(k) ?? 0) + 1);
  }
  return [...h].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key, runs]) => ({ key, runs }));
}

/** The figures for one arm, or one task in it, over its valid rows. */
export function statsOf(rows) {
  const rated = rows.filter(ftRated);
  const valid = count(rated, (r) => r.firstTry.valid);
  const fix = rows.filter((r) => r.fixRounds?.verified && !r.fixRounds.neverValid && r.fixRounds.rounds !== null);
  const warned = rows.filter((r) => r.warningsLeft !== null && r.warningsLeft !== undefined);
  return {
    runs: rows.length,
    firstTry: { valid, of: rated.length, wilson: wilson(valid, rated.length) },
    verified: count(rows, (r) => r.firstTry?.verified),
    noRender: count(rows, (r) => r.firstTry?.verified && (r.firstTry.valid === null || r.firstTry.valid === undefined)),
    finalPass: count(rows, (r) => r.pass),
    fixRounds: { median: median(fix.map((r) => r.fixRounds.rounds)), of: fix.length, neverValid: count(rows, (r) => r.fixRounds?.verified && r.fixRounds.neverValid) },
    lookedElsewhere: count(rows, (r) => r.lookedElsewhere > 0),
    warningsLeft: { runs: count(warned, (r) => r.warningsLeft > 0), of: warned.length },
    mistakes: histogram(rows),
    cutoffs: Object.entries(rows.reduce((o, r) => { const k = cutoffKind(r); if (k) o[k] = (o[k] ?? 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]),
    median: {
      turns: median(rows.map((r) => r.turns)),
      outputTokens: median(rows.map((r) => r.outputTokens)),
      totalTokens: median(rows.map(total)),
      costUsd: median(rows.map((r) => r.costUsd)),
      seconds: median(rows.map((r) => r.wallMs / 1000)),
    },
    costUsd: rows.reduce((s, r) => s + (r.costUsd ?? 0), 0),
  };
}

/** The arm comparisons are made against: release, else candidate, else the first. */
const baseOf = (kits) => (kits.includes("release") ? "release" : kits.includes("candidate") ? "candidate" : kits[0]);

/**
 * The report's figures. `plan` is the batch's plan.json (optional: without it every cell that has rows is complete);
 * `compare` is `[base, other]` to compare one pair only.
 */
export function skillReport({ rows: all, partial = [], plan = null, marks = {}, compare = null }) {
  const rows = applyMarks(all.filter((r) => r.suite === "skill" || r.suite === undefined), marks);
  const kits = plan?.kits ?? [...new Set(rows.map((r) => r.kit))];
  const tasks = plan?.briefs ?? [...new Set(rows.map((r) => r.brief))];
  const na = plan?.na ?? {};
  const cell = (k, t) => rows.filter((r) => r.kit === k && r.brief === t);

  // Cells: planned against finished. A row left out still finished; a job the cost cap stopped has none.
  const planned = new Map();
  if (plan) for (const j of plan.jobs) planned.set(`${j.kit}\t${j.brief}`, (planned.get(`${j.kit}\t${j.brief}`) ?? 0) + 1);
  else for (const r of rows) planned.set(`${r.kit}\t${r.brief}`, (planned.get(`${r.kit}\t${r.brief}`) ?? 0) + 1);
  const complete = (k, t) => planned.has(`${k}\t${t}`) && cell(k, t).length >= planned.get(`${k}\t${t}`);
  const incomplete = [...planned].filter(([key]) => !complete(...key.split("\t"))).map(([key, n]) => {
    const [kit, brief] = key.split("\t");
    return { kit, brief, finished: cell(kit, brief).length, planned: n };
  });
  const plannedRuns = [...planned.values()].reduce((a, b) => a + b, 0);
  const isPartial = partial.length > 0 || incomplete.length > 0;

  const leftOut = rows.filter((r) => r.valid === false);
  const arms = Object.fromEntries(kits.map((kit) => {
    const done = tasks.filter((t) => complete(kit, t));
    const good = done.flatMap((t) => cell(kit, t)).filter((r) => r.valid !== false);
    const out = rows.filter((r) => r.kit === kit && r.valid === false);
    const byTask = Object.fromEntries(done.map((t) => [t, statsOf(cell(kit, t).filter((r) => r.valid !== false))]));
    // pass^3: where a task has three valid, verified first tries or more, the chance three of its runs are all valid.
    const p3 = Object.entries(byTask).filter(([, s]) => s.firstTry.of >= 3);
    const engine = rows.find((r) => r.kit === kit && r.engine)?.engine;
    return [kit, {
      kit, engine: engine ? { version: engine.version, commit: engine.commit, dirty: engine.dirty } : null,
      tasks: done, na: na[kit] ?? [],
      ...statsOf(good),
      allThree: { tasks: p3.reduce((s, [, x]) => s + choose(x.firstTry.valid, 3) / choose(x.firstTry.of, 3), 0), of: p3.length },
      leftOut: { total: out.length, ...Object.fromEntries(["harness error", "tampered", "reached outside"].map((k) => [k, count(out, (r) => leftOutAs(r) === k)])) },
      byTask,
    }];
  }));

  const pairs = compare ? [compare] : kits.filter((k) => k !== baseOf(kits)).map((k) => [baseOf(kits), k]);
  const comparisons = pairs.filter(([a, b]) => arms[a] && arms[b]).map(([a, b]) => compareArms(arms[a], arms[b], tasks));

  const mismatches = rows.filter((r) => r.mismatch).map((r) => ({
    id: rowId(r), call: r.replay?.cutoff?.call, command: r.replay?.cutoff?.input, reason: r.replay?.cutoff?.reason,
    session: r.replay?.cutoff?.session ?? null, replay: r.replay?.cutoff?.replay ?? null,
    output: r.replay?.cutoff?.output ?? "", readsUnpinned: r.readsUnpinned ?? [],
    transcript: `runs/${r.stamp}/${r.kit}__${r.brief}__${r.rep}/transcript.jsonl`, marked: r.marked ?? null,
  }));

  const negRows = arms.negative ? arms.negative.tasks.flatMap((t) => cell("negative", t)).filter((r) => r.valid !== false) : [];
  const negative = arms.negative && arms.candidate ? negativeControl(arms.candidate, arms.negative, plan, negRows) : null;

  return {
    kits, tasks, arms, comparisons, mismatches, negative,
    partial: isPartial ? { reasons: partial.map((p) => p.reason), spentUsd: partial[0]?.spentUsd ?? null, maxCostUsd: partial[0]?.maxCostUsd ?? null, finished: rows.length, planned: plannedRuns, incomplete } : null,
    leftOut: leftOut.map((r) => ({ id: rowId(r), as: leftOutAs(r), why: r.harnessError ?? (r.tampered?.length ? r.tampered.join("; ") : (r.outside ?? []).filter((o) => o.got && !o.own).map((o) => o.path).slice(0, 2).join(", ")) })),
  };
}

/**
 * One arm against the base, over the tasks both have complete with a verified first try: each task's first-try rate
 * in `b` minus `a`, averaged, with a bootstrap interval over tasks. A difference is called only when the interval
 * excludes zero, and only when both arms have 80% of those tasks' rows verified.
 */
export function compareArms(a, b, all = []) {
  const notCompared = [];
  const shared = [];
  const tasks = [...new Set([...all, ...a.tasks, ...b.tasks, ...a.na, ...b.na])];
  for (const t of tasks) {
    const why = [a, b].map((x) => (x.na.includes(t) ? `N/A for ${x.kit}` : !x.tasks.includes(t) ? `incomplete in ${x.kit}` : !x.byTask[t].firstTry.of ? `no verified first try in ${x.kit}` : null)).filter(Boolean);
    if (why.length) notCompared.push({ task: t, why: why.join(", ") });
    else shared.push(t);
  }
  const rate = (x, t) => x.byTask[t].firstTry.valid / x.byTask[t].firstTry.of;
  const diffs = shared.map((t) => rate(b, t) - rate(a, t));
  const coverage = (x) => { const s = shared.map((t) => x.byTask[t]); const runs = s.reduce((n, y) => n + y.runs, 0); return runs ? s.reduce((n, y) => n + y.verified, 0) / runs : 0; };
  const cov = { [a.kit]: coverage(a), [b.kit]: coverage(b) };
  const interval = pairedInterval(diffs);
  const low = Object.entries(cov).filter(([, c]) => c < COVERAGE);
  const verdict = !interval ? "nothing to compare"
    : low.length ? `inconclusive: coverage (${low.map(([k, c]) => `${k} ${Math.round(c * 100)}% verified`).join(", ")})`
    : interval.lo > 0 || interval.hi < 0 ? `a clear difference: ${b.kit} ${interval.mean > 0 ? "higher" : "lower"}`
    : "no clear difference";
  return { base: a.kit, other: b.kit, tasks: shared, perTask: Object.fromEntries(shared.map((t, i) => [t, diffs[i]])), delta: interval, coverage: cov, verdict, notCompared };
}

/**
 * Decision 9: the negative arm (a guide without `mobile` and `hover`) against the candidate. It passes only if its
 * first-try validity is 30 points lower, half its runs made a mistake naming `mobile` or `hover`, the candidate
 * passed every run, and each arm has 80% of its planned runs with a verified first try (otherwise inconclusive).
 */
export function negativeControl(candidate, negative, plan, negativeRows = []) {
  const plannedOf = (kit, x) => (plan ? plan.jobs.filter((j) => j.kit === kit).length : x.runs + x.leftOut.total);
  const rate = (x) => (x.firstTry.of ? x.firstTry.valid / x.firstTry.of : null);
  const named = (x) => x.mistakes.filter((m) => NAMING.test(m.key));
  // Runs, not keys: a run with both a `mobile` and a `hover` mistake counts once.
  const runsNaming = count(negativeRows, (r) => (r.mistakes ?? []).some((m) => NAMING.test(m.key)));
  const checks = [
    { what: "first-try validity at least 30 points below the candidate's", ok: rate(negative) !== null && rate(candidate) !== null && rate(candidate) - rate(negative) >= 0.3, got: `${pct(rate(negative))} against ${pct(rate(candidate))}` },
    { what: "half the negative runs made a mistake naming mobile or hover", ok: negative.runs > 0 && runsNaming * 2 >= negative.runs, got: `${runsNaming} of ${negative.runs} (${named(negative).map((m) => `${m.key} ×${m.runs}`).join(", ") || "none"})` },
    { what: "the candidate passed every run", ok: candidate.finalPass === plannedOf("candidate", candidate), got: `${candidate.finalPass} of ${plannedOf("candidate", candidate)}` },
  ];
  const coverage = [candidate, negative].map((x) => ({ kit: x.kit, verified: x.verified, planned: plannedOf(x.kit, x) }));
  const covered = coverage.every((c) => c.verified >= COVERAGE * c.planned);
  return { checks, coverage, verdict: !covered ? "inconclusive: coverage (run it again)" : checks.every((c) => c.ok) ? "passed" : "failed" };
}

const pct = (x) => (x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`);
const pp = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x * 100))}`;
const frac = (k, n) => (n ? `${k}/${n}  ${pct(k / n)}` : "–");
const num = (x) => (x === null ? "–" : Number.isInteger(x) || x >= 100 ? Math.round(x).toLocaleString("en-US") : String(Math.round(x * 10) / 10));

/** Pads columns to their widest cell. */
function table(rows) {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i] ?? "").length)));
  return rows.map((r) => r.map((c, i) => String(c ?? "").padEnd(w[i] + 3)).join("").trimEnd()).join("\n");
}

/** The report as text. */
export function formatSkillReport(rep) {
  const out = [];
  const arms = rep.kits.map((k) => rep.arms[k]);
  const head = (a) => `${a.kit}${a.engine ? ` (${a.engine.version}${a.engine.commit ? ` ${a.engine.commit.slice(0, 7)}${a.engine.dirty ? "+" : ""}` : ""})` : ""}`;

  if (rep.partial) {
    const p = rep.partial;
    out.push(`PARTIAL: ${p.finished} of ${p.planned} planned runs finished${p.reasons.length ? ` (stopped: ${p.reasons.join(", ")}${p.spentUsd !== null ? `, $${p.spentUsd.toFixed(2)} of $${p.maxCostUsd}` : ""})` : ""}.`);
    out.push(`Rates are over complete cells only. Incomplete: ${p.incomplete.map((c) => `${c.kit} ${c.brief} (${c.finished}/${c.planned})`).join(", ") || "none"}.`);
    if (!arms.some((a) => a.tasks.length)) out.push("No cell finished: nothing to rate.");
    out.push("");
  }

  const cmp = rep.comparisons[0];
  const rows = [
    ["", ...arms.map(head), ...(cmp ? [`Δ ${cmp.other} − ${cmp.base}, by task (95% CI)`] : [])],
    ["First try valid (verified)", ...arms.map((a) => frac(a.firstTry.valid, a.firstTry.of)), ...(cmp ? [cmp.delta ? `${pp(cmp.delta.mean)}pp (${pp(cmp.delta.lo)}, ${pp(cmp.delta.hi)}) over ${cmp.tasks.length} shared tasks: ${cmp.verdict}` : cmp.verdict] : [])],
    ["  Wilson 95%", ...arms.map((a) => (a.firstTry.wilson ? `${pct(a.firstTry.wilson[0])}–${pct(a.firstTry.wilson[1])}` : "–"))],
    ["  Verified first tries", ...arms.map((a) => frac(a.verified, a.runs))],
    ["  No render", ...arms.map((a) => a.noRender)],
    ["All 3 runs valid", ...arms.map((a) => (a.allThree.of ? `${num(Math.round(a.allThree.tasks * 10) / 10)}/${a.allThree.of} tasks` : "–"))],
    ["Final pass", ...arms.map((a) => `${a.finalPass}/${a.runs}`)],
    ["Median fix rounds", ...arms.map((a) => (a.fixRounds.of ? `${num(a.fixRounds.median)} (${a.fixRounds.of} verified${a.fixRounds.neverValid ? `, ${a.fixRounds.neverValid} never valid` : ""})` : "–"))],
    ["Warnings left", ...arms.map((a) => (a.warningsLeft.of ? `${a.warningsLeft.runs}/${a.warningsLeft.of} runs` : "–"))],
    ["Opened REFERENCE.md/dist", ...arms.map((a) => `${a.lookedElsewhere}/${a.runs}`)],
    ["Median turns", ...arms.map((a) => num(a.median.turns))],
    ["Median output tokens", ...arms.map((a) => num(a.median.outputTokens))],
    ["Median all tokens", ...arms.map((a) => num(a.median.totalTokens))],
    ["Median cost", ...arms.map((a) => (a.median.costUsd === null ? "–" : `$${a.median.costUsd.toFixed(3)}`))],
    ["Total cost", ...arms.map((a) => `$${a.costUsd.toFixed(2)}`)],
    ["Median seconds", ...arms.map((a) => num(a.median.seconds === null ? null : Math.round(a.median.seconds)))],
    ["Left out", ...arms.map((a) => `${a.leftOut.tampered} tampered, ${a.leftOut["harness error"]} harness errors, ${a.leftOut["reached outside"]} outside`)],
  ];
  out.push(table(rows));

  for (const c of rep.comparisons) {
    if (c !== cmp) out.push("", `Δ ${c.other} − ${c.base}: ${c.delta ? `${pp(c.delta.mean)}pp (${pp(c.delta.lo)}, ${pp(c.delta.hi)}) over ${c.tasks.length} tasks: ` : ""}${c.verdict}`);
    if (c.notCompared.length) out.push(`Not compared (${c.other} − ${c.base}): ${c.notCompared.map((n) => `${n.task} (${n.why})`).join(", ")}`);
  }

  out.push("", "Per task: first try valid (verified) · final pass · fix rounds (median)");
  out.push(table([["", ...arms.map((a) => a.kit), ...(cmp ? ["Δ"] : [])], ...rep.tasks.map((t) => [t, ...arms.map((a) => {
    if (a.na.includes(t)) return "N/A";
    const s = a.byTask[t];
    if (!s) return "incomplete";
    return `${s.firstTry.of ? `${s.firstTry.valid}/${s.firstTry.of}` : "–"}${s.verified < s.runs ? ` (${s.verified}/${s.runs} verified)` : ""} · ${s.finalPass}/${s.runs} · ${num(s.fixRounds.median)}`;
  }), ...(cmp ? [t in cmp.perTask ? `${pp(cmp.perTask[t])}pp` : ""] : [])])]));

  out.push("", "Mistakes (runs making each, over each run's verified attempts)");
  for (const a of arms) {
    out.push(`  ${a.kit}: ${a.mistakes.map((m) => `${m.key} ×${m.runs}`).join(", ") || "none"}`);
    for (const t of a.tasks) {
      const m = a.byTask[t].mistakes;
      if (m.length) out.push(`    ${t}: ${m.map((x) => `${x.key} ×${x.runs}`).join(", ")}`);
    }
  }

  out.push("", "What cut the replays off");
  for (const a of arms) out.push(`  ${a.kit}: ${a.cutoffs.map(([k, n]) => `${k} ×${n}`).join(", ") || "nothing"}`);

  if (rep.negative) {
    out.push("", `Negative control: ${rep.negative.verdict}`);
    for (const c of rep.negative.checks) out.push(`  ${c.ok ? "✓" : "✗"} ${c.what}: ${c.got}`);
    out.push(`  verified first tries: ${rep.negative.coverage.map((c) => `${c.kit} ${c.verified}/${c.planned}`).join(", ")} (need ${Math.round(COVERAGE * 100)}%)`);
  }

  if (rep.leftOut.length) {
    out.push("", `Left out (${rep.leftOut.length})`);
    for (const l of rep.leftOut) out.push(`  ${l.id}: ${l.as}: ${l.why}`);
  }

  if (rep.mismatches.length) {
    out.push("", `Mismatches, for a maintainer to read (${rep.mismatches.length}). Mark one tampered in <results>.marks.json: { "<kit> <brief> #<rep>": { "tampered": "why" } }`);
    for (const m of rep.mismatches) {
      out.push(`  ${m.id}${m.marked ? ` (marked tampered: ${m.marked})` : ""}: call ${m.call}: ${m.reason}`);
      out.push(`    command: ${m.command}`);
      if (m.session || m.replay) out.push(`    session: ${m.session ?? "–"}`, `    replay:  ${m.replay ?? "–"}`);
      if (m.readsUnpinned.length) out.push(`    reads unpinned: ${m.readsUnpinned.join(", ")}`);
      out.push(`    transcript: ${m.transcript}`);
      if (m.output) out.push(...m.output.trim().split("\n").slice(-8).map((l) => `    | ${l}`));
    }
  }
  return out.join("\n");
}
