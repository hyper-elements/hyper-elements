#!/usr/bin/env node
/**
 * The `hyper-elements` command. It checks the runtime before anything else loads, in code any version runs (no
 * imports, no newer syntax or APIs): Node.js 20.6 or later, or Bun 1.3 or later. Any other exits 2 with the version
 * found and the ones supported. Then main.ts runs.
 */

var bunVersion = process.versions.bun;
var runtime = bunVersion ? "Bun" : "Node.js";
var found = String(bunVersion || process.versions.node);
var minimum = bunVersion ? [1, 3] : [20, 6];
var parts = found.split(".").map(Number);
var asked = process.argv.slice(2);
if (asked.length === 1 && (asked[0] === "--version" || asked[0] === "-v")) {
  // Which version this is, on any runtime: read from its package.json (an import of node:fs only, which any runs).
  import("node:fs").then(function (fs) {
    process.stdout.write(JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version + "\n");
  });
} else if (parts[0] < minimum[0] || (parts[0] === minimum[0] && parts[1] < minimum[1])) {
  process.stderr.write(
    "@hyper-elements/cli needs Node.js 20.6 or later, or Bun 1.3 or later (this is " + runtime + " " + found + ").\n",
  );
  process.exitCode = 2;
} else {
  import("./main.js");
}
