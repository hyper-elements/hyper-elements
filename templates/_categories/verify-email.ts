export const verifyEmail = {
  group: "Account",
  label: "Verify email",
  roots: ["Email"],
  useWhen: "A link that confirms an email address belongs to the person who signed up with it",
  avoidWhen: "A code to type (use sign-in-code), or a first hello with next steps (use welcome)",
} as const;
