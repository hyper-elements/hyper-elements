export const brand = { name: "Acme", accent: "#7c3aed" };

/** The runtime the template was rendered on: Bun sets process.versions.bun, Node doesn't. */
export const runtime = typeof process.versions.bun === "string" ? "bun" : "node";
