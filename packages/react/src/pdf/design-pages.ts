import type { Plan, PlannedPart } from "@hyper-elements/core";

/** A part of a builder design on a page: where it is in the design's body, its id there, and whether it starts or ends there. */
export interface DesignPagePart {
  at: string;
  id?: string;
  /** The page has its first part (it starts here), and its last (it ends here). On both, it's whole on the page. */
  first: boolean;
  last: boolean;
}

/**
 * Each page's parts of a builder design, as a plan of the template fromDesign() made of it puts them: `parts` is
 * fromDesign()'s, the plan is of its `element`. A page lists every part of the design with something on it, in the
 * order it's drawn (a row before its columns, a column before its blocks, a table before its rows), each once. A
 * part that goes on from the page before isn't `first`; one that goes on to the next isn't `last`. A table's header
 * rows are on every page it runs to, whole on each. The Document's header and footer aren't listed: they're on every
 * page.
 */
export function designPages(plan: Plan, parts: Readonly<Record<string, { at: string; id?: string }>>): DesignPagePart[][] {
  // What's in each node, and each part of the design's outermost nodes (a text of several paragraphs has one each, a
  // row split by a page break a band each), both in the template's order: by each path's place, not the keys' order
  // (which a copy of `parts` stored or sent can change).
  const inside = new Map<string, string[]>();
  const outermost = new Map<string, string[]>();
  const place = new Map(Object.keys(parts).map((path) => [path, [...path.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))]));
  const before = (a: string, b: string) => {
    const x = place.get(a)!;
    const y = place.get(b)!;
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
    return x.length - y.length;
  };
  for (const path of [...place.keys()].sort(before)) {
    const part = parts[path];
    const around = path.replace(/\.children\[\d+\]$/, "");
    inside.set(around, [...(inside.get(around) ?? []), path]);
    if (parts[around]?.at !== part.at) outermost.set(part.at, [...(outermost.get(part.at) ?? []), path]);
  }
  // Each page's nodes with something on it, each with whether its first and its last parts are there.
  const pages = plan.pages.map((page) => {
    const on = new Map<string, { first: boolean; last: boolean }>();
    const note = (path: string, first: boolean, last: boolean) => {
      const was = on.get(path);
      on.set(path, { first: first || !!was?.first, last: last || !!was?.last });
    };
    // What's in a block planned as one part (whole on the page, or a text's lines) is there as it is.
    const within = (path: string, first: boolean, last: boolean) => {
      for (const child of inside.get(path) ?? []) {
        note(child, first, last);
        within(child, first, last);
      }
    };
    const visit = (part: PlannedPart) => {
      // A Row's column with nothing on this page keeps its room there and draws nothing.
      if (part.empty) return;
      note(part.path, part.first, part.last);
      if (part.children) part.children.forEach(visit);
      else within(part.path, part.first, part.last);
    };
    page.parts.forEach(visit);
    return on;
  });
  // A part starts where its first drawn node does, and ends where its last drawn node does.
  const drawn = new Set(pages.flatMap((on) => [...on.keys()]));
  const ends = new Map<string, { from: string; to: string }>();
  for (const [at, nodes] of outermost) {
    const shown = nodes.filter((path) => drawn.has(path));
    if (shown.length) ends.set(at, { from: shown[0], to: shown[shown.length - 1] });
  }
  return pages.map((on) => {
    const listed = new Map<string, DesignPagePart>();
    for (const path of on.keys()) {
      const of = parts[path];
      const end = of && ends.get(of.at);
      if (!of || !end || listed.has(of.at)) continue;
      listed.set(of.at, { at: of.at, ...(of.id !== undefined ? { id: of.id } : {}), first: !!on.get(end.from)?.first, last: !!on.get(end.to)?.last });
    }
    return [...listed.values()];
  });
}
