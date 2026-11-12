/**
 * `preview --serve`: the preview files served on 127.0.0.1, for a browser that can't open file:// paths. It listens on
 * 127.0.0.1 only, on a free port, and answers only:
 *
 * - a request whose `Host` is `127.0.0.1:<port>`, `localhost:<port>` or `[::1]:<port>` (403 otherwise: a page that
 *   points its own name at 127.0.0.1 can't read it);
 * - with no `Origin`, or its own (403 otherwise);
 * - under a random path prefix, `/<32 hex>/`, which the URLs it prints carry (404 otherwise);
 * - for a file in its folder, by real path, after decoding the path once: `..`, `%2e%2e`, backslashes and symbolic
 *   links out of the folder are refused (403).
 */
import { createReadStream, realpathSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
};

export interface Served {
  /** `http://127.0.0.1:<port>/<prefix>/`. */
  base: string;
  port: number;
  /** The URL of a file in the folder. */
  url(file: string): string;
  close(): Promise<void>;
}

export async function serve(folder: string, host = "127.0.0.1"): Promise<Served> {
  const root = realpathSync(folder);
  const prefix = randomBytes(16).toString("hex");
  let port = 0;
  const end = (response: ServerResponse, status: number, text: string) => {
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(`${text}\n`);
  };
  const handle = (request: IncomingMessage, response: ServerResponse) => {
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
    const asked = (request.headers.host ?? "").toLowerCase();
    if (!hosts.includes(asked)) return end(response, 403, "Forbidden");
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== `http://${asked}`) return end(response, 403, "Forbidden");
    if (request.method !== "GET" && request.method !== "HEAD") return end(response, 405, "Method Not Allowed");
    const raw = (request.url ?? "").split(/[?#]/)[0];
    const start = `/${prefix}/`;
    if (!raw.startsWith(start)) return end(response, 404, "Not Found");
    let path: string;
    try {
      path = decodeURIComponent(raw.slice(start.length));
    } catch {
      return end(response, 400, "Bad Request");
    }
    const parts = path.split("/");
    if (path.includes("\\") || path.includes("\0") || isAbsolute(path) || parts.some((part) => part === ".." || part === ".")) return end(response, 403, "Forbidden");
    const target = resolve(root, ...parts);
    let real: string;
    try {
      real = realpathSync(target);
    } catch {
      return end(response, 404, "Not Found");
    }
    const inside = relative(root, real);
    if (!inside || inside.startsWith(`..${sep}`) || inside === ".." || isAbsolute(inside)) return end(response, 403, "Forbidden");
    let size: number;
    try {
      const stat = statSync(real);
      if (!stat.isFile()) return end(response, 404, "Not Found");
      size = stat.size;
    } catch {
      return end(response, 404, "Not Found");
    }
    response.writeHead(200, {
      "Content-Type": TYPES[extname(real).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") return response.end();
    createReadStream(real).on("error", () => response.destroy()).pipe(response);
  };
  const server = createServer(handle);
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolvePromise());
  });
  port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/${prefix}/`;
  return {
    base,
    port,
    url: (file) => base + relative(root, realpathOr(file)).split(sep).map(encodeURIComponent).join("/"),
    close: () => new Promise((resolvePromise) => server.close(() => resolvePromise())),
  };
}

function realpathOr(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
