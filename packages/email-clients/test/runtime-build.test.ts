/**
 * The runtime the preview files carry: src/runtime.generated.ts is what its sources build (scripts/build-runtime.mjs),
 * the copied email-renderer modules are the ones RUNTIME_SOURCE pins, and none of it is in core's bundle.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
// @ts-expect-error a script, without types
import { generated, runtimeScript } from "../scripts/build-runtime.mjs";
import { RUNTIME } from "../src/runtime.generated";

const dir = resolve(__dirname, "..");

describe("the runtime", () => {
  it("is what its sources build, with its sha256", async () => {
    const built = await runtimeScript();
    expect(readFileSync(join(dir, "src/runtime.generated.ts"), "utf8")).toBe(generated(built));
    expect(RUNTIME.sha256).toBe(createHash("sha256").update(RUNTIME.script, "utf8").digest("base64"));
    expect(RUNTIME.script).not.toMatch(/<\/script/i);
  });

  it("draws with the email-renderer modules RUNTIME_SOURCE pins, unchanged", () => {
    const source = readFileSync(join(dir, "RUNTIME_SOURCE"), "utf8");
    expect(source).toMatch(/^repository: unlayer\/email-renderer$/m);
    expect(source).toMatch(/^commit: [0-9a-f]{40}$/m);
    const files = [...source.matchAll(/^  (\S+) sha256-([0-9a-f]{64})$/gm)];
    expect(files.map((m) => m[1]).sort()).toEqual(["clients/apple-mail.js", "clients/gmail.js", "clients/outlook-com.js", "clients/support.json", "conditional.mjs", "rules.js"]);
    for (const [, file, sha] of files) expect([file, createHash("sha256").update(readFileSync(join(dir, "src/runtime/renderer", file!))).digest("hex")]).toEqual([file, sha]);
  });

  it("isn't in core: @hyper-elements/react's bundles hold none of it", () => {
    const coreDist = resolve(dir, "../react/dist");
    if (!existsSync(coreDist)) return;
    for (const file of readdirSync(coreDist).filter((f) => /\.(c?js)$/.test(f))) {
      const text = readFileSync(join(coreDist, file), "utf8");
      for (const name of ["createOutlookRules", "gmailClip", "settleAppleMail", "resolveConditionalComments", "data-email-client-ready"]) expect([file, text.includes(name)]).toEqual([file, false]);
    }
  });
});
