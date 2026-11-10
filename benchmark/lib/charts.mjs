import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Rebuild both shared README/docs charts from their final recorded batches.
// Run from any directory: node benchmark/lib/charts.mjs (or `npm run charts` in benchmark/)
const charts = [
  {
    suite: "email",
    source: "2026-11-08-sonnet.jsonl",
    destination: "hyper-elements-agent-benchmark.svg",
    runsPerKit: 16,
    kits: [["he", "Hyper Elements"], ["mjml", "MJML"], ["html", "Hand-written HTML"], ["react-email", "React Email"]],
    comparisonKit: "react-email",
    comparisonLabel: "React Email",
    speedDigits: 1,
    firstCheckBasis: "tied with MJML",
    highlightNote: "Fastest · fewest output tokens",
    title: "Hyper Elements agent benchmark",
    context: "Hyper Elements and MJML tie on first-check passes. Five email briefs and 16 runs per approach in one interleaved batch; all 64 runs eventually passed.",
  },
  {
    suite: "image",
    // Excludes the pilot/first batch; uses the isolated rerun with identical kit instructions.
    source: "2026-11-08b-image-sonnet.jsonl",
    destination: "hyper-elements-image-benchmark.svg",
    runsPerKit: 20,
    kits: [["he", "Hyper Elements"], ["playwright", "Playwright", "HTML + Chromium"], ["canvas", "Canvas 2D", "@napi-rs/canvas"]],
    comparisonKit: "canvas",
    comparisonLabel: "Canvas 2D",
    speedDigits: 2,
    firstCheckBasis: "Hyper Elements",
    highlightNote: "Lowest median time and tokens",
    title: "Hyper Elements image agent benchmark",
    context: "Five image briefs and 20 runs per approach, four per brief, in an isolated batch; all 60 runs were valid and eventually passed. The within-brief speed comparison with Playwright was inconclusive (p = 0.35).",
  },
];
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Match the website's neutral palette and mint success color.
const colors = { bg: "#0a0a0a", surface: "#101a15", border: "#284a36", accent: "#7ee2a8", ink: "#ededed", muted: "#a1a1a1" };
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const text = (x, y, value, size = 24, fill = colors.ink, extra = "") =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const mono = 'font-family="Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"';
const label = (x, y, value) => text(x, y, value, 18, colors.muted, `${mono} letter-spacing="1.5"`);
const number = (x, y, value, active) => text(x, y, value, 40, active ? colors.accent : colors.ink, 'font-weight="500" letter-spacing="-1"');
const format = (value) => Math.round(value).toLocaleString("en-US");
const rowStart = 294;
const rowStride = 158;
const bar = (x, y, value, max, active) => `
  <rect x="${x}" y="${y}" width="324" height="10" rx="3" fill="#242424"/>
  <rect x="${x}" y="${y}" width="${(324 * value / max).toFixed(3)}" height="10" rx="3" fill="${active ? colors.accent : "#737373"}"/>
`;
const passes = (x, y, count, active, total) => {
  const step = Math.floor(324 / total);
  return Array.from({ length: total }, (_, i) =>
    `<rect x="${x + i * step}" y="${y}" width="12" height="12" rx="3" fill="${i < count ? (active ? colors.accent : "#737373") : "#292929"}"/>`
  ).join("\n");
};

function generateChart(chart) {
  const source = new URL(`../results/${chart.source}`, import.meta.url);
  const destination = new URL(`../../apps/website/public/img/${chart.destination}`, import.meta.url);
  const runs = readFileSync(source, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const groups = chart.kits.map(([kit, label, note]) => {
    const records = runs.filter((run) => run.kit === kit);
    if (records.length !== chart.runsPerKit || records.some((run) =>
      !run.pass || !Number.isFinite(run.wallMs) || run.wallMs <= 0 || !Number.isFinite(run.outputTokens) || run.outputTokens <= 0 || typeof run.firstCheckPassed !== "boolean" ||
      (chart.suite === "image" && (run.valid !== true || run.suite !== "image"))
    )) throw new Error(`Review the ${chart.suite} chart's ${kit} results and methodology labels.`);
    const briefs = new Set(records.map((run) => run.brief));
    if (briefs.size !== 5 || (chart.suite === "image" && [...briefs].some((brief) => records.filter((run) => run.brief === brief).length !== 4))) {
      throw new Error(`Review the ${chart.suite} chart's brief distribution for ${kit}.`);
    }
    return {
      kit, label, note,
      seconds: median(records.map((run) => run.wallMs)) / 1000,
      tokens: median(records.map((run) => run.outputTokens)),
      firstPasses: records.filter((run) => run.firstCheckPassed).length,
    };
  });
  if (runs.length !== chart.runsPerKit * chart.kits.length) throw new Error(`Unexpected ${chart.suite} batch size.`);
  const hyperElements = groups.find((group) => group.kit === "he");
  const comparison = groups.find((group) => group.kit === chart.comparisonKit);
  const speed = (comparison.seconds / hyperElements.seconds).toFixed(chart.speedDigits);
  const tokens = (comparison.tokens / hyperElements.tokens).toFixed(1);
  const timeScale = Math.ceil(Math.max(...groups.map((group) => group.seconds)) / 20) * 20;
  const tokenScale = Math.ceil(Math.max(...groups.map((group) => group.tokens)) / 1000) * 1000;
  const height = rowStart + groups.length * rowStride + 24;

  const rows = groups.map((group, i) => {
    const top = rowStart + i * rowStride;
    const active = group.kit === "he";
    const note = active ? chart.highlightNote : group.note;
    return `
  <g id="row-${group.kit}">
    ${active ? `<rect x="52" y="${top}" width="1696" height="138" rx="14" fill="${colors.surface}" stroke="${colors.border}"/>` : ""}
    ${text(80, top + 62, group.label, 32, active ? colors.ink : "#c2c2c2", `font-weight="${active ? 600 : 400}" letter-spacing="-0.6"`)}
    ${note ? text(80, top + 100, note, 20, colors.muted) : ""}
    ${number(500, top + 62, `${Math.round(group.seconds)}s`, active)}
    ${bar(500, top + 96, group.seconds, timeScale, active)}
    ${number(930, top + 62, format(group.tokens), active)}
    ${bar(930, top + 96, group.tokens, tokenScale, active)}
    ${number(1360, top + 62, `${group.firstPasses} / ${chart.runsPerKit}`, active)}
    ${passes(1360, top + 95, group.firstPasses, active, chart.runsPerKit)}
  </g>
  ${i > 0 && i < groups.length - 1 ? `<path d="M72 ${top + 138}H1728" stroke="#222222"/>` : ""}
  `;
  }).join("\n");
  const description = groups.map((group) =>
    `${group.label}: ${Math.round(group.seconds)} seconds, ${format(group.tokens)} output tokens, ${group.firstPasses} of ${chart.runsPerKit} first-check passes.`
  ).join(" ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="${height}" viewBox="0 0 1800 ${height}" role="img" aria-labelledby="title description">
<title id="title">${escape(chart.title)}</title>
<desc id="description">${escape(description)} Time and output tokens are medians. ${escape(chart.context)} Claude Code with Claude Sonnet 5, November 8, 2026. Bars start at zero; time uses a ${timeScale}-second scale and tokens a ${format(tokenScale)}-token scale. Each square represents one run's first check.</desc>
<rect width="1800" height="${height}" fill="${colors.bg}"/>
<g font-family="Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif">
  ${text(80, 113, `5 ${chart.suite} briefs`, 27, colors.ink, 'font-weight="500"')}
  ${text(80, 154, `${chart.runsPerKit} runs per approach`, 25, colors.muted)}
  ${text(80, 194, `${runs.length} runs in total.`, 23, colors.muted)}

  ${text(500, 120, `${speed}×`, 88, colors.accent, 'font-weight="600" letter-spacing="-4"')}
  ${text(500, 178, "faster to pass", 27, colors.ink)}
  ${text(500, 213, `vs. ${chart.comparisonLabel}`, 22, colors.muted)}

  ${text(930, 120, `${tokens}×`, 88, colors.accent, 'font-weight="600" letter-spacing="-4"')}
  ${text(930, 178, "fewer output tokens", 27, colors.ink)}
  ${text(930, 213, `vs. ${chart.comparisonLabel}`, 22, colors.muted)}

  ${text(1360, 120, `${hyperElements.firstPasses}/${chart.runsPerKit}`, 88, colors.accent, 'font-weight="600" letter-spacing="-4"')}
  ${text(1360, 178, "passed on first check", 27, colors.ink)}
  ${text(1360, 213, chart.firstCheckBasis, 22, colors.muted)}

  ${label(80, 269, "APPROACH")}
  ${label(500, 269, "TIME · MEDIAN")}
  ${label(930, 269, "OUTPUT TOKENS · MEDIAN")}
  ${label(1360, 269, "FIRST-CHECK PASSES")}
  ${rows}
</g>
</svg>
`;
  writeFileSync(destination, svg.split("\n").map((line) => line.trimEnd()).join("\n"));
  console.log(`Wrote ${fileURLToPath(destination)}`);
  console.log(JSON.stringify(groups, null, 2));
}

charts.forEach(generateChart);
