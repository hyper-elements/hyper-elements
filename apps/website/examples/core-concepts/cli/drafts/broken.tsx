import { Email, Text } from "@hyper-elements/react";

export default function Broken() {
  return (
    <Email lang="en">
      {/* @ts-expect-error: there are no margins */}
      <Text style={{ marginBottom: 8 }}>Your account is ready.</Text>
    </Email>
  );
}
