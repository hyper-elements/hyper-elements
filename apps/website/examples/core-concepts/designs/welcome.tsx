import { Email, Heading, Text } from "@hyper-elements/react";

export default function Welcome() {
  return (
    <Email width={600} previewText="Thanks for signing up" lang="en">
      <Heading>Welcome</Heading>
      <Text>Thanks for signing up.</Text>
    </Email>
  );
}
