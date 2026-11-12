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
import { DEFAULT_EMAIL_CLIENTS, checkClients, forClients, type ClientDiagnostic, type EmailClient } from "./email-clients";
import { loadModels } from "./load-models";
import type { Models } from "./models";

export interface EmailClientsPluginOptions {
  /** The email clients to check for (default: DEFAULT_EMAIL_CLIENTS, the 11 most email is read in). */
  clients?: readonly EmailClient[];
}

/** The plugin's name: core's validate() and render() leave out their email/more-checks note when it's passed. */
export const PLUGIN_NAME = "email-clients";

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
