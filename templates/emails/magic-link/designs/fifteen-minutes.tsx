import MagicLink from "../template";

export const meta = { label: "Fifteen-minute link" };

export default function FifteenMinutes() {
  return <MagicLink signInLink="https://orbit.example/login/3be8f1" expires={15} unit="minutes" />;
}
