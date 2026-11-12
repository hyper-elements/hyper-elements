/**
 * `dev`'s server: `preview --serve`'s (preview/serve.ts, with every guard it has: 127.0.0.1 only, its own Host and
 * Origin, a random path prefix, files from its own folder by real path) with three routes of its own under the prefix:
 *
 * - `""`: the page (page.html), which runs only its own script and can't be framed;
 * - `state.json`: what was rendered, for the page;
 * - `events`: a Server-Sent Events stream saying when that changes.
 *
 * Everything else is a file the parent wrote in its folder: an HTML file or an SVG image (template markup, an `Html`
 * block's script among it) is served as a sandbox of its own (`Content-Security-Policy: sandbox`), so even opened on
 * its own it runs in an origin that isn't the page's; the page shows it in `<iframe sandbox>` without
 * `allow-same-origin` too. The email client previews are the exception (`preview()`, below): they're email-clients'
 * shells, which run none of the email's scripts.
 */
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { relative, sep } from "node:path";
import { serve, type Served } from "../preview/serve";
import page from "./page.html";

/** What an output file may do, opened in the page's frames or on its own: run its scripts and open windows, in an origin of its own. */
export const FILE_SANDBOX = "sandbox allow-scripts allow-popups";

export interface DevServer {
  base: string;
  port: number;
  /** The state the page reads, as JSON text; each change is announced on the event stream. */
  publish(state: unknown): void;
  close(): Promise<void>;
}

const hash = (text: string) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

/** The page's own policy: its one script and one stylesheet (by their hashes), fetches and frames from the server, nothing else. */
function pagePolicy(html: string): string {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => hash(match[1]));
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => hash(match[1]));
  return [
    "default-src 'none'",
    `script-src ${scripts.join(" ")}`,
    `style-src ${styles.join(" ")}`,
    "connect-src 'self'",
    "frame-src 'self'",
    "img-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Whether a file is an email client preview (`<render>/<template>/clients/<id>.html`): email-clients' own shell, which
 * holds the email as data and draws it in frames where no script runs, under a CSP of its own. It reads those frames,
 * which it can't from an origin of its own, so it isn't served as a sandbox.
 */
export function preview(folder: string, file: string): boolean {
  const parts = relative(folder, file).split(sep);
  return parts.length === 4 && parts[2] === "clients" && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]);
}

export async function serveDev(folder: string): Promise<DevServer> {
  let state = "{}";
  let sent = 0;
  const streams = new Set<ServerResponse>();
  const policy = pagePolicy(page);
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const routes = {
    "": (request: IncomingMessage, response: ServerResponse) => {
      response.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": policy, "Referrer-Policy": "no-referrer" });
      response.end(request.method === "HEAD" ? undefined : page);
    },
    "state.json": (request: IncomingMessage, response: ServerResponse) => {
      response.writeHead(200, { ...headers, "Content-Type": "application/json; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : state);
    },
    events: (request: IncomingMessage, response: ServerResponse) => {
      response.writeHead(200, { ...headers, "Content-Type": "text/event-stream; charset=utf-8", Connection: "keep-alive" });
      if (request.method === "HEAD") return response.end();
      response.write(`retry: 1000\ndata: ${sent}\n\n`);
      streams.add(response);
      const forget = () => streams.delete(response);
      request.on("close", forget);
      response.on("close", forget);
    },
  };
  const served: Served = await serve(folder, "127.0.0.1", {
    routes,
    headers: (file): Record<string, string> => (/\.(html?|svg)$/i.test(file) && !preview(folder, file) ? { "Content-Security-Policy": FILE_SANDBOX } : {}),
  });
  // A comment now and then, so a proxy or a browser doesn't close a quiet stream.
  const beat = setInterval(() => {
    for (const stream of streams) stream.write(": \n\n");
  }, 15_000);
  beat.unref();
  return {
    base: served.base,
    port: served.port,
    publish(next) {
      state = JSON.stringify(next);
      sent++;
      for (const stream of streams) stream.write(`data: ${sent}\n\n`);
    },
    async close() {
      clearInterval(beat);
      for (const stream of streams) stream.end();
      await served.close();
    },
  };
}
