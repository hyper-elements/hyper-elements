// Replays a finished skill batch again, after a change to the replay, without new sessions: each row's kept run
// (runs/<stamp>/<kit>__<brief>__<rep>) is put back at the session's own path, replayed with the row's secret and the
// batch's clock (plan.json), and the row's replay figures rewritten. Rows without a secret (before it was kept) and
// harness errors are left as they are.
//
//   node lib/rereplay.mjs results/<stamp>-skill-<model>.jsonl
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eventsOf, sessionEnv } from "./claude.mjs";
import { replayFields, replayRun } from "./replay.mjs";
import { browsersPath } from "./setup.mjs";

const bench = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Replays one row's kept run; returns the row with its replay figures recomputed. */
export async function rereplayRow(row, { clock, runsDir }) {
  const kept = join(runsDir, `${row.kit}__${row.brief}__${row.rep}`);
  const text = await readFile(join(kept, "transcript.jsonl"), "utf8");
  const events = eventsOf(text);
  const dir = events.find((e) => e.type === "system" && e.subtype === "init")?.cwd;
  if (!dir) throw new Error(`${kept}: the transcript has no init event with the session's path`);
  const parent = dirname(dir);
  if (existsSync(parent)) throw new Error(`${parent} exists: another run may be using it`);
  await mkdir(parent, { recursive: true });
  try {
    await cp(kept, dir, { recursive: true });
    await mkdir(join(dir, ".tmp"), { recursive: true });
    const baseline = join(runsDir, "baselines", `${row.brief}.json`);
    const extra = existsSync(baseline) ? { "tools/checks/change/baseline.json": baseline } : {};
    const env = { ...sessionEnv(process.env, { browsers: browsersPath(), tmp: join(dir, ".tmp") }), BENCH_SECRET: row.secret, BENCH_CLOCK: String(clock) };
    const rp = await replayRun({ kit: row.kit, brief: row.brief, rep: row.rep, root: parent, dir, events, env, extra });
    return { ...row, ...replayFields(rp, events) };
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node lib/rereplay.mjs results/<stamp>-skill-<model>.jsonl"); process.exit(1); }
  const plan = JSON.parse(readFileSync(file.replace(/\.jsonl$/, ".plan.json"), "utf8"));
  const clock = Date.parse(plan.startedAt);
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath();
  process.env.BENCH_CHROMIUM_ARGS = "--single-process";
  let changed = 0, skipped = 0;
  const out = [];
  for (const row of lines) {
    if (row.partial || row.suite !== "skill" || !row.secret || row.harnessError) { if (!row.partial) skipped++; out.push(row); continue; }
    const next = await rereplayRow(row, { clock, runsDir: join(bench, "runs", row.stamp) });
    const was = row.replay?.cutoff?.reason ?? "no cutoff", now = next.replay?.cutoff?.reason ?? "no cutoff";
    console.log(`${row.kit} ${row.brief} #${row.rep}: ${was === now ? now : `${was} → ${now}`}; first try ${row.firstTry?.verified ? "verified" : "unverified"} → ${next.firstTry?.verified ? "verified" : "unverified"}`);
    if (JSON.stringify(next) !== JSON.stringify(row)) changed++;
    out.push(next);
  }
  await writeFile(file, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`${changed} rows changed, ${skipped} left as they were (no secret, or a harness error). ${file}`);
}
