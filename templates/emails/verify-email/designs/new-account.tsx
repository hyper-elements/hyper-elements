import VerifyEmail from "../template";

export const meta = { label: "New account" };

export default function NewAccount() {
  return <VerifyEmail email="ada@example.com" verifyLink="https://orbit.example/verify/a41c9e" />;
}
