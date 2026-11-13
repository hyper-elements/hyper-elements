import sampleEmail from "../generated/email-testing.html?raw";

/** The HTML playground's supported preview families. `name` is what every card, title and finding calls the client. */
export const emailTestingClients = [
  { id: "outlook", name: "Classic Outlook", logo: "outlook" },
  { id: "outlook-com", name: "Outlook.com", logo: "outlook" },
  { id: "gmail", name: "Gmail", logo: "gmail" },
  { id: "gmail-app", name: "Gmail App", logo: "gmail" },
  { id: "gmail-app-other", name: "Gmail App (Other accounts)", logo: "gmail" },
  { id: "apple-mail", name: "Apple Mail", logo: "apple-mail" },
  { id: "yahoo", name: "Yahoo Mail", logo: "yahoo" },
  { id: "aol", name: "AOL Mail", logo: "aol" },
] as const;

/** The page and browser agents check every client unless an agent names some. */
export const defaultEmailClients: string[] = emailTestingClients.map((client) => client.id);
export const MAX_EMAIL_BYTES = 250_000;
export const emailTestingDescription = "Test HTML emails in Outlook, Gmail, Apple Mail, Yahoo and AOL. Paste your HTML for client previews and compatibility checks, free in your browser.";

/** Generated from examples/email-testing/macbook-pro.tsx with render(). */
export { sampleEmail };
