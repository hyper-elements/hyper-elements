import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Rebuild the README chart from the same recorded runs as the website benchmark.
// Run from any directory: node scripts/generate-readme-benchmark.mjs
const source = new URL("../apps/website/benchmark/results/2026-11-06-sonnet.jsonl", import.meta.url);
const destination = new URL("../assets/hyper-elements-agent-benchmark.svg", import.meta.url);
const runs = readFileSync(source, "utf8").trim().split("\n").map((line) => JSON.parse(line));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const groups = [
  ["he", "Hyper Elements"],
  ["html", "Hand-written HTML"],
  ["react-email", "React Email"],
].map(([kit, label]) => {
  const records = runs.filter((run) => run.kit === kit);
  if (records.length !== 16 || records.some((run) => !run.pass)) {
    throw new Error(`Review the chart's methodology labels for changed ${kit} results.`);
  }
  return {
    kit, label,
    seconds: median(records.map((run) => run.wallMs)) / 1000,
    tokens: median(records.map((run) => run.outputTokens)),
    firstPasses: records.filter((run) => run.firstCheckPassed).length,
  };
});

// Match the website's neutral palette and use its actual brand mark.
const logoSource = readFileSync(new URL("../apps/website/src/components/Logo.astro", import.meta.url), "utf8");
const logoPath = /<path[^>]*\bd="([^"]+)"/.exec(logoSource)?.[1];
if (!logoPath) throw new Error("Could not read the website logo.");
const colors = { bg: "#0a0a0a", surface: "#111111", line: "#272727", ink: "#ededed", muted: "#a1a1a1", dim: "#6e6e6e" };
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const text = (x, y, value, size = 24, fill = colors.ink, extra = "") =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const mono = 'font-family="Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"';
const label = (x, y, value) => text(x, y, value, 18, colors.muted, `${mono} letter-spacing="1.5"`);
const number = (x, y, value) => text(x, y, value, 40, colors.ink, 'font-weight="500" letter-spacing="-1"');
const format = (value) => Math.round(value).toLocaleString("en-US");
const speed = (groups[2].seconds / groups[0].seconds).toFixed(1);
const tokens = (groups[2].tokens / groups[0].tokens).toFixed(1);

const bar = (x, y, value, max, active) => `
  <rect x="${x}" y="${y}" width="324" height="10" rx="3" fill="#242424"/>
  <rect x="${x}" y="${y}" width="${(324 * value / max).toFixed(3)}" height="10" rx="3" fill="${active ? colors.ink : "#737373"}"/>
`;
const passes = (x, y, count, active) => Array.from({ length: 16 }, (_, i) =>
  `<rect x="${x + i * 20}" y="${y}" width="12" height="12" rx="3" fill="${i < count ? (active ? colors.ink : "#737373") : "#292929"}"/>`
).join("\n");

const rows = groups.map((group, i) => {
  const top = 526 + i * 158;
  const active = group.kit === "he";
  return `
  <g id="row-${group.kit}">
    ${active ? `<rect x="52" y="${top}" width="1696" height="138" rx="14" fill="${colors.surface}" stroke="#353535"/>` : ""}
    ${text(80, top + 62, group.label, 32, active ? colors.ink : "#c2c2c2", `font-weight="${active ? 600 : 400}" letter-spacing="-0.6"`)}
    ${active ? text(80, top + 100, "Best across all three measures", 20, colors.muted) : ""}
    ${number(500, top + 62, `${Math.round(group.seconds)}s`)}
    ${bar(500, top + 96, group.seconds, 80, active)}
    ${number(930, top + 62, format(group.tokens))}
    ${bar(930, top + 96, group.tokens, 6000, active)}
    ${number(1360, top + 62, `${group.firstPasses} / 16`)}
    ${passes(1360, top + 95, group.firstPasses, active)}
  </g>
  ${i === 1 ? '<path d="M72 822H1728" stroke="#222222"/>' : ""}
  `;
}).join("\n");
const description = groups.map((group) =>
  `${group.label}: ${Math.round(group.seconds)} seconds, ${format(group.tokens)} output tokens, ${group.firstPasses} of 16 first-check passes.`
).join(" ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1140" viewBox="0 0 1800 1140" role="img" aria-labelledby="title description">
<title id="title">Hyper Elements: faster to a passing email</title>
<desc id="description">${escape(description)} Time and output tokens are medians. Five email briefs and 16 runs per approach; all 48 runs eventually passed. Claude Code with Claude Sonnet 5, November 6, 2026. Bars start at zero; time uses an 80-second scale and tokens a 6,000-token scale. Each square represents one run's first check.</desc>
<rect width="1800" height="1140" rx="24" fill="${colors.bg}"/>
<g font-family="Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif">
  <svg x="72" y="48" width="48" height="36" viewBox="228 326 798 600" aria-hidden="true">
    <path d="${logoPath}" fill="#e3e8ed"/>
    <path d="${logoPath}" fill="#ef4638" transform="rotate(180 627 626)"/>
  </svg>
  ${text(138, 77, "Hyper Elements", 30, colors.ink, 'font-weight="600" letter-spacing="-0.7"')}
  ${text(1728, 74, "AGENT BENCHMARK", 19, colors.muted, `${mono} text-anchor="end" letter-spacing="2.2"`)}
  ${text(72, 184, "Faster to a passing email.", 72, colors.ink, 'font-weight="600" letter-spacing="-2.8"')}
  ${text(72, 234, "Less time. Fewer output tokens. More first-check passes.", 28, colors.muted)}
  <path d="M72 273H1728" stroke="${colors.line}"/>

  ${text(80, 345, "5 email briefs", 27, colors.ink, 'font-weight="500"')}
  ${text(80, 386, "16 runs per approach", 25, colors.muted)}
  ${text(80, 426, "Same tasks. Same checks.", 23, colors.muted)}

  ${text(500, 352, `${speed}×`, 88, colors.ink, 'font-weight="600" letter-spacing="-4"')}
  ${text(500, 410, "faster to pass", 27, colors.ink)}
  ${text(500, 445, "vs. React Email", 22, colors.muted)}

  ${text(930, 352, `${tokens}×`, 88, colors.ink, 'font-weight="600" letter-spacing="-4"')}
  ${text(930, 410, "fewer output tokens", 27, colors.ink)}
  ${text(930, 445, "vs. React Email", 22, colors.muted)}

  ${text(1360, 352, `${groups[0].firstPasses}/16`, 88, colors.ink, 'font-weight="600" letter-spacing="-4"')}
  ${text(1360, 410, "passed on first check", 27, colors.ink)}
  ${text(1360, 445, "Hyper Elements", 22, colors.muted)}

  ${label(80, 501, "APPROACH")}
  ${label(500, 501, "TIME · MEDIAN")}
  ${label(930, 501, "OUTPUT TOKENS · MEDIAN")}
  ${label(1360, 501, "FIRST-CHECK PASSES")}
  ${rows}

  <path d="M72 1010H1728" stroke="${colors.line}"/>
  ${text(72, 1058, "Claude Code · Claude Sonnet 5 · Hyper Elements 0.3 · November 6, 2026", 22, colors.muted)}
  ${text(72, 1095, "Identical Chromium checks at desktop and mobile widths. All 48 runs eventually passed.", 21, colors.dim)}
  ${text(1728, 1058, "hyperelements.dev", 22, colors.muted, `${mono} text-anchor="end"`)}
</g>
</svg>
`;
writeFileSync(destination, svg.split("\n").map((line) => line.trimEnd()).join("\n"));
console.log(`Wrote ${fileURLToPath(destination)}`);
console.log(JSON.stringify(groups, null, 2));
