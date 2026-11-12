/**
 * @hyper-elements/email-clients/html without a usable models package: previews need its script and font data, so the
 * call rejects (and tries the import again next time); a protocol it doesn't read is a mismatched install.
 */
afterEach(() => {
  vi.doUnmock("@hyper-elements/email-client-models");
  vi.resetModules();
});

const email = "<!DOCTYPE html><html><body><p>Hi</p></body></html>";

describe("renderInEmailClients(html) when the models package can't be used", () => {
  it("rejects with the import's error when it can't be loaded, and imports it again on the next call", async () => {
    vi.resetModules();
    vi.doMock("@hyper-elements/email-client-models", () => {
      throw new Error("Cannot find package '@hyper-elements/email-client-models'");
    });
    const { renderInEmailClients } = await import("../src/html-entry");
    // Vitest reports a mock factory's throw in its own words: what matters is the call rejects, with no previews.
    await expect(renderInEmailClients(email)).rejects.toThrow();
    vi.doUnmock("@hyper-elements/email-client-models");
    const { previews } = await renderInEmailClients(email, { emailClients: ["apple-mail"] });
    expect(previews.map((p) => p.id)).toEqual(["apple-mail"]);
  });

  it("rejects with email-clients/version-mismatch for a protocol it doesn't read", async () => {
    vi.resetModules();
    vi.doMock("@hyper-elements/email-client-models", async (original) => ({ ...(await original<object>()), PROTOCOL: 99 }));
    const { renderInEmailClients } = await import("../src/html-entry");
    await expect(renderInEmailClients(email)).rejects.toMatchObject({ name: "email-clients/version-mismatch" });
  });
});
