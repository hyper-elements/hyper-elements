import sampleEmail from "../generated/email-testing.html?raw";

/** The HTML playground's supported preview families, and its initial selection. */
export const emailTestingClients = [
  { id: "outlook", name: "Classic Outlook", logo: "outlook" },
  { id: "outlook-com", name: "New Outlook / Outlook.com", logo: "outlook" },
  { id: "gmail", name: "Gmail", logo: "gmail" },
  { id: "gmail-app", name: "Gmail app", logo: "gmail" },
  { id: "gmail-app-other", name: "Gmail app, other accounts", logo: "gmail" },
  { id: "apple-mail", name: "Apple Mail", logo: "apple-mail" },
  { id: "yahoo", name: "Yahoo Mail", logo: "yahoo" },
  { id: "aol", name: "AOL Mail", logo: "aol" },
] as const;

export const defaultEmailClients = ["outlook", "gmail", "apple-mail"];
export const MAX_EMAIL_BYTES = 250_000;
export const emailTestingDescription = "Test HTML email compatibility and preview Outlook, Gmail, Apple Mail, Yahoo Mail and AOL Mail locally. Paste or edit HTML and compare client previews in the free live playground. No React or test send required.";

/** Generated from examples/email-testing/macbook-pro.tsx with render(). */
export { sampleEmail };
