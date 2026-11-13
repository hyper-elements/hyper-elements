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
export const emailTestingDescription = "Test HTML email compatibility and preview Outlook, Gmail, Apple Mail, Yahoo Mail and AOL Mail locally. Paste or edit HTML and compare client previews in the free live playground. No React or test send required.";

/** A complete sample email. All editing happens directly in the HTML. */
export const sampleEmail = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your next adventure starts here.</title>
</head>
<body style="margin:0; padding:0; background-color:#f2f0eb; color:#24312b; font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%; max-width:560px;">
        <tr><td style="padding:20px 0; font-size:13px; font-weight:bold; letter-spacing:3px; color:#24382e;">FIELDNOTES</td></tr>
        <tr><td style="padding:40px 32px; background-color:#ffffff; border-radius:20px; box-shadow:0 8px 24px #00000012;">
          <p style="margin:0 0 16px; font-size:11px; color:#24382e; letter-spacing:2px;">A LITTLE FURTHER AFIELD</p>
          <h1 style="margin:0 0 20px; font-size:38px; line-height:1.15; letter-spacing:-1px; color:#24382e;">Your next adventure starts here.</h1>
          <p style="margin:0 0 28px; font-size:16px; line-height:1.65; color:#525b56;">Fresh air. A slower morning. Somewhere you haven&#39;t been before. Your weekend guide is ready.</p>
          <p style="margin:0 0 28px; padding:18px 0; border-top:1px solid #dddddd; border-bottom:1px solid #dddddd; font-size:13px; letter-spacing:1px; color:#24382e;">01 &nbsp; FIND YOUR TRAIL &nbsp; / &nbsp; TAKE THE LONG WAY</p>
          <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#24382e" style="border-radius:24px;">
            <a href="https://example.com/guide" style="display:inline-block; padding:16px 24px; color:#ffffff; font-size:14px; font-weight:bold; text-decoration:none;">Explore the guide &rarr;</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 0; font-size:11px; color:#66716a; line-height:1.8;">FIELDNOTES &middot; A little something for your inbox.<br><a href="https://example.com/unsubscribe" style="color:#66716a;">Unsubscribe</a> &nbsp; &middot; &nbsp; <a href="https://example.com" style="color:#66716a;">Visit our website</a></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
