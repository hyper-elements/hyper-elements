import { defaultEmailClients, emailTestingClients, MAX_EMAIL_BYTES, sampleEmail } from "../lib/email-testing";
import type { Preview, Result } from "../../playground/protocol";
import { previewDevice, previewFile, type PreviewScripts } from "../playground/preview";
import { Sandbox } from "../playground/sandbox";

const root = document.querySelector<HTMLElement>("[data-email-testing]")!;
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const source = get<HTMLTextAreaElement>("email-html");
const runButton = get<HTMLButtonElement>("email-run");
const file = get<HTMLInputElement>("email-file");
const dark = get<HTMLInputElement>("email-dark");
const status = get("email-status");
const error = get("email-error");
const select = get<HTMLSelectElement>("email-preview");
const controls = get("email-preview-controls");
const empty = get("email-empty");
const viewport = get("email-viewport");
const sheet = get("email-sheet");
const sizeButton = get<HTMLButtonElement>("email-size");
const download = get<HTMLButtonElement>("email-download");
const findings = get("email-findings");
const diagnostics = get<HTMLUListElement>("email-diagnostics");
const skipped = get<HTMLUListElement>("email-skipped");
const checkboxes = [...root.querySelectorAll<HTMLInputElement>('[name="email-client"]')];
const sandbox = new Sandbox({ base: "/playground/runtime", version: root.dataset.runtimeVersion! });
const names = new Map<string, string>(emailTestingClients.map(({ id, name }) => [id, name]));

interface Input { html: string; clients?: string[]; dark?: boolean }
type Report = Pick<Result, "ok" | "diagnostics" | "skipped" | "error" | "ms"> & { previews: Omit<Preview, "html">[] };
let result: Result | undefined;
let report: Report | undefined;
let scripts: PreviewScripts | undefined;
let frame: HTMLIFrameElement | undefined;
let sequence = 0;
let fit = true;

function clear() {
  result = undefined;
  report = undefined;
  frame = undefined;
  sheet.replaceChildren();
  select.replaceChildren();
  diagnostics.replaceChildren();
  skipped.replaceChildren();
  controls.hidden = viewport.hidden = findings.hidden = true;
  empty.hidden = false;
  download.disabled = sizeButton.disabled = true;
  error.hidden = true;
}

function changed() {
  sequence++;
  sandbox.cancel("email-testing");
  clear();
  runButton.disabled = false;
  runButton.textContent = "Test email →";
  root.removeAttribute("aria-busy");
  status.textContent = "Email or options changed. Test again to update the previews and findings.";
}

function label(preview: Preview): string {
  const name = names.get(preview.client) ?? preview.client;
  const device = previewDevice(preview);
  return [name, device, preview.dark ? "Dark" : "Light"].filter(Boolean).join(" · ");
}

function resize() {
  const preview = result?.previews?.find((p) => p.id === select.value);
  if (!preview || !frame) return;
  const scale = fit ? Math.min(1, viewport.clientWidth / preview.width) : 1;
  frame.style.width = `${preview.width}px`;
  frame.style.height = "800px";
  frame.style.transform = `scale(${scale})`;
  sheet.style.width = `${preview.width * scale}px`;
  sheet.style.height = `${800 * scale}px`;
}

function showPreview() {
  const preview = result?.previews?.find((p) => p.id === select.value);
  if (!preview || !scripts) return;
  const next = document.createElement("iframe");
  next.title = label(preview);
  error.hidden = true;
  sheet.replaceChildren();
  frame = undefined;
  if (!previewFile(next, preview.html, scripts)) {
    error.textContent = "This preview is too large to display here. Use the CLI below to preview this email locally.";
    error.hidden = false;
    return;
  }
  frame = next;
  sheet.append(next);
  get("email-preview-note").textContent = `${preview.width}px${preview.approximate ? " · Approximate" : ""}`;
  resize();
}

function showFindings(output: Result) {
  findings.hidden = false;
  get("email-findings-summary").textContent = output.diagnostics.length
    ? `${output.diagnostics.length} finding${output.diagnostics.length === 1 ? "" : "s"} from the client compatibility checks.`
    : "No known compatibility issues found by these checks. Inspect the previews and test critical emails in real clients.";
  for (const d of output.diagnostics) {
    const item = document.createElement("li");
    const meta = document.createElement("span");
    meta.className = "et-diagnostic-meta";
    meta.textContent = [d.severity, d.line ? `Line ${d.line}` : "", d.clients?.map((id) => names.get(id) ?? id).join(", ")].filter(Boolean).join(" · ");
    item.append(meta, document.createTextNode(d.message));
    if (d.fix) {
      const fix = document.createElement("span");
      fix.className = "et-diagnostic-fix";
      fix.textContent = `Suggested fix: ${d.fix}`;
      item.append(fix);
    }
    if (d.see) {
      const link = document.createElement("a");
      link.href = d.see;
      link.textContent = " Support details ↗";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(link);
    }
    diagnostics.append(item);
  }
  for (const s of output.skipped ?? []) {
    const item = document.createElement("li");
    item.textContent = `${names.get(s.client) ?? s.client}: ${s.reason}`;
    skipped.append(item);
  }
}

/** The UI and browser agents use the same validation, sandbox and results. HTML is never evaluated as code. */
async function check(input: Input): Promise<Report> {
  const run = ++sequence;
  sandbox.cancel("email-testing");
  clear();
  try {
    if (!input || typeof input.html !== "string" || !input.html.trim()) throw new Error("Paste a complete HTML email to test.");
    if (new TextEncoder().encode(input.html).length > MAX_EMAIL_BYTES) throw new Error("This playground accepts emails up to 250 KB. Use the CLI below for larger files.");
    const clients = input.clients ?? defaultEmailClients;
    if (!Array.isArray(clients) || !clients.length || clients.some((id) => !names.has(id))) throw new Error("Choose at least one supported email client.");
    if (input.dark !== undefined && typeof input.dark !== "boolean") throw new Error("The dark option must be true or false.");
    source.value = input.html;
    dark.checked = input.dark === true;
    checkboxes.forEach((box) => { box.checked = clients.includes(box.value); });
    runButton.disabled = true;
    runButton.textContent = "Testing…";
    root.setAttribute("aria-busy", "true");
    status.textContent = "Checking compatibility and generating client previews in your browser…";
    scripts = await sandbox.previewScripts();
    if (run !== sequence) return { ok: false, diagnostics: [], previews: [], ms: 0, error: { kind: "internal", message: "Superseded by another edit or test." } };
    const output = await sandbox.run({ kind: "html-previews", html: input.html, clients: [...new Set(clients)], dark: input.dark }, ["clients"], "email-testing");
    const summary: Report = {
      ok: output.ok, diagnostics: output.diagnostics, skipped: output.skipped, error: output.error, ms: output.ms,
      previews: (output.previews ?? []).map(({ html: _html, ...metadata }) => metadata),
    };
    if (run !== sequence) return { ...summary, ok: false, error: { kind: "internal", message: "Superseded by another edit or test." } };
    if (!output.ok) throw new Error(output.error?.message ?? "The email could not be checked. Try again.");
    result = output;
    report = summary;
    const previews = output.previews ?? [];
    for (const preview of previews) select.add(new Option(label(preview), preview.id));
    controls.hidden = viewport.hidden = !previews.length;
    empty.hidden = !!previews.length;
    sizeButton.disabled = !previews.length;
    download.disabled = false;
    showPreview();
    showFindings(output);
    status.textContent = `${previews.length} previews generated · ${output.diagnostics.length} compatibility finding${output.diagnostics.length === 1 ? "" : "s"}`;
    return summary;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "The email could not be checked. Try again.";
    if (run === sequence) {
      error.textContent = message;
      error.hidden = false;
      status.textContent = "The check did not complete.";
    }
    return { ok: false, diagnostics: [], previews: [], ms: 0, error: { kind: "runtime", message } };
  } finally {
    if (run === sequence) {
      runButton.disabled = false;
      runButton.textContent = "Test email →";
      root.removeAttribute("aria-busy");
    }
  }
}

runButton.addEventListener("click", () => void check({ html: source.value, clients: checkboxes.filter((box) => box.checked).map((box) => box.value), dark: dark.checked }));
source.addEventListener("input", changed);
dark.addEventListener("change", changed);
checkboxes.forEach((box) => box.addEventListener("change", changed));
select.addEventListener("change", showPreview);
sizeButton.addEventListener("click", () => { fit = !fit; sizeButton.textContent = fit ? "Actual size" : "Fit to panel"; resize(); });
new ResizeObserver(resize).observe(viewport);
get("email-example").addEventListener("click", () => { source.value = sampleEmail; changed(); });
get("email-open").addEventListener("click", () => file.click());
file.addEventListener("change", async () => {
  const selected = file.files?.[0];
  file.value = "";
  if (!selected) return;
  changed();
  const current = sequence;
  try {
    if (selected.size > MAX_EMAIL_BYTES) throw new Error("This playground accepts emails up to 250 KB. Use the CLI below for larger files.");
    const html = await selected.text();
    if (current !== sequence) return;
    source.value = html;
    status.textContent = `Opened ${selected.name}. Choose clients and test your email.`;
  } catch (reason) {
    if (current !== sequence) return;
    error.textContent = reason instanceof Error ? reason.message : "The file could not be read.";
    error.hidden = false;
  }
});
download.addEventListener("click", () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "email-compatibility-report.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

Object.defineProperty(window, "hyperElementsEmailTesting", { value: Object.freeze({ check }), configurable: true });
type ModelContext = { registerTool(tool: object): unknown };
const modelContext = (document as unknown as { modelContext?: ModelContext }).modelContext ?? (navigator as unknown as { modelContext?: ModelContext }).modelContext;
if (modelContext?.registerTool) {
  try {
    Promise.resolve(modelContext.registerTool({
      name: "check_html_email",
      description: "Check complete HTML email compatibility and generate local modeled client previews. Returns diagnostics, preview metadata and skipped variants; ok means generation succeeded, not guaranteed compatibility. Updates this playground.",
      inputSchema: { type: "object", properties: { html: { type: "string", description: "The complete HTML email, including html and body tags (up to 250 KB)." }, clients: { type: "array", minItems: 1, items: { type: "string", enum: [...names.keys()] } }, dark: { type: "boolean" } }, required: ["html"], additionalProperties: false },
      execute: check,
    })).catch(() => undefined);
  } catch { /* The browser API is optional; the window API remains available. */ }
}
for (const id of ["email-run", "email-example", "email-open"]) get<HTMLButtonElement>(id).disabled = false;
