// What tools/tap.mjs and tools/tap-og.mjs record: Satori's input as plain JSON. Function components are called (as
// Satori calls them), fragments flattened, image sources shortened, font files reduced to their name, face and format.
import { createHash } from "node:crypto";

const FRAGMENT = Symbol.for("react.fragment");

const bytesOf = (data) => new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data);

function format(data) {
  const b = bytesOf(data);
  const tag = String.fromCharCode(...b.subarray(0, 4));
  if (tag === "wOF2") return "woff2";
  if (tag === "wOFF") return "woff";
  if (tag === "OTTO") return "otf";
  if (tag === "true" || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0)) return "ttf";
  return "unknown";
}

function source(src) {
  if (typeof src === "string") return src.startsWith("data:") ? `${src.slice(0, src.indexOf(",") + 1)}…(${src.length} chars)` : src;
  if (src) return `[${src.byteLength ?? "?"} bytes]`;
  return undefined;
}

function plain(node, depth = 0) {
  if (depth > 200) return null;
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map((n) => plain(n, depth + 1)).flat().filter((n) => n !== null);
  if (typeof node === "object" && "type" in node && "props" in node) {
    const { type, props = {} } = node;
    if (typeof type === "function") return plain(type.prototype?.render ? new type(props).render() : type(props), depth + 1);
    if (type === FRAGMENT || typeof type === "symbol") return plain(props.children, depth + 1);
    const { children, style, tw, src, width, height } = props;
    const kids = plain(children, depth + 1);
    return {
      type,
      ...(style ? { style } : {}),
      ...(tw ? { tw } : {}),
      ...(src !== undefined ? { src: source(src) } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      children: kids === null ? [] : [].concat(kids),
    };
  }
  return null;
}

export function record(engine, element, options) {
  let tree = null;
  let error = null;
  try { tree = plain(element); } catch (e) { error = String(e?.message ?? e); }
  globalThis.__benchTaps?.push({
    engine,
    width: options.width,
    height: options.height,
    fonts: (options.fonts ?? []).map((f) => ({
      name: f.name, weight: f.weight ?? 400, style: f.style ?? "normal",
      format: f.data ? format(f.data) : "none",
      sha256: f.data ? createHash("sha256").update(bytesOf(f.data)).digest("hex") : null,
    })),
    tree,
    ...(error ? { treeError: error } : {}),
  });
}
