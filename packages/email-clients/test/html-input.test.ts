/**
 * renderInEmailClients(html): previews of any HTML email. Which files a call writes and which are approximate,
 * the HTML embedded exactly as given (as data, never markup), the header that says where the email came from, and what
 * it refuses. No React or core here: this file imports neither.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCRIPT_SHA256 } from "@hyper-elements/email-client-models";
import { APPROXIMATE_FOR_HTML } from "../src/email-clients";
import { checkWholeEmail } from "../src/html-input";
import { renderInEmailClients } from "../src/index";
import { contentSecurityPolicy } from "../src/shell";
import { RUNTIME } from "../src/runtime.generated";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures/html", name), "utf8");
const receipt = fixture("receipt.html");

/** The JSON a file embeds under `id`. */
const embedded = (html: string, id: string) => JSON.parse(new RegExp(`<script type="application/json" id="${id}">([^<]*)</script>`).exec(html)![1]!);

describe("renderInEmailClients(html)", () => {
  it("writes one file per client asked for, the four captured by default, approximate where the models are weak on HTML or haven't measured it", async () => {
    const { previews, skipped, diagnostics } = await renderInEmailClients(receipt);
    expect(previews.map(({ id, approximate }) => ({ id, approximate }))).toEqual([
      { id: "outlook", approximate: true },
      { id: "outlook-com", approximate: false },
      { id: "outlook-com.mac", approximate: true },
      { id: "gmail", approximate: false },
      { id: "gmail.mac", approximate: true },
      { id: "apple-mail", approximate: false },
    ]);
    expect(skipped).toEqual([]);
    // Nothing in this email for the clients previewed; at most a note that the captured checks for HTML need models 1.8.
    expect(diagnostics.filter((d) => d.code !== "email/captured-checks")).toEqual([]);
    // Each file's config agrees with its preview.
    for (const preview of previews) expect(embedded(preview.html, "email-client-config")).toMatchObject({ id: preview.id, approximate: preview.approximate });
  });

  it("marks exactly the six previews APPROXIMATE_FOR_HTML lists, and Apple Mail light, Gmail and Outlook.com on Windows not", async () => {
    expect(APPROXIMATE_FOR_HTML).toEqual(["outlook", "gmail-app", "apple-mail.dark", "gmail-app-other", "gmail.mac", "outlook-com.mac"]);
    const { previews } = await renderInEmailClients(receipt, { emailClients: ["outlook", "outlook-com", "gmail", "gmail-app", "gmail-app-other", "apple-mail"], dark: true });
    const flags = Object.fromEntries(previews.map((p) => [p.id, p.approximate]));
    expect(flags).toEqual({
      outlook: true,
      "outlook-com": false,
      "outlook-com.mac": true,
      gmail: false,
      "gmail.mac": true,
      "gmail-app": true,
      "gmail-app-other": true,
      "apple-mail": false,
      "apple-mail.dark": true,
    });
  });

  it("embeds the HTML exactly as given, as escaped data, with no blocks, under the shell's CSP", async () => {
    const tricky = receipt.replace("Thanks for your order", "Thanks </script><!-- <script> “quoted”   & <b>bold</b>");
    const { previews } = await renderInEmailClients(tricky, { emailClients: ["gmail"], computers: ["windows"] });
    const file = previews[0]!.html;
    expect(embedded(file, "email")).toBe(tricky);
    // The email can't end its <script>: nothing in the file but the shell's own two scripts.
    expect(file.match(/<script>/g)).toHaveLength(2);
    expect(embedded(file, "email-client-config").blocks).toEqual({ version: 2, unit: "utf8", entries: [] });
    expect(file).toContain(`content="${contentSecurityPolicy({ runtime: RUNTIME, models: { script: "", sha256: SCRIPT_SHA256 } }, "https://cdn.jsdelivr.net")}"`);
  });

  it("says in the header that it's the HTML given, not built with Hyper Elements, and how close the model is", async () => {
    const { previews } = await renderInEmailClients(receipt, { emailClients: ["outlook", "apple-mail"] });
    // The header's text alone: the config also has an `approximate` field.
    const [outlook, apple] = previews.map((p) => /<header class="note">([\s\S]*?)<\/header>/.exec(p.html)![1]!);
    for (const file of [outlook, apple]) {
      expect(file).toContain("what you send is the HTML you gave");
      expect(file).not.toContain("render()'s html");
      expect(file).toContain("This email wasn't built with Hyper Elements");
    }
    expect(outlook).toContain("the model is approximate for it");
    expect(apple).not.toContain("approximate");
  });

  it("takes a whole email: a doctype is optional, a fragment, a tag only inside a comment and a non-string are refused", async () => {
    expect(() => checkWholeEmail("<html><body><p>Hi</p></body></html>")).not.toThrow();
    expect(() => checkWholeEmail("<HTML>\n<BODY class=x>Hi</BODY></HTML>")).not.toThrow();
    expect(() => checkWholeEmail("<p>Hi</p>")).toThrow(/whole email.*no <html> tag/);
    expect(() => checkWholeEmail("<html><p>Hi</p></html>")).toThrow(/no <body> tag/);
    expect(() => checkWholeEmail("<!-- <html><body> --><p>Hi</p>")).toThrow(TypeError);
    expect(() => checkWholeEmail("<htmlx><bodyx>")).toThrow(TypeError);
    await expect(renderInEmailClients("<p>Hi</p>")).rejects.toThrow(TypeError);
    expect(() => checkWholeEmail(42)).toThrow(/as a string, not number/);
  });

  it("refuses HTML given as bytes, saying to read it as text", async () => {
    const bytes = new TextEncoder().encode(receipt);
    await expect(renderInEmailClients(bytes as never)).rejects.toThrow(/as a string, not bytes.*utf8/);
    await expect(renderInEmailClients(Buffer.from(receipt) as never)).rejects.toThrow(TypeError);
  });

  it("refuses an option it doesn't take, such as render()'s, and a client it doesn't know", async () => {
    await expect(renderInEmailClients(receipt, { plugins: [] } as never)).rejects.toThrow(/not "plugins"/);
    await expect(renderInEmailClients(receipt, { emailClients: ["hotmail"] } as never)).rejects.toThrow(TypeError);
    await expect(renderInEmailClients(receipt, null as never)).rejects.toThrow(/as an object/);
  });

  it("previews an email with a head stylesheet and media queries as given", async () => {
    const newsletter = fixture("newsletter.html");
    const { previews } = await renderInEmailClients(newsletter, { emailClients: ["gmail-app"] });
    expect(previews.map((p) => p.id)).toEqual(["gmail-app"]);
    expect(embedded(previews[0]!.html, "email")).toBe(newsletter);
  });
});
