import Certificate from "../template";

export const meta = { label: "Mentorship" };

export default function Mentorship() {
  return (
    <Certificate
      recipient="Clara Novak-Lindqvist"
      achievement="Mentored twelve new designers through their first year on the team, and led the spring critique series"
      dateAwarded="November 8"
      level="Distinction"
      credentialId="MNT-0418-CNL"
      verifyLink="https://orbit.example/certificates/MNT-0418-CNL"
    />
  );
}
