/**
 * The builder adapter: a template in the new components as the Unlayer builder's design JSON, and
 * a design (edited in the builder or not) back as a template. The design holds no Elements data: a style or prop a
 * tool has no field for is a hidden property of that tool (manifest.ts), kept in the design with no editor yet. What
 * the builder can't arrange comes back as the builder holds it: the same look, flatter.
 */
import type React from "react";
import { printTemplate, toElement } from "./print";
import { readDesign, type DisplayMode } from "./read";
import { checkTemplate } from "./check";
import { uniqueIds } from "./ids";
import { writeDesign, type Design, type DesignResult } from "./write";
import { partsOf, type DesignPart } from "./parts";

export type { Design, DesignPart, DesignResult, DisplayMode };

/** A template in the new components (an `<Email>`, a `<Page>` or a `<Document>`) as the builder's design JSON. */
export function toDesign(element: React.ReactElement): DesignResult {
  return writeDesign(element);
}

export interface TemplateResult {
  /** The template, to render. */
  element: React.ReactElement;
  /** The template as JSX source in the new components. */
  code: string;
  /** What of the design the template can't hold, and what was left out: one line each. */
  report: string[];
  /**
   * The part of the design each node of `element` stands for, by its path in it (`root.children[3]`, as a Document's
   * plan names it): where it is in the design's body (`rows[2].columns[0].contents[1]`, a table's
   * `….values.table.rows[3]`, `headers`), and its id there (`values._meta.htmlID`), where it has one. A node made
   * around a block (its padding) stands for that block, and a block's text for it. With `designPages()` from
   * `@hyper-elements/react/pdf`, a plan of `element` says which of the design's parts go on each page. It holds for
   * this `element` and this design: a design written again by toDesign() has ids of its own. A place is in the design
   * as the builder loads it, a value the design leaves out its tool's default (a table saved without its `table`
   * value has the table tool's rows).
   */
  parts: Record<string, DesignPart>;
}

export interface FromDesignOptions {
  /**
   * The builder's display mode the design was made in: its root. "email" is an Email, "web" a Page, "document" a
   * Document. Without one, a design with a header, a footer or a page break is a Document, any other an Email.
   */
  displayMode?: DisplayMode;
  /** The name of the component in `code`. */
  name?: string;
  /**
   * Your sanitizer for a design's markup, as today's exporters take it in their config: every builder `html` block's
   * markup, and every text's (before it's read, as theirs is), goes through it. Without one, a design's markup is
   * kept as it is: give one where a design can hold untrusted content.
   */
  toSafeHtml?: (html: string) => string;
}

/** The builder's design JSON (made by toDesign() or in the builder) as a template in the new components. */
export function fromDesign(design: unknown, options: FromDesignOptions = {}): TemplateResult {
  const report: string[] = [];
  const root = checkTemplate(uniqueIds(readDesign(design, options.displayMode, report, options.toSafeHtml)), report);
  const code = printTemplate(root, options.name, report);
  return { element: toElement(root), code, report, parts: partsOf(root) };
}
