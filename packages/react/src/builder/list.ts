/**
 * registerTools()'s field for a prop that's a list (`prop.list()`), an object (`prop.object()`) or a list of blocks
 * (`prop.blocks()`), which none of the builder's editors holds. Each item is a box with a field for each of its parts,
 * which can be moved up or down or removed, and `+ Add` adds one.
 *
 * The builder draws a field again each time its value changes, so the field keeps what its user is doing itself (the
 * items, each known by an id of its own, and what's typed) and gives the builder a value only when it's done: a text
 * once its user leaves it or presses Enter, a choice or a box ticked at once, and an item added, moved or removed at
 * once. Its value is kept only where its prop takes it, as any field's (field.ts): one it doesn't stays in the field
 * with why under it, saying which item and which part, and the block keeps the value it had. An export fails
 * meanwhile, as it does while any field holds a value that isn't kept.
 *
 * An item's parts are drawn by the field itself, since one of the builder's editors can't be drawn inside another: a
 * text, a number, a length, a color, a link, an image, a date or a font is typed, a choice or a font weight picked, and
 * a yes or no ticked. A part saved with more than a field shows (a link's target, an image's size) keeps it till its
 * user types another.
 */
import type { Json, PropSpec } from "@hyper-elements/core";
import { checkValue } from "../primitives/properties";
import { errorLine, escape, holdUnkept, say, type Widget } from "./field";

/** A prop that's a list, an object or a list of blocks, with what it's made of, as `prop`'s helpers keep it. */
export type Composed = PropSpec & { item?: PropSpec; fields?: Record<string, PropSpec>; blocks?: Record<string, PropSpec> };

/** Whether a prop is one this field edits: a list, an object or a list of blocks. */
export const composed = (spec: PropSpec): spec is Composed => {
  const one = spec as Composed;
  return spec.kind.editor === "items" && (one.item !== undefined || one.fields !== undefined || one.blocks !== undefined);
};

/** A part of an item, as its field holds it: what's typed or picked, and the value it was saved with till it's edited. */
interface Leaf {
  t: "leaf";
  spec: PropSpec;
  held: string | boolean;
  edited: boolean;
  saved: unknown;
}
/** An object: a part for each of its fields. */
interface Fields {
  t: "object";
  spec: Composed;
  fields: Record<string, Draft>;
  saved: unknown;
}
/** An item of a list, known by an id that stays its own when items are added, moved or removed. */
interface Row {
  id: string;
  /** A block's type, in a list of blocks. */
  type?: string;
  item: Draft;
  /** A block saved with a type its list doesn't have: kept as it is, to be moved or removed. */
  unknown?: unknown;
}
/** A list, or a list of blocks. */
interface Rows {
  t: "list" | "blocks";
  spec: Composed;
  rows: Row[];
  /** The value it was saved with: none (left out of its object) stays none till an item's added. */
  saved: unknown;
}
type Draft = Leaf | Fields | Rows;

/** A field's name as a step of a path ("/i3/question"): encoded, so a name with a "/" is one step. */
const step = (key: string) => encodeURIComponent(key);

let ids = 0;
const nextId = () => `i${++ids}`;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The values a part is picked from, where it's one of a few (a choice, a text with an enum, a font weight). */
function choicesOf(spec: PropSpec): Json[] | undefined {
  if (spec.kind.editor === "fontWeight") return [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const listed = (spec.kind.jsonSchema() as { enum?: Json[] }).enum;
  return spec.kind.editor === "choice" || listed ? (listed ?? []) : undefined;
}

/** What a part's field shows for a value: its text, a link's address, an image's. */
function shown(spec: PropSpec, value: unknown): string | boolean {
  if (spec.kind.editor === "toggle") return value === true;
  const choices = choicesOf(spec);
  if (choices) {
    const at = choices.findIndex((choice) => String(choice) === String(value));
    return at < 0 ? "" : String(at);
  }
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (isObject(value) && typeof value.href === "string") return value.href;
  if (isObject(value) && typeof value.src === "string") return value.src;
  return JSON.stringify(value);
}

/** The field's own copy of a value of a prop (`spec`), for its user to edit. */
function draftOf(spec: PropSpec, value: unknown): Draft {
  const one = spec as Composed;
  if (composed(spec) && one.item) {
    return { t: "list", spec: one, rows: (Array.isArray(value) ? value : []).map((item) => ({ id: nextId(), item: draftOf(one.item as PropSpec, item) })), saved: value };
  }
  if (composed(spec) && one.blocks) {
    const types = one.blocks;
    const rows = (Array.isArray(value) ? value : []).map((item): Row => {
      const { type, ...rest } = isObject(item) ? item : ({} as Record<string, unknown>);
      if (typeof type !== "string" || !Object.hasOwn(types, type)) return { id: nextId(), item: draftOf(Object.values(types)[0], undefined), unknown: item };
      return { id: nextId(), type, item: draftOf(types[type], rest) };
    });
    return { t: "blocks", spec: one, rows, saved: value };
  }
  if (composed(spec) && one.fields) {
    const saved = isObject(value) ? value : {};
    // A part not saved is at its default, as its object's kind fills it in.
    return { t: "object", spec: one, fields: Object.fromEntries(Object.entries(one.fields).map(([key, field]) => [key, draftOf(field, saved[key] ?? field.default)])), saved: value };
  }
  return { t: "leaf", spec, held: shown(spec, value), edited: false, saved: value };
}

/** A new item of a list (`spec`, the list's item or a block's type): each part at its default, or empty. */
const fresh = (spec: PropSpec): Draft => draftOf(spec, spec.default);

type Valued = { ok: true; value: Json | undefined } | { ok: false; message: string; path: string; held: unknown };

/** Whether its user has changed nothing in a part: no text typed, no box ticked, no item added. */
function pristine(draft: Draft): boolean {
  if (draft.t === "leaf") return !draft.edited;
  if (draft.t === "object") return Object.values(draft.fields).every(pristine);
  return draft.saved === undefined && !draft.rows.length;
}

/**
 * The value a part holds, as its prop has it, or why it isn't one, saying where (`where`: "item 2, Answer"). `item`: it's
 * an item of a list, which is something even with none of its parts given.
 */
function valueOf(draft: Draft, path: string, where: string[], item = false): Valued {
  const at = (message: string) => (where.length ? `${where.join(", ")}: ${message}` : message);
  if (draft.t === "leaf") {
    if (!draft.edited) {
      // As it was saved: checked by its own prop, so one it doesn't take is said at its part.
      if (draft.saved === undefined) return { ok: true, value: undefined };
      const saved = checkValue(draft.spec, draft.saved);
      return saved.ok ? { ok: true, value: draft.saved as Json } : { ok: false, message: at(saved.message), path, held: draft.saved };
    }
    const choices = choicesOf(draft.spec);
    const held = choices ? (draft.held === "" ? undefined : choices[Number(draft.held)]) : draft.held;
    const checked = checkValue(draft.spec, held);
    return checked.ok ? checked : { ok: false, message: at(checked.message), path, held };
  }
  if (draft.t === "object") {
    // An object left out of its own, with nothing done in it, stays out: its parts aren't needed.
    if (draft.saved === undefined && !item && pristine(draft)) return { ok: true, value: undefined };
    const out: Record<string, Json> = {};
    for (const [key, field] of Object.entries(draft.fields)) {
      const spec = draft.spec.fields?.[key];
      const name = spec?.label ?? key;
      const one = valueOf(field, `${path}/${step(key)}`, [...where, name]);
      if (!one.ok) return one;
      // A part its object needs, left empty: said at that part, by its name.
      if (one.value === undefined && spec?.required && spec.default === undefined) return { ok: false, message: `${[...where, name].join(", ")}: is needed`, path: `${path}/${step(key)}`, held: undefined };
      if (one.value !== undefined) out[key] = one.value;
    }
    return { ok: true, value: item || Object.keys(out).length || draft.saved !== undefined ? out : undefined };
  }
  // A list left out of its object, with no item added, stays out: it isn't an empty one.
  if (!draft.rows.length && draft.saved === undefined && !item) return { ok: true, value: undefined };
  const out: Json[] = [];
  for (const [index, row] of draft.rows.entries()) {
    if (row.unknown !== undefined) {
      out.push(row.unknown as Json);
      continue;
    }
    const name = `${draft.t === "blocks" ? "block" : "item"} ${index + 1}`;
    const one = valueOf(row.item, `${path}/${row.id}`, [...where, name], true);
    if (!one.ok) return one;
    // An item a list has is something: one of its parts left empty is needed there.
    if (one.value === undefined) return { ok: false, message: `${[...where, name].join(", ")}: is needed`, path: `${path}/${row.id}`, held: undefined };
    out.push(draft.t === "blocks" ? { type: row.type as string, ...(isObject(one.value) ? one.value : {}) } : (one.value ?? null));
  }
  return { ok: true, value: out };
}

/**
 * The draft as the value its prop keeps (`value`, parsed: a part left empty is at its default there): each part that
 * holds something else is set to it. Whether one was.
 */
function sync(draft: Draft, value: unknown): boolean {
  if (draft.t === "leaf") {
    // What's kept is what it was saved with from now on (a box ticked, then not, is false, not left out); what it shows
    // changes only where the kept value isn't what it holds (a part left empty at its default).
    const now = valueOf(draft, "", []);
    const same = now.ok && JSON.stringify(now.value) === JSON.stringify(value);
    draft.saved = value;
    draft.edited = false;
    if (same || value === undefined) return false;
    draft.held = shown(draft.spec, value);
    return true;
  }
  let changed = false;
  if (draft.t === "object") {
    const given = isObject(value) ? value : {};
    for (const [key, field] of Object.entries(draft.fields)) changed = sync(field, given[key]) || changed;
  } else {
    const items = Array.isArray(value) ? value : [];
    draft.rows.forEach((row, index) => {
      if (row.unknown !== undefined) return;
      const item = items[index];
      const parts = draft.t === "blocks" && isObject(item) ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== "type")) : item;
      changed = sync(row.item, parts) || changed;
    });
  }
  draft.saved = value;
  return changed;
}

/** The part of a draft at a path ("/i3/question"), and the list it's an item of, where it's one. */
function find(draft: Draft, path: string): { draft: Draft; list?: Rows; row?: Row } | undefined {
  let here: Draft = draft;
  let list: Rows | undefined;
  let row: Row | undefined;
  for (const one of path.split("/").filter(Boolean)) {
    const step = decodeURIComponent(one);
    if (here.t === "object") {
      const next: Draft | undefined = Object.hasOwn(here.fields, step) ? here.fields[step] : undefined;
      if (!next) return undefined;
      here = next;
      list = undefined;
      row = undefined;
    } else if (here.t === "list" || here.t === "blocks") {
      const found: Row | undefined = here.rows.find((one) => one.id === step);
      if (!found) return undefined;
      list = here;
      row = found;
      here = found.item;
    } else return undefined;
  }
  return { draft: here, list, row };
}

const BOX = "border:1px solid #e2e4e8;border-radius:4px;padding:8px 10px 10px;margin:0 0 8px;background:#fff";
const BUTTON = "border:1px solid #d6d9de;background:#fff;border-radius:4px;height:26px;min-width:26px;padding:0 6px;font:inherit;font-size:13px;line-height:1;color:inherit;cursor:pointer";
const INPUT = "width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:1px solid #d6d9de;border-radius:4px;font:inherit;font-size:13px;color:inherit;background:#fff";
const LABEL = "display:block;margin:8px 0 4px;font-size:12px";
const attr = (name: string, value: string) => ` ${name}="${escape(value)}"`;

/** A part's field: a box to tick, a choice to pick, or a text to type. `named` says which part, for a screen reader. */
function leafMarkup(leaf: Leaf, path: string, label: string, named: string): string {
  // One that isn't editable (an item's, in a list of them) is shown as it is, and can't be changed.
  const fixed = leaf.spec.editable === false;
  if (leaf.spec.kind.editor === "toggle") {
    return `<label style="display:flex;gap:8px;align-items:center;margin:8px 0 0;font-size:12px"><input type="checkbox"${attr("data-path", path)}${attr("aria-label", named)}${leaf.held === true ? " checked" : ""}${fixed ? " disabled" : ""} />${escape(label)}</label>`;
  }
  const choices = choicesOf(leaf.spec);
  const head = `<label style="${LABEL}">${escape(label)}</label>`;
  if (choices) {
    const options = [`<option value=""></option>`, ...choices.map((choice, index) => `<option value="${index}"${String(index) === leaf.held ? " selected" : ""}>${escape(String(choice))}</option>`)];
    return `${head}<select${attr("data-path", path)}${attr("aria-label", named)}${fixed ? " disabled" : ""} style="${INPUT}">${options.join("")}</select>`;
  }
  return `${head}<input type="text" spellcheck="false"${attr("data-path", path)}${attr("aria-label", named)}${attr("value", String(leaf.held))}${fixed ? ' readonly aria-readonly="true"' : ""} style="${INPUT}" />`;
}

/** A draft's fields, each at its path, its parts named for a screen reader from `named` ("Questions, item 2"). */
function markup(draft: Draft, path: string, named: string, label: string, root = false): string {
  if (draft.t === "leaf") return leafMarkup(draft, path, label, named);
  if (draft.t === "object") {
    // A part that isn't editable isn't drawn: it keeps its value.
    const parts = Object.entries(draft.fields)
      .filter(([key]) => draft.spec.fields?.[key]?.editable !== false)
      .map(([key, field]) => {
        const name = draft.spec.fields?.[key]?.label ?? key;
        return markup(field, `${path}/${step(key)}`, `${named}, ${name}`, name);
      })
      .join("");
    return root ? parts : `<fieldset style="${BOX}"><legend style="font-size:12px;padding:0 4px">${escape(label)}</legend>${parts}</fieldset>`;
  }
  const noun = draft.t === "blocks" ? "block" : "item";
  const types = draft.t === "blocks" ? Object.keys(draft.spec.blocks ?? {}) : [];
  const rows = draft.rows
    .map((row, index) => {
      const at = `${path}/${row.id}`;
      const name = `${named}, ${noun} ${index + 1}`;
      const button = (act: string, text: string, what: string, off = false) =>
        `<button type="button"${attr("data-act", act)}${attr("data-path", at)}${attr("aria-label", `${what} ${noun} ${index + 1}`)}${off ? " disabled" : ""} style="${BUTTON}">${text}</button>`;
      const type =
        draft.t === "blocks" && row.unknown === undefined
          ? `<select${attr("data-act", "type")}${attr("data-path", at)}${attr("aria-label", `${name}, type`)} style="${INPUT};width:auto;height:26px">${types
              .map((one) => `<option${attr("value", one)}${one === row.type ? " selected" : ""}>${escape(draft.spec.blocks?.[one]?.label ?? one)}</option>`)
              .join("")}</select>`
          : "";
      const body =
        row.unknown !== undefined
          ? `<div style="margin-top:8px;font-size:12px">${escape(`A block of a type this list doesn't have, kept as it is: ${JSON.stringify(row.unknown)}`)}</div>`
          : markup(row.item, at, name, draft.t === "list" ? (draft.spec.item?.label ?? noun) : "", true);
      return (
        `<div${attr("data-row", at)} style="${BOX}">` +
        `<div style="display:flex;gap:6px;align-items:center"><span style="flex:1;font-size:12px;font-weight:600">${escape(`${noun[0].toUpperCase()}${noun.slice(1)} ${index + 1}`)}</span>${type}` +
        `${button("up", "↑", "Move up", index === 0)}${button("down", "↓", "Move down", index === draft.rows.length - 1)}${button("remove", "✕", "Remove")}</div>` +
        `${body}</div>`
      );
    })
    .join("");
  const max = (draft.spec.kind.jsonSchema() as { maxItems?: number }).maxItems;
  const full = max !== undefined && draft.rows.length >= max;
  const add = `<button type="button"${attr("data-act", "add")}${attr("data-path", path)}${attr("aria-label", `Add ${noun} to ${named}`)}${full ? " disabled" : ""} style="${BUTTON};height:30px;padding:0 10px">+ Add ${noun}</button>`;
  return root ? `${rows}${add}` : `<fieldset style="${BOX}"><legend style="font-size:12px;padding:0 4px">${escape(label)}</legend>${rows}${add}</fieldset>`;
}

/** Where its user was in the field: the part's path, or a button's, and the caret. */
interface Place {
  key: string;
  start?: number | null;
  end?: number | null;
}
const placeOf = (element: Element | null): Place | undefined => {
  const path = element?.getAttribute("data-path");
  if (!element || path === null || path === undefined) return undefined;
  const act = element.getAttribute("data-act");
  const input = element as HTMLInputElement;
  return { key: `${act ?? "part"}:${path}`, ...(input.type === "text" ? { start: input.selectionStart, end: input.selectionEnd } : {}) };
};
const elementAt = (node: HTMLElement, place: Place): HTMLElement | null => {
  const [act, ...rest] = place.key.split(":");
  const path = rest.join(":");
  return [...node.querySelectorAll<HTMLElement>("[data-path]")].find((one) => one.getAttribute("data-path") === path && (one.getAttribute("data-act") ?? "part") === act) ?? null;
};

/** The field one block's prop has open: its copy of the value, the value the block has, and where its user is. */
interface Open {
  kept: string;
  draft: Draft;
  node: HTMLElement | null;
  update?: (value: unknown) => void;
  place?: Place;
  timer?: ReturnType<typeof setTimeout>;
  /** What it holds that isn't kept, and why: what its user is typing, or a value its prop doesn't take. */
  held?: { held: unknown; message: string };
  /** Whether its user has done anything in it yet. */
  touched?: boolean;
}

/**
 * registerTools()'s field for a list, an object or a list of blocks (`spec`) of a tool (`owner`, its label), labelled
 * `label`. Its value is the prop's, as a template has it.
 */
export function listField(spec: Composed, label: string, owner: string): Widget {
  let open: Open | undefined;
  const where = `${owner}'s ${label}`;
  const key = (value: unknown) => JSON.stringify(value ?? null);
  const checked = (draft: Draft): Valued => {
    const one = valueOf(draft, "", []);
    if (!one.ok) return one;
    const whole = checkValue(spec, one.value);
    return whole.ok ? whole : { ok: false, message: whole.message, path: "", held: one.value };
  };
  const inner = (draft: Draft) =>
    `<div class="blockbuilder-widget row" data-elements-list><div class="col-12">` +
    `<div class="blockbuilder-widget-label"><label class="blockbuilder-label-primary">${escape(label)}</label></div>` +
    markup(draft, "", label, label, true) +
    errorLine +
    `</div></div>`;
  // Where its user is now, in the field as it's in the page.
  const here = (): Place | undefined => {
    const active = open?.node?.ownerDocument?.activeElement ?? null;
    return active && open?.node?.contains(active) ? placeOf(active) : undefined;
  };
  // Back where its user was, in the field as it's drawn now.
  const back = (node: HTMLElement, place: Place | undefined) => {
    const element = place ? elementAt(node, place) : null;
    if (!element || !place) return;
    element.focus();
    if (place.start !== undefined && element instanceof HTMLInputElement && element.type === "text") element.setSelectionRange(place.start ?? element.value.length, place.end ?? element.value.length);
  };
  // Says why the value isn't kept, at the part it's about, or that it is.
  const sayAt = (node: HTMLElement | null, problem: Valued | undefined) => {
    say(node, label, problem && !problem.ok ? problem.message : undefined);
    // The part it's about is marked, and only that part, for the eye and for a screen reader.
    for (const one of node?.querySelectorAll<HTMLElement>("[data-path]") ?? []) {
      one.style.borderColor = "";
      one.removeAttribute("aria-invalid");
    }
    if (problem && !problem.ok && problem.path && node) {
      const part = elementAt(node, { key: `part:${problem.path}` });
      if (part) {
        part.style.borderColor = "#c5221f";
        part.setAttribute("aria-invalid", "true");
      }
    }
  };
  const redraw = (place?: Place) => {
    const node = open?.node;
    if (!open || !node) return;
    node.innerHTML = inner(open.draft);
    back(node, place);
  };
  // What the field holds that isn't kept, to its export (unkeptValues()), at the field as it's in the page.
  const hold = (held?: { held: unknown; message: string }, pending = false) => {
    if (!open) return;
    open.held = held;
    // Known by the field as it's open for one block: another block's opening doesn't let it go.
    holdUnkept(open, held ? { where, ...held, node: open.node, pending } : undefined);
  };
  // The field's value to the block, once its prop takes it: the builder draws the field again with it. `structural`:
  // items were added, moved or removed, or a block's type changed, so the field is drawn again here first.
  const keep = (place?: Place, structural = false) => {
    if (!open) return;
    clearTimeout(open.timer);
    open.timer = undefined;
    const at = place ?? here();
    if (structural) redraw(at);
    const one = checked(open.draft);
    if (!one.ok) {
      hold({ held: one.held, message: one.message });
      return sayAt(open.node, one);
    }
    hold();
    // What its prop keeps (a part left empty at its default) is what the field shows.
    if (sync(open.draft, one.value)) redraw(at);
    sayAt(open.node, undefined);
    const next = key(one.value);
    if (next === open.kept) return;
    open.kept = next;
    open.place = at;
    open.update?.(one.value);
  };
  // A text, once its user has left it or pressed Enter: given after their focus has moved, so they're put back where
  // it went once the builder draws the field again.
  const later = () => {
    if (!open) return;
    clearTimeout(open.timer);
    open.timer = undefined;
    // Held till then, even if the field closes meanwhile: an export now would be of the value the block had.
    if (open.held) hold(open.held, true);
    const now = open;
    now.timer = setTimeout(() => {
      now.timer = undefined;
      if (open === now) keep();
      else given(now);
    }, 0);
  };
  // A text its user left as the field was drawn for another block (they clicked it): given to the block it was in
  // (its update is that block's), and let go.
  const given = (was: Open) => {
    const one = checked(was.draft);
    holdUnkept(was);
    if (one.ok && key(one.value) !== was.kept) was.update?.(one.value);
  };
  // The field drawn for another block, or anew: what it held for the last one is let go, unless a text its user left
  // is still to be given (above).
  const close = () => {
    if (open && open.timer === undefined) holdUnkept(open);
  };
  const listen = (node: HTMLElement) => {
    node.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      const path = target.getAttribute("data-path");
      if (!open || path === null || target.type !== "text") return;
      const found = find(open.draft, path);
      if (found?.draft.t !== "leaf") return;
      found.draft.held = target.value;
      // Put back as it was: the value it was saved with (a link's target with it), not the text alone.
      found.draft.edited = target.value !== shown(found.draft.spec, found.draft.saved);
      open.touched = true;
      // Typed, not yet given to the block: an export now would be of the value it had.
      hold({ held: target.value, message: "it's being typed" });
    });
    // Left without a change (typed, then put back as it was): what it holds is the block's again.
    node.addEventListener("focusout", (event) => {
      const target = event.target as HTMLInputElement;
      if (open?.held?.message === "it's being typed" && target.type === "text" && target.hasAttribute("data-path")) later();
    });
    node.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      const path = target.getAttribute("data-path");
      if (!open || path === null) return;
      const act = target.getAttribute("data-act");
      const found = find(open.draft, path);
      open.touched = true;
      if (act === "type" && found?.row && found.list?.t === "blocks") {
        // Another type of block: its parts start again, at that type's defaults.
        found.row.type = target.value;
        found.row.item = fresh(found.list.spec.blocks?.[target.value] as PropSpec);
        return keep(undefined, true);
      }
      if (found?.draft.t !== "leaf") return;
      found.draft.held = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;
      found.draft.edited = found.draft.held !== shown(found.draft.spec, found.draft.saved);
      if (target instanceof HTMLInputElement && target.type === "text") later();
      else keep();
    });
    node.addEventListener("click", (event) => {
      const button = (event.target as Element | null)?.closest?.("button[data-act]");
      const path = button?.getAttribute("data-path");
      if (!open || !button || path === null || path === undefined) return;
      const act = button.getAttribute("data-act");
      open.touched = true;
      if (act === "add") {
        const found = path === "" ? { draft: open.draft } : find(open.draft, path);
        const list = found?.draft;
        if (!list || (list.t !== "list" && list.t !== "blocks")) return;
        const type = list.t === "blocks" ? Object.keys(list.spec.blocks ?? {})[0] : undefined;
        const row: Row = { id: nextId(), ...(type ? { type } : {}), item: fresh((type ? list.spec.blocks?.[type] : list.spec.item) as PropSpec) };
        list.rows.push(row);
        // To the new item's first part, or to its buttons where it has none.
        const first = `${path}/${row.id}`;
        return keep({ key: row.item.t === "leaf" ? `part:${first}` : `remove:${first}` }, true);
      }
      const found = find(open.draft, path);
      if (!found?.list || !found.row) return;
      const rows = found.list.rows;
      const at = rows.indexOf(found.row);
      if (act === "remove") {
        rows.splice(at, 1);
        const after = rows[at] ?? rows[at - 1];
        const listPath = path.slice(0, path.lastIndexOf("/"));
        return keep(after ? { key: `remove:${listPath}/${after.id}` } : { key: `add:${listPath}` }, true);
      }
      const to = act === "up" ? at - 1 : at + 1;
      if (to < 0 || to >= rows.length) return;
      [rows[at], rows[to]] = [rows[to], rows[at]];
      // The same button of the item moved: its path is its own, wherever it is now.
      const off = (act === "up" && to === 0) || (act === "down" && to === rows.length - 1);
      return keep({ key: `${off ? (act === "up" ? "down" : "up") : act}:${path}` }, true);
    });
  };
  const listened = new WeakSet<HTMLElement>();
  return {
    schema: spec.kind.jsonSchema(),
    render(value) {
      const now = key(value);
      // The value the block has came from this field: drawn as its user has it, the items known by their ids.
      if (open && open.kept === now) {
        open.place = open.place ?? here();
        return inner(open.draft);
      }
      close();
      open = { kept: now, draft: draftOf(spec, value), node: null };
      return inner(open.draft);
    },
    mount(node, value, update) {
      if (!node) return;
      // A field drawn somewhere else (the block's fields closed and opened again, another block's with the same value):
      // what its user did in the other isn't this one's.
      if (!open || open.kept !== key(value) || (open.node && open.node !== node)) {
        close();
        open = { kept: key(value), draft: draftOf(spec, value), node: null };
        node.innerHTML = inner(open.draft);
      }
      open.node = node;
      open.update = update;
      if (!listened.has(node)) {
        listened.add(node);
        listen(node);
      }
      const place = open.place;
      open.place = undefined;
      back(node, place);
      // What it holds that isn't kept, at the field as it's in the page now.
      if (open.held) hold(open.held);
      // Why what it holds isn't a value its prop takes: what its user did, or a value a design was saved with, shown to
      // be corrected. One saved with what its field has no part for (an object's field its prop doesn't have) is said
      // too, till its user edits it, which leaves that out.
      const one = checked(open.draft);
      const saved = one.ok && !open.touched ? checkValue(spec, value === null ? undefined : value) : undefined;
      sayAt(node, !one.ok ? one : saved && !saved.ok ? { ok: false, message: saved.message, path: "", held: value } : undefined);
    },
  };
}
