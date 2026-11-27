/**
 * What a tool's fields keep, in a builder (registerTools()): only a value its prop takes. One it doesn't (what its
 * user is still typing, a price below its minimum) stays in the field with why, under it, and the block keeps the value
 * it had, so the canvas draws what the design holds. Its user corrects it, and that's kept and drawn. Each field is
 * checked with its prop's own check (checkValue()), as any editing app checks one.
 *
 * The text field here is registerTools()'s own, for a text and for a number or a length the builder keeps as text: it
 * gives a tool the text as it's typed. The builder's own gives it as HTML where its safeHtml is on ("A&lt;B" for
 * "A<B"), which a tool can't tell from text typed so.
 */
import type { Json, PropSpec } from "@hyper-elements/core";
import { checkValue, type CheckedValue } from "../primitives/properties";

/** A field as the builder's `createWidget()` takes one. `node` is its markup's, once it's in the page. */
export interface Widget {
  render(value: unknown, update: (value: unknown) => void, data?: unknown): string;
  mount(node: HTMLElement | null, value: unknown, update: (value: unknown) => void, data?: unknown): void;
  schema?: unknown;
}

/** Text as HTML's: no markup. */
export const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const ERROR = "data-elements-field-error";
const RED = "#c5221f";

/** Where a field says why its value isn't kept: under it, hidden while there's nothing to say. */
export const errorLine = `<div ${ERROR} role="alert" style="display:none;margin-top:6px;color:${RED};font-size:12px;line-height:16px"></div>`;

/** Says at a field why what it holds isn't kept (`message`), or that it is (none). */
export function say(node: HTMLElement | null, label: string, message: string | undefined): void {
  const line = node?.querySelector<HTMLElement>(`[${ERROR}]`);
  if (line) {
    line.textContent = message === undefined ? "" : `${label}: ${message}`;
    line.style.display = message === undefined ? "none" : "block";
  }
  const input = node?.querySelector<HTMLInputElement>("input");
  if (input) {
    input.style.borderColor = message === undefined ? "" : RED;
    if (message === undefined) input.removeAttribute("aria-invalid");
    else input.setAttribute("aria-invalid", "true");
  }
}

/** A value a field holds that isn't kept: whose field it is, what it holds, why, and the field's markup. */
export interface Unkept {
  where: string;
  held: unknown;
  message: string;
  node: Node | null;
  /** Given to the block in a moment (its user has left the field): held even once the field's out of the page. */
  pending?: boolean;
}

/**
 * What the fields in the page hold that isn't kept. The block keeps the value it had, so an export now would be of
 * that value, not of what its user sees in the field: registerTools()'s exports fail while there's one. A field that
 * isn't in the page any more (its block's fields closed, another block's open) holds nothing.
 */
const unkept = new Map<object, Unkept>();

/** A field (`field`, any object it's known by) as holding a value that isn't kept (`one`), or (none) as holding none. */
export function holdUnkept(field: object, one?: Unkept): void {
  if (one) unkept.set(field, one);
  else unkept.delete(field);
}

/** Each value a field in the page holds that isn't kept, said ("Product's Price holds -5, which isn't kept (…)"). */
export function unkeptValues(): string[] {
  const said: string[] = [];
  for (const [field, one] of unkept) {
    if (!one.node?.isConnected && !one.pending) unkept.delete(field);
    else said.push(`${one.where} holds ${typeof one.held === "number" ? String(one.held) : JSON.stringify(one.held)}, which isn't kept (${one.message})`);
  }
  return said;
}

/** How long a field waits, once its user stops typing, to keep a value its prop takes, and to say why it isn't one. */
const KEEP_AFTER = 250;
const SAY_AFTER = 700;
/** How soon after a value is kept from what its user typed the builder draws its field again, at most. */
const RESTORE_WITHIN = 1000;

/** What a text field knows of the input it's mounted on: the builder's latest `update`, and what's waiting to happen. */
interface Typing {
  update: (value: unknown) => void;
  kept: string;
  timer?: ReturnType<typeof setTimeout>;
  /** Whether its user is composing (an input method's text, not yet chosen): nothing's kept till they're done. */
  composing?: boolean;
}

/** Where its user was in a field as what they typed was kept: the text, and the caret (or what's selected), and when. */
interface Typed {
  at: number;
  kept: string;
  text: string;
  start: number | null;
  end: number | null;
}

/**
 * registerTools()'s text field for a prop (`spec`) of a tool (`owner`, its label), labelled `label`: what's typed is
 * kept as `store` gives it, once it checks, and the value is set where it's mounted, unless its user is at it. The builder draws a field again once
 * its value changes, in a new input, so the one its user was typing in is gone: what they had there (the text, the
 * caret) is put back in the new one, focused, and they type on.
 */
export function textField(spec: PropSpec, label: string, owner: string, store: (value: Json) => string = String): Widget {
  const typing = new WeakMap<HTMLInputElement, Typing>();
  const check = (held: string): CheckedValue => checkValue(spec, held);
  const where = `${owner}'s ${label}`;
  // What the field holds, checked, and so whether it holds a value that isn't kept (unkeptValues()): one its prop
  // doesn't take, or one it does that's waiting to be kept, as its user may still be typing.
  const holding = (input: HTMLInputElement, state: Typing): CheckedValue => {
    const checked = check(input.value);
    if (!checked.ok) unkept.set(input, { where, held: input.value, message: checked.message, node: input });
    else if ((checked.value === undefined ? "" : store(checked.value)) !== state.kept) unkept.set(input, { where, held: input.value, message: "it's being typed", node: input });
    else unkept.delete(input);
    return checked;
  };
  // One block's fields are open at a time: what its user had where a value was last kept from what they typed.
  let typed: Typed | undefined;
  const keep = (input: HTMLInputElement, state: Typing) => {
    const checked = check(input.value);
    if (!checked.ok) return;
    const kept = checked.value === undefined ? "" : store(checked.value);
    unkept.delete(input);
    if (kept === state.kept) return;
    state.kept = kept;
    typed = input.ownerDocument.activeElement === input ? { at: Date.now(), kept, text: input.value, start: input.selectionStart, end: input.selectionEnd } : undefined;
    state.update(kept);
  };
  return {
    schema: spec.kind.editor === "text" ? spec.kind.jsonSchema() : { type: "string" },
    render: () =>
      `<div class="blockbuilder-widget blockbuilder-text-widget row"><div class="col-12">` +
      `<div class="blockbuilder-widget-label"><label class="blockbuilder-label-primary">${escape(label)}</label></div>` +
      `<input type="text" aria-label="${escape(label)}" spellcheck="false" style="width:100%;box-sizing:border-box;height:36px;padding:0 12px;border:1px solid #d6d9de;border-radius:4px;font:inherit;font-size:14px;color:inherit;background:#fff" />` +
      errorLine +
      `</div></div>`,
    mount(node, value, update) {
      const input = node?.querySelector<HTMLInputElement>("input");
      if (!node || !input) return;
      const shown = value === undefined || value === null ? "" : String(value);
      let state = typing.get(input);
      if (!state) {
        const fresh: Typing = { update, kept: shown };
        state = fresh;
        typing.set(input, fresh);
        const heard = () => {
          clearTimeout(fresh.timer);
          const checked = holding(input, fresh);
          // Said only once its user pauses: on the way to "12px", "12p" isn't wrong yet.
          if (checked.ok) {
            say(node, label, undefined);
            fresh.timer = setTimeout(() => keep(input, fresh), KEEP_AFTER);
          } else fresh.timer = setTimeout(() => say(node, label, checked.message), SAY_AFTER);
        };
        // What an input method is composing isn't typed yet: kept, the builder would draw the field again in a new
        // input, and the composition would go on in that one, after the text it has ("a", then "ab": "aab"). It's
        // held (an export fails) and waits till its user is done.
        input.addEventListener("compositionstart", () => {
          fresh.composing = true;
          clearTimeout(fresh.timer);
          holding(input, fresh);
        });
        input.addEventListener("compositionend", () => {
          fresh.composing = false;
          heard();
        });
        input.addEventListener("input", (event) => {
          if (fresh.composing || (event as InputEvent).isComposing) {
            clearTimeout(fresh.timer);
            holding(input, fresh);
          } else heard();
        });
        // Left, or Enter: kept now, or said now.
        input.addEventListener("change", () => {
          if (fresh.composing) return;
          clearTimeout(fresh.timer);
          const checked = holding(input, fresh);
          say(node, label, checked.ok ? undefined : checked.message);
          keep(input, fresh);
        });
      }
      state.update = update;
      // The value the block has now came from what its user is typing: the field stays as they have it.
      if (input.ownerDocument.activeElement === input) {
        typed = undefined;
        return;
      }
      clearTimeout(state.timer);
      state.kept = shown;
      unkept.delete(input);
      // Drawn again in a new input with the value just kept from what its user typed: back where they were.
      const back = typed;
      typed = undefined;
      // As the builder draws it again right after the value is kept: a field mounted later, for another block with the
      // same value maybe, isn't where they were.
      if (back && back.kept === shown && Date.now() - back.at < RESTORE_WITHIN && input.isConnected) {
        input.value = back.text;
        input.focus();
        input.setSelectionRange(back.start ?? back.text.length, back.end ?? back.text.length);
        const checked = check(back.text);
        say(node, label, checked.ok ? undefined : checked.message);
        return;
      }
      input.value = shown;
      // A value a design was saved with that its prop doesn't take is shown with why, to be corrected.
      const checked = check(shown);
      say(node, label, checked.ok ? undefined : checked.message);
    },
  };
}

/**
 * A team's own control (`render`, `mount`), checked: given its prop's value only where the prop takes it (none
 * otherwise), and what it gives back kept only where the prop takes it. One it doesn't is said under the control, and
 * the block keeps the value it had. `read` is the value the builder keeps as the prop has it, `store` the other way.
 * `owner` is its tool's label. `schema` is what the builder keeps, for its AI to fill the control by.
 */
export function checkedControl(
  spec: PropSpec,
  label: string,
  owner: string,
  control: { render(value: any, update: (value: any) => void, options: any): string; mount?(node: HTMLElement, value: any, update: (value: any) => void, options: any): void },
  options: unknown,
  read: (kept: unknown) => unknown,
  store: (value: Json) => unknown,
  schema?: unknown
): Widget {
  // The control's markup in the page, where it says why: one at a time is open in the builder's panel.
  let shown: HTMLElement | null = null;
  const checked = (kept: unknown) => (kept === undefined || kept === null ? ({ ok: true, value: undefined } as const) : checkValue(spec, read(kept)));
  const given = (kept: unknown) => {
    const one = checked(kept);
    return one.ok ? one.value : undefined;
  };
  // This control, as a field holding a value that isn't kept (unkeptValues()).
  const field = {};
  const updating = (keep: (value: unknown) => void) => (next: unknown) => {
    const one = checkValue(spec, next);
    if (!one.ok) {
      unkept.set(field, { where: `${owner}'s ${label}`, held: next, message: one.message, node: shown });
      return say(shown, label, one.message);
    }
    unkept.delete(field);
    say(shown, label, undefined);
    keep(one.value === undefined ? one.value : store(one.value));
  };
  return {
    ...(schema === undefined ? {} : { schema }),
    render: (kept, keep) => control.render(given(kept), updating(keep), options) + errorLine,
    mount(node, kept, keep) {
      shown = node;
      unkept.delete(field);
      control.mount?.(node as HTMLElement, given(kept), updating(keep), options);
      const one = checked(kept);
      say(node, label, one.ok ? undefined : one.message);
    },
  };
}
