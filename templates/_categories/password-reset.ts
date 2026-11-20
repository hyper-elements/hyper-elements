export const passwordReset = {
  group: "Account",
  label: "Password reset",
  roots: ["Email"],
  useWhen: "A link to choose a new password, after someone asked to reset theirs",
  avoidWhen: "A code to type instead of a link (use sign-in-code), or telling someone their password was changed (use security-alert)",
} as const;
