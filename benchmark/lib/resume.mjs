// `bench.mjs --resume`: finishing a skill batch that stopped (its cost cap, or a crash) as the same batch. The jobs
// still to run are the plan's without a row; the rows already written stay as they are.

const key = (j) => `${j.kit}/${j.brief}/${j.rep}`;

/**
 * What a stopped batch left, from its plan.json and its results file's text: the rows it finished, the `partial`
 * markers it ended with, the jobs still to run (in the plan's order), what the rows cost, and the results file's text
 * without the markers (rewritten once the resumed batch starts; the stops are kept in plan.json).
 */
export function resumeOf(plan, text) {
  const lines = text.split("\n").filter((l) => l.trim());
  const parsed = lines.map((l) => JSON.parse(l));
  const rows = parsed.filter((l) => !l.partial);
  const done = new Set(rows.map(key));
  return {
    rows,
    stops: parsed.filter((l) => l.partial),
    left: plan.jobs.filter((j) => !done.has(key(j))).map((j) => [j.kit, j.brief, j.rep]),
    spentUsd: rows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    text: lines.filter((_, i) => !parsed[i].partial).map((l) => l + "\n").join(""),
  };
}

/**
 * Why the batch about to run isn't the one the plan started: another job list or N/A list, another version of Claude
 * Code, or a kit whose engine or docs differ from its rows'. Any of these makes the rows two batches, so it refuses.
 */
export function resumeProblems({ plan, rows, jobs, na, claudeVersion, kits }) {
  const problems = [];
  if (JSON.stringify(jobs.map(([kit, brief, rep]) => ({ kit, brief, rep }))) !== JSON.stringify(plan.jobs)) problems.push("the job list differs from plan.json's");
  if (JSON.stringify(na) !== JSON.stringify(plan.na)) problems.push(`the N/A tasks differ from plan.json's (${JSON.stringify(na)} against ${JSON.stringify(plan.na)})`);
  const versions = [...new Set(rows.map((r) => r.claudeVersion).filter(Boolean))];
  if (versions.some((v) => v !== claudeVersion)) problems.push(`Claude Code is ${claudeVersion}; the batch's rows ran on ${versions.join(", ")}`);
  for (const [kit, now] of Object.entries(kits)) {
    if (!now) continue;
    for (const field of ["engine", "docs"]) {
      const before = [...new Set(rows.filter((r) => r.kit === kit && r[field]).map((r) => JSON.stringify(r[field])))];
      if (before.some((b) => b !== JSON.stringify(now[field]))) problems.push(`kit ${kit}: its ${field} differs from its rows'`);
    }
  }
  return problems;
}
