export const ticket = {
  group: "Events",
  label: "Ticket",
  roots: ["Email", "Document"],
  useWhen: "A ticket someone holds for an event: who it's for, when and where, and the code to show at the door",
  avoidWhen: "Inviting people to an event (use event), or a receipt for the ticket's price (use receipt)",
} as const;
