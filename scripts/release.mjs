/**
 * The release workflow's decisions (.github/workflows/publish.yml; plan email-client-models, D15), as functions with
 * tests (release.test.mjs) and a command line the workflow calls:
 *
 *   node scripts/release.mjs version <package> <patch|minor|major> <dir>
 *     prints GitHub outputs: current=, version=, publish=true|false. A run that already published its version
 *     (`releaseRun` in that version's manifest is this run's id) gets that version back with publish=false, so a
 *     re-attempt finishes the git tag and the GitHub release without publishing twice. Otherwise the next version from
 *     the highest one published at any tag (not `latest`), or the committed version where it's ahead.
 *   node scripts/release.mjs stamp <dir> <version>
 *     writes the version and this run's id (`releaseRun`) into <dir>/package.json before it's packed.
 *   node scripts/release.mjs tag
 *     prints the dist-tag to publish to: NPM_RELEASE_TAG (a repository variable, set to `next` while a release is held),
 *     else `latest`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** A version's numbers, or null for one that isn't a plain x.y.z (a prerelease isn't a release here). */
export function parse(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  return m ? m.slice(1).map(Number) : null;
}

/** Negative, zero or positive, as a comes before, with or after b. */
export function compare(a, b) {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** The highest plain version of a list, or null. */
export function highest(versions) {
  return versions.filter((v) => parse(v)).sort(compare).at(-1) ?? null;
}

export function bump(version, type) {
  const [major, minor, patch] = parse(version);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  if (type === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`release: a bump is patch, minor or major, not ${type}`);
}

/**
 * The version this run already published: one of the versions published since the run's first attempt started, at any
 * tag, whose manifest carries this run's id. `time` is `npm view <package> time --json` (its created and modified keys
 * aren't versions); `releaseRunOf(version)` reads that version's `releaseRun`.
 */
export function ownVersion({ time, since, runId, releaseRunOf }) {
  const start = Date.parse(since);
  const candidates = Object.entries(time ?? {})
    .filter(([version, at]) => parse(version) && Date.parse(at) >= start)
    .map(([version]) => version)
    .sort(compare);
  return candidates.find((version) => String(releaseRunOf(version)) === String(runId)) ?? null;
}

/**
 * What a run publishes. Its own version first, if it already published one (publish: false). Otherwise the next one:
 * the bump from the highest version published at any tag, or the committed version where it's ahead. A version that's
 * already on npm from another run is refused.
 */
export function decide({ published, committed, type, own }) {
  if (!parse(committed)) throw new Error(`release: package.json's version is ${committed}, not a plain x.y.z: this workflow releases those only (publish a prerelease by hand, to a tag of its own)`);
  const current = highest(published) ?? committed;
  if (own) return { current, version: own, publish: false };
  let version = bump(current, type);
  if (compare(committed, version) > 0) version = committed;
  if (published.includes(version)) throw new Error(`release: ${version} is already on npm, published by another run`);
  return { current, version, publish: true };
}

/** The dist-tag to publish to: NPM_RELEASE_TAG where it's set (a held release goes to `next`), else latest. */
export function releaseTag(env = process.env) {
  const tag = (env.NPM_RELEASE_TAG ?? "").trim();
  if (tag && !/^[a-z][a-z0-9-]*$/.test(tag)) throw new Error(`release: NPM_RELEASE_TAG isn't a dist-tag: ${tag}`);
  return tag || "latest";
}

// The command line, for the workflow. Reads npm and GitHub; the functions above are what's tested.
const npmJson = (args) => {
  try {
    return JSON.parse(execFileSync("npm", ["view", ...args, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) || "null");
  } catch {
    return null;
  }
};

/** When this run's first attempt started, from GitHub's API (no Actions context field gives it). */
function runStartedAt() {
  const { GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: run } = process.env;
  const out = execFileSync("gh", ["api", `repos/${repo}/actions/runs/${run}/attempts/1`, "--jq", ".run_started_at"], { encoding: "utf8" });
  return out.trim();
}

async function main([command, ...args]) {
  if (command === "version") {
    const [name, type, dir] = args;
    const committed = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;
    const versions = npmJson([name, "versions"]);
    const published = versions === null ? [] : [].concat(versions);
    const runId = process.env.GITHUB_RUN_ID;
    const own = published.length && runId ? ownVersion({ time: npmJson([name, "time"]), since: runStartedAt(), runId, releaseRunOf: (v) => npmJson([`${name}@${v}`, "releaseRun"]) }) : null;
    const { current, version, publish } = decide({ published, committed, type, own });
    process.stdout.write(`current=${current}\nversion=${version}\npublish=${publish}\n`);
    return;
  }
  if (command === "stamp") {
    const [dir, version] = args;
    const file = join(dir, "package.json");
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    manifest.version = version;
    manifest.releaseRun = process.env.GITHUB_RUN_ID ?? "local";
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }
  if (command === "tag") {
    process.stdout.write(`${releaseTag()}\n`);
    return;
  }
  throw new Error("release: version <package> <bump> <dir> | stamp <dir> <version> | tag");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
