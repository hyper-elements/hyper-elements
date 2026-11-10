// Task 4 (landing) needs a Page's own phone width: an engine that gives an error here skips the task (N/A).
import { Page, Text } from "@hyper-elements/react";

export default function Probe() {
  return (
    <Page breakpoints={{ mobile: 640 }}>
      <Text>Probe</Text>
    </Page>
  );
}
