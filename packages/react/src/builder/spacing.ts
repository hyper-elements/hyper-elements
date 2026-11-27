/**
 * The space between what a stack holds, on desktops and on phones apart, as Elements draws it: the stack's padding
 * around what shows on a device, and its gap only between children that show there (core's writers/shared/gaps.ts: a
 * child shows where it isn't hidden itself, so a Column whose blocks are all hidden still takes its gaps and padding).
 *
 * The writers put that space in the builder's rows and blocks as if everything showed: a stack's top padding on its
 * first, its gap above each other child, its bottom padding on its last (raise.ts, columns.ts). Each row or block says
 * what it was given (`given`). Here a stack the builder holds as a whole (a Section, the root's content, a column) is
 * spaced again on each device where something in it is hidden, from its template: each row or block holds its own space
 * and what comes to it there, and where that isn't the same on desktops and phones, a phone padding says so (a block's
 * `containerPadding`, a row's or a column's `padding`, in `_override.mobile`, which the builder has for each and
 * `fromDesign()` reads back). A device where nothing in the stack is hidden keeps what the writers wrote.
 */
import type { Node, ResolvedNode } from "@hyper-elements/core";
import { gapOf, padding, ZERO, type Child, type Sides } from "./columns";
import type { Block, Column, Row } from "./design";
import { sides, type Values } from "./read-values";
import { cssSides } from "./values";

/** What a row or a block was given by the stack it's in: the template node it's drawn for, and the space put above and below it. */
export interface Given {
  path: string;
  top: number;
  bottom: number;
}

/** A row's or a block's given space, set once: what a stack inside gave it already stays. */
export function given<T extends Block | Row>(made: T[], path: string, space: { top: number; bottom: number }): T[] {
  for (const one of made) one.given ??= { path, top: space.top, bottom: space.bottom };
  return made;
}

/** A stack held as a whole: its template children, the padding the writers put in what it holds (none where its column holds it), its gap. */
export interface Stack {
  children: Child[];
  pad: Sides;
  /** Its padding on phones, where it has one of its own: its top and bottom go where its padding does there. */
  phonePad?: Sides;
  gap: number;
  /** Its gap on phones, where it has one of its own. */
  phoneGap?: number;
  /** Where the stack itself is hidden, nothing in it shows: that device is left as it is. */
  hidden?: { mobile?: boolean; desktop?: boolean };
}

/** How the template is read: what's laid out at a path, and a node's children. */
export interface Reading {
  at(path: string): ResolvedNode;
  childrenOf(node: Node, path: string): Child[];
}

type Device = "desktop" | "mobile";
const DEVICES: Device[] = ["desktop", "mobile"];
type Ends = { top: number; bottom: number };
type Shown = { mobile?: boolean; desktop?: boolean };
/** The space a stack holds on each device where nothing in it shows, for something else to hold there. */
export type Left = Record<Device, Ends>;

/** Something of the builder's that holds space above and below it: a block (its containerPadding), a row or a column (its padding). */
interface Holder {
  given: Given;
  hidden: Record<Device, boolean>;
  desktop: Sides;
  phone?: Sides;
  write(desktop: Sides, phone?: Sides): void;
}

type Item = { kind: "drawn"; hidden: Shown; holders: Holder[] } | { kind: "stack"; hidden: Shown; pad: Sides; phonePad?: Sides; gap: number; phoneGap?: number; items: Item[] } | { kind: "none" };

/** A plain stack's padding on phones, where it has one. */
export const phonePadOf = (node: Node): Sides | undefined => node.mobile?.padding as Sides | undefined;
/** A plain stack's gap on phones, where it has one. */
export const phoneGapOf = (node: Node): number | undefined => (typeof node.mobile?.gap === "number" ? node.mobile.gap : undefined);
/** Whether a stack's padding on phones isn't its desktop padding at its sides, where the builder has nowhere to hold it. */
export const phoneSidesDiffer = (node: Node): boolean => {
  const phone = phonePadOf(node);
  return phone !== undefined && (phone.left !== padding(node).left || phone.right !== padding(node).right);
};
const endsDiffer = (pad: Sides, phone?: Sides) => phone !== undefined && (phone.top !== pad.top || phone.bottom !== pad.bottom);

const hiddenOn = (hidden: Shown | undefined, device: Device) => Boolean(device === "mobile" ? hidden?.mobile : hidden?.desktop);

/** A holder of a padding written as CSS, on desktops and on phones (`_override.mobile`). */
function holderOf(values: Values, key: string, read: () => unknown, write: (value: string) => void, given: Given | undefined, hidden: Record<Device, boolean>): Holder | undefined {
  const desktop = sides(read());
  const phoneValue = values._override?.mobile?.[key];
  const phone = phoneValue === undefined ? undefined : sides(phoneValue);
  if (!given || !desktop || (phoneValue !== undefined && !phone)) return undefined;
  return {
    given,
    hidden,
    desktop,
    phone,
    write(onDesktop, onPhones) {
      write(written(read(), onDesktop));
      if (onPhones) values._override = { ...values._override, mobile: { ...values._override?.mobile, [key]: written(phoneValue, onPhones) } };
    },
  };
}

const blockHolder = (made: Block, row: Shown): Holder | undefined =>
  holderOf(
    made.values,
    "containerPadding",
    () => made.values.containerPadding,
    (value) => (made.values.containerPadding = value),
    made.given,
    { desktop: Boolean(made.hiding.hideOnDesktop || row.desktop), mobile: Boolean(made.hiding.hideOnMobile || row.mobile) }
  );

const NOTHING: Given = { path: "", top: 0, bottom: 0 };

const boxHolder = (made: Row | Column, given: Given | undefined): Holder | undefined =>
  holderOf(
    made.values,
    "padding",
    () => made.fields.padding,
    (value) => (made.fields.padding = value),
    given,
    { desktop: "hideOnDesktop" in made.fields && Boolean(made.fields.hideOnDesktop), mobile: "hideOnMobile" in made.fields && Boolean(made.fields.hideOnMobile) }
  );

/**
 * A Section's or the root's rows spaced on each device: a row of a Row, a Grid or a box holds its space, a run's blocks
 * theirs. Where nothing in it shows on a device, a row holds its padding there: its first run's, or one of its own
 * (`spacer`), shown there only.
 */
export function spaceRows(rows: Row[], stack: Stack, reading: Reading, spacer?: () => Row): void {
  const holders: (Holder | undefined)[] = [];
  for (const row of rows) {
    if (row.given) holders.push(boxHolder(row, row.given));
    else for (const column of row.columns) for (const made of column.contents) if (made.given) holders.push(blockHolder(made, { mobile: row.fields.hideOnMobile, desktop: row.fields.hideOnDesktop }));
  }
  const left = space(holders, stack, reading);
  if (!left) return;
  const run = rows.find((row) => row.run);
  if (run) return hold(boxHolder(run, NOTHING), left);
  if (!spacer) return;
  const made = spacer();
  // Only where it holds something: elsewhere what's in the Section shows.
  if (!left.desktop.top && !left.desktop.bottom) made.fields.hideOnDesktop = true;
  if (!left.mobile.top && !left.mobile.bottom) made.fields.hideOnMobile = true;
  hold(boxHolder(made, NOTHING), made.fields.hideOnDesktop ? { desktop: left.mobile, mobile: left.mobile } : made.fields.hideOnMobile ? { desktop: left.desktop, mobile: left.desktop } : left);
  rows.push(made);
}

/** A column's blocks spaced on each device; where nothing in it shows on one, its column holds its space there. */
export function spaceBlocks(blocks: Block[], stack: Stack, reading: Reading, column: Column): void {
  const left = space(
    blocks.filter((made) => made.given).map((made) => blockHolder(made, {})),
    stack,
    reading
  );
  if (left) hold(boxHolder(column, NOTHING), left);
}

/** What a row or a column holds besides its own: its padding there and more. */
function hold(holder: Holder | undefined, left: Left): void {
  if (!holder) return;
  const onDesktop = more(holder.desktop, left.desktop);
  const onPhones = more(holder.phone ?? holder.desktop, left.mobile);
  holder.write(onDesktop, holder.phone || cssSides(onPhones) !== cssSides(onDesktop) ? onPhones : undefined);
}

/** The stack spaced on each device where something in it is hidden; what it holds where nothing in it shows, if anything. */
function space(found: (Holder | undefined)[], stack: Stack, { at, childrenOf }: Reading): Left | undefined {
  // Something the writers put space in that isn't read as px: the stack is left as it is.
  if (found.some((holder) => !holder)) return undefined;
  const holders = found as Holder[];
  if (!holders.length) return undefined;
  // What each holds of its own: what it has less what it was given, on desktops and on phones.
  const own = new Map(holders.map((holder) => [holder, { desktop: less(holder.desktop, holder.given), mobile: less(holder.phone ?? holder.desktop, holder.given) }]));
  if ([...own.values()].some(({ desktop, mobile }) => desktop.top < 0 || desktop.bottom < 0 || mobile.top < 0 || mobile.bottom < 0)) return undefined;

  // Each holder by the template node it's drawn for, and for every node something is drawn inside, the first of those.
  const drawnFor = new Map<string, Holder[]>();
  const firstInside = new Map<string, number>();
  holders.forEach((holder, i) => {
    const { path } = holder.given;
    const same = drawnFor.get(path);
    if (same) same.push(holder);
    else drawnFor.set(path, [holder]);
    for (let dot = path.indexOf("."); dot > 0; dot = path.indexOf(".", dot + 1)) if (!firstInside.has(path.slice(0, dot))) firstInside.set(path.slice(0, dot), i);
  });
  const order = new Map(holders.map((holder, i) => [holder, i]));

  const read = (children: Child[]): Item[] =>
    children.map(({ child, path }): Item => {
      const laid = at(path);
      const hidden = laid?.hidden ?? {};
      const drawn = drawnFor.get(path) ?? [];
      const first = firstInside.get(path);
      if (first === undefined) {
        if (drawn.length) return { kind: "drawn", hidden, holders: drawn };
        // A Column with nothing drawn in it still shows, as its padding, with a gap beside it.
        return child.type === "Column" || child.type === "Section" ? { kind: "stack", hidden, pad: padding(child), phonePad: phonePadOf(child), gap: gapOf(laid), phoneGap: phoneGapOf(child), items: [] } : { kind: "none" };
      }
      // A Grid is the Column of Rows it's laid out as, each of its Rows a row of the builder's.
      const laidRows = child.type === "Grid" ? (laid.children ?? []).filter((row): row is ResolvedNode => typeof row !== "string") : [];
      const items: Item[] = child.type === "Grid" ? laidRows.map((row): Item => ({ kind: "drawn", hidden: row.hidden ?? {}, holders: drawnFor.get(row.path) ?? [] })) : read(childrenOf(child, path));
      const stacked: Item = child.type === "Grid" ? { kind: "stack", hidden, pad: ZERO, gap: gapOf(laid), items } : { kind: "stack", hidden, pad: padding(child), phonePad: phonePadOf(child), gap: gapOf(laid), phoneGap: phoneGapOf(child), items };
      if (!drawn.length) return stacked;
      // Lines drawn as rows of their own around what's drawn in it (a box's border): before and after it.
      const before = drawn.filter((holder) => order.get(holder)! < first);
      const after = drawn.filter((holder) => order.get(holder)! > first);
      return { kind: "stack", hidden, pad: ZERO, gap: 0, items: [{ kind: "drawn", hidden: {}, holders: before }, { ...stacked, hidden: {} }, { kind: "drawn", hidden: {}, holders: after }] };
    });
  const items = read(stack.children);
  const hides = (list: Item[], device: Device): boolean =>
    list.some((item) => item.kind !== "none" && (hiddenOn(item.hidden, device) || (item.kind === "drawn" ? item.holders.some((holder) => holder.hidden[device]) : hides(item.items, device))));
  // A phone padding of its own, in it or in a stack inside it: its phones spaced again.
  const gapDiffers = (gap: number, phone?: number) => phone !== undefined && phone !== gap;
  const ownOnPhones = (list: Item[]): boolean => list.some((item) => item.kind === "stack" && (endsDiffer(item.pad, item.phonePad) || gapDiffers(item.gap, item.phoneGap) || ownOnPhones(item.items)));
  const phonesDiffer = endsDiffer(stack.pad, stack.phonePad) || gapDiffers(stack.gap, stack.phoneGap) || ownOnPhones(items);
  if (!phonesDiffer && !holders.some((holder) => holder.hidden.desktop || holder.hidden.mobile)) return undefined;
  const shows = (list: Item[], device: Device): boolean =>
    list.some((item) => (item.kind === "drawn" ? !hiddenOn(item.hidden, device) && item.holders.some((holder) => !holder.hidden[device]) : item.kind === "stack" && !hiddenOn(item.hidden, device) && shows(item.items, device)));

  const gets = new Map(holders.map((holder) => [holder, { desktop: { top: holder.given.top, bottom: holder.given.bottom }, mobile: { top: holder.given.top, bottom: holder.given.bottom } } as Record<Device, Ends>]));
  const left: Left = { desktop: { top: 0, bottom: 0 }, mobile: { top: 0, bottom: 0 } };
  for (const device of DEVICES) {
    if (hiddenOn(stack.hidden, device) || !(hides(items, device) || (device === "mobile" && phonesDiffer))) continue;
    for (const holder of holders) gets.get(holder)![device] = { top: 0, bottom: 0 };
    // In order: space that goes above what shows next, space that goes below what showed last, and what shows.
    type Entry = { space: number; below: boolean } | { holder: Holder };
    const entries: Entry[] = [];
    const walk = (desktopPad: Sides, phonePad: Sides | undefined, desktopGap: number, phoneGap: number | undefined, list: Item[]) => {
      const pad = device === "mobile" && phonePad ? phonePad : desktopPad;
      const gap = device === "mobile" && phoneGap !== undefined ? phoneGap : desktopGap;
      entries.push({ space: pad.top, below: false });
      let before = false;
      for (const item of list) {
        if (item.kind === "none" || hiddenOn(item.hidden, device) || (item.kind === "drawn" && !item.holders.length)) continue;
        if (before) entries.push({ space: gap, below: false });
        before = true;
        if (item.kind === "drawn") for (const holder of item.holders) if (!holder.hidden[device]) entries.push({ holder });
        if (item.kind === "stack") walk(item.pad, item.phonePad, item.gap, item.phoneGap, item.items);
      }
      // Below what showed last in it; where nothing in it shows, above what shows next.
      entries.push({ space: pad.bottom, below: shows(list, device) });
    };
    walk(stack.pad, stack.phonePad, stack.gap, stack.phoneGap, items);
    let waiting = 0;
    let last: Holder | undefined;
    for (const entry of entries) {
      if ("holder" in entry) {
        gets.get(entry.holder)![device].top += waiting;
        waiting = 0;
        last = entry.holder;
      } else if (entry.below && last) {
        gets.get(last)![device].bottom += waiting + entry.space;
        waiting = 0;
      } else waiting += entry.space;
    }
    if (last) gets.get(last)![device].bottom += waiting;
    // Nothing in it shows there: something else holds its padding there, its top above and its bottom below.
    else {
      const bottom = (device === "mobile" && stack.phonePad ? stack.phonePad : stack.pad).bottom;
      left[device] = { top: waiting - bottom, bottom };
    }
  }

  for (const holder of holders) {
    const mine = own.get(holder)!;
    const by = gets.get(holder)!;
    const onDesktop = holder.hidden.desktop ? holder.desktop : more(mine.desktop, by.desktop);
    const onPhones = holder.hidden.mobile ? (holder.phone ?? onDesktop) : more(mine.mobile, by.mobile);
    // Where it's hidden, its padding there stays as it is; with no phone padding of its own, its one padding is where it shows.
    if (!holder.phone && (holder.hidden.desktop || holder.hidden.mobile)) holder.write(holder.hidden.desktop ? onPhones : onDesktop);
    else holder.write(onDesktop, holder.phone || cssSides(onPhones) !== cssSides(onDesktop) ? onPhones : undefined);
  }
  return left.desktop.top || left.desktop.bottom || left.mobile.top || left.mobile.bottom ? left : undefined;
}

/** Sides as CSS, as they were written where they're the same. */
const written = (was: unknown, now: Sides): string => {
  const before = sides(was);
  return typeof was === "string" && before && cssSides(before) === cssSides(now) ? was : cssSides(now);
};
/** What's left of a padding written in px to two places (values.ts `cssPx`) less what was given to it, to the same places. */
const less = (at: Sides, by: Ends): Sides => ({ ...at, top: hundredths(at.top - by.top), bottom: hundredths(at.bottom - by.bottom) });
const hundredths = (n: number) => Math.round(n * 100) / 100 || 0;
const more = (at: Sides, by: Ends): Sides => ({ ...at, top: at.top + by.top, bottom: at.bottom + by.bottom });
