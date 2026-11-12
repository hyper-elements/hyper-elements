/**
 * `emailClients()`: the email client checks, as a plugin for core's validate() and render() (plan email-client-models,
 * D6). The open checks (checks.ts, from caniemail's tables) and the captured ones (the models package's WebAssembly
 * module), for the clients asked for, merged where they say the same of several clients.
 *
 *   validate(<Welcome />, { plugins: [await emailClients()] });
 *   validate(<Welcome />, { plugins: [await emailClients({ clients: ["gmail", "outlook"] })] });
 */
import type { ElementsPlugin, PluginInput, PluginOutput } from "@hyper-elements/react";
import { treeChecks, outputChecks } from "./checks";
import { checkPlugins, loadCore } from "./core";
import { checkProtocol } from "./protocol";
import { DEFAULT_EMAIL_CLIENTS, checkClients, forClients, type ClientDiagnostic, type EmailClient } from "./email-clients";
import { forgetModelsPackage, loadModelsPackage, type Models } from "./models";

export interface EmailClientsPluginOptions {
  /** The email clients to check for (default: DEFAULT_EMAIL_CLIENTS, the 11 most email is read in). */
  clients?: readonly EmailClient[];
}

/** The plugin's name: core's validate() and render() leave out their email/more-checks note when it's passed. */
export const PLUGIN_NAME = "email-clients";

const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/**
 * Compiling the models' module, once per process: later calls reuse it. Null where it compiled; the Error where it
 * didn't, which isn't kept: the next emailClients() tries again (a plugin already made keeps the open checks only).
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

/** The models package, or why it can't be loaded (the next emailClients() tries again). */
async function loadModels(): Promise<{ models: Models; unavailable: null } | { models: null; unavailable: Error }> {
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

/**
 * The plugin for the clients asked for. Loads the models' WebAssembly module the first time; where the models package
 * can't be imported, or its module compiled (no WebAssembly), the plugin runs the open checks only, and its first
 * diagnostic on an Email says so.
 */
export async function emailClients(options: EmailClientsPluginOptions = {}): Promise<ElementsPlugin> {
  checkPlugins(await loadCore());
  const given = options.clients;
  checkClients(given, "emailClients({ clients })");
  const { models, unavailable } = await loadModels();
  const selection = given ?? DEFAULT_EMAIL_CLIENTS;
  const forSelection = (found: ClientDiagnostic[]) => forClients(found, selection);
  return Object.freeze({
    name: PLUGIN_NAME,
    api: 1 as const,
    check(input: PluginInput): ClientDiagnostic[] {
      const root = input.root.type;
      if (root !== "Email") {
        return given ? [{ code: "email/clients-ignored", severity: "info", message: `emailClients({ clients }) is for an Email; a ${root} isn't checked for email clients`, path: "root" }] : [];
      }
      const found: ClientDiagnostic[] = [];
      if (unavailable) {
        found.push({ code: "email/captured-checks", severity: "warning", message: `The captured email client checks didn't load (${unavailable.message}): only the checks from caniemail's tables ran`, path: "root", fix: "install @hyper-elements/email-client-models where it can load (it comes with this package): Node 20 or later, or a browser with WebAssembly" });
      }
      found.push(...treeChecks(input));
      if (models) found.push(...captured(models, input));
      return forSelection(found);
    },
    checkOutput(output: PluginOutput): ClientDiagnostic[] {
      return output.root === "Email" ? forSelection(outputChecks(output)) : [];
    },
  });
}

/** The models' checks; one that throws gives a warning, and the open checks still stand. */
function captured(models: Models, input: PluginInput): ClientDiagnostic[] {
  try {
    return models.check({ root: input.root });
  } catch (error) {
    return [{ code: "email/captured-checks", severity: "warning", message: `The captured email client checks failed on this email (${error instanceof Error ? error.message : String(error)}): only the checks from caniemail's tables ran`, path: "root" }];
  }
}
