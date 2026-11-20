export const speaker = {
  group: "Events",
  label: "Speaker",
  roots: ["Canvas"],
  useWhen: "Announcing one speaker for an event: who they are, what they'll talk about, and when",
  avoidWhen: "The whole event (use event), or a quote from someone (use quote-card)",
} as const;
