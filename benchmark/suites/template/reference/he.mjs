// The Hyper Elements kit's reference issue: a design whose root is the newsletter template.
const q = (s) => JSON.stringify(s);
export const files = (c) => ({
  "designs/newsletter.tsx": `import { Button, Column, Heading, Image, Text } from "@hyper-elements/react";
import Newsletter from "../templates/newsletter";

export default () => (
  <Newsletter
    preview=${q(c.preview)}
    heading=${q(c.heading)}
    body={
      <Column>
        <Text>${c.intro}</Text>
${c.stories.map((s) => `        <Image src={{ src: ${q(s.image.src)}, width: ${s.image.width}, height: ${s.image.height} }} alt=${q(s.image.alt)} />
        <Heading level={2}>${s.title}</Heading>
        <Text>${s.text}</Text>
        <Button href=${q(s.button.href)}>${s.button.text}</Button>`).join("\n")}
      </Column>
    }
  />
);
`,
});
