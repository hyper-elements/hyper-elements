import { defaultEmailClients, emailTestingClients, MAX_EMAIL_BYTES, sampleEmail } from "../lib/email-testing";
import type { Preview, Result } from "../../playground/protocol";
import { previewDevice, previewFile, type PreviewScripts } from "../playground/preview";
import { Sandbox } from "../playground/sandbox";

const root = document.querySelector<HTMLElement>("[data-email-testing]")!;
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const source = get<HTMLTextAreaElement>("email-html");
const live = get<HTMLInputElement>("email-live");
const gallery = get("email-gallery");
const controls = get("email-preview-controls");
const allButton = get<HTMLButtonElement>("email-all");
const detailsButton = get<HTMLButtonElement>("email-details");
const runButton = get<HTMLButtonElement>("email-run");
const dark = get<HTMLInputElement>("email-dark");
const status = get("email-status");
const error = get("email-error");
const select = get<HTMLSelectElement>("email-preview");
const empty = get("email-empty");
const viewport = get("email-viewport");
const sheet = get("email-sheet");
const sizeButton = get<HTMLButtonElement>("email-size");
const download = get<HTMLButtonElement>("email-download");
const findings = get("email-findings");
const diagnostics = get<HTMLUListElement>("email-diagnostics");
const skipped = get<HTMLUListElement>("email-skipped");
const sandbox = new Sandbox({ base: "/playground/runtime", version: root.dataset.runtimeVersion! });
const names = new Map<string, string>(emailTestingClients.map(({ id, name }) => [id, name]));
const logos = new Map<string, string>(emailTestingClients.map(({ id, logo }) => [id, logo]));

interface Input { html: string; clients?: string[]; dark?: boolean }
type Report = Pick<Result, "ok" | "diagnostics" | "skipped" | "error" | "ms"> & { previews: Omit<Preview, "html">[] };
let result: Result | undefined;
let report: Report | undefined;
let scripts: PreviewScripts | undefined;
let frame: HTMLIFrameElement | undefined;
let sequence = 0;
let fit = true;
let renderDetails = false;
let preferredPreview = matchMedia("(max-width: 760px)").matches ? "apple-mail.iphone" : "apple-mail";
let focused = false;
const thumbnailResize = new ResizeObserver(() => resizeThumbnails());
let liveTimer: number | undefined;

function invalidate() {
  report = undefined;
  diagnostics.replaceChildren();
  skipped.replaceChildren();
  findings.hidden = true;
  download.disabled = select.disabled = detailsButton.disabled = sizeButton.disabled = true;
  gallery.querySelectorAll<HTMLButtonElement>("button").forEach((button) => { button.disabled = true; });
  error.hidden = true;
  root.dataset.renderStatus = "pending";
  if (result) get("email-preview-note").textContent = "Previous previews · Changes pending";
}

function changed() {
  clearTimeout(liveTimer);
  sequence++;
  sandbox.cancel("email-testing");
  invalidate();
  runButton.disabled = false;
  runButton.textContent = "Update preview ↵";
  root.removeAttribute("aria-busy");
  status.textContent = live.checked ? "Updating preview…" : "Edits waiting · Update preview to check your changes.";
  if (live.checked) liveTimer = window.setTimeout(() => void runUI(), 650);
}

const runUI = () => check({ html: source.value, clients: emailTestingClients.map((client) => client.id), dark: dark.checked });

function label(preview: Preview): string {
  const name = names.get(preview.client) ?? preview.client;
  const device = previewDevice(preview);
  return [name, device, preview.dark ? "Dark" : "Light"].filter(Boolean).join(" · ");
}

function resizeThumbnails() {
  gallery.querySelectorAll<HTMLElement>(".et-thumb-image").forEach((stage) => {
    const iframe = stage.querySelector("iframe");
    if (!iframe || !stage.clientWidth) return;
    const width = Number(stage.dataset.width);
    const scale = Math.min(stage.clientWidth / width, stage.clientHeight / 900);
    iframe.style.width = `${width}px`;
    iframe.style.height = "900px";
    iframe.style.transform = `scale(${scale})`;
    iframe.style.left = `${(stage.clientWidth - width * scale) / 2}px`;
  });
}

function drawThumbnails(previews: Preview[]) {
  thumbnailResize.disconnect();
  gallery.replaceChildren();
  const clients = [...new Set(previews.map((preview) => preview.client))];
  for (const client of clients) {
    const variants = previews.filter((preview) => preview.client === client);
    const preview = variants.find((preview) => preview.dark === dark.checked) ?? variants[0];
    const card = document.createElement("div");
    card.className = "et-thumbnail";
    const stage = document.createElement("div");
    stage.className = "et-thumb-image";
    stage.dataset.width = String(preview.width);
    stage.dataset.preview = preview.id;
    stage.setAttribute("aria-hidden", "true");
    stage.inert = true;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.client = client;
    button.setAttribute("aria-label", `Open ${names.get(client) ?? client} preview`);
    button.setAttribute("aria-controls", "email-viewport");
    const title = document.createElement("span");
    title.className = "et-thumb-name";
    const logo = document.createElement("img");
    logo.className = "et-client-logo";
    logo.src = `/img/email-testing/${logos.get(client)}.svg`;
    logo.alt = "";
    logo.width = logo.height = 24;
    title.append(logo, document.createTextNode(client === "outlook-com" ? "Outlook.com" : names.get(client) ?? client));
    const detail = document.createElement("span");
    detail.className = "et-thumb-meta";
    detail.textContent = [previewDevice(preview), preview.dark ? "Dark" : "Light", preview.approximate ? "Approximate" : ""].filter(Boolean).join(" · ");
    button.append(title, detail);
    button.addEventListener("click", () => {
      focused = true;
      gallery.hidden = true;
      viewport.hidden = controls.hidden = allButton.hidden = false;
      select.value = preview.id;
      showPreview();
      allButton.focus({ preventScroll: true });
    });
    card.append(stage, button);
    gallery.append(card);
    thumbnailResize.observe(stage);
  }
  if (!focused) get("email-view-title").textContent = `Client previews (${clients.length})`;
  resizeThumbnails();
}

/** Only mount thumbnail documents while the overview is visible, so their layout is measured at its real size. */
function mountThumbnails() {
  if (gallery.hidden || !scripts) return;
  gallery.querySelectorAll<HTMLElement>(".et-thumb-image").forEach((stage) => {
    if (stage.querySelector("iframe")) return;
    const preview = result?.previews?.find((preview) => preview.id === stage.dataset.preview);
    if (!preview) return;
    const thumbnail = document.createElement("iframe");
    thumbnail.title = `${label(preview)} thumbnail`;
    thumbnail.tabIndex = -1;
    thumbnail.style.width = `${preview.width}px`;
    thumbnail.style.height = "900px";
    if (previewFile(thumbnail, preview.html, scripts!, { canvas: true })) stage.append(thumbnail);
    else stage.textContent = "Too large to preview here";
  });
  resizeThumbnails();
}

function showAll() {
  focused = false;
  gallery.hidden = false;
  viewport.hidden = controls.hidden = allButton.hidden = true;
  sheet.replaceChildren();
  frame = undefined;
  get("email-view-title").textContent = `Client previews (${gallery.children.length})`;
  get("email-preview-note").textContent = root.dataset.renderStatus === "ok"
    ? `${gallery.children.length} clients · Modeled previews · Click a thumbnail to enlarge`
    : "Previous previews · Changes pending";
  mountThumbnails();
  const client = result?.previews?.find((preview) => preview.id === select.value)?.client;
  [...gallery.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.dataset.client === client)?.focus({ preventScroll: true });
}

function resize() {
  const preview = result?.previews?.find((p) => p.id === select.value);
  if (!preview || !frame) return;
  if (!viewport.clientWidth) return;
  const padding = getComputedStyle(viewport);
  const width = viewport.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
  const height = viewport.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
  const scale = fit ? Math.min(1, width / preview.width) : 1;
  const frameHeight = Math.max(800, height);
  frame.style.width = `${preview.width}px`;
  frame.style.height = `${frameHeight}px`;
  frame.style.transform = `scale(${scale})`;
  sheet.style.width = `${preview.width * scale}px`;
  sheet.style.height = `${frameHeight * scale}px`;
}

function showPreview() {
  const preview = result?.previews?.find((p) => p.id === select.value);
  if (!preview || !scripts) return;
  preferredPreview = preview.id;
  const next = document.createElement("iframe");
  next.title = label(preview);
  error.hidden = true;
  sheet.replaceChildren();
  frame = undefined;
  if (!previewFile(next, preview.html, scripts, { canvas: !renderDetails })) {
    error.textContent = "This preview is too large to display here. Use @hyper-elements/cli to preview this email locally.";
    error.hidden = false;
    return;
  }
  frame = next;
  sheet.append(next);
  get("email-view-title").textContent = names.get(preview.client) ?? preview.client;
  get("email-preview-note").textContent = `${preview.width}px · Modeled preview${preview.approximate ? " · Approximate" : ""}`;
  resize();
}

function showFindings(output: Result) {
  findings.hidden = false;
  get("email-findings-count").textContent = String(output.diagnostics.length);
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
  clearTimeout(liveTimer);
  const run = ++sequence;
  sandbox.cancel("email-testing");
  invalidate();
  try {
    if (!input || typeof input.html !== "string" || !input.html.trim()) throw new Error("Paste a complete HTML email to test.");
    if (new TextEncoder().encode(input.html).length > MAX_EMAIL_BYTES) throw new Error("This playground accepts emails up to 250 KB. Use @hyper-elements/cli for larger files.");
    const clients = input.clients ?? defaultEmailClients;
    if (!Array.isArray(clients) || !clients.length || clients.some((id) => !names.has(id))) throw new Error("Choose at least one supported email client.");
    if (input.dark !== undefined && typeof input.dark !== "boolean") throw new Error("The dark option must be true or false.");
    if (source.value !== input.html) source.value = input.html;
    dark.checked = input.dark === true;
    runButton.disabled = true;
    runButton.textContent = "Updating…";
    root.setAttribute("aria-busy", "true");
    status.textContent = "Generating client previews locally…";
    scripts = await sandbox.previewScripts();
    if (run !== sequence) return { ok: false, diagnostics: [], previews: [], ms: 0, error: { kind: "internal", message: "Superseded by another edit or test." } };
    // Serve the sample's own image from this deployment, including PR previews and localhost.
    // Keep the source/export URL portable. Other hosts in user HTML are left as written.
    const previewHtml = input.html.replaceAll("https://www.hyperelements.dev/img/email-testing/", `${location.origin}/img/email-testing/`);
    const output = await sandbox.run({ kind: "html-previews", html: previewHtml, clients: [...new Set(clients)], dark: input.dark }, ["clients"], "email-testing");
    const summary: Report = {
      ok: output.ok, diagnostics: output.diagnostics, skipped: output.skipped, error: output.error, ms: output.ms,
      previews: (output.previews ?? []).map(({ html: _html, ...metadata }) => metadata),
    };
    if (run !== sequence) return { ...summary, ok: false, error: { kind: "internal", message: "Superseded by another edit or test." } };
    if (!output.ok) throw new Error(output.error?.message ?? "The email could not be checked. Try again.");
    result = output;
    report = summary;
    const previews = output.previews ?? [];
    select.replaceChildren();
    for (const preview of previews) select.add(new Option(label(preview), preview.id));
    select.disabled = !previews.length;
    if (previews.some((preview) => preview.id === preferredPreview)) select.value = preferredPreview;
    drawThumbnails(previews);
    gallery.hidden = focused || !previews.length;
    viewport.hidden = !focused || !previews.length;
    controls.hidden = allButton.hidden = !focused;
    empty.hidden = !!previews.length;
    sizeButton.disabled = detailsButton.disabled = !previews.length;
    download.disabled = false;
    if (focused) showPreview();
    else {
      mountThumbnails();
      get("email-preview-note").textContent = `${new Set(previews.map((preview) => preview.client)).size} clients · Modeled previews · Click a thumbnail to enlarge`;
    }
    showFindings(output);
    root.dataset.renderStatus = "ok";
    status.textContent = `${previews.length} previews generated · ${output.diagnostics.length} compatibility finding${output.diagnostics.length === 1 ? "" : "s"}`;
    return summary;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "The email could not be checked. Try again.";
    if (run === sequence) {
      error.textContent = message;
      error.hidden = false;
      status.textContent = "The check did not complete.";
      root.dataset.renderStatus = "error";
      empty.querySelector("h2")!.textContent = "Ready for your email";
      empty.querySelector("p")!.textContent = "Paste a complete HTML email or load the example.";
      empty.querySelector<HTMLElement>(".et-loading")!.hidden = true;
    }
    return { ok: false, diagnostics: [], previews: [], ms: 0, error: { kind: "runtime", message } };
  } finally {
    if (run === sequence) {
      runButton.disabled = false;
      runButton.textContent = "Update preview ↵";
      root.removeAttribute("aria-busy");
    }
  }
}

runButton.addEventListener("click", () => void runUI());
source.addEventListener("input", changed);
source.addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void runUI(); } });
live.addEventListener("change", () => { clearTimeout(liveTimer); if (live.checked && root.dataset.renderStatus !== "ok") void runUI(); });
dark.addEventListener("change", () => { preferredPreview = preferredPreview.replace(/\.dark$/, "") + (dark.checked ? ".dark" : ""); changed(); });
select.addEventListener("change", showPreview);
allButton.addEventListener("click", showAll);
sizeButton.addEventListener("click", () => { fit = !fit; sizeButton.textContent = fit ? "Actual size" : "Fit to panel"; resize(); });
new ResizeObserver(resize).observe(viewport);
get("email-example").addEventListener("click", () => { source.value = sampleEmail; changed(); void runUI(); });
detailsButton.addEventListener("click", () => { renderDetails = !renderDetails; detailsButton.setAttribute("aria-pressed", String(renderDetails)); detailsButton.textContent = renderDetails ? "Back to email" : "Render details"; showPreview(); });
root.querySelectorAll<HTMLElement>("[data-mobile-tab]").forEach((button) => button.addEventListener("click", () => {
  root.dataset.mobilePane = button.dataset.mobileTab;
  root.querySelectorAll<HTMLElement>("[data-mobile-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab === button)));
}));
function save(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
download.addEventListener("click", () => { if (report) save(JSON.stringify(report, null, 2), "email-compatibility-report.json", "application/json"); });
get("email-export").addEventListener("click", () => save(source.value, "email.html", "text/html"));

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
for (const id of ["email-run", "email-example", "email-export"]) get<HTMLButtonElement>(id).disabled = false;
void runUI();
