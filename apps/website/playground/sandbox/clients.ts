// The sandbox's email clients bundle: @hyper-elements/email-clients (the checks' plugin, and the previews) with the
// models it loads. Loaded after core, for an Email.
import { EMAIL_CLIENTS, emailClients, renderInEmailClients } from "@hyper-elements/email-clients";
// Not exported by the package: the playground bundles its source, and this is the module renderInEmailClients(html) checks with.
import { checkWholeEmail } from "../../../../packages/email-clients/src/html-input";

let plugin: ReturnType<typeof emailClients> | undefined;

(globalThis as any).__HYPER_ELEMENTS_SANDBOX__.extras.clients = {
  // One plugin per worker: making it compiles the models.
  emailClients: () => (plugin ??= emailClients()),
  renderInEmailClients,
  // Each client as the package names it ("Classic Outlook"), for the page to show beside a diagnostic.
  names: Object.fromEntries(Object.entries(EMAIL_CLIENTS).map(([id, client]) => [id, client.name])),
  // The email testing page reports HTML that isn't a whole email as an input error, by the package's own rule.
  checkWholeEmail: (html: unknown) => checkWholeEmail(html),
};
