// The skill suite's replay: a session's attempts recomputed, not read, over a verified prefix (decisions 2 and 3).
//
// The session is replayed in order in a pristine directory at the session's own path. Each event must be replayable
// (a Write or Edit of a source, a Read, Glob or Grep inside the run, or a Bash call of the exact forms below whose
// result is the same whatever its read steps did); the first one that isn't is the *cutoff*, and nothing from it on is
// verified. Up to the cutoff the replay made every change the session made, so its directory matches the session's,
// and each Bash call's tool steps are run again there: their signed result lines (bench-runtime.mjs) must be the
// session's, line for line. A call whose results differ is a `mismatch`: the cutoff, listed for a maintainer, never
// `tampered` by itself.
//
// From the verified calls come the attempts (a Bash call that ran the render or `tsc`), and from them the first try,
// the fix rounds and the mistakes.
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { GUARDED } from "./claude.mjs";

/** Tools that change no file: replayed as nothing. */
const NOOP = new Set(["TodoWrite", "Skill"]);
/** `$?` in double quotes, as parseCommand keeps it. */
const STATUS = "\u0002";
const LINE = /^\[(render|check)\] (ok|failed|pass|fail)(?: ([0-9a-f]{64}))? in=([0-9a-f]{64}) mac=([0-9a-f]{64})$/;

/**
 * A command split into steps on `&&`, `||` and `;`: { steps: [{ op, words, pipe, heredoc }] }, op the operator before
 * the step. A step may be a pipeline (`pipe`: the stages after the first), which the replay accepts only when every
 * stage reads. One quoted heredoc feeding `cat > <file>` is the step's `heredoc` (the file's text). No other
 * redirections, subshells, variables, expansions or line breaks: `{ error }` for anything else.
 */
export function parseCommand(command) {
  // `P=/the/run; sed -n 1,20p $P/docs/REFERENCE.md`: leading assignments of plain values, each `$P` or `${P}` replaced
  // by its value, as the shell expands it in a command with no single quotes or heredoc to keep it literal.
  const assign = /^\s*([A-Za-z_]\w*)=([\w./@+-]+)\s*;/;
  if (assign.test(command) && !/['<]/.test(command)) {
    for (let m; (m = assign.exec(command)); ) {
      command = command.slice(m[0].length).replace(new RegExp(`\\$(?:${m[1]}(?!\\w)|\\{${m[1]}\\})`, "g"), m[2]);
    }
  }
  // A quoted heredoc (`<<'EOF'`, or `<<EOF` whose text has nothing to expand) on the first line. The lines after its
  // end line are more commands, each joined as by `;`.
  let heredoc = null;
  let cmd = command;
  const open = /^([^\n]*?)\s*<<\s*(?:'(\w+)'|(\w+))\n/.exec(command);
  if (open) {
    const tag = open[2] ?? open[3];
    const rest = command.slice(open[0].length);
    const end = new RegExp(`(^|\\n)${tag}[ \\t]*(\\n|$)`).exec(rest);
    if (!end) return { error: "a heredoc with no end" };
    const body = rest.slice(0, end.index);
    if (open[3] && /[$`\\]/.test(body)) return { error: "a heredoc with expansions" };
    heredoc = body === "" ? "" : `${body}\n`;
    const after = rest.slice(end.index + end[0].length).split("\n").map((l) => l.trim()).filter(Boolean);
    if (after.some((l) => /(&&|\|\||\||;)$/.test(l))) return { error: "a command continued over lines" };
    cmd = [open[1], ...after].join(" ; ");
  }
  // `2>&1` or `2>/dev/null` after a step or a pipeline's stage changes nothing the harness reads: Claude Code captures
  // both streams, and the result lines are on stdout.
  cmd = cmd.replace(/\s+2>&1\s*\|(?!\|)/g, " \u0001 ").replace(/\s+2>(?:&1|\/dev\/null)(?=\s*(?:&&|\|\|?|;|\u0001|$))/g, "");
  const steps = [];
  let stages = [], merged = [], words = [], word = null, op = null, redirect = null;
  const endWord = () => {
    if (word === null) return;
    if (redirect === "pending") { redirect = word; word = null; return; }
    words.push(word);
    word = null;
  };
  const endStage = () => { endWord(); if (!words.length) return false; stages.push(words); words = []; return true; };
  const endStep = (next) => {
    if (!endStage()) return false;
    const step = { op, words: stages[0] };
    if (stages.length > 1) { step.pipe = stages.slice(1); step.merged = merged; }
    if (redirect === "/dev/null") {
      // `ls node_modules/x >/dev/null`: the step's output is dropped. Only a read may do that (stepKind).
      step.quiet = true;
      redirect = null;
    } else if (redirect !== null) {
      // Only `cat > <file>` fed by the heredoc.
      if (redirect === "pending" || heredoc === null || stages.length > 1 || !(step.words.length === 1 && step.words[0] === "cat")) return "redirect";
      step.words = ["cat", ">", redirect];
      step.heredoc = heredoc;
      heredoc = "used";
      redirect = null;
    }
    steps.push(step);
    stages = []; merged = []; op = next;
    return true;
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i], two = cmd.slice(i, i + 2);
    if (c === "'") {
      const end = cmd.indexOf("'", i + 1);
      if (end < 0) return { error: "an unclosed quote" };
      word = (word ?? "") + cmd.slice(i + 1, end);
      i = end;
    } else if (c === '"') {
      // Inside double quotes a backslash escapes only $ ` " \; before anything else it's itself (`grep "a\|b"`). A `$`
      // that can't start an expansion is itself (`grep "^### Table$\|^### Row$"`); `$?` is kept as STATUS, which only
      // an `echo` may print (stepKind).
      let j = i + 1, inner = "";
      for (; j < cmd.length && cmd[j] !== '"'; j++) {
        if (cmd[j] === "\\" && j + 1 < cmd.length) {
          if ('$`"\\'.includes(cmd[j + 1])) { inner += cmd[j + 1]; j++; } else inner += "\\";
        } else if (cmd[j] === "$" && cmd[j + 1] === "?") { inner += STATUS; j++; }
        else if (cmd[j] === "`" || (cmd[j] === "$" && /[\w{(#@*!$-]/.test(cmd[j + 1] ?? ""))) return { error: "an expansion in double quotes" };
        else inner += cmd[j];
      }
      if (j >= cmd.length) return { error: "an unclosed quote" };
      word = (word ?? "") + inner;
      i = j;
    } else if (two === "&&" || two === "||") {
      const r = endStep(two);
      if (r === "redirect") return { error: "a redirection" };
      if (!r) return { error: `nothing before ${two}` };
      i++;
    } else if (c === ";") {
      const r = endStep(";");
      if (r === "redirect") return { error: "a redirection" };
      if (!r) return { error: "nothing before ;" };
    } else if (c === "|" || c === "\u0001") {
      if (!endStage()) return { error: "nothing before |" };
      merged.push(c === "\u0001"); // `2>&1 |`: both streams go through the pipe
    } else if (c === ">" && two !== ">>" && redirect === null && word === null) {
      redirect = "pending";
    } else if (/\s/.test(c)) {
      if (c === "\n" || c === "\r") return { error: "a line break" };
      endWord();
    } else if (/[&<>()$`\\{}~!#]/.test(c)) {
      return { error: `the character ${JSON.stringify(c)}` };
    } else word = (word ?? "") + c;
  }
  endWord();
  if (stages.length && !words.length) return { error: "nothing after |" };
  if (words.length) {
    const r = endStep(null);
    if (r === "redirect") return { error: "a redirection" };
  } else if (op && op !== ";") return { error: `nothing after ${op}` }; // a trailing `;` ends the last step
  if (!steps.length) return { error: "no command" };
  if (heredoc !== null && heredoc !== "used") return { error: "a heredoc not fed to cat > <file>" };
  return { steps };
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const tool = (w) => w.replace(/^\.\//, "");

/** A path the replay runs a file step on: plain characters only, so no shell or `sed` can read it as anything else. */
const PLAIN = /^[\w./@+-]+$/;

/** One `sed` substitution with no flag that writes or runs anything (`s|a|b|g`). */
const SUBSTITUTION = /^s([^\w\s\\])(?:\\.|(?!\1)[^\\])*\1(?:\\.|(?!\1)[^\\])*\1[gI0-9]*$/;

/**
 * A step that only reads: `cat`, `ls`, `wc`, `head`, `tail`, `grep` and `sed -n <lines>p`, with their flags, of paths
 * in the run (or of their input, in a pipeline).
 */
export function readKind(words, inRun) {
  const [cmd, ...args] = words;
  const path = (a) => !a.startsWith("-") && inRun(a);
  const FLAGS = { cat: /^-n$/, ls: /^-[A-Za-z1]+$/, wc: /^-[lcwm]+$/, head: /^-(n|c|\d+)$/, tail: /^-(n|c|\d+)$/ };
  if (FLAGS[cmd]) {
    // `head -n 20`: a count after -n or -c; `ls -I node_modules`: a pattern after -I.
    return args.every((a, i) => FLAGS[cmd].test(a) || (/^\d+$/.test(a) && /^-[nc]$/.test(args[i - 1] ?? "")) || (cmd === "ls" && args[i - 1] === "-I" && !a.startsWith("-")) || path(a));
  }
  // `file images/logo.png`: what a file is.
  if (cmd === "file") return args.length > 0 && args.every((a) => /^-[bLhiI]+$/.test(a) || a === "--mime-type" || path(a));
  // `cut -c1-400`: in a pipeline, or of paths.
  if (cmd === "cut") return args.length > 0 && args.every((a, i) => /^-[cbf][\d,-]+$/.test(a) || (/^[\d,-]+$/.test(a) && /^-[cbf]$/.test(args[i - 1] ?? "")) || /^-[cbf]$/.test(a) || path(a));
  // `find images tools -maxdepth 2 -type f -name '*.png'`: paths in the run, then tests only (no -exec, -delete…).
  if (cmd === "find") {
    let i = 0;
    for (; i < args.length && !args[i].startsWith("-"); i++) if (!path(args[i])) return false;
    if (i === 0) return false;
    for (; i < args.length; i++) {
      const a = args[i], v = args[i + 1];
      if ((a === "-maxdepth" || a === "-mindepth") && /^\d+$/.test(v ?? "")) i++;
      else if (a === "-type" && /^[fdl]$/.test(v ?? "")) i++;
      else if ((a === "-name" || a === "-iname") && v !== undefined) i++;
      else return false;
    }
    return true;
  }
  if (cmd === "grep") {
    let pattern = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (/^-[nivwclLhHrREFosx]+$/.test(a) || /^-[ABCm]\d+$/.test(a)) continue;
      if (/^--(include|exclude|exclude-dir)=[\w.*?{},-]+$/.test(a) || a === "--color=never") continue;
      if (/^-[ABCm]$/.test(a) && /^\d+$/.test(args[i + 1] ?? "")) { i++; continue; }
      if (a === "-e" && i + 1 < args.length) { i++; pattern = true; continue; }
      if (!pattern) { pattern = true; continue; } // the pattern: any text
      if (!path(a)) return false;
    }
    return pattern;
  }
  if (cmd === "sed") {
    if (!args.includes("-n")) return false;
    return args.every((a) => a === "-n" || a === "-e" || /^\d+(,\d+)?p$/.test(a) || path(a));
  }
  return false;
}

/** The line count of `tail`, `tail -N` or `tail -n N` (10 for `tail` alone), or null. */
export const tailOf = (w) => (w[0] === "tail" && w.length === 1 ? 10 : w[0] === "tail" && w.length === 2 && /^-\d+$/.test(w[1]) ? Number(w[1].slice(1)) : w[0] === "tail" && w.length === 3 && w[1] === "-n" && /^\d+$/.test(w[2]) ? Number(w[2]) : null);

/** The line count of `head`, `head -N` or `head -n N`, or null. */
export const headOf = (w) => tailOf(["tail", ...w.slice(1)]) !== null && w[0] === "head" ? tailOf(["tail", ...w.slice(1)]) : null;

/** The first `n` lines, as `head -n` shows them. */
const headText = (text, n) => (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n").slice(0, n).join("\n");

/** The last `n` lines of a tool's output, as `tail -n` shows them. */
const tailText = (text, n) => { const lines = (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n"); return n === 0 ? "" : lines.slice(-n).join("\n"); };

/**
 * What a step is:
 * - `tsc` (`npx tsc --noEmit`), `render` (the brief's render command), `check` (`node tools/check.mjs`, with `--json`
 *   or not): the tools, run again and compared
 * - `read` (readKind, or a pipeline whose every stage reads) and `echo`: nothing runs, nothing changes
 * - `mkdir` (`mkdir -p` in the run), `write` (`cat > <source>` fed by a quoted heredoc) and `edit` (`sed -i` of
 *   substitutions on sources): file steps, made in the replay too, in order
 * - null for anything else
 * `isSource` says whether a path (as the session wrote it) is one of the run's sources.
 */
export function stepKind(step, render, inRun, isSource = () => false, platform = process.platform) {
  const words = Array.isArray(step) ? step : step.words;
  // `$?` only in an `echo` (`echo "exit $?"`), whose output isn't compared.
  if ([words, ...(step.pipe ?? [])].flat().some((w) => w.includes(STATUS)) && (words[0] !== "echo" || step.pipe)) return null;
  // `ls x >/dev/null`: only a read may drop its output.
  if (step.quiet) {
    const kind = stepKind({ ...step, quiet: false }, render, inRun, isSource, platform);
    return kind === "read" || kind === "echo" ? kind : null;
  }
  // `cd docs`: a folder in the run. Claude Code keeps the folder for the calls after it, as the replay does.
  if (words[0] === "cd" && !step.pipe) return words.length === 2 && PLAIN.test(words[1]) && inRun(words[1]) ? "cd" : null;
  if (step.pipe) {
    if ([words, ...step.pipe].every((w) => readKind(w, inRun))) return "read";
    // `node tools/render.mjs 2>&1 | tail -20`: the tool, with the same tail applied to the replay's output. Not
    // `head`, which can stop the tool mid-write.
    const tool = stepKind({ words }, render, inRun, isSource, platform);
    // `head` only after `tsc`: it writes no file, so a tsc stopped by head's closed pipe changes nothing.
    return ["tsc", "render", "check"].includes(tool) && step.merged.every(Boolean) && step.pipe.every((w) => tailOf(w) !== null || (tool === "tsc" && headOf(w) !== null)) ? tool : null;
  }
  if (step.heredoc !== undefined) return words.length === 3 && PLAIN.test(words[2]) && inRun(words[2]) && isSource(words[2]) ? "write" : null;
  if (same(words, ["npx", "tsc", "--noEmit"])) return "tsc";
  if (words[0] === "node" && words.length > 1) {
    const rest = [tool(words[1]), ...words.slice(2)];
    if (same(rest, render.map((w, i) => (i === 0 ? tool(w) : w)))) return "render";
    if (same(rest, ["tools/check.mjs"]) || same(rest, ["tools/check.mjs", "--json"])) return "check";
    return null;
  }
  // `echo` of literal words: always succeeds, changes nothing. A result line it prints is one more than the call's
  // tool steps, which is the cutoff.
  if (words[0] === "echo") return "echo";
  // `mkdir -p` of folders in the run (agents make `src/` before writing to it): an empty folder can change what `ls`
  // shows, so the replay makes them too. A new folder in a guarded one fails as the sandbox fails it, making nothing.
  if (words[0] === "mkdir") return words.length > 2 && words[1] === "-p" && words.slice(2).every((a) => PLAIN.test(a) && !a.startsWith("-") && inRun(a)) ? "mkdir" : null;
  // `sed -i` of substitutions on sources, in this platform's form only, so no path is read as a script: on macOS
  // `-i ''` (BSD sed takes the next word as the backup suffix), elsewhere `-i` alone.
  // On macOS, `sed -i '<script>' <file>` (GNU sed's form): BSD sed takes the script as the backup suffix and the
  // path as the script, and always fails ("unterminated substitute pattern", or no input). The replay records the
  // failure; a session where it changed the file anyway leaves the replay's files different, which the next step's
  // input hash or the final sources catch.
  if (platform === "darwin" && words.length === 4 && words[0] === "sed" && words[1] === "-i" && words[2] !== "" && !words[2].startsWith("-") && PLAIN.test(words[3]) && inRun(words[3])) return "failed-edit";
  if (words[0] === "sed" && words.includes("-i")) {
    const rest = words.slice(1);
    const lead = platform === "darwin" ? ["-i", ""] : ["-i"];
    if (!same(rest.slice(0, lead.length), lead)) return null;
    const args = rest.slice(lead.length);
    const scripts = [], files = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-e" && i + 1 < args.length) scripts.push(args[++i]);
      else if (!scripts.length && !files.length && SUBSTITUTION.test(args[i])) scripts.push(args[i]);
      else files.push(args[i]);
    }
    const ok = scripts.length && scripts.every((s) => SUBSTITUTION.test(s)) && files.length && files.every((f) => PLAIN.test(f) && !f.startsWith("-") && inRun(f) && isSource(f));
    return ok ? "edit" : null;
  }
  return readKind(words, inRun) ? "read" : null;
}

/** A tool result's text. */
const textOf = (result) => (typeof result?.content === "string" ? result.content : Array.isArray(result?.content) ? result.content.map((c) => c.text ?? "").join("\n") : "");

/** The diagnostics a render printed (`severity code at path: message`). */
export const diagnosticsOf = (out) => [...out.matchAll(/^(error|warning|info) (\S+) at (\S*): (.*)$/gm)].map(([, severity, code, path, message]) => ({ severity, code, path, message }));

/** The errors `tsc` printed, each with the property it names (from its line or its continuation lines). */
export function tsErrorsOf(out) {
  const errors = [];
  const lines = out.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /error (TS\d+): (.*)$/.exec(lines[i]);
    if (!m) continue;
    let text = m[2];
    for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) text += `\n${lines[j].trim()}`;
    const prop = /Property '(\w+)' does not exist/.exec(text)?.[1] ?? /(?:and|but) '(\w+)' does not exist in type/.exec(text)?.[1] ?? null; // TS2353 says "and", TS2561 "but"
    errors.push({ code: m[1], prop, text });
  }
  return errors;
}

/**
 * A mistake's key: `prop/unknown mobile`, `style/unknown marginBottom`, `ts/TS2322 mobile`. A diagnostic's key is its
 * code and the last segment of its path where the path is the template's (`root.…`); `jsx/markup`'s is `jsx`.
 */
export const mistakeKey = (d) => {
  if (d.code.startsWith("TS")) return `ts/${d.code}${d.prop ? ` ${d.prop}` : ""}`;
  const last = /^root\b/.test(d.path ?? "") ? d.path.split(".").pop().replace(/\[\d+\]$/, "") : "";
  return last && last !== "root" ? `${d.code} ${last}` : d.code;
};

/**
 * Replays a session. `events`: its transcript; `dir`: the replay directory, pristine and at the session's own path;
 * `run`: `runOf()` for its kit and brief; `env`: the session's environment (BENCH_SECRET and BENCH_CLOCK included);
 * `finalSources`: the session's sources as it left them ({ path: text }), compared at the end.
 */
export async function replay({ events, dir, run, env, finalSources = null }) {
  const secret = env.BENCH_SECRET;
  const roots = [dir, ...(existsSync(dir) ? [realpathSync(dir)] : [])];
  // The shell's folder in the run ("" for the run itself): a `cd` moves it, and Claude Code keeps it for the next call.
  let cwd = "";
  const relOf = (p) => {
    const abs = isAbsolute(p) ? normalize(p) : resolve(dir, cwd, p);
    for (const r of roots) if (abs === r || abs.startsWith(r + "/")) return relative(r, abs);
    return null;
  };
  const inRun = (p) => { const r = relOf(p); return r !== null && !r.startsWith(".."); };
  const isSource = (rel) => run.sources.some((s) => (s.endsWith("/") ? rel.startsWith(s) : rel === s));

  const results = new Map(events.flatMap((e) => (e.type === "user" && Array.isArray(e.message?.content) ? e.message.content : [])).filter((c) => c.type === "tool_result").map((c) => [c.tool_use_id, c]));
  const calls = events.flatMap((e) => (e.type === "assistant" ? e.message.content : [])).filter((c) => c.type === "tool_use");

  const verified = [];
  let cutoff = null;
  const cut = (k, call, reason, extra = {}) => { cutoff = { call: k, tool: call.name, input: call.input?.command ?? call.input?.file_path ?? null, reason, ...extra }; };

  let captures = 0;
  // A read step (readKind: cat, ls, grep… of paths in the run, or a pipeline of them), run for its status only. Its
  // words are quoted, but a glob of plain characters (`tools/checks/*/spec.json`) is left to expand, as in the session.
  const runRead = (step) => {
    const q = (w) => (/^[\w./@+*?-]+$/.test(w) && /[*?]/.test(w) && !w.includes("..") ? w : `'${w.replace(/'/g, "'\\''")}'`);
    const command = [step.words, ...(step.pipe ?? [])].map((w) => w.map(q).join(" ")).join(" | ");
    return spawnSync("bash", ["-c", command], { cwd: join(dir, cwd), env: { PATH: process.env.PATH }, stdio: "ignore", timeout: 60_000 }).status ?? 1;
  };
  const runTool = (kind, step) => {
    const words = step.words;
    // File steps: made in the replay as the session made them, in order with the tools.
    const done = (code) => ({ kind, code, out: "", lines: [], tsErrors: [] });
    if (kind === "mkdir") {
      // The sandbox denies writes to the guarded files: `mkdir -p docs` succeeds (it exists), `mkdir -p docs/src` fails.
      // Like BSD mkdir, the other folders are still made.
      let code = 0;
      for (const d of words.slice(2)) {
        const rel = relOf(d);
        if (existsSync(join(dir, rel))) continue;
        if (GUARDED.some((g) => rel === g || rel.startsWith(`${g}/`))) { code = 1; continue; }
        try { mkdirSync(join(dir, rel), { recursive: true }); } catch { code = 1; }
      }
      return done(code);
    }
    if (kind === "write") {
      try { mkdirSync(dirname(join(dir, relOf(words[2]))), { recursive: true }); writeFileSync(join(dir, relOf(words[2])), step.heredoc); return done(0); } catch { return done(1); }
    }
    if (kind === "edit") return done(spawnSync("sed", words.slice(1), { cwd: join(dir, cwd), encoding: "utf8", timeout: 30_000 }).status ?? 1);
    // BSD sed's misread `sed -i '<script>' <file>` (stepKind): it fails without changing anything. Not run here, since
    // the path would be read as a script.
    if (kind === "failed-edit") return done(1);
    mkdirSync(join(dir, ".tmp"), { recursive: true });
    const file = join(dir, ".tmp", `replay-${captures++}.out`);
    const fd = openSync(file, "w");
    let r;
    try {
      r = kind === "tsc"
        ? spawnSync("npx", ["tsc", "--noEmit"], { cwd: dir, env, stdio: ["ignore", fd, fd], timeout: 240_000 })
        : spawnSync(process.execPath, words.slice(1), { cwd: dir, env, stdio: ["ignore", fd, fd], timeout: 240_000 });
    } finally { closeSync(fd); }
    const out = readFileSync(file, "utf8");
    rmSync(file, { force: true });
    const lines = out.split("\n").filter((l) => LINE.test(l));
    const ran = { kind, code: r.status ?? 1, out, lines, tsErrors: kind === "tsc" ? tsErrorsOf(out) : [] };
    if (!step.pipe) return ran;
    const shown = step.pipe.reduce((t, w) => (tailOf(w) !== null ? tailText(t, tailOf(w)) : headText(t, headOf(w))), out);
    return { ...ran, flow: 0, shownLines: shown.split("\n").filter((l) => LINE.test(l)), shownTs: (shown.match(/error TS\d+/g) ?? []).length };
  };

  for (let k = 0; k < calls.length && !cutoff; k++) {
    const call = calls[k], input = call.input ?? {}, result = results.get(call.id);
    if (!result) { cut(k, call, "no result"); break; }
    if (NOOP.has(call.name)) continue;

    if (call.name === "Write" || call.name === "Edit") {
      if (result.is_error) continue; // it changed nothing
      const rel = relOf(input.file_path ?? "");
      if (rel === null || !isSource(rel)) { cut(k, call, `a ${call.name} outside the sources`); break; }
      const file = join(dir, rel);
      if (call.name === "Write") {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, input.content ?? "");
      } else {
        if (!existsSync(file)) { cut(k, call, "an Edit of a file the replay doesn't have"); break; }
        const text = await readFile(file, "utf8");
        if (!text.includes(input.old_string)) { cut(k, call, "an Edit whose text the replay doesn't have"); break; }
        await writeFile(file, input.replace_all ? text.split(input.old_string).join(input.new_string) : text.replace(input.old_string, () => input.new_string));
      }
      verified.push({ call: k, tool: call.name });
      continue;
    }

    if (call.name === "Read" || call.name === "Glob" || call.name === "Grep") {
      const path = input.file_path ?? input.path;
      if (path && !inRun(path)) { cut(k, call, `a ${call.name} outside the run`); break; }
      if (call.name === "Read" && !result.is_error && isSource(relOf(path))) {
        // What the session read must be what the replay has: each numbered line.
        const text = existsSync(join(dir, relOf(path))) ? await readFile(join(dir, relOf(path)), "utf8") : null;
        const got = textOf(result);
        const lines = [...got.matchAll(/^\s*(\d+)\t(.*)$/gm)];
        const ok = text !== null && (lines.length ? lines.every(([, n, l]) => text.split("\n")[Number(n) - 1] === l) : text === "" && /empty/.test(got));
        if (!ok) { cut(k, call, "a Read of a source that the replay doesn't match"); break; }
      }
      verified.push({ call: k, tool: call.name });
      continue;
    }

    if (call.name !== "Bash") { cut(k, call, `the tool ${call.name}`); break; }
    const out = textOf(result);
    if (input.run_in_background || /running in (the )?background|moved to (the )?background|timed out/i.test(out)) { cut(k, call, "a call in the background or timed out"); break; }
    // A command Claude Code refused to run ("Contains brace with quote character (expansion obfuscation)", "requires
    // approval"): an error with no exit code and no result line. It changed nothing, like an Edit that failed. Taking
    // a command that did run for a refused one fails closed: the replay's files then differ, which the next step's
    // input hash or the final sources catch.
    if (result.is_error && !/^\s*Exit code \d+/.test(out) && !out.split("\n").some((l) => LINE.test(l.trim()))) {
      verified.push({ call: k, tool: "Bash", command: input.command, notRun: true, steps: [] });
      continue;
    }
    const parsed = parseCommand(input.command ?? "");
    if (parsed.error) { cut(k, call, `a command with ${parsed.error}`); break; }
    // The steps in order, as the shell ran them, each judged where it runs (after a `cd`, in that folder); a step that
    // can't be replayed is the cutoff only if it runs. Read steps run here too: up to this call the replay's files are
    // the session's, so a read's status (`cat out/email.txt` after the render, `cd docs`) is the session's. The call's
    // overall status is compared with the session's below. The tools run only from the run itself.
    let status = 0, refused = null;
    const ran = [];
    for (const [i, s] of parsed.steps.entries()) {
      if (i > 0 && ((s.op === "&&" && status !== 0) || (s.op === "||" && status === 0))) continue;
      const kind = stepKind(s, run.render, inRun, (p) => isSource(relOf(p) ?? ""));
      if (kind === null) { refused = `a step that isn't replayable: ${[s.words, ...(s.pipe ?? [])].map((w) => w.join(" ")).join(" | ")}`; break; }
      if (cwd !== "" && ["tsc", "render", "check"].includes(kind)) { refused = `a tool run from ${cwd}, not the run`; break; }
      if (kind === "echo") { status = 0; continue; }
      if (kind === "read") { status = runRead(s); continue; }
      if (kind === "cd") {
        const to = relOf(s.words[1]);
        status = existsSync(join(dir, to)) && statSync(join(dir, to)).isDirectory() ? 0 : 1;
        if (status === 0) cwd = to;
        continue;
      }
      const r = runTool(kind, s);
      status = r.flow ?? r.code;
      ran.push(r);
    }
    if (refused) { cut(k, call, refused); break; }
    const steps = ran;

    // A pipeline that hid a step's result line leaves nothing to compare it by.
    if (steps.some((s) => s.shownLines && s.shownLines.length !== s.lines.length)) { cut(k, call, "a pipeline that hides a result line"); break; }
    // Compared step by step: the session's result lines must be the replay's.
    const want = steps.flatMap((s) => s.shownLines ?? s.lines);
    const got = out.split("\n").map((l) => l.trim()).filter((l) => LINE.test(l));
    const forged = got.find((l) => { const [body, mac] = l.split(" mac="); return createHmac("sha256", secret).update(body).digest("hex") !== mac; });
    if (forged) { cut(k, call, "a result line that isn't the harness's", { line: forged }); break; }
    if (got.length !== want.length) { cut(k, call, got.length < want.length ? "a result line missing from the session's output" : "more result lines than tool steps"); break; }
    const input_ = (l) => / in=([0-9a-f]{64})/.exec(l)[1];
    const differ = got.findIndex((l, i) => l !== want[i]);
    if (differ >= 0) {
      if (input_(got[differ]) !== input_(want[differ])) { cut(k, call, "a step whose inputs differ from the replay's"); break; }
      cut(k, call, "a step whose result differs from the replay's", { mismatch: true, session: got[differ], replay: want[differ], output: out.slice(-2000) });
      break;
    }
    const tsGot = (out.match(/error TS\d+/g) ?? []).length, tsWant = steps.reduce((n, s) => n + (s.shownTs ?? s.tsErrors.length), 0);
    const failed = status !== 0;
    // tsc's error count only where tsc ran: a read may show text that looks like one (`grep -n "error TS" notes.md`).
    if ((steps.some((s) => s.kind === "tsc") && tsGot !== tsWant) || failed !== !!result.is_error) {
      cut(k, call, tsGot !== tsWant ? "tsc's errors differ from the replay's" : "the call's status differs from the replay's", { mismatch: true, output: out.slice(-2000) });
      break;
    }
    verified.push({ call: k, tool: "Bash", command: input.command, failed, steps: steps.map((s) => ({ kind: s.kind, code: s.code, out: s.kind === "check" ? s.lines.join("\n") : s.out.slice(-6000), tsErrors: s.tsErrors })) });
  }

  // The end of the run: with no cutoff, the replay's sources are the session's.
  let sourcesMatch = null;
  if (!cutoff && finalSources) {
    const { sourcesOf } = await import("./grade.mjs");
    const mine = await sourcesOf(dir, run.sources);
    const keys = [...new Set([...Object.keys(mine), ...Object.keys(finalSources)])];
    sourcesMatch = keys.every((f) => mine[f] === finalSources[f]);
  }
  return { calls: calls.length, verified, cutoff, sourcesMatch, ...attemptsOf(verified, cutoff, sourcesMatch) };
}

/**
 * The attempts (each verified Bash call that ran the render or `tsc`, per the recomputation) and what they grade:
 * the first try, the fix rounds and the mistakes, each verified only where the attempts it needs are before the cutoff.
 */
export function attemptsOf(verified, cutoff, sourcesMatch = true) {
  const attempts = verified.filter((v) => v.tool === "Bash" && v.steps.some((s) => s.kind === "render" || s.kind === "tsc")).map((v) => {
    const steps = v.steps.filter((s) => s.kind === "render" || s.kind === "tsc");
    // A failed render with no diagnostic still made a mistake: the bundler's syntax error (`src/template.tsx:11
    // Expected ">" but found "style"`) is `build/syntax`, anything else `render/failed`.
    const diagnostics = steps.filter((s) => s.kind === "render").flatMap((s) => {
      const found = diagnosticsOf(s.out);
      if (s.code === 0 || found.some((d) => d.severity === "error")) return found;
      const syntax = /^(?:src|cards)\/\S+:\d+ (.+)$/m.exec(s.out);
      const last = s.out.split("\n").filter((l) => l.trim() && !LINE.test(l.trim())).pop() ?? "";
      return [...found, { severity: "error", code: syntax ? "build/syntax" : "render/failed", path: "", message: syntax ? syntax[0] : last }];
    });
    const tsErrors = steps.flatMap((s) => s.tsErrors);
    return {
      call: v.call, rendered: steps.some((s) => s.kind === "render"), error: steps.some((s) => s.code !== 0),
      mistakes: [...diagnostics.filter((d) => d.severity !== "info"), ...tsErrors.map((e) => ({ severity: "error", ...e }))].map((d) => ({ key: mistakeKey(d), severity: d.severity, text: d.message ?? d.text })),
    };
  });
  // A session whose sources at the end aren't the replay's changed them in a way the transcript doesn't show: nothing
  // in it is verified.
  const unverified = sourcesMatch === false;
  const whole = !cutoff && !unverified; // the whole session verified
  const firstRender = attempts.findIndex((a) => a.rendered);
  const firstTry = firstRender >= 0
    ? { verified: !unverified, valid: attempts.slice(0, firstRender + 1).every((a) => !a.error) }
    : { verified: whole, valid: null };
  const firstClean = attempts.findIndex((a) => a.rendered && !a.error);
  const fixRounds = firstClean >= 0
    ? { verified: !unverified, rounds: attempts.slice(0, firstClean).filter((a) => a.error).length, neverValid: false }
    : { verified: whole, rounds: whole ? attempts.filter((a) => a.error).length : null, neverValid: whole };
  return { attempts, firstTry, fixRounds, mistakes: attempts.flatMap((a) => a.mistakes), unverified };
}

/**
 * Replays a finished session at its own path: its directory moved aside, a pristine run made where it was (the same
 * kit, brief and rep under the same root, with the checker, specs, start files and `extra`), the session replayed
 * there, and the session's directory put back.
 */
export async function replayRun({ suite = "skill", kit, brief, rep, root, dir, events, env, extra = {} }) {
  const { rename, rm } = await import("node:fs/promises");
  const { briefOf, kitOf, makeRun, runOf, suiteOf } = await import("./make-run.mjs");
  const { sourcesOf } = await import("./grade.mjs");
  const run = runOf(await suiteOf(suite), await kitOf(suite, kit), await briefOf(suite, brief));
  const finalSources = await sourcesOf(dir, run.sources);
  // Claude Code makes `.claude/.cc-writes` in the session's folder when it starts, so `ls .claude` succeeds there.
  const ccWrites = existsSync(join(dir, ".claude/.cc-writes"));
  const aside = `${dir}.session`;
  await rename(dir, aside);
  try {
    const fresh = await makeRun(suite, kit, brief, rep, root, { isolated: true, extra });
    if (fresh !== dir) throw new Error(`the replay's directory ${fresh} isn't the session's ${dir}`);
    await mkdir(join(dir, ".tmp"), { recursive: true });
    if (ccWrites) await mkdir(join(dir, ".claude/.cc-writes"), { recursive: true });
    return await replay({ events, dir, run, env: { ...env, TMPDIR: join(dir, ".tmp") }, finalSources });
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rename(aside, dir);
  }
}

/** A replay's figures, as a results row records them. */
export function replayFields(rp, events) {
  return {
    firstTry: rp.firstTry, fixRounds: rp.fixRounds,
    mistakes: rp.mistakes, attempts: rp.attempts.map(({ call, rendered, error }) => ({ call, rendered, error })),
    replay: { calls: rp.calls, verified: rp.verified.length, cutoff: rp.cutoff, sourcesMatch: rp.sourcesMatch, unverified: rp.unverified },
    // A step whose result the replay couldn't reproduce: cut off there, and listed for a maintainer.
    mismatch: !!rp.cutoff?.mismatch,
    lookedElsewhere: lookedElsewhere(events),
  };
}

/** Each Read, cat or Grep of REFERENCE.md or of the engine's dist: whether the agent looked beyond the guide. */
export function lookedElsewhere(events) {
  const calls = events.flatMap((e) => (e.type === "assistant" ? e.message.content : [])).filter((c) => c.type === "tool_use");
  return calls.filter((c) => /REFERENCE\.md|node_modules\/@hyper-elements\/react\/dist/.test(JSON.stringify(c.input ?? {})) && ["Read", "Grep", "Glob", "Bash"].includes(c.name)).length;
}
