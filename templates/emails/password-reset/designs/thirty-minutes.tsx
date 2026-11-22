import PasswordReset from "../template";

export const meta = { label: "Thirty-minute link" };

export default function ThirtyMinutes() {
  return (
    <PasswordReset
      resetLink="https://orbit.example/account/reset/k3m8q1?token=f4c19a7e2b8d3065c1e9a4f7b2d8c3e6a1f9b4d7c2e8a3f6b1d9c4e7a2f8b3d6"
      expires={30}
      unit="minutes"
    />
  );
}
