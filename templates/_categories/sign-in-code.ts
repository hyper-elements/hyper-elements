export const signInCode = {
  group: "Account",
  label: "Sign-in code",
  roots: ["Email"],
  useWhen: "A one-time code the reader types to sign in or to confirm an action",
  avoidWhen: "A link to click instead of a code (use magic-link), or resetting a password (use password-reset)",
} as const;
