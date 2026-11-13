// The sandbox's email clients bundle: @hyper-elements/email-clients (the checks' plugin, and the previews) with the
// models it loads. Loaded after core, for an Email.
import { EMAIL_CLIENTS, emailClients, PREVIEW_CLIENTS, renderInEmailClients } from "@hyper-elements/email-clients";

let plugin: ReturnType<typeof emailClients> | undefined;

(globalThis as any).__HYPER_ELEMENTS_SANDBOX__.extras.clients = {
  // One plugin per worker: making it compiles the models.
  emailClients: () => (plugin ??= emailClients()),
  renderInEmailClients,
  // Every client there's a model of: the playground previews them all, not the four renderInEmailClients() does by default.
  previewClients: [...PREVIEW_CLIENTS],
  // Each client as the package names it ("Classic Outlook"), for the page to show beside a diagnostic.
  names: Object.fromEntries(Object.entries(EMAIL_CLIENTS).map(([id, client]) => [id, client.name])),
};
