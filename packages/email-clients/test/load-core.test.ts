/**
 * Loading core for a template: "not installed" only when core itself is missing (a module missing inside core is
 * rethrown as it is), and a failed load isn't kept, so the next call tries again.
 */
import { isCoreMissing } from "../src/core";

afterEach(() => {
  vi.doUnmock("@hyper-elements/react");
  vi.resetModules();
});

const notFound = (code: string, message: string) => Object.assign(new Error(message), { code });

describe("loading core", () => {
  it("says core isn't installed only when core itself is what's missing", () => {
    expect(isCoreMissing(notFound("MODULE_NOT_FOUND", "Cannot find module '@hyper-elements/react'\nRequire stack:\n- /app/node_modules/@hyper-elements/email-clients/dist/index.cjs"))).toBe(true);
    expect(isCoreMissing(notFound("ERR_MODULE_NOT_FOUND", "Cannot find package '@hyper-elements/react' imported from /app/node_modules/@hyper-elements/email-clients/dist/index.js"))).toBe(true);
    // react-dom missing inside core: core's path is in the message, unquoted, after "imported from".
    expect(isCoreMissing(notFound("ERR_MODULE_NOT_FOUND", "Cannot find package 'react-dom' imported from /app/node_modules/@hyper-elements/react/dist/primitives.js"))).toBe(false);
    expect(isCoreMissing(notFound("MODULE_NOT_FOUND", "Cannot find module 'react-dom/server'\nRequire stack:\n- /app/node_modules/@hyper-elements/react/dist/primitives.cjs"))).toBe(false);
    expect(isCoreMissing(new Error("Cannot find module '@hyper-elements/react'"))).toBe(false);
    expect(isCoreMissing(null)).toBe(false);
  });

  it("doesn't keep a failed load: the next call loads core", async () => {
    vi.doMock("@hyper-elements/react", () => {
      throw new Error("core failed to load");
    });
    const { loadCore } = await import("../src/core");
    await expect(loadCore()).rejects.toThrow();
    vi.doUnmock("@hyper-elements/react");
    const core = await loadCore();
    expect(typeof core.render).toBe("function");
    // Loaded once, then reused.
    expect(await loadCore()).toBe(core);
  });
});
