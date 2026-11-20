export const announcement = {
  group: "Launches",
  label: "Announcement",
  roots: ["Email", "Page", "Canvas"],
  useWhen: "One launch or piece of news: a headline, a date, and what's new",
  avoidWhen: "Several pieces of news at once (use newsletter), or a link preview for an article (use og-card)",
} as const;
