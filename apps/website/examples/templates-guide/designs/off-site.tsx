// designs/off-site.tsx
import { Button, Column, Text } from "@hyper-elements/react";
import BrandEmail from "../templates/brand-email";

export default () => (
  <BrandEmail
    preview="A partner offer for Orbit customers, for a short time, from a friend of ours"
    body={
      <Column style={{ gap: 16 }}>
        <Text>Our friends at Northwind have an offer for Orbit customers.</Text>
        <Button href="https://northwind.example.net/offer">See the offer</Button>
      </Column>
    }
  />
);
