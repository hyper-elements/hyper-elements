import type { Meta } from "@storybook/react-vite";
import { args, argTypes, browsed, type Args } from "../../../stories/SideBySide";
import { Column, Form, Heading, Page, Row, Section, Text } from "../../index";

const meta: Meta<Args> = {
  title: "Components/Form",
  args,
  argTypes,
  parameters: {
    docs: {
      description: {
        component: "An interactive form for a Page: inputs, labels, selects, checkboxes, and a submit button.",
      },
    },
  },
};
export default meta;

export const ContactForm = () =>
  browsed(
    <Page title="Contact Us" style={{ backgroundColor: "#F7F8FA", padding: [40, 20] }}>
      <Section style={{ maxWidth: 560, backgroundColor: "#FFFFFF", padding: [36, 40], borderRadius: 8, border: "1px solid #E5E7EB", gap: 20 }}>
        <Heading level={2} style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>
          Get in touch
        </Heading>
        <Text style={{ fontSize: 14, color: "#6B7280" }}>
          Fill out the form below and our team will get back to you within 24 hours.
        </Text>
        <Form
          id="contact"
          action="https://api.example.com/contact"
          method="POST"
          fields={[
            { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jane Doe" },
            { name: "email", label: "Email Address", type: "email", required: true, placeholder: "jane@company.com" },
            { name: "department", label: "Department", type: "dropdown", options: ["Sales", "Support", "Engineering", "Billing"] },
            { name: "message", label: "Message", type: "textarea", required: true, placeholder: "Tell us how we can help..." },
            { name: "newsletter", label: "Subscribe to monthly product updates", type: "checkbox" },
          ]}
          buttonText="Send message"
          fieldStyle={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #D1D5DB",
            borderRadius: 6,
            padding: { top: 10, right: 14, bottom: 10, left: 14 },
            fontSize: 14,
            color: "#111827",
          }}
          labelStyle={{
            fontSize: 13,
            fontWeight: 500,
            color: "#374151",
          }}
          buttonStyle={{
            backgroundColor: "#2563EB",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
            padding: { top: 12, right: 24, bottom: 12, left: 24 },
            borderRadius: 6,
            hover: { backgroundColor: "#1D4ED8" },
          }}
          style={{ gap: 16 }}
        />
      </Section>
    </Page>
  );

export const SubscribeForm = () =>
  browsed(
    <Page title="Subscribe" style={{ backgroundColor: "#0F172A", padding: [60, 20] }}>
      <Section style={{ maxWidth: 480, backgroundColor: "#1E293B", padding: [32, 36], borderRadius: 12, gap: 16 }}>
        <Heading level={3} style={{ fontSize: 20, fontWeight: 600, color: "#F8FAFC" }}>
          Stay updated
        </Heading>
        <Text style={{ fontSize: 14, color: "#94A3B8" }}>
          Weekly insights on web performance, email deliverability, and developer tools.
        </Text>
        <Form
          action="https://api.example.com/newsletter"
          method="POST"
          fields={[
            { name: "email", label: "Email", type: "email", required: true, placeholder: "you@example.com", showLabel: false },
          ]}
          buttonText="Subscribe"
          fieldStyle={{
            backgroundColor: "#0F172A",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: { top: 10, right: 14, bottom: 10, left: 14 },
            color: "#F8FAFC",
            fontSize: 14,
          }}
          buttonStyle={{
            backgroundColor: "#38BDF8",
            color: "#0F172A",
            fontSize: 14,
            fontWeight: 600,
            padding: { top: 10, right: 20, bottom: 10, left: 20 },
            borderRadius: 6,
            hover: { backgroundColor: "#7DD3FC" },
          }}
          style={{ gap: 12 }}
        />
      </Section>
    </Page>
  );
