/**
 * renderInEmailClients(html)'s diagnostics with each state of the models package: its captured checks on HTML
 * (check({ html }), 1.8.0 and later) run and are placed by line; with an older one (which says "no root"), or where they
 * fail, the open checks still run and a diagnostic about the checks says so; another protocol is a mismatched install. A
 * diagnostic about the checks has no clients, no line and no excerpt, and stays whatever clients are previewed.
 */
export {};

afterEach(() => {
  vi.doUnmock("@hyper-elements/email-client-models");
  vi.resetModules();
});

const email = ["<!DOCTYPE html>", "<html>", "<body>", '<div style="position:absolute">x</div>', '<p style="color:RGB(1 2 3)">y</p>', "</body>", "</html>"].join("\n");

/** The main entry with the models package's exports changed by `change`. */
async function entryWith(change: (original: Record<string, unknown>) => Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("@hyper-elements/email-client-models", async (importOriginal) => change(await importOriginal<Record<string, unknown>>()));
  return import("../src/index");
}

/** check() as models 1.8.0 answers it: a template's tree as before, and HTML with `found`. */
const checkWith = (original: Record<string, unknown>, onHtml: (input: { html: string }) => unknown) => (input: { root?: unknown; html?: string }) =>
  typeof input.html === "string" ? onHtml(input as { html: string }) : (original.check as (input: unknown) => unknown)(input);

const aboutTheChecks = <D extends { code: string }>(diagnostics: D[]) => diagnostics.filter((d) => d.code === "email/captured-checks");
const openChecks = <D extends { code: string; message: string }>(diagnostics: D[]) => diagnostics.filter((d) => d.code === "email/html-css" && d.message.includes("position: absolute"));

describe("renderInEmailClients(html)'s diagnostics and the models package", () => {
  it("adds the models' captured checks on HTML, each placed by line, with path, excerpt and the clients previewed", async () => {
    const onHtml = vi.fn(() => [{ code: "email/html-css", severity: "info", message: "This email's markup may have a pattern", clients: ["gmail", "outlook-com"], fix: "write it another way", line: 5 }]);
    const { renderInEmailClients } = await entryWith((original) => ({ ...original, check: checkWith(original, onHtml) }));
    const { diagnostics } = await renderInEmailClients(email, { emailClients: ["gmail", "apple-mail"], computers: ["windows"] });
    expect(onHtml).toHaveBeenCalledWith({ html: email });
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
    expect(diagnostics.map((d) => d.line)).toEqual([4, 5]);
  });

  it("says so, as an info, where the models package checks only templates (before 1.8.0), and runs the open checks", async () => {
    const { renderInEmailClients } = await entryWith((original) => ({
      ...original,
      check: checkWith(original, () => {
        throw new Error("email-client-models: no root");
      }),
    }));
    const { diagnostics } = await renderInEmailClients(email, { emailClients: ["gmail"], computers: ["windows"] });
    expect(openChecks(diagnostics)).toHaveLength(1);
    expect(aboutTheChecks(diagnostics)).toEqual([{ code: "email/captured-checks", severity: "info", message: expect.stringContaining("1.8.0 and later"), fix: expect.any(String), path: "html", line: null }]);
  });

  it("warns where the captured checks fail otherwise, keeping the open checks", async () => {
    const { renderInEmailClients } = await entryWith((original) => ({
      ...original,
      check: checkWith(original, () => {
        throw new Error("boom");
      }),
    }));
    const { diagnostics } = await renderInEmailClients(email, { emailClients: ["gmail"], computers: ["windows"] });
    expect(openChecks(diagnostics)).toHaveLength(1);
    expect(aboutTheChecks(diagnostics)).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("failed on this email (boom)") })]);
  });

  it("still makes previews where the models' WebAssembly doesn't compile in Node (the browser compiles it), with a warning", async () => {
    const { renderInEmailClients } = await entryWith((original) => ({ ...original, ready: () => Promise.reject(new Error("no WebAssembly")) }));
    const { previews, diagnostics } = await renderInEmailClients(email, { emailClients: ["gmail"], computers: ["windows"] });
    expect(previews.map((p) => p.id)).toEqual(["gmail"]);
    expect(openChecks(diagnostics)).toHaveLength(1);
    expect(aboutTheChecks(diagnostics)).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("no WebAssembly") })]);
  });

  it("keeps a diagnostic about the checks whatever clients are previewed: no clients, no line, no excerpt", async () => {
    const { renderInEmailClients } = await entryWith((original) => ({
      ...original,
      check: checkWith(original, () => {
        throw new Error("email-client-models: no root");
      }),
    }));
    for (const emailClients of [["gmail"], ["apple-mail"], ["outlook"]] as const) {
      const [about] = aboutTheChecks((await renderInEmailClients(email, { emailClients: [...emailClients], computers: ["windows"] })).diagnostics);
      expect(about).toBeDefined();
      expect("clients" in about!).toBe(false);
      expect(about).toMatchObject({ path: "html", line: null });
      expect("excerpt" in about!).toBe(false);
    }
  });

  it("checks with the installed models package (1.7: only templates) and says so", async () => {
    const { renderInEmailClients } = await import("../src/index");
    const { diagnostics } = await renderInEmailClients(email, { emailClients: ["outlook", "gmail"], computers: ["windows"] });
    expect(openChecks(diagnostics)[0]!.clients).toEqual(["outlook", "gmail"]);
  });
});
