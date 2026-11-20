export const quote = {
  group: "Billing",
  label: "Quote",
  roots: ["Email", "Document"],
  useWhen: "An estimate before work starts: what's included, what it costs, and how long the price holds",
  avoidWhen: "A bill to be paid (use invoice), or a full proposal with its approach and terms (use proposal)",
} as const;
