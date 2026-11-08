// Whether a run reached outside its own directory: every path its tool calls named there (absolute, `~`, or `..` out
// of it), and whether the tool got it (not denied, no error). System paths a command may name (/dev/null, /usr/bin…)
// aren't counted. A run that got anything outside is invalid: it may have read another run's work or the benchmark's.
//
//   node lib/audit.mjs runs/<stamp>        audits every run kept there (its transcript.jsonl)
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SYSTEM = /^\/(dev\/null|dev\/std|usr\/|bin\/|opt\/homebrew\/|System\/|Library\/Developer\/)/;

/**
 * `commands`: the run's tool calls ({ id, name, input }); `toolResults`: their results by id. `since`: when the run
 * started (ms): a file outside made after it (a crop of its own image in /tmp, say) is the run's own (`own`), not
 * another's work.
 */
export function outsideAccess(dir, commands, toolResults, since = null) {
  const roots = [dir];
  try { roots.push(realpathSync(dir)); } catch {}
  const out = [];
  for (const c of commands) {
    const i = c.input ?? {};
    const text = [i.command, i.file_path, i.path, i.pattern, i.notebook_path].filter(Boolean).join(" ");
    // A path starts with "/" and a name ("/Users…", not a lone "/" in `a / b`), or "~", or climbs with "../".
    const tokens = text.split(/[\s"'`=;|&()<>,]+/).filter((t) => /^\/[A-Za-z.]/.test(t) || t.startsWith("~/") || t.includes("../"));
    for (const t of tokens) {
      const p = t.startsWith("~") ? join(homedir(), t.slice(1)) : resolve(dir, t);
      if (roots.some((r) => p === r || p.startsWith(r + "/")) || SYSTEM.test(p)) continue;
      // Not a path at all where it doesn't exist and neither does its folder, or its folder is the root: a regular
      // expression in a script (`/inter/i.test`, `/letter|round/i`). A file in another run's folder, deleted since,
      // still counts: its folder (the temporary folder) is there.
      if (!existsSync(p) && (dirname(p) === "/" || !existsSync(dirname(p)))) continue;
      const result = toolResults.get(c.id);
      const got = !!result && !result.is_error && !/denied|blocked|not allowed/i.test(JSON.stringify(result.content ?? "").slice(0, 400));
      let own = false;
      try { own = since !== null && statSync(p).birthtimeMs >= since; } catch {}
      out.push({ tool: c.name, path: p, got, ...(own ? { own } : {}) });
    }
  }
  return out;
}

/** A transcript (stream-json lines) as its tool calls and their results. */
export function toolCalls(text) {
  const events = text.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const commands = events.flatMap((e) => (e.type === "assistant" ? e.message.content : []))
    .filter((c) => c.type === "tool_use").map((c) => ({ id: c.id, name: c.name, input: c.input ?? {} }));
  const toolResults = new Map(events.flatMap((e) => (e.type === "user" && Array.isArray(e.message?.content) ? e.message.content : []))
    .filter((c) => c.type === "tool_result").map((c) => [c.tool_use_id, c]));
  return { events, commands, toolResults };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2]);
  // A kept run was copied out of its temporary directory: its transcript names that directory, not this one.
  for (const run of readdirSync(root).sort()) {
    const t = join(root, run, "transcript.jsonl");
    if (!existsSync(t)) continue;
    const text = readFileSync(t, "utf8");
    const { commands, toolResults } = toolCalls(text);
    const cwd = /"cwd":"([^"]+)"/.exec(text)?.[1] ?? join(root, run);
    const outside = outsideAccess(cwd, commands, toolResults);
    const got = outside.filter((o) => o.got && !o.own);
    console.log(`${got.length ? "INVALID" : outside.length ? "tried  " : "clean  "} ${run}${outside.length ? `  ${[...new Set(outside.map((o) => `${o.got ? "got" : "denied"} ${o.path}`))].slice(0, 3).join(" | ")}` : ""}`);
  }
}
