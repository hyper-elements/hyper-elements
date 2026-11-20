export const event = {
  group: "Events",
  label: "Event",
  roots: ["Email", "Page", "Canvas"],
  useWhen: "An event people can come to: what it is, when and where, and how to register",
  avoidWhen: "A ticket someone already has (use ticket), or one speaker's announcement (use speaker)",
} as const;
