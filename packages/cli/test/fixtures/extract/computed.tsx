// A design whose title is computed: it can't be a field's example.
import { Email, Heading, Text } from "@hyper-elements/react";

const name = "Ada";

export default () => (
  <Email lang="en" previewText="A note for you, from all of us at Acme">
    <Heading id="title" level={1}>{`Hello, ${name}`}</Heading>
    <Text id="body">Thanks for signing up.</Text>
  </Email>
);
