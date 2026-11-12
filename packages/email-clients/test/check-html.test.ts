/**
 * checkInEmailClients(html), and the diagnostics of renderInEmailClients(html), with each state of the models package:
 * its captured checks for HTML (1.8.0 and later) run and are placed by line; without them, or where they fail, the open
 * checks still run and a diagnostic about the checks says so; another protocol is a mismatched install. A diagnostic
 * about the checks has no clients, no line and no excerpt, and stays whatever clients are asked for.
 */
export {};

afterEach(() => {
  vi.doUnmock("@hyper-elements/email-client-models");
  vi.resetModules();
});

const email = ["<!DOCTYPE html>", "<html>", "<body>", '<div style="position:absolute">x</div>', '<p style="color:RGB(1 2 3)">y</p>', "</body>", "</html>"].join("\n");

/** html-entry.ts with the models package's exports changed by `change`. */
async function entryWith(change: (original: Record<string, unknown>) => Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("@hyper-elements/email-client-models", async (importOriginal) => change(await importOriginal<Record<string, unknown>>()));
  return import("../src/html-entry");
}

const aboutTheChecks = <D extends { code: string }>(diagnostics: D[]) => diagnostics.filter((d) => d.code === "email/captured-checks");
const openChecks = <D extends { code: string; message: string }>(diagnostics: D[]) => diagnostics.filter((d) => d.code === "email/html-css" && d.message.includes("position: absolute"));

describe("checkInEmailClients(html) and the models package", () => {
  it("adds the models' captured checks for HTML, each placed by line, with path, excerpt and the clients asked for", async () => {
    const checkHtml = vi.fn(() => [{ code: "email/html-css" as const, severity: "info" as const, message: "This email's markup may have a pattern", clients: ["gmail", "outlook-com"], fix: "write it another way", line: 5 }]);
    const { checkInEmailClients } = await entryWith((original) => ({ ...original, checkHtml }));
    const { diagnostics } = await checkInEmailClients(email, { clients: ["gmail", "apple-mail"] });
    expect(checkHtml).toHaveBeenCalledWith({ html: email });
    expect(diagnostics.find((d) => d.message === "This email's markup may have a pattern")).toEqual({
      code: "email/html-css",
      severity: "info",
      message: "This email's markup may have a pattern",
      clients: ["gmail"],
      fix: "write it another way",
      path: "html",
      line: 5,
      excerpt: '<p style="color:RGB(1 2 3)">y</p>',
    });
    expect(aboutTheChecks(diagnostics)).toEqual([]);
    // In order of their lines: the open check's line 4 first.
    expect(diagnostics.map((d) => d.line)).toEqual([4, 5]);
  });

  it("says so, as an info, where the models package has no captured checks for HTML (1.7), and runs the open checks", async () => {
    const { checkInEmailClients } = await entryWith((original) => ({ ...original, checkHtml: undefined }));
    const { diagnostics } = await checkInEmailClients(email, { clients: ["gmail"] });
    expect(openChecks(diagnostics)).toHaveLength(1);
    expect(aboutTheChecks(diagnostics)).toEqual([{ code: "email/captured-checks", severity: "info", message: expect.stringContaining("1.8.0 and later"), fix: expect.any(String), path: "html", line: null }]);
  });

  it("warns where the captured checks throw, keeping the open checks", async () => {
    const { checkInEmailClients } = await entryWith((original) => ({
      ...original,
      checkHtml: () => {
        throw new Error("boom");
      },
    }));
    const { diagnostics } = await checkInEmailClients(email, { clients: ["gmail"] });
    expect(openChecks(diagnostics)).toHaveLength(1);
    expect(aboutTheChecks(diagnostics)).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("failed on this email (boom)") })]);
  });

  it("warns where the models package doesn't import, or its WebAssembly doesn't compile, keeping the open checks", async () => {
    vi.resetModules();
    vi.doMock("@hyper-elements/email-client-models", () => {
      throw new Error("Cannot find package");
    });
    const missing = await import("../src/html-entry");
    const fromMissing = await missing.checkInEmailClients(email, { clients: ["gmail"] });
    expect(openChecks(fromMissing.diagnostics)).toHaveLength(1);
    expect(aboutTheChecks(fromMissing.diagnostics)).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("didn't load") })]);

    const failing = await entryWith((original) => ({ ...original, ready: () => Promise.reject(new Error("no WebAssembly")) }));
    const fromFailing = await failing.checkInEmailClients(email, { clients: ["gmail"] });
    expect(openChecks(fromFailing.diagnostics)).toHaveLength(1);
    expect(aboutTheChecks(fromFailing.diagnostics)).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("no WebAssembly") })]);
  });

  it("rejects with email-clients/version-mismatch for a protocol it doesn't read", async () => {
    const { checkInEmailClients } = await entryWith((original) => ({ ...original, PROTOCOL: 99 }));
    await expect(checkInEmailClients(email)).rejects.toMatchObject({ name: "email-clients/version-mismatch" });
  });

  it("keeps a diagnostic about the checks whatever clients are asked for: no clients, no line, no excerpt", async () => {
    const { checkInEmailClients } = await entryWith((original) => ({ ...original, checkHtml: undefined }));
    for (const clients of [["gmail"], ["apple-mail"], ["yahoo", "aol"]] as const) {
      const [about] = aboutTheChecks((await checkInEmailClients(email, { clients: [...clients] })).diagnostics);
      expect(about).toBeDefined();
      expect("clients" in about!).toBe(false);
      expect(about).toMatchObject({ path: "html", line: null });
      expect("excerpt" in about!).toBe(false);
    }
  });

  it("refuses what isn't a whole email, an option it doesn't take, and a client it doesn't know", async () => {
    const { checkInEmailClients } = await import("../src/html-entry");
    await expect(checkInEmailClients("<p>Hi</p>")).rejects.toThrow(/checkInEmailClients\(html\) takes a whole email/);
    await expect(checkInEmailClients(email, { emailClients: ["gmail"] } as never)).rejects.toThrow(/not "emailClients"/);
    await expect(checkInEmailClients(email, { clients: ["hotmail"] } as never)).rejects.toThrow(TypeError);
  });
});

describe("renderInEmailClients(html)'s diagnostics", () => {
  it("are the checks for the clients previewed", async () => {
    const { checkInEmailClients, renderInEmailClients } = await import("../src/html-entry");
    const { diagnostics } = await renderInEmailClients(email, { emailClients: ["outlook", "gmail"] });
    expect(diagnostics).toEqual((await checkInEmailClients(email, { clients: ["outlook", "gmail"] })).diagnostics);
    expect(openChecks(diagnostics)[0]!.clients).toEqual(["outlook", "gmail"]);
  });

  it("still come with previews where the models' WebAssembly doesn't compile in Node: the browser compiles it itself", async () => {
    const { renderInEmailClients } = await entryWith((original) => ({ ...original, ready: () => Promise.reject(new Error("no WebAssembly")) }));
    const { previews, diagnostics } = await renderInEmailClients(email, { emailClients: ["gmail"], computers: ["windows"] });
    expect(previews.map((p) => p.id)).toEqual(["gmail"]);
    expect(aboutTheChecks(diagnostics)).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("no WebAssembly") })]);
    expect(openChecks(diagnostics)).toHaveLength(1);
  });
});
