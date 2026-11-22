import PasswordReset from "../template";

export const meta = { label: "One-hour link" };

export default function OneHour() {
  return <PasswordReset resetLink="https://orbit.example/reset/7d9f2c" expires={1} unit="hours" />;
}
