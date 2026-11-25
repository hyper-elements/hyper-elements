// The MJML kit's reference issue: the kit's head, header and footer, included as they are.
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
export const files = (c) => ({
  "emails/email.mjml": `<mjml lang="en">
  <mj-head>
    <mj-include path="./head.mjml" />
    <mj-preview>${esc(c.preview)}</mj-preview>
  </mj-head>
  <mj-body background-color="#f1f2f6" width="600px">
    <mj-include path="./header.mjml" />
    <mj-section>
      <mj-column>
        <mj-text font-size="28px" line-height="36px">${esc(c.heading)}</mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="8px 32px 24px">
      <mj-column>
        <mj-text>${esc(c.intro)}</mj-text>
${c.stories.map((s) => `        <mj-image src="${s.image.src}" alt="${esc(s.image.alt)}" />
        <mj-text css-class="title">${esc(s.title)}</mj-text>
        <mj-text>${esc(s.text)}</mj-text>
        <mj-button href="${s.button.href}">${esc(s.button.text)}</mj-button>`).join("\n")}
      </mj-column>
    </mj-section>
    <mj-include path="./footer.mjml" />
  </mj-body>
</mjml>
`,
});
