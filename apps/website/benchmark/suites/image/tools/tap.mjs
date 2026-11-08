// Stands in for `satori` in tools/render.mjs's bundle (the agent's import, and Hyper Elements' own): records the
// element tree and options it's given, then draws with the real Satori.
import realSatori from "satori";
import { record } from "./tap-record.mjs";

export * from "satori";
export default async function satori(element, options = {}) {
  record("satori", element, options);
  return realSatori(element, options);
}
