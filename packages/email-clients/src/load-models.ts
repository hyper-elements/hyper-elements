/**
 * The models package, loaded and compiled for the checks: by the plugin (emailClients()) and by the HTML entry's
 * checkInEmailClients() alike. A package that can't be imported, or whose WebAssembly doesn't compile, leaves the open
 * checks to run alone (the caller says so); a protocol this package doesn't read is a mismatched install, and throws.
 */
import { forgetModelsPackage, loadModelsPackage, type Models } from "./models";
import { checkProtocol } from "./protocol";

export const asError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Compiling the models' module, once per process: later calls reuse it. Null where it compiled; the Error where it
 * didn't, which isn't kept: the next call tries again.
 */
let compiling: Promise<Error | null> | undefined;
const compile = (models: Models) =>
  (compiling ??= models.ready().then(
    () => null,
    (error: unknown) => {
      compiling = undefined;
      return asError(error);
    }
  ));

/** The models package, compiled, or why it can't be used (the next call tries again). */
export async function loadModels(): Promise<{ models: Models; unavailable: null } | { models: null; unavailable: Error }> {
  let models: Models;
  try {
    models = await loadModelsPackage();
  } catch (error) {
    forgetModelsPackage();
    return { models: null, unavailable: asError(error) };
  }
  // A protocol this package doesn't read is a mismatched install, said as one: not a fallback.
  checkProtocol(models.PROTOCOL);
  const unavailable = await compile(models);
  return unavailable ? { models: null, unavailable } : { models, unavailable: null };
}
