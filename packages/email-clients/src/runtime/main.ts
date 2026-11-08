/**
 * The runtime a preview file carries (built into one script by scripts/build-runtime.mjs). It reads the email and its
 * config from the file's JSON blocks, makes the client's version (clients.ts), shows it in a sandboxed frame at the
 * client's width, runs the client's step on the loaded frame, and says when it's done: `data-email-client-ready` on the
 * shell's <html> is "ok", or "error" with the error in the findings. It never runs code inside the frame.
 */
import type { BlockMap } from "@hyper-elements/react";
import { scriptJson } from "../shell";
import { processForClient, type Client } from "./clients";

interface Config {
  id: string;
  client: Client;
  name: string;
  variant: "desktop" | "phone";
  dark: boolean;
  width: number;
  approximate: boolean;
  blocks: BlockMap;
  fontOrigin: string | null;
}

const json = <T>(id: string): T => JSON.parse(document.getElementById(id)!.textContent!) as T;

/** A sandboxed frame (no scripts, forms, popups or navigation) of `width`, showing `html`, once it has loaded. */
function frame(html: string, width: number, title: string): Promise<HTMLIFrameElement> {
  const el = document.createElement("iframe");
  el.setAttribute("sandbox", "allow-same-origin");
  el.setAttribute("title", title);
  el.style.width = `${width}px`;
  el.style.height = "0";
  const loaded = new Promise<HTMLIFrameElement>((resolve) => el.addEventListener("load", () => resolve(el), { once: true }));
  el.srcdoc = html;
  document.getElementById("frames")!.append(el);
  return loaded;
}

/** The frame as tall as what it shows. */
function grow(el: HTMLIFrameElement): void {
  const doc = el.contentDocument!;
  el.style.height = `${Math.ceil(Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0))}px`;
}

function writeFindings(findings: Record<string, unknown>): void {
  const script = document.createElement("script");
  script.type = "application/json";
  script.id = "email-client-findings";
  script.textContent = scriptJson(findings);
  document.body.append(script);
}

async function main(): Promise<void> {
  const root = document.documentElement;
  const config = json<Config>("email-client-config");
  const findings: Record<string, unknown> = { version: 1, client: config.client, variant: config.variant, dark: config.dark, width: config.width, approximate: config.approximate, error: null };
  try {
    const html = json<string>("email");
    const processed = processForClient(config.client, html, config.blocks.entries, { dark: config.dark });
    const shown = await frame(processed.html, config.width, `${config.name}: the email as it draws`);
    processed.frameStep(shown.contentWindow!);
    grow(shown);
    findings.removed = Object.entries(processed.removed).map(([what, count]) => ({ what, count }));
    findings.ready = "ok";
  } catch (error) {
    findings.ready = "error";
    findings.error = error instanceof Error ? error.message : String(error);
  }
  writeFindings(findings);
  root.setAttribute("data-email-client-ready", String(findings.ready));
}

void main();
