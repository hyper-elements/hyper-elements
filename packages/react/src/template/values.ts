/**
 * A template's values: read strictly by its fields' kinds (an unknown field, a missing one, a list's count, an image's
 * declared size against its rules), changed with `update()` (what isn't named keeps its reference), and stored as a
 * values file (the template's reference and version, the values, and each asset's hash and provenance beside them).
 */
import type { Diagnostic, PropSpec, PropSpecs } from "@hyper-elements/core";
import { imageRules, isBlocks, isList, isObjectSpec, type ImageRules, type ImageType } from "./fields";
import { isSlot, isStoredSlot } from "./slots";

/** A value a template's component was given that isn't plain data (a function, a class instance): never read. */
export class Unowned {
  constructor(readonly what: string) {}
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * A value copied as plain data, each getter read once (a Proxy too: what it gives on this read is the value). What
 * isn't plain data is an `Unowned` in its place, which reading reports. React elements stay what they are.
 */
export function own(value: unknown, isElement: (value: unknown) => boolean): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : new Unowned(String(value));
  if (value === undefined) return undefined;
  if (isElement(value)) return value;
  if (Array.isArray(value)) return Array.from(value, (item) => own(item, isElement));
  if (isPlainObject(value) || (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const item = own((value as Record<string, unknown>)[key], isElement);
      if (item !== undefined) out[key] = item;
    }
    return out;
  }
  return new Unowned(typeof value === "function" ? "a function" : typeof value === "object" ? `a ${(value as object).constructor?.name ?? "class"} instance` : `a ${typeof value}`);
}

interface Reading {
  diagnostics: Diagnostic[];
  /** The template's id and version, for messages. */
  name: string;
  /** Whether a value is JSX (a slot's content, kept as it is). */
  isElement: (value: unknown) => boolean;
}

const error = (code: string, message: string, path: string, fix?: string): Diagnostic => ({ code, severity: "error", message, path, ...(fix ? { fix } : {}) });

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
const countWords = (min?: number, max?: number) =>
  min !== undefined && max !== undefined ? (min === max ? `exactly ${min}` : `${min} to ${max}`) : min !== undefined ? `at least ${min}` : `at most ${max}`;

/** Fields' values read: each given one parsed by its kind, defaults and `[]` for lists filled in, the rest refused. */
export function readValues(fields: PropSpecs, input: unknown, at: string, reading: Reading): Record<string, unknown> | undefined {
  if (input instanceof Unowned) return void reading.diagnostics.push(error("jsx/value", `A value is plain data (text, numbers, lists, objects), not ${input.what}`, at));
  if (!isPlainObject(input)) return void reading.diagnostics.push(error("template/value", `Values are an object of fields, not ${describe(input)}`, at));
  const out: Record<string, unknown> = {};
  const names = Object.keys(fields);
  for (const key of Object.keys(input)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) continue;
    if (input[key] === undefined) continue;
    reading.diagnostics.push(
      error(
        "template/unknown-field",
        `${reading.name} has no field "${key}"${at === "values" ? "" : ` here`} (its fields: ${names.join(", ") || "none"}); what isn't a field is fixed by the template`,
        `${at}.${key}`,
        "change one of its fields, or ask the template's owner for a version that has this one"
      )
    );
  }
  for (const [name, spec] of Object.entries(fields)) {
    const value = readValue(spec, input[name], `${at}.${name}`, reading);
    if (value !== undefined) out[name] = value;
  }
  return out;
}

/** One field's value read, or its default; undefined where it has none (and a required one is reported). */
export function readValue(spec: PropSpec, input: unknown, at: string, reading: Reading): unknown {
  if (input === undefined) {
    if (spec.default !== undefined) return structuredCopy(spec.default);
    if (spec.required) return void reading.diagnostics.push(error("template/required", `${spec.label} is required`, at));
    if (!isList(spec) && !isBlocks(spec)) return undefined;
    input = [];
  }
  if (isSlot(spec)) {
    // JSX (the content, read when the design is built), or its stored form (a module or a captured fragment).
    if (reading.isElement(input) || isStoredSlot(input)) return input;
    return void reading.diagnostics.push(error("template/value", `${spec.label} is JSX (its content, <Column>…</Column>), or stored as { module } or { fragment }`, at));
  }
  if (input instanceof Unowned) return void reading.diagnostics.push(error("jsx/value", `${spec.label} is plain data, not ${input.what}`, at));
  if (isBlocks(spec)) {
    if (!Array.isArray(input)) return void reading.diagnostics.push(error("template/value", `${spec.label} is a list of blocks, not ${describe(input)}`, at));
    const schema = spec.kind.jsonSchema() as { minItems?: number; maxItems?: number };
    const [min, max] = [schema.minItems, schema.maxItems];
    if ((min !== undefined && input.length < min) || (max !== undefined && input.length > max)) {
      reading.diagnostics.push(error("template/count", `${plural(input.length, "block")}; this template takes ${countWords(min, max)}`, at));
    }
    const types = Object.keys(spec.blocks);
    return input.map((item, index) => {
      const where = `${at}[${index}]`;
      const type = isPlainObject(item) ? item.type : undefined;
      if (!isPlainObject(item) || typeof type !== "string" || !Object.prototype.hasOwnProperty.call(spec.blocks, type)) {
        return void reading.diagnostics.push(error("template/value", `A block is { type, … } with type ${types.map((t) => JSON.stringify(t)).join(" or ")}, not ${isPlainObject(item) ? JSON.stringify(type) : describe(item)}`, where));
      }
      const { type: _, ...rest } = item;
      const read = readValues(spec.blocks[type].fields, rest, where, reading);
      return read && { type, ...read };
    });
  }
  if (isList(spec)) {
    if (!Array.isArray(input)) return void reading.diagnostics.push(error("template/value", `${spec.label} is a list, not ${describe(input)}`, at));
    const schema = spec.kind.jsonSchema() as { minItems?: number; maxItems?: number };
    const [min, max] = [schema.minItems, schema.maxItems];
    if ((min !== undefined && input.length < min) || (max !== undefined && input.length > max)) {
      reading.diagnostics.push(error("template/count", `${plural(input.length, "item")}; this template takes ${countWords(min, max)}`, at));
    }
    return input.map((item, index) => readValue(spec.item, item, `${at}[${index}]`, reading));
  }
  if (isObjectSpec(spec)) return readValues(spec.fields, input, at, reading);
  // Required text given blank is required text not given: an empty cell of a spreadsheet, a field left as spaces.
  if (spec.required && spec.kind.name === "text" && typeof input === "string" && input.trim() === "") {
    return void reading.diagnostics.push(error("template/required", `${spec.label} is required: it's empty`, at));
  }
  const parsed = spec.kind.parse(input);
  if (!parsed.ok) return void reading.diagnostics.push(error("template/value", `${spec.label}: ${parsed.message}`, at));
  const rules = imageRules(spec);
  if (rules) return readImage(parsed.value, rules, spec.label, at, reading);
  return parsed.value;
}

/** An image field's value: `{ src, width, height }`, its declared size checked against the template's rules. */
function readImage(value: unknown, rules: ImageRules, label: string, at: string, reading: Reading): unknown {
  const image = value as { src?: string; width?: number; height?: number };
  if (typeof value === "string" || image.width === undefined || image.height === undefined) {
    reading.diagnostics.push(error("template/value", `${label} is { src, width, height }, the file's size in px: its rules are checked against it`, at));
    return undefined;
  }
  const { width, height, src } = image as { src: string; width: number; height: number };
  const aspect = width / height;
  if (rules.aspect?.min !== undefined && aspect < rules.aspect.min - 1e-9) {
    reading.diagnostics.push(error("template/asset-aspect", `${label} is ${width}×${height}, ${round(aspect)}:1; it takes ${round(rules.aspect.min)}:1 or wider`, at));
  } else if (rules.aspect?.max !== undefined && aspect > rules.aspect.max + 1e-9) {
    reading.diagnostics.push(error("template/asset-aspect", `${label} is ${width}×${height}, ${round(aspect)}:1; it takes ${round(rules.aspect.max)}:1 or narrower`, at));
  }
  if (rules.minWidth !== undefined && width < rules.minWidth) reading.diagnostics.push(error("template/asset-pixels", `${label} is ${width}px wide; it takes at least ${rules.minWidth}px`, at));
  if (rules.minHeight !== undefined && height < rules.minHeight) reading.diagnostics.push(error("template/asset-pixels", `${label} is ${height}px high; it takes at least ${rules.minHeight}px`, at));
  const type = typeOf(src);
  if (rules.accepts && type && !rules.accepts.includes(type)) {
    reading.diagnostics.push(error("template/asset-type", `${label} is ${type === "jpeg" ? "a JPEG" : `an ${type.toUpperCase()}`} file; it takes ${rules.accepts.map((t) => t.toUpperCase()).join(" or ")}`, at));
  }
  // What only the file says isn't decided here, and is never taken as passed: said, until what reads the file decides it.
  const unread = [...(rules.transparent ? ["whether it's transparent"] : []), ...(rules.accepts && !type ? ["its type"] : [])];
  if (unread.length) {
    reading.diagnostics.push({ code: "template/asset-unread", severity: "info", message: `${label}: ${unread.join(" and ")} ${unread.length > 1 ? "are" : "is"} told from its file, which isn't read here: checkLayout() given the file decides it, as the command line does for a file it can read`, path: at });
  }
  return value;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** An image's type from its URL's extension or its data URI's media type, where either says. */
export function typeOf(src: string): ImageType | undefined {
  const data = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml)[;,]/i.exec(src);
  const ext = data?.[1] ?? /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(src)?.[1];
  const named = ext?.toLowerCase();
  return named === "jpg" ? "jpeg" : named === "svg+xml" ? "svg" : (["png", "jpeg", "gif", "svg", "webp"] as const).find((t) => t === named);
}

const describe = (value: unknown) => (value === null ? "null" : Array.isArray(value) ? "a list" : value instanceof Unowned ? value.what : typeof value === "object" ? "an object" : JSON.stringify(value));
const structuredCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ─── update() ───────────────────────────────────────────────────────────────

/** JSON Merge Patch (RFC 7386): an object merged key by key, `null` removing one; anything else replaces. */
export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isPlainObject(patch)) return patch;
  const out: Record<string, unknown> = isPlainObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else if (value !== undefined) out[key] = mergePatch(out[key], value);
  }
  return out;
}

// ─── Versions ───────────────────────────────────────────────────────────────

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export const isVersion = (version: unknown): version is string => typeof version === "string" && SEMVER.test(version);
export const versionParts = (version: string): [number, number, number] => SEMVER.exec(version)!.slice(1, 4).map(Number) as [number, number, number];

/** -1, 0 or 1: `a` older than, the same as, or newer than `b` (their release numbers; a prerelease's tag isn't compared). */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
