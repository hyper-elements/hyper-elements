/**
 * The builder adapter: a template in the new components as the Unlayer builder's design JSON, and
 * a design (edited in the builder or not) back as a template. The design holds no Elements data: a style or prop a
 * tool has no field for is a hidden property of that tool (manifest.ts), kept in the design with no editor yet. What
 * the builder can't arrange comes back as the builder holds it: the same look, flatter.
 */
import type { EmailAssetsOption } from "@hyper-elements/core";
import type React from "react";
import { printTemplate, toElement } from "./print";
import { readDesign, type DisplayMode } from "./read";
import { checkTemplate } from "./check";
import { uniqueIds } from "./ids";
import { writeDesign, type Design, type DesignResult } from "./write";

export type { Design, DesignResult, DisplayMode };

export interface ToDesignOptions {
  /**
   * For an Email with a Canvas (or an Svg): where its pictures' files are hosted, and what draws them, as render()
   * takes them. Each picture goes to the builder as an image linking the file render() returns for it.
   */
  assets?: EmailAssetsOption;
}

/**
 * A template in the new components (an `<Email>`, a `<Page>` or a `<Document>`) as the builder's design JSON; with
 * `assets`, an Email's pictures linking the files render() returns for them.
 */
export function toDesign(element: React.ReactElement, options: ToDesignOptions): DesignResult;
/** A template in the new components (an `<Email>`, a `<Page>` or a `<Document>`) as the builder's design JSON. */
export function toDesign(element: React.ReactElement): DesignResult;
export function toDesign(element: React.ReactElement, options?: ToDesignOptions): DesignResult {
  // As a callback (emails.map(toDesign)), it's given an index: that's no options.
  return writeDesign(element, typeof options === "object" && options !== null ? options : {});
}

export interface TemplateResult {
  /** The template, to render. */
  element: React.ReactElement;
  /** The template as JSX source in the new components. */
  code: string;
  /** What of the design the template can't hold, and what was left out: one line each. */
  report: string[];
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
  return { element: toElement(root), code, report };
}
