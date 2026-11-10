/**
 * A preview file: a trusted shell document around the email. The email is data, never markup: a JSON string in
 * `<script type="application/json" id="email">`, escaped so `</script>` in an Html block can't end it. The shell's two
 * scripts, the email client models (@hyper-elements/email-client-models' browser script) and the runtime, draw it in
 * sandboxed frames (no scripts, forms, popups or navigation run in them), and a CSP lets only those two run, and the
 * models compile their WebAssembly ('wasm-unsafe-eval'): inline styles only, fonts from the stand-in origin, inlined or
 * any HTTPS URL, images from anywhere, nothing else fetched.
 */
import type { Config } from "./runtime/main";

/** The runtime: its script, and the script's sha256 (base64) for the CSP. */
export interface Runtime {
  script: string;
  sha256: string;
}

/** What the runtime reads, beside the email (src/runtime/main.ts's Config). */
export type PreviewConfig = Config;

/** `value` as JSON that's safe inside a `<script>`: <, >, &, U+2028 and U+2029 as \u escapes. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * The shell's Content-Security-Policy: only the models and the runtime run, and the models may compile WebAssembly (no
 * script at all without them).
 */
export function contentSecurityPolicy(scripts: { runtime: Runtime; models: Runtime } | null, fontOrigin: string | null): string {
  return [
    "default-src 'none'",
    `script-src ${scripts ? `'sha256-${scripts.models.sha256}' 'sha256-${scripts.runtime.sha256}' 'wasm-unsafe-eval'` : "'none'"}`,
    "style-src 'unsafe-inline'",
    `font-src ${fontOrigin ? `${fontOrigin} ` : ""}data: https:`,
    "img-src * data:",
  ].join("; ");
}

const STYLE =
  "body{margin:0;font:14px/1.4 system-ui,sans-serif;color:#1f2328;background:#f6f8fa}" +
  ".note{padding:12px 16px;border-bottom:1px solid #d0d7de;background:#fff}.note h1{margin:0 0 4px;font-size:15px}.note h2{margin:8px 0 2px;font-size:13px}.note p{margin:0}.note ul{margin:0;padding-left:20px}" +
  "#frames{display:flex;gap:16px;padding:16px;align-items:flex-start}#frames iframe{flex:none;border:0;background:#fff;box-shadow:0 0 0 1px #d0d7de}";

/** The preview file for `config`'s client, drawing `html` (render()'s email) with the models and the runtime. */
export function previewFile(html: string, config: PreviewConfig, scripts: { runtime: Runtime; models: Runtime } | null): string {
  const approximate = config.approximate ? " The model is approximate: words can sit a few pixels from where the client puts them." : "";
  // Classic Outlook's model places words as Word does; what it draws around them (rounded corners, for one) can still show.
  const words = config.client === "outlook" ? " It models where words fall: details Outlook doesn't draw, such as rounded corners, may still show." : "";
  const title = `${config.name}${config.dark ? ", dark" : ""} (${config.variant}, ${config.width}px)`;
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(contentSecurityPolicy(scripts, config.fontOrigin))}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}: email preview</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    `<header class="note"><h1>${escapeHtml(title)}</h1><p>How this email draws in ${escapeHtml(config.name)}.${approximate}${words} A preview isn't an email: what you send is render()'s html. What the client changed is listed here once the preview has loaded.</p><div id="findings"></div></header>`,
    '<main id="frames"></main>',
    `<script type="application/json" id="email">${scriptJson(html)}</script>`,
    `<script type="application/json" id="email-client-config">${scriptJson(config)}</script>`,
    scripts ? `<script>${scripts.models.script}</script>` : "",
    scripts ? `<script>${scripts.runtime.script}</script>` : "",
    "</body>",
    "</html>",
  ].join("\n");
}
