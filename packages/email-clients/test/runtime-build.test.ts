/**
 * The runtime the preview files carry: src/runtime.generated.ts is what its sources build (scripts/build-runtime.mjs),
 * it holds none of the models (they're the closed package's script), and none of it is in core's bundle.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
// @ts-expect-error a script, without types
import { assertInlineSafe, generated, runtimeScript } from "../scripts/build-runtime.mjs";
import { RUNTIME } from "../src/runtime.generated";

const dir = resolve(__dirname, "..");

describe("the runtime", () => {
  it("is what its sources build, with its sha256", async () => {
    const built = await runtimeScript();
    expect(readFileSync(join(dir, "src/runtime.generated.ts"), "utf8")).toBe(generated(built));
    expect(RUNTIME.sha256).toBe(createHash("sha256").update(RUNTIME.script, "utf8").digest("base64"));
    expect(RUNTIME.script).not.toMatch(/<\/script/i);
  });

  it("refuses a runtime that couldn't sit inline in the preview's <script>", () => {
    expect(assertInlineSafe("var a='<!--[if mso]>';")).toBe("var a='<!--[if mso]>';");
    expect(() => assertInlineSafe("var a='</script>';")).toThrow(/<\/script/);
    expect(() => assertInlineSafe("var a='<!--',b='<script>';")).toThrow(/double|read past/);
    expect(() => assertInlineSafe("var a='<!--',b='<script src=x>';")).toThrow();
    expect(assertInlineSafe("var a='<!--',b='<scripts>';")).toContain("<scripts>");
  });

  it("holds none of the models: they're @hyper-elements/email-client-models' own script", async () => {
    const { SCRIPT } = await import("@hyper-elements/email-client-models");
    expect(existsSync(join(dir, "src/runtime/renderer"))).toBe(false);
    expect(RUNTIME.script).not.toContain("WebAssembly");
    for (const name of ["createOutlookRules", "gmailClip", "settleAppleMail", "resolveConditionalComments", "Aptos Stand-in", "Hamburgefonstiv"]) expect([name, RUNTIME.script.includes(name)]).toEqual([name, false]);
    expect(RUNTIME.script.length).toBeLessThan(SCRIPT.length / 10);
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
