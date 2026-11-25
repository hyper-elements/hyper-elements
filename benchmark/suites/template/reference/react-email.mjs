// The React Email kit's reference issue: the kit's Layout, styled with its palette and styles.
const q = (s) => JSON.stringify(s);
export const files = (c) => ({
  "emails/email.tsx": `import { Heading, Img, Link, Text } from "@react-email/components";
import { Layout, styles } from "./brand";

export default function Email() {
  return (
    <Layout preview=${q(c.preview)} heading=${q(c.heading)}>
      <Text style={styles.text}>${c.intro}</Text>
${c.stories.map((s) => `      <Img src=${q(s.image.src)} width="536" alt=${q(s.image.alt)} style={styles.image} />
      <Heading as="h2" style={styles.title}>${s.title}</Heading>
      <Text style={styles.text}>${s.text}</Text>
      <Link href=${q(s.button.href)} style={styles.button}>${s.button.text}</Link>`).join("\n")}
    </Layout>
  );
}
`,
});
