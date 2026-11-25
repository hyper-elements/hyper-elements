import MagicLink from "../template";

export const meta = { label: "Thirty-minute link" };

export default function ThirtyMinutes() {
  return (
    <MagicLink
      signInLink="https://orbit.example/auth/magic/q7w2e9?token=9e2b7c4f1a8d3e6b0c5f2a9d7e4b1c8f3a6d0e9b2c7f4a1d8e5b3c6f0a9d2e7b"
      expires={30}
      unit="minutes"
    />
  );
}
