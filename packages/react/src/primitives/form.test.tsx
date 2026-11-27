import React from "react";
import { describe, expect, it } from "vitest";
import { Email, Document, Form, Page, render, validate } from "./index";
import { fromDesign, toDesign } from "../builder";

describe("<Form>", () => {
  it("renders semantic HTML form on a Page with inputs, labels, and submit button", async () => {
    const template = (
      <Page title="Contact">
        <Form
          id="contact-form"
          action="https://api.example.com/submit"
          method="POST"
          fields={[
            { name: "fullname", label: "Full Name", type: "text", required: true, placeholder: "John Doe" },
            { name: "email", label: "Work Email", type: "email", required: true, placeholder: "john@example.com" },
            { name: "role", label: "Role", type: "dropdown", options: ["Developer", "Designer", "Manager"] },
            { name: "message", label: "Message", type: "textarea", placeholder: "Write here..." },
            { name: "subscribe", label: "Subscribe to newsletter", type: "checkbox" },
            { name: "token", type: "hidden", value: "secret123" },
          ]}
          buttonText="Send Feedback"
          fieldStyle={{ backgroundColor: "#f5f5f5", padding: { top: 8, right: 12, bottom: 8, left: 12 }, borderRadius: 4 }}
          labelStyle={{ color: "#333333", fontSize: 14 }}
          buttonStyle={{ backgroundColor: "#0070f3", color: "#ffffff", padding: { top: 10, right: 20, bottom: 10, left: 20 }, borderRadius: 6, hover: { backgroundColor: "#0051b3" } }}
          style={{ width: 500, gap: 16 }}
        />
      </Page>
    );

    const { html, diagnostics } = await render(template);
    expect(diagnostics).toEqual([]);
    expect(html).toContain('<form id="contact-form"');
    expect(html).toContain('action="https://api.example.com/submit"');
    expect(html).toContain('method="POST"');

    // Inputs and labels
    expect(html).toContain('<label for="contact-form-fullname"');
    expect(html).toContain("Full Name</label>");
    expect(html).toContain('type="text" name="fullname" id="contact-form-fullname" placeholder="John Doe" required');

    expect(html).toContain('<label for="contact-form-email"');
    expect(html).toContain("Work Email</label>");
    expect(html).toContain('type="email" name="email" id="contact-form-email" placeholder="john@example.com" required');

    expect(html).toContain('<select name="role" id="contact-form-role"');
    expect(html).toContain('<option value="Developer">Developer</option>');
    expect(html).toContain('<option value="Designer">Designer</option>');

    expect(html).toContain('<textarea name="message" id="contact-form-message" placeholder="Write here..."');

    expect(html).toContain('type="checkbox" name="subscribe" id="contact-form-subscribe"');
    expect(html).toContain('type="hidden" name="token" value="secret123"');

    // Submit button
    expect(html).toContain('<button type="submit"');
    expect(html).toContain("Send Feedback</button>");
  });

  it("supports { href, target } for action", async () => {
    const template = (
      <Page>
        <Form
          action={{ href: "https://example.com/api", target: "_blank" }}
          fields={[{ name: "q", label: "Search" }]}
        />
      </Page>
    );

    const { html } = await render(template);
    expect(html).toContain('action="https://example.com/api"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("omits label when showLabel is false", async () => {
    const template = (
      <Page>
        <Form
          action="https://example.com"
          fields={[{ name: "email", label: "Email", showLabel: false, placeholder: "Your email" }]}
        />
      </Page>
    );

    const { html } = await render(template);
    expect(html).not.toContain("<label");
    expect(html).toContain('placeholder="Your email"');
  });

  it("rejects Form in an Email root with a diagnostic error", async () => {
    const template = (
      <Email>
        <Form action="https://example.com" fields={[{ name: "email" }]} />
      </Email>
    );

    await expect(render(template)).rejects.toThrow(/target\/unsupported|can't be rendered to email/);
  });

  it("rejects Form in a Document root with a diagnostic error", () => {
    const template = (
      <Document>
        <Form action="https://example.com" fields={[{ name: "email" }]} />
      </Document>
    );

    const { diagnostics } = validate(template);
    expect(diagnostics.some((d) => d.code === "element/not-supported" || d.message.includes("Page"))).toBe(true);
  });

  it("round-trips through builder toDesign and fromDesign", () => {
    const template = (
      <Page>
        <Form
          action="https://example.com/submit"
          method="POST"
          fields={[
            { name: "name", label: "Name", type: "text", placeholder: "Your Name" },
            { name: "email", label: "Email", type: "email", required: true },
          ]}
          buttonText="Submit Now"
        />
      </Page>
    );

    const { design } = toDesign(template);
    expect(design.body.rows.length).toBeGreaterThan(0);
    const formContent = design.body.rows[0].columns[0].contents.find((c: any) => c.type === "form");
    expect(formContent).toBeDefined();
    expect(formContent.values.action).toBe("https://example.com/submit");
    expect(formContent.values.method).toBe("POST");
    expect(formContent.values.buttonText).toBe("Submit Now");
    expect(formContent.values.fields.length).toBe(2);
    expect(formContent.values.fields[0].placeholder_text).toBe("Your Name");

    // Read back
    const { element } = fromDesign(design, { displayMode: "web" });
    expect(element).toBeDefined();
  });
});
