/**
 * A simple template written as an annotated design (Decision 32): the design an author would write anyway, with what's
 * open marked where it is. `open(spec)` makes a marker for one field, `open: { title, body }` names them, and each
 * marker goes on a built-in written in `design` itself as its `field`:
 *
 *   const title = open(prop.text({ label: "Title", required: true, maxLength: 70 }));
 *   template({ id, version, open: { title }, design: <Email><Heading field={title}>What's new</Heading></Email> });
 *
 * When the template is defined, the design is walked once: each marker's node opens its text (a text field), its
 * href (a link), its src (an image field) or its children (a slot); what it holds is the example; and the render
 * rebuilds the tree with each value in its place.
 */
import type { Diagnostic, PropSpec, PropSpecs, RootName } from "@hyper-elements/core";
import { ElementsError } from "@hyper-elements/react";
import { describeElements } from "@hyper-elements/react/inspect";
import React from "react";
import { imageRules, isBlocks, isList, isObjectSpec } from "./fields";
import type { TemplateRules } from "./rules";
import { isSlot } from "./slots";

const OPEN = Symbol.for("hyper-elements.open");
const PRIMITIVE = Symbol.for("@hyper-elements/react/primitive");
const ROOTS: readonly RootName[] = ["Email", "Page", "Document", "Canvas"];

/** A marker for one open field: put it on a built-in in `design` as its `field`. */
export interface Open<S extends PropSpec = PropSpec> {
  readonly spec: S;
}

/** A marker for one field of an annotated template: its spec, which `open: { name }` names. */
export function open<const S extends PropSpec>(spec: S): Open<S> & string {
  const marker = { spec };
  Object.defineProperty(marker, OPEN, { value: true });
  return Object.freeze(marker) as unknown as Open<S> & string;
}

const isOpen = (value: unknown): value is Open => typeof value === "object" && value !== null && (value as Record<symbol, unknown>)[OPEN] === true;

export interface AnnotatedSpec<F extends PropSpecs = PropSpecs> {
  id: string;
  version: string;
  label?: string;
  description?: string;
  guidance?: string;
  rules?: TemplateRules;
  migrate?: Record<number, (values: Record<string, unknown>) => unknown>;
  /** The markers by field name: what the template's props are, and their types. */
  open: { [K in keyof F]: Open<F[K]> };
  /** The design, with each marker on the built-in that shows its field. */
  design: React.ReactElement;
}

const TEXT_HOSTS = new Set(["Heading", "Text", "ListItem", "Button", "Link"]);
const LINK_HOSTS = new Set(["Link", "Button"]);
const fail = (code: string, message: string, path: string): Diagnostic => ({ code, severity: "error", message, path });
const typeOf = (element: React.ReactElement): string | undefined => {
  const type = element.type as unknown as Record<symbol, unknown> | string | null;
  return type && typeof type !== "string" ? (type[PRIMITIVE] as string | undefined) : undefined;
};

/** Plain data copied at every depth (a style object, a list); an element, a marker or a function kept as it is. */
function plain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object" && !React.isValidElement(value) && !isOpen(value) && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  return value;
}

/** A copy of an element tree: each element made again with copied props, component types kept by reference. */
function copy(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) return node.map(copy);
  if (!React.isValidElement(node)) return node;
  const { children, ...props } = node.props as { children?: React.ReactNode };
  const copied = { ...(plain(props) as Record<string, unknown>), ...(node.key !== null ? { key: node.key } : {}) };
  return children === undefined ? React.createElement(node.type, copied) : React.createElement(node.type, copied, ...([] as React.ReactNode[]).concat(copy(children) as React.ReactNode));
}

interface Placement {
  name: string;
  /** The element's place, as a list of child indexes from the root. */
  at: number[];
  type: string;
}

/** The annotated spec read into a `fields`, `example` and `render` spec. Throws an `ElementsError` for a misplaced marker. */
export function fromAnnotated<F extends PropSpecs>(spec: AnnotatedSpec<F>): Record<string, unknown> {
  const problems: Diagnostic[] = [];
  const given = spec as unknown as Record<string, unknown>;
  for (const key of ["fields", "render", "example", "formats"]) {
    if (key in given) problems.push(fail("template/spec", `A template is written either as an annotated design (open and design) or with fields and render, not both: ${key} is given beside design`, key));
  }
  if (!React.isValidElement(spec.design) || !spec.open || typeof spec.open !== "object") {
    throw new ElementsError([...problems, fail("template/spec", "An annotated template has open (its markers, by name) and design (its JSX)", "design")]);
  }
  const root = typeOf(spec.design);
  if (!root || !(ROOTS as readonly string[]).includes(root)) problems.push(fail("template/spec", `An annotated template's design is a root (<Email>, <Page>, <Document>, <Canvas>) written in it, not ${root ?? "a component"}`, "design"));
  // Which marker is which name; one marker under two names is placed twice.
  const names = new Map<Open, string>();
  for (const [name, marker] of Object.entries(spec.open as Record<string, unknown>)) {
    if (!isOpen(marker)) problems.push(fail("template/spec", `open.${name} is a marker made with open(spec)`, `open.${name}`));
    else if (names.has(marker)) problems.push(fail("template/inline-twice", `One marker is named both ${names.get(marker)} and ${name}: each field has its own open()`, `open.${name}`));
    else names.set(marker, name);
  }
  const definitions = new Map(describeElements().elements.map((c) => [c.type, c] as const));
  const design = copy(spec.design) as React.ReactElement;
  const placements: Placement[] = [];
  const found = new Map<Open, number>();
  const visit = (node: React.ReactNode, at: number[], path: string, inSlot: string | undefined) => {
    if (Array.isArray(node)) return node.forEach((child, i) => visit(child, [...at, i], path, inSlot));
    if (!React.isValidElement(node)) return;
    const props = node.props as { field?: unknown; children?: React.ReactNode };
    const type = typeOf(node);
    if (isOpen(props.field)) {
      const marker = props.field;
      found.set(marker, (found.get(marker) ?? 0) + 1);
      const name = names.get(marker);
      if (!name) problems.push(fail("template/inline-unlisted", `A marker in the design isn't named in open: name it there`, path));
      else if (!type) problems.push(fail("template/inline-target", `${name}'s marker isn't on a built-in: a marker goes on a built-in written in design (a Heading, a Section, an Image)`, path));
      else if (inSlot) problems.push(fail("template/inline-nested", `${name}'s marker is inside the slot ${inSlot}'s host: the slot's content replaces it`, path));
      else {
        const problem = pairing(name, marker.spec, type, props, definitions);
        if (problem) problems.push(fail(problem.code, problem.message, path));
        else placements.push({ name, at, type });
      }
    }
    const slotHere = isOpen(props.field) && isSlot(props.field.spec) ? names.get(props.field) : undefined;
    const children = props.children;
    if (children !== undefined) {
      const list = Array.isArray(children) ? children : [children];
      list.forEach((child, i) => visit(child, [...at, i], `${path}.children[${i}]`, inSlot ?? slotHere));
    }
  };
  visit(design, [], "design", undefined);
  for (const [marker, name] of names) {
    const count = found.get(marker) ?? 0;
    if (count === 0) problems.push(fail("template/inline-unplaced", `${name}'s marker isn't in design: put it on a built-in written in design itself (not inside a component's render), as field={${name}}`, `open.${name}`));
    else if (count > 1) problems.push(fail("template/inline-twice", `${name}'s marker is placed ${count} times: once`, `open.${name}`));
  }
  if (problems.length) throw new ElementsError(problems);
  const fields: Record<string, PropSpec> = {};
  for (const [marker, name] of names) fields[name] = marker.spec;
  // The example: what each marked node holds in the design.
  const example: Record<string, unknown> = {};
  for (const placement of placements) {
    const element = elementAt(design, placement.at);
    const spec_ = fields[placement.name];
    const props = element.props as Record<string, unknown> & { children?: React.ReactNode };
    if (isSlot(spec_)) example[placement.name] = React.createElement(React.Fragment, null, ...([] as React.ReactNode[]).concat(props.children ?? []));
    else if (imageRules(spec_)) example[placement.name] = props.src;
    else if (spec_.kind.name === "link") example[placement.name] = props.href;
    else example[placement.name] = typeof props.children === "string" ? props.children : undefined;
  }
  const render = (values: Record<string, unknown>) => {
    let tree = copy(design) as React.ReactElement;
    for (const placement of placements) {
      const spec_ = fields[placement.name];
      const value = values[placement.name];
      tree = replaceAt(tree, placement.at, (element) => {
        const props = { ...(element.props as Record<string, unknown>), field: placement.name, ...(element.key !== null ? { key: element.key } : {}) };
        const { children, ...rest } = props as Record<string, unknown> & { children?: React.ReactNode };
        if (isSlot(spec_) || (!imageRules(spec_) && spec_.kind.name !== "link")) return value === undefined ? React.createElement(element.type, rest) : React.createElement(element.type, rest, value as React.ReactNode);
        const key = imageRules(spec_) ? "src" : "href";
        return React.createElement(element.type, { ...rest, ...(value !== undefined ? { [key]: value } : {}) }, ...([] as React.ReactNode[]).concat(children ?? []));
      });
    }
    return tree;
  };
  const { open: _, design: __, ...rest } = spec as unknown as Record<string, unknown>;
  return { ...rest, label: spec.label ?? spec.id, root, fields, example, render };
}

/** Why a marker can't go on a node of this type, or undefined where it can. */
function pairing(name: string, spec: PropSpec, type: string, props: { children?: React.ReactNode } & Record<string, unknown>, definitions: Map<string, { children: { categories: readonly string[] } }>): { code: string; message: string } | undefined {
  if (isList(spec) || isObjectSpec(spec) || isBlocks(spec) || !["text", "link", "asset", "slot"].includes(spec.kind.name)) {
    return { code: "template/inline-kind", message: `${name} is a ${spec.kind.name} field: an annotated design opens text, links, images and slots (use fields and render for the rest)` };
  }
  if (isSlot(spec)) {
    const holds = definitions.get(type)?.children.categories ?? [];
    return holds.length ? undefined : { code: "template/inline-target", message: `${name} is a slot: its host holds elements (a Section, a Column), not a ${type}` };
  }
  if (imageRules(spec) || spec.kind.name === "asset") return type === "Image" ? undefined : { code: "template/inline-target", message: `${name} is an image: its marker goes on an Image, not a ${type}` };
  if (spec.kind.name === "link") return LINK_HOSTS.has(type) ? undefined : { code: "template/inline-target", message: `${name} is a link: its marker goes on a Link or a Button (its href), not a ${type}` };
  if (!TEXT_HOSTS.has(type)) return { code: "template/inline-target", message: `${name} is text: its marker goes on a Heading, a Text, a ListItem, a Button or a Link, not a ${type}` };
  return typeof props.children === "string" ? undefined : { code: "template/inline-content", message: `${name}'s ${type} holds one string, its example text: not ${props.children === undefined ? "nothing" : "other components"}` };
}

const childList = (element: React.ReactElement): React.ReactNode[] => {
  const children = (element.props as { children?: React.ReactNode }).children;
  return Array.isArray(children) ? children : [children];
};

function elementAt(root: React.ReactElement, at: number[]): React.ReactElement {
  let node: React.ReactNode = root;
  for (const index of at) node = Array.isArray(node) ? node[index] : childList(node as React.ReactElement)[index];
  return node as React.ReactElement;
}

/** The tree with the element at a place replaced. */
function replaceAt(root: React.ReactElement, at: number[], replace: (element: React.ReactElement) => React.ReactElement): React.ReactElement {
  const swap = (node: React.ReactNode, rest: number[]): React.ReactNode => {
    if (!rest.length) return replace(node as React.ReactElement);
    const [index, ...more] = rest;
    if (Array.isArray(node)) return node.map((child, i) => (i === index ? swap(child, more) : child));
    const element = node as React.ReactElement;
    const children = (element.props as { children?: React.ReactNode }).children;
    const list = Array.isArray(children) ? children.map((child, i) => (i === index ? swap(child, more) : child)) : [swap(children, more)];
    return React.cloneElement(element, undefined, ...list);
  };
  return swap(root, at) as React.ReactElement;
}
