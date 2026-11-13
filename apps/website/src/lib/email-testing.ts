/** The HTML playground's supported preview families, and its initial selection. */
export const emailTestingClients = [
  { id: "outlook", name: "Classic Outlook", logo: "outlook" },
  { id: "outlook-com", name: "New Outlook / Outlook.com", logo: "outlook" },
  { id: "gmail", name: "Gmail", logo: "gmail" },
  { id: "gmail-app", name: "Gmail app", logo: "gmail" },
  { id: "apple-mail", name: "Apple Mail", logo: "apple-mail" },
  { id: "yahoo", name: "Yahoo Mail", logo: "yahoo" },
  { id: "aol", name: "AOL Mail", logo: "aol" },
] as const;

export const defaultEmailClients = ["outlook", "gmail", "apple-mail"];
export const MAX_EMAIL_BYTES = 250_000;
export const emailTestingDescription = "Test HTML email compatibility and preview Outlook, Gmail, Apple Mail, Yahoo Mail and AOL Mail locally. Paste or edit HTML and compare client previews in the free live playground. No React or test send required.";

/** A MacBook Air concept email. All editing happens directly in the HTML. */
export const sampleEmail = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MacBook Air. Make room for possibility.</title>
  <style>
    @media only screen and (max-width:620px) {
      .email-width { width:100% !important; }
      .email-padding { padding-left:24px !important; padding-right:24px !important; }
      .email-headline { font-size:38px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f7; color:#1d1d1f; font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f5f5f7">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" class="email-width" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:100%;">
        <tr><td bgcolor="#ffffff" style="padding:20px 32px; border-radius:16px 16px 0 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="font-size:20px; font-weight:bold; letter-spacing:-0.6px;">Apple</td>
            <td align="right" style="font-size:12px;"><a href="https://www.apple.com/macbook-air/" style="color:#6e6e73; text-decoration:none;">Meet MacBook Air &rsaquo;</a></td>
          </tr></table>
        </td></tr>
        <tr><td align="center" bgcolor="#e3f0f8" class="email-padding" style="padding:40px 48px 28px;">
          <p style="margin:0 0 12px; font-size:14px; line-height:20px; font-weight:bold; color:#245d82;">MacBook Air</p>
          <h1 class="email-headline" style="margin:0 0 16px; font-size:48px; line-height:1.08; letter-spacing:-2px; color:#163a54;">Make room for possibility.</h1>
          <p style="margin:0; font-size:17px; line-height:26px; color:#42627a;">A fresh perspective. A lighter way to work.<br>Your next big idea starts here.</p>
        </td></tr>
        <tr><td bgcolor="#e3f0f8">
          <img src="https://www.hyperelements.dev/img/email-testing/macbook-air.jpg" width="600" height="337" alt="Two sky blue MacBook Air laptops, open to show their thin design" style="display:block; width:100%; max-width:600px; height:auto; border:0;">
        </td></tr>
        <tr><td align="center" bgcolor="#ffffff" class="email-padding" style="padding:30px 48px 36px;">
          <h2 style="margin:0 0 12px; font-size:26px; line-height:32px; letter-spacing:-0.6px;">Light on your desk.<br>Big on what comes next.</h2>
          <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:#6e6e73;">From the first spark of an idea to the final finishing touch, bring a little more possibility to every day.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#0071e3" style="border-radius:24px; box-shadow:0 4px 12px #0071e326;">
            <a href="https://www.apple.com/macbook-air/" style="display:inline-block; padding:14px 26px; border:1px solid #0071e3; border-radius:24px; color:#ffffff; font-size:15px; line-height:20px; text-decoration:none;">Explore MacBook Air &rarr;</a>
          </td></tr></table>
        </td></tr>
        <tr><td align="center" bgcolor="#163a54" style="padding:24px; border-radius:0 0 16px 16px;">
          <p style="margin:0 0 7px; font-size:17px; line-height:24px; font-weight:bold; color:#ffffff;">Find your kind of blue.</p>
          <p style="margin:0; font-size:13px; line-height:20px; color:#b9d9ee;">A little color. A whole new point of view.</p>
        </td></tr>
        <tr><td align="center" style="padding:22px 24px 8px; font-size:10px; line-height:17px; color:#86868b;">
          MacBook Air concept email &middot; Hyper Elements playground.<br>
          Product photography &copy; Apple.<br>
          <a href="https://www.apple.com/macbook-air/" style="color:#6e6e73;">Explore MacBook Air</a> &nbsp;&middot;&nbsp; <a href="https://www.hyperelements.dev/email-testing" style="color:#6e6e73;">Edit this template</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
