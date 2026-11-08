import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Rebuild the README chart from the same recorded runs as the website benchmark.
// Run from any directory: node scripts/generate-readme-benchmark.mjs
// Use the complete four-kit batch, not the earlier MJML-only run or the old batch.
const source = new URL("../apps/website/benchmark/results/2026-11-08-sonnet.jsonl", import.meta.url);
const destination = new URL("../assets/hyper-elements-agent-benchmark.svg", import.meta.url);
const runs = readFileSync(source, "utf8").trim().split("\n").map((line) => JSON.parse(line));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const groups = [
  ["he", "Hyper Elements"],
  ["mjml", "MJML"],
  ["html", "Hand-written HTML"],
  ["react-email", "React Email"],
].map(([kit, label]) => {
  const records = runs.filter((run) => run.kit === kit);
  if (records.length !== 16 || records.some((run) => !run.pass || !Number.isFinite(run.wallMs) || !Number.isFinite(run.outputTokens) || typeof run.firstCheckPassed !== "boolean")) {
    throw new Error(`Review the chart's methodology labels for changed ${kit} results.`);
  }
  return {
    kit, label,
    seconds: median(records.map((run) => run.wallMs)) / 1000,
    tokens: median(records.map((run) => run.outputTokens)),
    firstPasses: records.filter((run) => run.firstCheckPassed).length,
  };
});
if (runs.length !== 64 || new Set(runs.map((run) => run.brief)).size !== 5) {
  throw new Error("Review the chart's batch size and brief count.");
}

// Match the website's neutral palette and mint success color.
const colors = { bg: "#0a0a0a", surface: "#101a15", border: "#284a36", accent: "#7ee2a8", line: "#272727", ink: "#ededed", muted: "#a1a1a1" };
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const text = (x, y, value, size = 24, fill = colors.ink, extra = "") =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const mono = 'font-family="Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"';
const label = (x, y, value) => text(x, y, value, 18, colors.muted, `${mono} letter-spacing="1.5"`);
const number = (x, y, value, active) => text(x, y, value, 40, active ? colors.accent : colors.ink, 'font-weight="500" letter-spacing="-1"');
const format = (value) => Math.round(value).toLocaleString("en-US");
const hyperElements = groups.find((group) => group.kit === "he");
const reactEmail = groups.find((group) => group.kit === "react-email");
const speed = (reactEmail.seconds / hyperElements.seconds).toFixed(1);
const tokens = (reactEmail.tokens / hyperElements.tokens).toFixed(1);
const timeScale = Math.ceil(Math.max(...groups.map((group) => group.seconds)) / 20) * 20;
const tokenScale = Math.ceil(Math.max(...groups.map((group) => group.tokens)) / 1000) * 1000;
const rowStart = 446;
const rowStride = 158;
const height = rowStart + groups.length * rowStride + 24;

const bar = (x, y, value, max, active) => `
  <rect x="${x}" y="${y}" width="324" height="10" rx="3" fill="#242424"/>
  <rect x="${x}" y="${y}" width="${(324 * value / max).toFixed(3)}" height="10" rx="3" fill="${active ? colors.accent : "#737373"}"/>
`;
const passes = (x, y, count, active) => Array.from({ length: 16 }, (_, i) =>
  `<rect x="${x + i * 20}" y="${y}" width="12" height="12" rx="3" fill="${i < count ? (active ? colors.accent : "#737373") : "#292929"}"/>`
).join("\n");

const rows = groups.map((group, i) => {
  const top = rowStart + i * rowStride;
  const active = group.kit === "he";
  return `
  <g id="row-${group.kit}">
    ${active ? `<rect x="52" y="${top}" width="1696" height="138" fill="${colors.surface}" stroke="${colors.border}"/>` : ""}
    ${text(80, top + 62, group.label, 32, active ? colors.ink : "#c2c2c2", `font-weight="${active ? 600 : 400}" letter-spacing="-0.6"`)}
    ${active ? text(80, top + 100, "Fastest · fewest output tokens", 20, colors.muted) : ""}
    ${number(500, top + 62, `${Math.round(group.seconds)}s`, active)}
    ${bar(500, top + 96, group.seconds, timeScale, active)}
    ${number(930, top + 62, format(group.tokens), active)}
    ${bar(930, top + 96, group.tokens, tokenScale, active)}
    ${number(1360, top + 62, `${group.firstPasses} / 16`, active)}
    ${passes(1360, top + 95, group.firstPasses, active)}
  </g>
  ${i > 0 && i < groups.length - 1 ? `<path d="M72 ${top + 138}H1728" stroke="#222222"/>` : ""}
  `;
}).join("\n");
const description = groups.map((group) =>
  `${group.label}: ${Math.round(group.seconds)} seconds, ${format(group.tokens)} output tokens, ${group.firstPasses} of 16 first-check passes.`
).join(" ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="${height}" viewBox="0 0 1800 ${height}" role="img" aria-labelledby="title description">
<title id="title">Hyper Elements: faster to a passing email</title>
<desc id="description">${escape(description)} Time and output tokens are medians. Hyper Elements and MJML tie on first-check passes. Five email briefs and 16 runs per approach in one interleaved batch; all 64 runs eventually passed. Claude Code with Claude Sonnet 5, November 8, 2026. Bars start at zero; time uses a ${timeScale}-second scale and tokens a ${format(tokenScale)}-token scale. Each square represents one run's first check.</desc>
<rect width="1800" height="${height}" fill="${colors.bg}"/>
<g font-family="Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif">
  ${text(72, 104, "Faster to a passing email.", 72, colors.ink, 'font-weight="600" letter-spacing="-2.8"')}
  ${text(72, 154, "Four approaches. Same briefs. Same checks.", 28, colors.muted)}
  <path d="M72 193H1728" stroke="${colors.line}"/>

  ${text(80, 265, "5 email briefs", 27, colors.ink, 'font-weight="500"')}
  ${text(80, 306, "16 runs per approach", 25, colors.muted)}
  ${text(80, 346, "64 runs in total.", 23, colors.muted)}

  ${text(500, 272, `${speed}×`, 88, colors.accent, 'font-weight="600" letter-spacing="-4"')}
  ${text(500, 330, "faster to pass", 27, colors.ink)}
  ${text(500, 365, "vs. React Email", 22, colors.muted)}

  ${text(930, 272, `${tokens}×`, 88, colors.accent, 'font-weight="600" letter-spacing="-4"')}
  ${text(930, 330, "fewer output tokens", 27, colors.ink)}
  ${text(930, 365, "vs. React Email", 22, colors.muted)}

  ${text(1360, 272, `${hyperElements.firstPasses}/16`, 88, colors.accent, 'font-weight="600" letter-spacing="-4"')}
  ${text(1360, 330, "passed on first check", 27, colors.ink)}
  ${text(1360, 365, "tied with MJML", 22, colors.muted)}

  ${label(80, 421, "APPROACH")}
  ${label(500, 421, "TIME · MEDIAN")}
  ${label(930, 421, "OUTPUT TOKENS · MEDIAN")}
  ${label(1360, 421, "FIRST-CHECK PASSES")}
  ${rows}
</g>
</svg>
`;
writeFileSync(destination, svg.split("\n").map((line) => line.trimEnd()).join("\n"));
console.log(`Wrote ${fileURLToPath(destination)}`);
console.log(JSON.stringify(groups, null, 2));
