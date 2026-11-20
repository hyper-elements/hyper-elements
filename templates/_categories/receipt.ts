export const receipt = {
  group: "Billing",
  label: "Receipt",
  roots: ["Email", "Document"],
  useWhen: "Proof of a payment already made: what was bought, what it cost, and when it was paid",
  avoidWhen: "A bill still to be paid (use invoice), or an order that hasn't been charged yet (use order-confirmation)",
} as const;
