// How tools/render.mjs prints the email's problems: each on a line, with its severity, code, place and message.
export const print = (diagnostics) => diagnostics.map((d) => `${d.severity} ${d.code} at ${d.path}: ${d.message}`).join("\n");
