/**
 * Refreshes test/fixtures/caniemail.json, the part of caniemail's data (caniemail.com, MIT, © Rémi Parmentier) that
 * Elements' email client lists come from: the features src/ names (`feature: "…"`, `caniemail("…")`). Run it, then
 * `pnpm test caniemail`: a client list that no longer matches the data fails, naming what changed.
 *
 *   node scripts/caniemail.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = "https://www.caniemail.com/api/data.json";
const root = new URL("..", import.meta.url).pathname;

const files = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : /\.tsx?$/.test(name) ? [join(dir, name)] : []));
const named = new Set();
for (const file of files(join(root, "src"))) {
  for (const match of readFileSync(file, "utf8").matchAll(/(?:feature: |caniemail\()"([a-z0-9-]+)"/g)) named.add(match[1]);
}

const data = await (await fetch(SOURCE)).json();
const features = {};
for (const slug of [...named].sort()) {
  const feature = data.data.find((f) => f.slug === slug);
  if (!feature) throw new Error(`caniemail has no feature "${slug}"`);
  features[slug] = { title: feature.title, stats: feature.stats, notes: feature.notes_by_num ?? {} };
}
const out = { source: SOURCE, license: "MIT, © Rémi Parmentier (github.com/hteumeuleu/caniemail)", updated: data.last_update_date, features };
writeFileSync(join(root, "test/fixtures/caniemail.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(features).length} features, caniemail data of ${data.last_update_date}`);
