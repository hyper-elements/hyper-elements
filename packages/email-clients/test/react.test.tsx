/**
 * The plugin in @hyper-elements/react's validate() and render(), as a template's author calls them (React 0.3.1's
 * email client tests, ported to `plugins`): the clients each problem names, the note core leaves out once the plugin is
 * passed, and what a Page gets.
 */
import React from "react";
import { Email, formatDiagnostics, Html, Page, render, Text, validate } from "@hyper-elements/react";
import { DEFAULT_EMAIL_CLIENTS, EMAIL_CLIENTS, emailClients } from "../src/index";

const spaced = (
  <Email width={600}>
    <Text style={{ letterSpacing: 2 }}>Spaced</Text>
    <Html html={'<div style="position:absolute">Over</div>'} />
  </Email>
);

describe("emailClients() in validate() and render()", () => {
  it("names the clients each problem is about, for the clients most email is read in by default, and replaces core's note", async () => {
    const { diagnostics } = validate(spaced, { plugins: [await emailClients()] });
    expect(diagnostics.map((d) => [d.code, d.clients])).toEqual([
      ["email/html-css", ["outlook", "outlook-com", "outlook-mac", "outlook-app", "gmail", "gmail-app", "gmail-app-other", "yahoo", "aol"]],
      ["email/outlook-degraded", ["outlook"]],
    ]);
    expect(formatDiagnostics(diagnostics).split("\n")[0]).toMatch(
      /^info email\/html-css at root\.children\[1\]\.props\.html: .* \[outlook, outlook-com, .*\] Fix: .* See: https:\/\/www\.caniemail\.com\/features\/css-position\/$/
    );
    // Without it, core says where the checks are.
    expect(validate(spaced).diagnostics.map((d) => d.code)).toEqual(["email/more-checks"]);
  });

  it("reports only the clients asked for, in validate() and render() alike", async () => {
    expect(validate(spaced, { plugins: [await emailClients({ clients: ["outlook-com"] })] }).diagnostics.map((d) => d.code)).toEqual(["email/html-css"]);
    const apple = await emailClients({ clients: ["apple-mail"] });
    expect(validate(spaced, { plugins: [apple] }).diagnostics).toEqual([]);
    expect((await render(spaced, { plugins: [apple] })).diagnostics).toEqual([]);
    const all = await emailClients();
    expect((await render(spaced, { plugins: [all] })).diagnostics).toEqual(validate(spaced, { plugins: [all] }).diagnostics);
  });

  it("says nothing for a Page, unless it was given clients", async () => {
    const page = (
      <Page width={600}>
        <Text>Hi</Text>
      </Page>
    );
    expect(validate(page, { plugins: [await emailClients()] }).diagnostics).toEqual([]);
    expect(validate(page, { plugins: [await emailClients({ clients: ["gmail"] })] }).diagnostics.map((d) => d.code)).toEqual(["email/clients-ignored"]);
  });

  it("is passed awaited: a Promise is skipped, and core says so", () => {
    const { diagnostics } = validate(spaced, { plugins: [emailClients() as never] });
    expect(diagnostics.map((d) => [d.code, d.message])).toEqual([
      ["plugin/invalid", "plugins[0] got a Promise: pass `await emailClients()`, not `emailClients()`"],
      ["email/more-checks", expect.any(String)],
    ]);
  });

  it("exports what's known of each client, and the default clients, to report for them and more", async () => {
    expect(Object.keys(EMAIL_CLIENTS)).toHaveLength(26);
    expect(EMAIL_CLIENTS["apple-mail"].measured).toMatchObject({ elements: "0.3.0" });
    expect(EMAIL_CLIENTS.yahoo).toMatchObject({ name: "Yahoo Mail", measured: null });
    expect(validate(spaced, { plugins: [await emailClients({ clients: DEFAULT_EMAIL_CLIENTS })] }).diagnostics).toEqual(validate(spaced, { plugins: [await emailClients()] }).diagnostics);
    const widened = validate(spaced, { plugins: [await emailClients({ clients: [...DEFAULT_EMAIL_CLIENTS, "gmx"] })] }).diagnostics;
    expect(widened.find((d) => d.code === "email/html-css")!.clients).toContain("gmx");
  });
});
