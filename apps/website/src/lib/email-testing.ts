/** The HTML playground's supported preview families, and its initial selection. */
export const emailTestingClients = [
  { id: "outlook", name: "Classic Outlook" },
  { id: "outlook-com", name: "New Outlook / Outlook.com" },
  { id: "gmail", name: "Gmail" },
  { id: "gmail-app", name: "Gmail app" },
  { id: "apple-mail", name: "Apple Mail" },
  { id: "yahoo", name: "Yahoo Mail" },
  { id: "aol", name: "AOL Mail" },
] as const;

export const defaultEmailClients = ["outlook", "gmail", "apple-mail"];
export const MAX_EMAIL_BYTES = 250_000;
export const emailTestingDescription = "Test HTML email compatibility and preview Outlook, Gmail, Apple Mail, Yahoo Mail and AOL Mail locally. Edit a template or paste HTML into the free live playground. No React or test send required.";

export interface EmailDesign {
  id: string;
  name: string;
  kind: "newsletter" | "launch" | "receipt";
  brand: string;
  eyebrow: string;
  heading: string;
  body: string;
  button: string;
  accent: string;
  background: string;
}

export const emailDesigns: EmailDesign[] = [
  { id: "fieldnotes", name: "Fieldnotes · Newsletter", kind: "newsletter", brand: "FIELDNOTES", eyebrow: "A LITTLE FURTHER AFIELD", heading: "Your next adventure starts here.", body: "Fresh air. A slower morning. Somewhere you haven't been before. Your weekend guide is ready.", button: "Explore the guide", accent: "#24382e", background: "#f2f0eb" },
  { id: "orbit", name: "Orbit · Product launch", kind: "launch", brand: "ORBIT", eyebrow: "MEET YOUR NEW WORKSPACE", heading: "Space for your next big idea.", body: "Bring your notes, projects and people together. A calmer way to do your best work, starting today.", button: "Meet Orbit", accent: "#4b3ac5", background: "#eeecfa" },
  { id: "studio", name: "Studio · Order receipt", kind: "receipt", brand: "STUDIO SUPPLY", eyebrow: "ORDER #1048 · CONFIRMED", heading: "Good things are on their way.", body: "Thanks for making room for a little creativity. We're getting your order ready and will let you know when it ships.", button: "View your order", accent: "#254f73", background: "#edf2f5" },
];

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Editable starter designs are complete HTML emails, with escaped text and validated colors. No external assets. */
export function designHtml(design: EmailDesign): string {
  const text = Object.fromEntries(["brand", "eyebrow", "heading", "body", "button"].map((key) => [key, escape(String(design[key as keyof EmailDesign]))]));
  const accent = /^#[\da-f]{6}$/i.test(design.accent) ? design.accent : "#24382e";
  const background = /^#[\da-f]{6}$/i.test(design.background) ? design.background : "#f2f0eb";
  const extra = design.kind === "receipt"
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px; border-top:1px solid #dddddd; font-size:14px;">
            <tr><td style="padding:16px 0;">The everyday notebook<br><span style="color:#777777; font-size:12px;">Dot grid · Forest · Qty 1</span></td><td align="right">$24.00</td></tr>
            <tr><td style="padding:16px 0; border-top:1px solid #dddddd; font-weight:bold;">Total</td><td align="right" style="border-top:1px solid #dddddd; font-weight:bold;">$24.00</td></tr>
          </table>`
    : design.kind === "launch"
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px; background-color:${background}; border-radius:12px;">
            <tr><td align="center" style="padding:28px 16px; font-size:48px; color:${accent};">&#9675; &nbsp; &#9679; &nbsp; &#9675;</td></tr>
            <tr><td align="center" style="padding:0 16px 24px; font-size:12px; letter-spacing:2px; color:${accent};">ONE SPACE. MORE POSSIBILITIES.</td></tr>
          </table>`
      : `<p style="margin:0 0 28px; padding:18px 0; border-top:1px solid #dddddd; border-bottom:1px solid #dddddd; font-size:13px; letter-spacing:1px; color:${accent};">01 &nbsp; FIND YOUR TRAIL &nbsp; / &nbsp; TAKE THE LONG WAY</p>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${text.heading}</title>
</head>
<body style="margin:0; padding:0; background-color:${background}; color:#24312b; font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%; max-width:560px;">
        <tr><td style="padding:20px 0; font-size:13px; font-weight:bold; letter-spacing:3px; color:${accent};">${text.brand}</td></tr>
        <tr><td style="padding:40px 32px; background-color:#ffffff; border-radius:20px; box-shadow:0 8px 24px #00000012;">
          <p style="margin:0 0 16px; font-size:11px; color:${accent}; letter-spacing:2px;">${text.eyebrow}</p>
          <h1 style="margin:0 0 20px; font-size:38px; line-height:1.15; letter-spacing:-1px; color:${accent};">${text.heading}</h1>
          <p style="margin:0 0 28px; font-size:16px; line-height:1.65; color:#525b56;">${text.body}</p>
          ${extra}
          <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="${accent}" style="border-radius:24px;">
            <a href="https://example.com/guide" style="display:inline-block; padding:16px 24px; color:#ffffff; font-size:14px; font-weight:bold; text-decoration:none;">${text.button} &rarr;</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 0; font-size:11px; color:#66716a; line-height:1.8;">${text.brand} &middot; A little something for your inbox.<br><a href="https://example.com/unsubscribe" style="color:#66716a;">Unsubscribe</a> &nbsp; &middot; &nbsp; <a href="https://example.com" style="color:#66716a;">Visit our website</a></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const sampleEmail = designHtml(emailDesigns[0]);
