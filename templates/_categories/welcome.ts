export const welcome = {
  group: "Account",
  label: "Welcome",
  roots: ["Email"],
  useWhen: "The first email after someone signs up: a greeting, a few next steps and one button",
  avoidWhen: "Confirming an email address (use verify-email), or a series of onboarding emails with different content",
} as const;
