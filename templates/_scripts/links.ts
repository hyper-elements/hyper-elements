/**
 * A design's values for another brand: its links on that brand's site. A design is written for one brand, its links on
 * that brand's site; drawn in another, they're moved to its site (inside a slot's JSX too), so they pass its rules.
 * Used by the tests, the website's generator and its image worker, so it imports nothing but React.
 */
import { cloneElement, isValidElement } from "react";
import type { Brand } from "../_brand";

export function valuesIn(values: Record<string, unknown>, brand: Brand, others: readonly Brand[]): Record<string, unknown> {
  const sites = others.map((b) => b.links.site).filter((site) => site !== brand.links.site);
  const move = (value: unknown): unknown => {
    if (typeof value === "string") {
      const from = sites.find((site) => value === site || value.startsWith(`${site}/`));
      return from ? brand.links.site + value.slice(from.length) : value;
    }
    if (Array.isArray(value)) return value.map(move);
    if (isValidElement(value)) {
      // Its children passed as they were written (one by one, not as a list, which React would want keys for).
      const { children, ...props } = value.props as { children?: unknown };
      const moved = move(children);
      return cloneElement(value, move(props) as object, ...(Array.isArray(moved) ? moved : moved === undefined ? [] : [moved]) as never[]);
    }
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, move(v)]));
    return value;
  };
  return move(values) as Record<string, unknown>;
}
