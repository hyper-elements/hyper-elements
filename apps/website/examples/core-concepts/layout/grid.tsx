import { Column, Email, Grid, Text } from "@hyper-elements/react";

const card = { backgroundColor: "#eef2ff", padding: 16, borderRadius: 8 };

export default function Example() {
  return (
    <Email width={600}>
      <Grid id="grid" columns={3} style={{ gap: 16, rowGap: 24 }}>
        <Column style={card}><Text>One</Text></Column>
        <Column style={card}><Text>Two</Text></Column>
        <Column style={card}><Text>Three</Text></Column>
        <Column style={card}><Text>Four</Text></Column>
      </Grid>
    </Email>
  );
}
