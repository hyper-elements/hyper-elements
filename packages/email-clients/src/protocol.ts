/**
 * The models package's message formats this package reads, and the check of the one installed. Apart from core.ts, so
 * HTML can be previewed, and the models checked, without loading core.
 */

/** The models package's message formats (its PROTOCOL) this package reads. */
export const MODEL_PROTOCOLS: readonly number[] = [1];

/** The models package installed speaks a protocol this package reads. */
export function checkProtocol(protocol: unknown): void {
  if (typeof protocol === "number" && MODEL_PROTOCOLS.includes(protocol)) return;
  const error = new Error(`@hyper-elements/email-clients reads @hyper-elements/email-client-models' protocol ${MODEL_PROTOCOLS.join(", ")}; the one installed speaks ${JSON.stringify(protocol)}. Reinstall @hyper-elements/email-clients, which brings the models package it reads`);
  error.name = "email-clients/version-mismatch";
  throw error;
}
