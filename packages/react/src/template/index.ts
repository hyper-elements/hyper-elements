/**
 * `@hyper-elements/react/template`: templates, reusable designs with guardrails. A template holds the parts of a design
 * that never change, opens fields (typed values, each with its rules) for whoever fills it, and checks the result:
 *
 *   const Launch = template({ id: "acme.Launch", version: "1.0.0", label: "Launch", root: "Canvas", fields, example, render });
 *   export default () => <Launch headline="Orbit is live" … />;    // a design: render() checks it, then renders it
 *   Launch.check(values);                                           // { valid, values, diagnostics, review, … }
 *
 * It imports the main entry by name (left external, as /pdf and /image do), and no engine, Node API or code that
 * evaluates strings: it runs wherever a design does.
 */
import type { Diagnostic, PropSpec, PropSpecs, RootName } from "@hyper-elements/core";
import { captureFragment, ElementsError, readFragment, validate, type FieldInputs, type FieldValues, type FragmentCapture, type Snapshot } from "@hyper-elements/react";
import { inspect } from "@hyper-elements/react/inspect";
import React from "react";
import { fromAnnotated, type AnnotatedSpec } from "./annotated";
import { build, TEMPLATE_RECORD, withTemplate, type BuildContext, type Definition, type Format } from "./checks";
import { describeTemplate, type TemplateDescription } from "./describe";
import { isBlocks, isList, isObjectSpec, specsOf } from "./fields";
import { readRules, type RuleResult, type TemplateRules } from "./rules";
import { brandMap, isSlot, isStoredSlot, resolveSlot, type ResolvedSlot } from "./slots";
import { compareVersions, isVersion, mergePatch, own, readValue, readValues, versionParts } from "./values";

export { field, type ImageRules, type ImageSpec, type ImageType, type ImageValue } from "./fields";
export { open, type AnnotatedSpec, type Open } from "./annotated";
export { CORE_RULES, type ImageHostRules, type LinkRules, type LintRuleDescriptor, type RuleResult, type TemplateRules } from "./rules";
export type { SlotOptions, SlotSpec, SlotStyles, StoredSlot } from "./slots";
export { checkLayout, type CheckLayoutOptions, type LayoutCheck, type MeasuredLayout } from "./layout";
export { fitInside, sniffImage, type SniffedImage } from "./layout";
export { DESCRIBE_VERSION, type FieldDescription, type TemplateDescription } from "./describe";
export type { Format } from "./checks";

const ROOTS: readonly RootName[] = ["Email", "Page", "Document", "Canvas"];
const ID = /^[a-z][a-z0-9-]*\.[A-Z][A-Za-z0-9]*$/;
const FORMAT_NAME = /^[a-z][a-z0-9-]*$/;
/** Props a template's component has besides its fields: a field can't take their names. */
const RESERVED = ["format", "key", "ref", "children"];

/** A template's format names, or `undefined` for a template with one size. */
export type FormatName<Fm> = [keyof Fm] extends [never] ? undefined : keyof Fm & string;

export interface TemplateSpec<F extends PropSpecs, Fm extends Record<string, Format>> {
  /** A namespace, a dot and a capitalized name, as a component's type: "acme.LaunchGraphic". */
  id: string;
  /** Its version, semver ("1.0.0"): a design's values file records it, and a newer major needs a migration. */
  version: string;
  label: string;
  description?: string;
  /** How to fill it well, for the whole design: plain English, never enforced (`check()` lists it for review). */
  guidance?: string;
  /** The root its render returns. */
  root: RootName;
  /** Its named sizes: a Canvas's `{ width, height, scale }`, a Document's `{ size, orientation }`. None: one size. */
  formats?: Fm;
  /** Its open parts: `prop` helpers' specs and `field.image()`. */
  fields: F;
  /** Values it's shown and tested with: `describe()` lays them out, and `check()` must accept them. */
  example: FieldInputs<F>;
  /** By major version: a values file of that major's values, as this version takes them. */
  migrate?: Record<number, (values: Record<string, unknown>) => unknown>;
  /** Rules over the result: lint rules and core codes required, links and root props (Decision 25). */
  rules?: TemplateRules;
  /** The design for some checked values, in a format: the template's whole root (nothing beside it reaches the output). */
  render(values: FieldValues<F>, context: { format: FormatName<Fm> }): React.ReactElement;
}

/** What `check()` returns: never thrown. */
export interface CheckResult<F extends PropSpecs = PropSpecs, Fm extends Record<string, Format> = Record<string, Format>> {
  /** No errors in the values or in any format's design (there may be warnings and notes). */
  valid: boolean;
  /** The values read: defaults filled in, a list not given `[]`. Absent where they couldn't be read. */
  values?: FieldValues<F>;
  diagnostics: Diagnostic[];
  /** Each required rule's result, by format (Phase 1b: rules). */
  rules: RuleResult[];
  /** What a reviewer checks by eye: each field's guidance and the template's, as it was asked. Never changes `valid`. */
  review: Array<{ field?: string; template?: string; guidance: string }>;
  /** The design for each format checked (`default` for a template with one size), where it's valid: what to render. */
  snapshots: Partial<Record<[keyof Fm] extends [never] ? "default" : keyof Fm & string, Snapshot>>;
  template: { id: string; version: string };
}

/** What a template's component takes: its fields' values, and `format`, one of its format names. */
export type TemplateComponentProps<F extends PropSpecs, Fm extends Record<string, Format>> = FieldInputs<F> & ([keyof Fm] extends [never] ? { format?: never } : { format?: keyof Fm & string });

export interface Template<F extends PropSpecs = PropSpecs, Fm extends Record<string, Format> = Record<string, Format>> {
  /** As a design's root: `<Launch headline="…" />` is a design, checked by the template and rendered as it built it. */
  (props: TemplateComponentProps<F, Fm>): React.ReactElement | null;
  readonly id: string;
  readonly version: string;
  readonly label: string;
  readonly description?: string;
  readonly guidance?: string;
  readonly root: RootName;
  readonly formats?: Fm;
  readonly fields: F;
  readonly example: FieldInputs<F>;
  readonly migrate?: Record<number, (values: Record<string, unknown>) => unknown>;
  readonly rules: TemplateRules;
  /**
   * The values read, each format's design built and checked, and every required rule decided. Never throws. A slot
   * stored as `{ module }` takes its content captured, in `fragments` by its path.
   */
  check(values: unknown, options?: { format?: FormatName<Fm>; fragments?: Record<string, FragmentCapture> }): CheckResult<F, Fm>;
  /** The design for some values, in a format: the root its render returns. Throws an `ElementsError` for bad values. */
  design(values: FieldInputs<F>, options?: { format?: FormatName<Fm> }): React.ReactElement;
  /** `values` with `patch`'s fields changed (objects merged, lists replaced); the rest keep their references. Throws for bad ones. */
  update(values: FieldValues<F>, patch: { [K in keyof F]?: unknown }): FieldValues<F>;
  /** Its formats, fields, rules and regions, for whoever fills it. Synchronous. */
  describe(): TemplateDescription;
}

/** A template's props, as its component takes them: `TemplateProps<typeof Newsletter>`. */
export type TemplateProps<T> = T extends Template<infer F, infer Fm> ? TemplateComponentProps<F, Fm> : never;
/** A template's values once checked: `Values<typeof Newsletter>`. */
export type Values<T> = T extends Template<infer F> ? FieldValues<F> : never;

const fail = (code: string, message: string, path: string): Diagnostic => ({ code, severity: "error", message, path });
const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const hasErrors = (diagnostics: readonly Diagnostic[]) => diagnostics.some((d) => d.severity === "error");

/** The template spec's own problems, when it's defined. */
function specProblems(spec: TemplateSpec<PropSpecs, Record<string, Format>>): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (typeof spec.id !== "string" || !ID.test(spec.id)) out.push(fail("template/spec", `A template's id is a namespace, a dot and a capitalized name ("acme.LaunchGraphic"), not ${JSON.stringify(spec.id)}`, "id"));
  if (!isVersion(spec.version)) out.push(fail("template/spec", `A template's version is semver ("1.0.0"), not ${JSON.stringify(spec.version)}`, "version"));
  if (typeof spec.label !== "string" || !spec.label) out.push(fail("template/spec", "A template has a label", "label"));
  if (!ROOTS.includes(spec.root)) out.push(fail("template/spec", `A template's root is one of ${ROOTS.join(", ")}, not ${JSON.stringify(spec.root)}`, "root"));
  if (typeof spec.render !== "function") out.push(fail("template/spec", "A template has a render(values, { format })", "render"));
  if (spec.formats !== undefined) {
    if (!isPlainObject(spec.formats) || !Object.keys(spec.formats).length) out.push(fail("template/spec", "formats is an object of named formats", "formats"));
    else
      for (const [name, format] of Object.entries(spec.formats)) {
        if (!FORMAT_NAME.test(name)) out.push(fail("template/spec", `A format's name is lowercase letters, digits and "-", starting with a letter, not ${JSON.stringify(name)}`, `formats.${name}`));
        if (!isPlainObject(format)) out.push(fail("template/spec", `The ${name} format is an object ({ width, height } for a Canvas)`, `formats.${name}`));
        else if (spec.root === "Canvas" && !(typeof format.width === "number" && typeof format.height === "number")) out.push(fail("template/spec", `A Canvas format has a width and a height in px: ${name} hasn't`, `formats.${name}`));
        else if (format.scale !== undefined && !(typeof format.scale === "number" && format.scale > 0)) out.push(fail("template/spec", `A format's scale is pixels per px, above 0`, `formats.${name}.scale`));
      }
  }
  if (!isPlainObject(spec.fields)) out.push(fail("template/spec", "A template's fields are an object of specs (prop.text(…), field.image(…))", "fields"));
  else
    for (const { path, spec: field } of specsOf(spec.fields)) {
      if (!field || typeof field.kind?.parse !== "function" || typeof field.label !== "string") out.push(fail("template/spec", `${path} is a field's spec (prop.text(…), field.image(…)), with a label`, `fields.${path}`));
    }
  if (isPlainObject(spec.fields)) {
    for (const { path, spec: field, block } of specsOf(spec.fields)) {
      if (field && isSlot(field) && (path.includes(".") || path.includes("[") || block)) out.push(fail("template/spec", `A slot is a top-level field, never inside a list, an object or a block: ${path}`, `fields.${path}`));
      if (field && isBlocks(field)) {
        for (const [type, branch] of Object.entries(field.blocks)) {
          if (!branch || !isObjectSpec(branch)) out.push(fail("template/spec", `The block type ${type} of ${path} is a prop.object() spec`, `fields.${path}.${type}`));
          else if (Object.prototype.hasOwnProperty.call(branch.fields, "type")) out.push(fail("template/block-type", `The block type ${type} of ${path} has a field named type: a block's type is its name`, `fields.${path}.${type}.type`));
        }
      }
    }
  }
  for (const name of Object.keys(isPlainObject(spec.fields) ? spec.fields : {})) {
    if (RESERVED.includes(name)) out.push(fail("template/field-name", `A field can't be named ${name}: it's a prop of the template's component (format, key, ref, children)`, `fields.${name}`));
  }
  if (!isPlainObject(spec.example)) out.push(fail("template/spec", "A template has example values: describe() lays them out, and tests render them", "example"));
  if (spec.migrate !== undefined && (!isPlainObject(spec.migrate) || Object.entries(spec.migrate).some(([major, fn]) => !/^\d+$/.test(major) || typeof fn !== "function"))) {
    out.push(fail("template/spec", "migrate is functions by major version: { 1: (values) => … }", "migrate"));
  }
  return out;
}

/**
 * What a template's check hands a design's capture (check(element), templateRequest()): its result, and the request
 * it checked (the template, its props as recorded, its format). A stack every copy of this entry shares.
 */
type Capture = (result: CheckResult<any, any>, request: TemplateRequestOf) => void;
interface TemplateRequestOf {
  template: Template<any, any>;
  props: Record<string, unknown>;
  format?: string;
}
const CAPTURES = Symbol.for("hyper-elements.template.capture");
const captures = () => ((globalThis as Record<symbol, unknown>)[CAPTURES] ??= []) as Capture[];

/** The shared frames of collecting renders (the main entry's, by the symbol every copy of Elements shares). */
const COLLECTING = Symbol.for("@hyper-elements/react/primitives/collecting");

/** A template: its parts, its fields, its checks, and a component that makes it a design's root. */
export function template<const F extends PropSpecs, const Fm extends Record<string, Format> = Record<never, Format>>(given: TemplateSpec<F, Fm> | AnnotatedSpec<F>): Template<F, Fm> {
  // An annotated design (Decision 32) is read into fields, an example and a render first.
  const spec = ("open" in given ? fromAnnotated(given as AnnotatedSpec<F>) : given) as TemplateSpec<F, Fm>;
  const problems = specProblems(spec as unknown as TemplateSpec<PropSpecs, Record<string, Format>>);
  const { rules, problems: ruleProblems } = readRules(spec.rules, spec.root, spec.id);
  problems.push(...ruleProblems);
  // Owned when it's defined: changing the spec afterwards (its fields, rules, formats, render) changes nothing.
  const fields = isPlainObject(spec.fields) ? (ownFields(spec.fields) as F) : ({} as F);
  const slots: ResolvedSlot[] = [];
  for (const [path, field] of Object.entries(fields)) {
    if (!isSlot(field)) continue;
    const resolved = resolveSlot(path, field, spec.root);
    problems.push(...resolved.problems);
    if (resolved.slot) slots.push(resolved.slot);
  }
  if (problems.length) throw new ElementsError(problems);
  const formats = spec.formats ? (deepFreeze(JSON.parse(JSON.stringify(spec.formats))) as Fm) : undefined;
  const names = formats ? Object.keys(formats) : [];
  const render = spec.render;
  const definition: Definition = { id: spec.id, version: spec.version, label: spec.label, root: spec.root, formats, fields, render: render as Definition["render"] };
  const name = `${spec.id} ${spec.version}`;
  const brand = slots.length ? brandMap() : { styles: new Map(), props: new Map() };
  const reading = () => ({ diagnostics: [] as Diagnostic[], name, isElement: React.isValidElement });
  const context = (fragments?: Record<string, FragmentCapture>): BuildContext => ({ slots, brand, rules, ...(fragments ? { fragments } : {}) });

  const formatProblem = (format: unknown): Diagnostic | undefined => {
    if (format === undefined) return undefined;
    if (typeof format === "string" && names.includes(format)) return undefined;
    return fail("template/format", names.length ? `${spec.id} has the formats ${names.join(", ")}, not ${JSON.stringify(format)}` : `${spec.id} has one size, and no formats: leave format out`, "values.format");
  };

  const review = (): CheckResult["review"] => [
    ...specsOf(fields).filter(({ spec: field }) => field.guidance).map(({ path, spec: field }) => ({ field: path, guidance: field.guidance! })),
    ...(spec.guidance ? [{ template: spec.id, guidance: spec.guidance }] : []),
  ];

  /** Slots stored as `{ module }` need their captures; one given for a slot that has its content already is two places. */
  const slotProblems = (values: Record<string, unknown>, fragments: Record<string, unknown> | undefined): Diagnostic[] => {
    const out: Diagnostic[] = [];
    for (const slot of slots) {
      const value = values[slot.path];
      const given = fragments?.[slot.path];
      const stored = isStoredSlot(value) ? value : undefined;
      if (stored && "module" in stored && !given) out.push(fail("template/slot-unloaded", `The slot ${slot.path} is stored as its module (${stored.module}): check() needs its content, captured (fragments), or the slot's JSX`, `values.${slot.path}`));
      if (given && !(stored && "module" in stored)) out.push(fail("template/slot-twice", `The slot ${slot.path}'s content is given twice: in the values and in fragments. A slot's content comes from one place`, `values.${slot.path}`));
    }
    for (const path of Object.keys(fragments ?? {})) if (!slots.some((slot) => slot.path === path)) out.push(fail("template/unknown-field", `${spec.id} has no slot ${path} for the fragment given`, `fragments.${path}`));
    return out;
  };

  /** The check, with what the template found apart from the designs' own problems (for an entry point's hand-off). */
  const run = (input: unknown, options: { format?: unknown; fragments?: Record<string, unknown> } = {}): CheckResult<F, Fm> & { own: Diagnostic[] } => {
    const read = reading();
    const format = formatProblem(options.format);
    const values = readValues(fields, input, "values", read);
    const base = { review: review(), template: { id: spec.id, version: spec.version } };
    const early = [...(format ? [format] : []), ...read.diagnostics, ...(values ? slotProblems(values, options.fragments) : [])];
    let fragments: Record<string, FragmentCapture> | undefined;
    if (options.fragments && !hasErrors(early)) {
      fragments = {};
      for (const [path, capture] of Object.entries(options.fragments)) {
        try {
          fragments[path] = readFragment(capture);
        } catch (thrown) {
          early.push(...((thrown as { diagnostics?: Diagnostic[] }).diagnostics ?? []).map((d) => ({ ...d, path: `fragments.${path}` })));
        }
      }
    }
    if (!values || hasErrors(early)) {
      return { ...base, rules: [], valid: false, ...(values && !hasErrors(read.diagnostics) ? { values: values as FieldValues<F> } : {}), diagnostics: early, own: early, snapshots: {} };
    }
    const checked = options.format !== undefined ? [options.format as string] : names.length ? names : [undefined];
    const own = [...early];
    const diagnostics = [...early];
    const results: RuleResult[] = [];
    const snapshots: Record<string, Snapshot> = {};
    for (const format of checked) {
      const built = build(definition, values, format, context(fragments));
      // In a template of several formats, each problem says which format it's in.
      const tag = (d: Diagnostic): Diagnostic => (names.length > 1 && checked.length > 1 ? { ...d, message: `In the ${format} format: ${d.message}` } : d);
      own.push(...built.own.map(tag));
      diagnostics.push(...built.design.map(tag), ...built.own.map(tag));
      results.push(...built.rules);
      if (built.snapshot) snapshots[format ?? "default"] = withTemplate(built.snapshot, base.template, built.rules);
    }
    const valid = !hasErrors(diagnostics);
    return { ...base, rules: results, valid, values: values as FieldValues<F>, diagnostics, own, snapshots: (valid ? snapshots : {}) as CheckResult<F, Fm>["snapshots"] };
  };

  const check = (input: unknown, options: { format?: FormatName<Fm>; fragments?: Record<string, FragmentCapture> } = {}): CheckResult<F, Fm> => {
    const { own: _, ...result } = run(input, options);
    return result;
  };

  const Template = function Template(props: Record<string, unknown>): null {
    const frames = (globalThis as Record<symbol, unknown>)[COLLECTING] as Array<{ templates?: unknown[] }> | undefined;
    const frame = frames?.[frames.length - 1];
    // Inside a collecting render, it records itself as the design's root, its props owned now: a getter or a Proxy
    // gives the check the value it gives on this read. Elsewhere it renders nothing.
    if (frame) (frame.templates ??= []).push({ template: Template, props: own(props, React.isValidElement) as Record<string, unknown> });
    return null;
  } as unknown as Template<F, Fm>;

  const record = Object.freeze({
    id: spec.id,
    version: spec.version,
    formats: Object.freeze([...names]),
    check(props: Record<string, unknown>, options: { format?: string }) {
      const result = run(props, options);
      const stack = captures();
      const capture = stack[stack.length - 1];
      if (capture) capture(result, { template: Template, props, ...(options.format !== undefined ? { format: options.format } : {}) });
      return { valid: result.valid, diagnostics: result.diagnostics, own: result.own, snapshots: result.snapshots as Record<string, unknown> };
    },
  });

  const design = (values: unknown, options: { format?: FormatName<Fm> } = {}): React.ReactElement => {
    const read = reading();
    const format = formatProblem(options.format) ?? (options.format === undefined && names.length > 1 ? fail("template/format", `${spec.id} has ${names.length} formats (${names.join(", ")}): name one`, "values.format") : undefined);
    const values_ = readValues(fields, values, "values", read);
    const diagnostics = [...(format ? [format] : []), ...read.diagnostics];
    // design() renders a slot's JSX as it is (unchecked: check()'s snapshots are what's checked); a stored one can't be.
    for (const slot of slots) {
      if (isStoredSlot(values_?.[slot.path])) diagnostics.push(fail("template/slot-unloaded", `design() takes the slot ${slot.path}'s JSX; check() reads it stored`, `values.${slot.path}`));
    }
    if (!values_ || hasErrors(diagnostics)) throw new ElementsError(diagnostics);
    return render(values_ as FieldValues<F>, { format: (options.format ?? names[0]) as FormatName<Fm> });
  };

  const update = (values: FieldValues<F>, patch: Record<string, unknown>): FieldValues<F> => {
    if (!isPlainObject(values) || !isPlainObject(patch)) throw new TypeError(`[Elements] ${spec.id}.update() takes values (from check()) and a patch of fields, each an object`);
    const read = reading();
    const out: Record<string, unknown> = { ...values };
    for (const key of Object.keys(patch)) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) {
        read.diagnostics.push({
          code: "template/unknown-field",
          severity: "error",
          message: `${name} has no field "${key}" (its fields: ${Object.keys(fields).join(", ")}); what isn't a field is fixed by the template`,
          path: `values.${key}`,
          fix: "change one of its fields, or ask the template's owner for a version that has this one",
        });
        continue;
      }
      const field: PropSpec = fields[key];
      // An object is merged (JSON Merge Patch: null removes a key); anything else, a list too, is replaced.
      const value_ = patch[key] === null ? undefined : "fields" in field && isPlainObject(patch[key]) ? mergePatch(values[key as keyof typeof values], patch[key]) : patch[key];
      const value = readValue(field, own(value_, React.isValidElement), `values.${key}`, read);
      if (value === undefined) delete out[key];
      else out[key] = value;
    }
    if (hasErrors(read.diagnostics)) throw new ElementsError(read.diagnostics);
    return out as FieldValues<F>;
  };

  const describe = (): TemplateDescription => {
    const read = reading();
    const example = readValues(fields, spec.example, "example", read);
    const laidOut: Parameters<typeof describeTemplate>[1] = [];
    let theme: unknown = null;
    if (example && !hasErrors(read.diagnostics)) {
      for (const format of names.length ? names : [undefined]) {
        const built = build(definition, example, format, context());
        if (built.root) laidOut.push({ format, values: example, root: built.root });
        if (theme === null && built.snapshot) theme = inspect(built.snapshot).theme;
      }
    }
    return describeTemplate({ ...definition, description: spec.description, guidance: spec.guidance, slots, rules, theme }, laidOut);
  };

  Object.defineProperty(Template, "name", { value: spec.id.split(".").pop() });
  Object.assign(Template, {
    displayName: spec.id,
    id: spec.id,
    version: spec.version,
    label: spec.label,
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.guidance ? { guidance: spec.guidance } : {}),
    root: spec.root,
    ...(formats ? { formats } : {}),
    fields,
    rules,
    example: spec.example,
    ...(spec.migrate ? { migrate: Object.freeze({ ...spec.migrate }) } : {}),
    check,
    design,
    update,
    describe,
  });
  Object.defineProperty(Template, TEMPLATE_RECORD, { value: record });
  return Object.freeze(Template);
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
};

/**
 * Fields owned: a new record of shallow, frozen copies of each spec, their data (defaults, rules, a list's item, an
 * object's fields, a block's types) copied and frozen. A kind and a slot's allowed components are kept by reference:
 * a kind's parse() is code, and a slot allows a component by its identity.
 */
function ownFields(fields: PropSpecs): PropSpecs {
  const ownSpec = (spec: PropSpec): PropSpec => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(spec)) {
      if (key === "kind" || key === "slot") out[key] = value;
      else if (key === "item") out.item = ownSpec(value as PropSpec);
      else if ((key === "fields" || key === "blocks") && value && typeof value === "object") out[key] = ownFields(value as PropSpecs);
      else out[key] = value && typeof value === "object" ? deepFreeze(JSON.parse(JSON.stringify(value))) : value;
    }
    return Object.freeze(out) as unknown as PropSpec;
  };
  return Object.freeze(Object.fromEntries(Object.entries(fields).map(([name, spec]) => [name, spec && typeof spec === "object" ? ownSpec(spec) : spec])));
}

/** The template a value is (a template, or `memo()`/`forwardRef()` of one), or undefined: not an element made from one. */
export function templateOf(value: unknown): Template | undefined {
  let current = value as { $$typeof?: unknown; type?: unknown; render?: unknown } | undefined;
  for (let i = 0; i < 4 && current; i++) {
    if (typeof current === "function" && (current as unknown as Record<symbol, unknown>)[TEMPLATE_RECORD]) return current as unknown as Template;
    current = (current.$$typeof === Symbol.for("react.memo") ? current.type : current.$$typeof === Symbol.for("react.forward_ref") ? current.render : undefined) as typeof current;
  }
  return undefined;
}

/**
 * A design checked by the template that's its root (`<Launch … />`, or a component that returns it): the same result
 * as the template's `check()` of its props, in its `format` or, without one, in every format. Never throws.
 */
export function check(element: React.ReactElement): CheckResult {
  let checked: CheckResult | undefined;
  const stack = captures();
  stack.push((result) => {
    checked ??= result;
  });
  let validated;
  try {
    validated = validate(element);
  } finally {
    stack.pop();
  }
  if (checked) return checked;
  const diagnostics = validated.diagnostics.some((d) => d.code === "template/not-root" || d.code === "template/format")
    ? validated.diagnostics
    : [...validated.diagnostics, fail("template/not-template", "The design's root isn't a template: check() checks a design made from one (<Newsletter … />)", "jsx")];
  return { valid: false, diagnostics, review: [], rules: [], snapshots: {}, template: { id: "", version: "" } };
}

/**
 * A design's template request (`<Launch format="square" … />`): the template that's its root, the props it was given
 * (owned as the root recorded them: a slot's JSX stays the element it is) and its format. For a tool that checks the
 * design somewhere else (the CLI captures it in one process and checks it in another). Diagnostics where the root
 * isn't one template; never throws.
 */
export function templateRequest(element: React.ReactElement): { template?: Template; props?: Record<string, unknown>; format?: string; diagnostics: Diagnostic[] } {
  let request: TemplateRequestOf | undefined;
  const stack = captures();
  stack.push((_result, given) => {
    request ??= given;
  });
  let validated;
  try {
    validated = validate(element);
  } finally {
    stack.pop();
  }
  if (request) return { template: request.template as Template, props: request.props, ...(request.format !== undefined ? { format: request.format } : {}), diagnostics: [] };
  const diagnostics = validated.diagnostics.some((d) => d.code === "template/not-root" || d.code === "template/format")
    ? validated.diagnostics
    : [...validated.diagnostics, fail("template/not-template", "The design's root isn't a template (<Newsletter … />)", "jsx")];
  return { diagnostics };
}

// ─── Dates ──────────────────────────────────────────────────────────────────

/**
 * A date field's value (YYYY-MM-DD) written for a locale (`formatDate("2026-12-03", "de-DE", { dateStyle: "long" })`
 * is "3. Dezember 2026"). The day is the one written, in any time zone: it's read and written in UTC, and no clock
 * is read.
 */
export function formatDate(date: string, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: "long" }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new TypeError(`[Elements] formatDate() takes a date as YYYY-MM-DD, not ${JSON.stringify(date)}`);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

// ─── Values files ───────────────────────────────────────────────────────────

/** A design's data form: which template, which version, which formats, its values, and its assets' provenance. */
export interface ValuesFile {
  version: 1;
  template: { module: string; id: string; version: string; sha256?: string };
  formats?: string[];
  values: Record<string, unknown>;
  /** By field path (`artwork`, `stories[1].image`): each file's hash and where it came from. Render never reads it. */
  assets?: Record<string, AssetRecord>;
}

export interface AssetRecord {
  sha256?: string;
  source?: { kind: "supplied" | "generated" | "stock" | string; [key: string]: unknown };
}

/** Values written as a values file (JSON in and out, no file system): checked first, and refused (thrown) with problems. */
export function toValuesFile(template: Template<any, any>, values: unknown, options: { module: string; formats?: string[]; sha256?: string; assets?: Record<string, AssetRecord> }): ValuesFile {
  // The values read, not built: a slot stored as its module has no content here, and a slot's JSX is stored captured.
  const reading = { diagnostics: [] as Diagnostic[], name: `${template.id} ${template.version}`, isElement: React.isValidElement };
  const read = readValues(template.fields, own(values, React.isValidElement), "values", reading);
  const formatNames = Object.keys(template.formats ?? {});
  const unknown = (options.formats ?? []).filter((format) => !formatNames.includes(format));
  const diagnostics = [...reading.diagnostics];
  for (const format of unknown) diagnostics.push(fail("template/format", `${template.id} has the formats ${formatNames.join(", ") || "(none)"}, not ${JSON.stringify(format)}`, "formats"));
  if (!read || hasErrors(diagnostics)) throw new ElementsError(diagnostics);
  const stored: Record<string, unknown> = { ...read };
  for (const [name, value] of Object.entries(read)) {
    if (!React.isValidElement(value)) continue;
    const fragment = captureFragment(value);
    if (fragment.aborted || hasErrors(fragment.diagnostics)) throw new ElementsError(fragment.diagnostics.map((d) => ({ ...d, path: `values.${name}` })));
    stored[name] = { fragment: JSON.parse(JSON.stringify(fragment)) };
  }
  const checked = { values: stored };
  return {
    version: 1,
    template: { module: options.module, id: template.id, version: template.version, ...(options.sha256 ? { sha256: options.sha256 } : {}) },
    ...(options.formats ? { formats: [...options.formats] } : {}),
    // Defaults written out: a later minor release that changes one doesn't change this design.
    values: JSON.parse(JSON.stringify(checked.values)) as Record<string, unknown>,
    ...(options.assets ? { assets: JSON.parse(JSON.stringify(options.assets)) as Record<string, AssetRecord> } : {}),
  };
}

/**
 * A values file read against the template it names: its id, its version (a newer minor is read again with a note, a
 * newer major through the template's migrations, an older template refused), then its values. Never throws.
 * `migrated` is its values as this version of the template takes them (its id and version accepted, its migrations
 * run), before its fields read them: what a tool changes in a file whose values aren't valid yet (a draft, or one to
 * repair), so the migrations are never skipped.
 */
export function readValuesFile(
  file: unknown,
  template: Template<any, any>
): { values?: Record<string, unknown>; migrated?: Record<string, unknown>; formats?: string[]; assets: Record<string, AssetRecord>; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const done = () => ({ assets: {}, diagnostics });
  if (!isPlainObject(file) || file.version !== 1 || !isPlainObject(file.template) || !isPlainObject(file.values)) {
    diagnostics.push(fail("template/values-file", "A values file is { version: 1, template: { module, id, version }, values, … }", "file"));
    return done();
  }
  const reference = file.template;
  if (reference.id !== template.id) {
    diagnostics.push(fail("template/id", `This values file is for ${JSON.stringify(reference.id)}, not ${template.id}`, "template.id"));
    return done();
  }
  if (!isVersion(reference.version)) {
    diagnostics.push(fail("template/version", `A values file records its template's version as semver, not ${JSON.stringify(reference.version)}`, "template.version"));
    return done();
  }
  const recorded = reference.version;
  let values: unknown = file.values;
  const order = compareVersions(recorded, template.version);
  if (order > 0) {
    diagnostics.push(fail("template/version", `This values file was made with ${template.id} ${recorded}, newer than ${template.version}: update the template`, "template.version"));
    return done();
  }
  if (order < 0) {
    const [from, to] = [versionParts(recorded)[0], versionParts(template.version)[0]];
    for (let major = from; major < to; major++) {
      const migrate = template.migrate?.[major];
      if (!migrate) {
        diagnostics.push(fail("template/version", `This values file was made with ${template.id} ${recorded}; ${template.version} is a new major version, and has no migration from ${major}.x`, "template.version"));
        return done();
      }
      try {
        values = own(migrate(values as Record<string, unknown>), () => false);
      } catch (thrown) {
        diagnostics.push(fail("template/version", `${template.id}'s migration from ${major}.x threw: ${thrown instanceof Error ? thrown.message : String(thrown)}`, "template.version"));
        return done();
      }
    }
    diagnostics.push({ code: "template/upgraded", severity: "info", message: `Made with ${template.id} ${recorded}, read with ${template.version}${from < to ? " through its migrations" : ""}: the next write records the new version`, path: "template.version" });
  }
  const reading = { diagnostics, name: `${template.id} ${template.version}`, isElement: React.isValidElement };
  const read = readValues(template.fields, values, "values", reading);
  const formatNames = Object.keys(template.formats ?? {});
  const formats = Array.isArray(file.formats) ? file.formats.filter((f): f is string => typeof f === "string") : undefined;
  for (const format of formats ?? []) if (!formatNames.includes(format)) diagnostics.push(fail("template/format", `${template.id} has the formats ${formatNames.join(", ") || "(none)"}, not ${JSON.stringify(format)}`, "formats"));
  const assets = isPlainObject(file.assets) ? (JSON.parse(JSON.stringify(file.assets)) as Record<string, AssetRecord>) : {};
  return { ...(read && !hasErrors(diagnostics) ? { values: read } : {}), ...(isPlainObject(values) ? { migrated: values as Record<string, unknown> } : {}), ...(formats ? { formats } : {}), assets, diagnostics };
}
