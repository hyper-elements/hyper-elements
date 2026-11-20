export const newsletter = {
  group: "Content",
  label: "Newsletter",
  roots: ["Email", "Page"],
  useWhen: "A regular issue of written news: a subject, a lead, and sections the writer fills in",
  avoidWhen: "One announcement (use announcement), or a summary built from data (use digest)",
} as const;
