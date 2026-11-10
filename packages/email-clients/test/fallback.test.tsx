/**
 * Where the models can't run, the plugin runs the open checks only and says so: the models package that can't be
 * imported, or whose WebAssembly module can't be compiled. Neither failure is kept: the next emailClients() tries again.
 */
import React from "react";
import { Email, Html, validate } from "@hyper-elements/react";
import { emailClients } from "../src/plugin";

const state = vi.hoisted(() => ({ importFails: 0, readyFails: 0, imports: 0 }));

vi.mock("../src/models", async () => {
  const real = await vi.importActual<typeof import("../src/models")>("../src/models");
  return {
    loadModelsPackage: async () => {
      state.imports++;
      if (state.importFails > 0) {
        state.importFails--;
        throw new Error("Cannot find package '@hyper-elements/email-client-models'");
      }
      const models = await real.loadModelsPackage();
      return {
        ...models,
        ready: () => {
          if (state.readyFails > 0) {
            state.readyFails--;
            return Promise.reject(new Error("WebAssembly is not defined"));
          }
          return models.ready();
        },
      };
    },
    forgetModelsPackage: () => {},
  };
});

const positioned = (
  <Email width={600}>
    <Html html={'<div style="position:absolute">Over</div>'} />
  </Email>
);
const codes = (plugin: Awaited<ReturnType<typeof emailClients>>) => validate(positioned, { plugins: [plugin] }).diagnostics.map((d) => [d.code, d.code === "email/captured-checks" ? d.message : undefined]);

describe("emailClients() where the models can't run", () => {
  it("runs the open checks where the models package can't be imported, says so, and imports it again next time", async () => {
    state.importFails = 1;
    const plugin = await emailClients();
    expect(codes(plugin)).toEqual([
      ["email/captured-checks", "The captured email client checks didn't load (Cannot find package '@hyper-elements/email-client-models'): only the checks from caniemail's tables ran"],
      ["email/html-css", undefined],
    ]);
    const before = state.imports;
    state.readyFails = 1;
    await emailClients();
    expect(state.imports).toBe(before + 1);
  });

  it("compiles the module again after a failed compile: the plugin made then keeps the open checks, the next one has the models", async () => {
    // The call above failed to compile (readyFails = 1): its failure isn't kept.
    state.readyFails = 1;
    const failed = await emailClients();
    expect(codes(failed)[0]).toEqual(["email/captured-checks", "The captured email client checks didn't load (WebAssembly is not defined): only the checks from caniemail's tables ran"]);
    const compiled = await emailClients();
    expect(codes(compiled).map(([code]) => code)).not.toContain("email/captured-checks");
    expect(codes(failed)[0]![0]).toBe("email/captured-checks");
  });
});

void React;
