import React from "react";
import { Email, EMAIL_CLIENTS, formatDiagnostics, Html, Page, prepare, render, Text, validate } from "./index";

const spaced = (
  <Email width={600}>
    <Text style={{ letterSpacing: 2 }}>Spaced</Text>
    <Html html={'<div style="position:absolute">Over</div>'} />
  </Email>
);

describe("email clients in validate() and render()", () => {
  it("names the clients each problem is about, for the clients most email is read in by default", () => {
    const { diagnostics } = validate(spaced);
    expect(diagnostics.map((d) => [d.code, d.clients])).toEqual([
      ["email/outlook-degraded", ["outlook"]],
      ["email/html-css", ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol"]],
    ]);
    expect(formatDiagnostics(diagnostics).split("\n")[1]).toMatch(
      /^info email\/html-css at root\.children\[1\]\.props\.html: .* \[outlook, outlook-com, .*\] Fix: .* See: https:\/\/www\.caniemail\.com\/features\/css-position\/$/
    );
  });

  it("reports only the clients asked for, in validate() and render() alike", async () => {
    expect(validate(spaced, { emailClients: ["outlook-com"] }).diagnostics.map((d) => d.code)).toEqual(["email/html-css"]);
    expect(validate(spaced, { emailClients: ["apple-mail"] }).diagnostics).toEqual([]);
    expect((await render(spaced, { emailClients: ["apple-mail"] })).diagnostics).toEqual([]);
    expect((await render(spaced)).diagnostics).toEqual(validate(spaced).diagnostics);
  });

  it("takes emailClients in prepare() too", () => {
    expect(prepare(spaced, { emailClients: ["outlook-com"] }).diagnostics.map((d) => d.code)).toEqual(["email/html-css"]);
    expect(prepare(spaced).diagnostics).toEqual(validate(spaced).diagnostics);
    expect(() => prepare(spaced, { emailClients: ["hotmail" as never] })).toThrow(TypeError);
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
    expect(Object.keys(EMAIL_CLIENTS)).toHaveLength(26);
    expect(EMAIL_CLIENTS["apple-mail"].measured).toMatchObject({ elements: "0.3.0" });
    expect(EMAIL_CLIENTS.yahoo).toMatchObject({ name: "Yahoo Mail", measured: null });
  });
});
