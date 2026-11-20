export const feedbackRequest = {
  group: "People",
  label: "Feedback request",
  roots: ["Email"],
  useWhen: "Asking someone for their view after something happened (a stay, a purchase, a call), or showing them a review and inviting their reply",
  avoidWhen: "A survey of many questions (link to it from a newsletter), or a review shown as a quote on an image (use quote-card)",
} as const;
