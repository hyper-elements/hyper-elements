export const orderConfirmation = {
  group: "Orders",
  label: "Order confirmation",
  roots: ["Email"],
  useWhen: "Confirming an order was placed: what's in it, what it costs, and where it's going",
  avoidWhen: "Proof of a payment for a subscription (use receipt), or an order on its way (use shipping)",
} as const;
