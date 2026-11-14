// Writes what editor.html loads, for each set of components (src/shop, src/oyen), to output/<set>/:
// tools.js (the editor's custom JavaScript), design.json (the email as the editor's design) and email.html (the email
// rendered as it is, to compare with what the editor exports).
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const shared = { bundle: true, jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning" };

for (const set of ["shop", "oyen"]) {
  const out = `output/${set}`;
  mkdirSync(out, { recursive: true });

  // The tools run in the editor's page: one script, with Elements and the components in it.
  await build({ ...shared, entryPoints: [`src/${set}/tools.ts`], platform: "browser", format: "iife", minify: true, outfile: `${out}/tools.js` });

  // The email and its design are made here, in Node.
  await build({ ...shared, entryPoints: [`src/${set}/design.tsx`], platform: "node", format: "esm", outfile: `${out}/design.mjs`, banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' } });
  const { html, design, report } = await import(`./${out}/design.mjs`);
  writeFileSync(`${out}/email.html`, html);
  writeFileSync(`${out}/design.json`, JSON.stringify(design, null, 2));

  const blocks = design.body.rows.flatMap((row) => row.columns.flatMap((column) => column.contents));
  const tools = blocks.filter((block) => block.type === "custom").length;
  console.log(`${out}: email.html (${html.length} bytes), design.json (${blocks.length} blocks, ${tools} of them the set's own tools), tools.js`);
  for (const line of report) console.log(`  ${line}`);
}
