export const shipping = {
  group: "Orders",
  label: "Shipping",
  roots: ["Email"],
  useWhen: "Telling someone their order is on its way: who's carrying it, when it should arrive, and how to track it",
  avoidWhen: "Confirming an order was placed (use order-confirmation), or one that has arrived (use delivered)",
} as const;
