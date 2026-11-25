import SignInCode from "../template";

export const meta = { label: "Ten-minute code" };

export default function TenMinutes() {
  return <SignInCode code="482-913" expires={10} unit="minutes" />;
}
