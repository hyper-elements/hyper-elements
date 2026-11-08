import React from "react";
import { Email, EMAIL_CLIENTS, formatDiagnostics, Html, Page, render, Text, validate } from "./index";

const spaced = (
  <Email width={600}>
    <Text style={{ letterSpacing: 2 }}>Spaced</Text>
    <Html html={'<div style="position:absolute">Over</div>'} />
  </Email>
);

describe("email clients in validate() and render()", () => {
  it("names the clients each problem is about, for the measured clients by default", () => {
    const { diagnostics } = validate(spaced);
    expect(diagnostics.map((d) => [d.code, d.clients])).toEqual([
      ["email/outlook-degraded", ["outlook"]],
      ["email/html-css", ["outlook-com"]],
    ]);
    expect(formatDiagnostics(diagnostics).split("\n")[1]).toMatch(/^info email\/html-css at root\.children\[1\]\.props\.html: .* \[outlook-com\] Fix: /);
  });

  it("reports only the clients asked for, in validate() and render() alike", async () => {
    expect(validate(spaced, { emailClients: ["outlook"] }).diagnostics.map((d) => d.code)).toEqual(["email/outlook-degraded"]);
    expect(validate(spaced, { emailClients: ["gmail"] }).diagnostics).toEqual([]);
    expect((await render(spaced, { emailClients: ["gmail"] })).diagnostics).toEqual([]);
    expect((await render(spaced)).diagnostics).toEqual(validate(spaced).diagnostics);
  });

  it("ignores emailClients for a Page, and says so", () => {
    const page = (
      <Page width={600}>
        <Text>Hi</Text>
      </Page>
    );
    expect(validate(page, { emailClients: ["gmail"] }).diagnostics.map((d) => d.code)).toEqual(["email/clients-ignored"]);
  });

  it("throws on a client it doesn't know, before reading the template", () => {
    expect(() => validate(spaced, { emailClients: ["hotmail" as never] })).toThrow(TypeError);
    return expect(render(spaced, { emailClients: ["hotmail" as never] })).rejects.toThrow(TypeError);
  });

  it("exports what's known of each client", () => {
    expect(Object.keys(EMAIL_CLIENTS)).toEqual(["outlook", "outlook-com", "gmail", "gmail-app", "gmail-app-other", "apple-mail"]);
  });
});
