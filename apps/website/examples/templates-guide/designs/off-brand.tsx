// designs/off-brand.tsx
import { Button, Column, Heading, Table, TableCell, TableRow, Text } from "@hyper-elements/react";
import Newsletter from "../templates/newsletter";

export default () => (
  <Newsletter
    subject="Huge summer sale"
    preview="Everything is on sale this week, for a short time only, across the whole store"
    body={
      <Column>
        <Heading level={2} style={{ color: "#ff0066" }}>Everything must go</Heading>
        <Table><TableRow><TableCell><Text>Pro plan</Text></TableCell><TableCell><Text>50% off</Text></TableCell></TableRow></Table>
        <Button href="https://orbit.example/sale">Shop the sale</Button>
      </Column>
    }
  />
);
