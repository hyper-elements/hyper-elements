import SignInCode from "../template";

export const meta = { label: "Short-lived code" };

export default function TwoMinutes() {
  return <SignInCode code="QX7M-4P2K-9D" expires={2} unit="minutes" />;
}
