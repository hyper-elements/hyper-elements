// Writes what editor.html loads: output/tools.js (the editor's custom JavaScript) and output/design.json (the dispatch),
// and output/email.html: the dispatch rendered as it is, to compare with what the editor exports.
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

mkdirSync("output", { recursive: true });
const shared = { bundle: true, jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning" };

// The tools run in the editor's page: one script, with Elements and the components in it.
await build({ ...shared, entryPoints: ["src/tools.ts"], platform: "browser", format: "iife", minify: true, outfile: "output/tools.js" });

// The design is made here, in Node.
await build({ ...shared, entryPoints: ["src/design.tsx"], platform: "node", format: "esm", outfile: "output/design.mjs", banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' } });
const { html, design, report } = await import("./output/design.mjs");
writeFileSync("output/email.html", html);
writeFileSync("output/design.json", JSON.stringify(design, null, 2));

const blocks = design.body.rows.flatMap((row) => row.columns.flatMap((column) => column.contents));
const tools = blocks.filter((block) => block.type === "custom").length;
console.log(`output/email.html: the dispatch, rendered (${html.length} bytes)`);
console.log(`output/design.json: ${blocks.length} blocks, ${tools} of them Oyen's own tools`);
for (const line of report) console.log(`  ${line}`);
