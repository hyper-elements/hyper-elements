/**
 * The release workflow's decisions (release.mjs; plan email-client-models, D15): numbering from the highest version
 * published at any tag, the hold tag, and resuming a run whose npm publish succeeded but whose git tag or GitHub release
 * didn't. Each re-attempt runs against the registry as the first attempt left it.
 *
 *   node --test scripts/release.test.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { bump, decide, highest, ownVersion, releaseTag } from "./release.mjs";

/** A fake registry: versions with their publish time, dist-tags and releaseRun. */
function registry(entries) {
  const r = { versions: {}, tags: {} };
  for (const [version, at, tag, run] of entries) {
    r.versions[version] = { at, run };
    if (tag) r.tags[tag] = version;
  }
  return r;
}
const time = (r) => ({ created: "2026-01-01T00:00:00Z", modified: "2026-11-10T00:00:00Z", ...Object.fromEntries(Object.entries(r.versions).map(([v, { at }]) => [v, at])) });

/** One attempt of a run: decide, then publish (unless resuming) to `tag`. Returns the decision. */
function attempt(r, { committed, type, runId, since, tag, now }) {
  const own = ownVersion({ time: time(r), since, runId, releaseRunOf: (v) => r.versions[v]?.run });
  const result = decide({ published: Object.keys(r.versions), committed, type, own });
  if (result.publish) {
    r.versions[result.version] = { at: now, run: runId };
    r.tags[tag] = result.version;
  }
  return result;
}

test("numbers from the highest version at any tag, not latest", () => {
  const r = registry([["0.3.1", "2026-11-09T08:41:00Z", "latest"], ["0.4.0", "2026-11-12T10:00:00Z", "next"]]);
  assert.deepEqual(decide({ published: Object.keys(r.versions), committed: "0.4.0", type: "patch", own: null }), { current: "0.4.0", version: "0.4.1", publish: true });
  assert.equal(highest(["0.3.1", "0.10.0", "0.9.9", "1.0.0-beta.1"]), "0.10.0");
});

test("a version committed ahead wins (a planned minor), and the first publish starts from it", () => {
  assert.deepEqual(decide({ published: ["0.3.1", "0.3.2"], committed: "0.4.0", type: "patch", own: null }), { current: "0.3.2", version: "0.4.0", publish: true });
  assert.deepEqual(decide({ published: [], committed: "1.0.0", type: "patch", own: null }), { current: "1.0.0", version: "1.0.1", publish: true });
  assert.equal(bump("0.3.9", "minor"), "0.4.0");
  assert.equal(bump("0.3.9", "major"), "1.0.0");
});

test("never picks a version that's already on npm (the refusal is a safety net numbering from the highest makes unreachable)", () => {
  const all = ["0.2.9", "0.3.0", "0.3.1", "0.3.2", "0.4.0", "0.4.1", "0.5.0", "1.0.0"];
  for (let mask = 1; mask < 1 << all.length; mask++) {
    const published = all.filter((_, i) => mask & (1 << i));
    for (const committed of ["0.3.0", "0.4.0", "0.6.0"]) {
      for (const type of ["patch", "minor", "major"]) {
        const { version } = decide({ published, committed, type, own: null });
        assert.ok(!published.includes(version), `${version} from ${published.join(",")} (${committed}, ${type})`);
      }
    }
  }
});

for (const [name, setup] of [
  ["held on next (a release:minor run)", { type: "minor", tag: "next", committed: "0.3.0", latest: "0.3.1" }],
  ["straight to latest, no hold (a patch run)", { type: "patch", tag: "latest", committed: "0.3.0", latest: "0.3.1" }],
]) {
  test(`a re-attempt after npm succeeded reuses its version: ${name}`, () => {
    const r = registry([["0.3.0", "2026-11-01T00:00:00Z"], [setup.latest, "2026-11-09T08:41:00Z", "latest"]]);
    const run = { committed: setup.committed, type: setup.type, runId: "4242", since: "2026-11-12T09:00:00Z", tag: setup.tag };
    const first = attempt(r, { ...run, now: "2026-11-12T09:05:00Z" });
    assert.equal(first.publish, true);
    // The git tag failed; the job is re-attempted with the same run id, against the registry the first attempt left.
    const second = attempt(r, { ...run, now: "2026-11-12T09:30:00Z" });
    assert.deepEqual(second, { current: first.version, version: first.version, publish: false });
    assert.equal(Object.keys(r.versions).filter((v) => r.versions[v].run === "4242").length, 1);
  });
}

test("a re-attempt after promotion still finds its version, now latest", () => {
  const r = registry([["0.3.1", "2026-11-09T08:41:00Z", "latest"]]);
  const run = { committed: "0.3.0", type: "minor", runId: "77", since: "2026-11-12T09:00:00Z", tag: "next" };
  const first = attempt(r, { ...run, now: "2026-11-12T09:05:00Z" });
  r.tags.latest = first.version; // npm dist-tag add … latest
  assert.deepEqual(attempt(r, { ...run, now: "2026-11-12T11:00:00Z" }), { current: first.version, version: first.version, publish: false });
});

test("another run's version isn't taken as this run's", () => {
  const r = registry([["0.3.1", "2026-11-09T08:41:00Z", "latest"], ["0.4.0", "2026-11-12T09:05:00Z", "next", "111"]]);
  const own = ownVersion({ time: time(r), since: "2026-11-12T09:00:00Z", runId: "222", releaseRunOf: (v) => r.versions[v]?.run });
  assert.equal(own, null);
  // Versions published before the run started aren't read at all.
  assert.equal(ownVersion({ time: time(r), since: "2026-11-12T10:00:00Z", runId: "111", releaseRunOf: (v) => r.versions[v]?.run }), null);
});

test("migrate numbers the same way", () => {
  const r = registry([["0.2.0", "2026-10-01T00:00:00Z", "latest"]]);
  const run = { committed: "0.2.0", type: "patch", runId: "9", since: "2026-11-12T09:00:00Z", tag: "next" };
  const first = attempt(r, { ...run, now: "2026-11-12T09:06:00Z" });
  assert.equal(first.version, "0.2.1");
  assert.deepEqual(attempt(r, { ...run, now: "2026-11-12T09:40:00Z" }), { current: "0.2.1", version: "0.2.1", publish: false });
});

test("the hold tag", () => {
  assert.equal(releaseTag({}), "latest");
  assert.equal(releaseTag({ NPM_RELEASE_TAG: "" }), "latest");
  assert.equal(releaseTag({ NPM_RELEASE_TAG: "next" }), "next");
  assert.throws(() => releaseTag({ NPM_RELEASE_TAG: "next; rm -rf /" }), /isn't a dist-tag/);
});
