#!/usr/bin/env node
/**
 * The `hyper-elements` command. It checks the Node.js version before anything else loads, in code any version runs
 * (no imports, no newer syntax or APIs), then cli.ts runs. Only `--version` comes first: it says which version this
 * is on any Node.js.
 */

var minimum = [20, 6];
var version = String(process.versions.node);
var parts = version.split(".").map(Number);
var asked = process.argv.slice(2);
if (asked.length === 1 && (asked[0] === "--version" || asked[0] === "-v")) {
  import("node:fs").then(function (fs) {
    process.stdout.write(JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version + "\n");
  });
} else if (parts[0] < minimum[0] || (parts[0] === minimum[0] && parts[1] < minimum[1])) {
  process.stderr.write("@hyper-elements/cli needs Node.js " + minimum.join(".") + " or later (you have " + version + ").\n");
  process.exitCode = 1;
} else {
  import("./cli.js").then(function (cli) {
    return cli.main(asked, { cwd: process.cwd(), out: process.stdout, err: process.stderr });
  }).then(function (code) {
    process.exitCode = code;
  });
}
