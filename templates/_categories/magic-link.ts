export const magicLink = {
  group: "Account",
  label: "Magic link",
  roots: ["Email"],
  useWhen: "A one-time link that signs the reader in without a password",
  avoidWhen: "A code to type (use sign-in-code), or resetting a password (use password-reset)",
} as const;
