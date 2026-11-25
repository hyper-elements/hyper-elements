import VerifyEmail from "../template";

export const meta = { label: "Work address" };

export default function WorkAddress() {
  return (
    <VerifyEmail
      email="tomas.lindqvist-bergstrom.design-operations@accounts.northwind-studio-collective.example"
      verifyLink="https://orbit.example/account/verify/x82k0p"
      expiry={{ expires: 24, unit: "hours" }}
    />
  );
}
