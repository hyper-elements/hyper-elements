export const invoice = {
  group: "Billing",
  label: "Invoice",
  roots: ["Email", "Document"],
  useWhen: "A bill the reader has to pay: what it's for, how much, and when it's due",
  avoidWhen: "A payment already made (use receipt), or an estimate before work starts (use quote)",
} as const;
