/**
 * Refreshes test/fixtures/caniemail.json, the part of caniemail's data (caniemail.com, MIT, © Rémi Parmentier) that
 * the plugin's email client lists come from: the features src/ names (`feature: "…"`, `caniemail("…")`), each
 * platform's results as [version, result] pairs in the order caniemail tested them. Run it, then
 * `pnpm test caniemail`: a client list that no longer matches the data fails, naming what changed.
 *
 *   node scripts/caniemail.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://www.caniemail.com/api/data.json";
const root = fileURLToPath(new URL("..", import.meta.url));

const files = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : /\.tsx?$/.test(name) ? [join(dir, name)] : []));
const named = new Set();
for (const file of files(join(root, "src"))) {
  for (const match of readFileSync(file, "utf8").matchAll(/(?:feature: |caniemail\()"([a-z0-9-]+)"/g)) named.add(match[1]);
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE}: ${response.status} ${response.statusText}`);
// A version that's a whole number ("13", "2019") would move to the front of its object in JSON.parse, out of the
// order caniemail tested them in: each is read as "#13" first, and each platform's results written as a list, oldest
// to latest.
const data = JSON.parse((await response.text()).replace(/"(\d+)":/g, '"#$1":'));
const bare = (key) => key.replace(/^#/, "");
const features = {};
for (const slug of [...named].sort()) {
  const feature = data.data.find((f) => f.slug === slug);
  if (!feature) throw new Error(`caniemail has no feature "${slug}"`);
  const stats = Object.fromEntries(
    Object.entries(feature.stats).map(([family, platforms]) => [family, Object.fromEntries(Object.entries(platforms).map(([platform, versions]) => [platform, Object.entries(versions).map(([version, result]) => [bare(version), result])]))])
  );
  const notes = Object.fromEntries(Object.entries(feature.notes_by_num ?? {}).map(([n, note]) => [bare(n), note]));
  features[slug] = { title: feature.title, stats, notes };
}
const out = { source: SOURCE, license: "MIT, © Rémi Parmentier (github.com/hteumeuleu/caniemail)", updated: data.last_update_date, features };
writeFileSync(join(root, "test/fixtures/caniemail.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(features).length} features, caniemail data of ${data.last_update_date}`);
