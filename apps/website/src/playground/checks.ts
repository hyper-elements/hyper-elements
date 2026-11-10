// The checks under the code: the template's diagnostics (each with its code, where it is, the email clients it's
// about and what to write instead), its outline, and what it logged. Everything here came from the sandbox, so it's
// written as text.
import type { Diagnostic, PlaygroundError, Result } from "../../playground/protocol";
import { h, plural } from "./dom";

export type Pick = { path?: string; line?: number; tone: "error" | "warning" | "info" };
export interface ChecksEvents {
  /** The pointer is over a diagnostic or an outline line (null: it left). */
  point(pick: Pick | null): void;
  /** One was clicked. */
  go(pick: Pick): void;
}

const SEVERITIES = ["error", "warning", "info"] as const;
type Severity = (typeof SEVERITIES)[number];
const NAMES: Record<Severity, [string, string]> = { error: ["error", "errors"], warning: ["warning", "warnings"], info: ["note", "notes"] };

/** An email client by the name @hyper-elements/email-clients gives it (a result carries them); its id where there's none. */
export const clientName = (id: string, names: Record<string, string> | undefined) => names?.[id] ?? id;

const ERROR_TITLES: Record<PlaygroundError["kind"], string> = {
  syntax: "Syntax error",
  import: "Import",
  export: "Nothing to render",
  runtime: "The code threw",
  template: "",
  internal: "The playground",
  timeout: "Stopped",
};

export class Checks {
  private filter: Severity | null = null;
  private result: Result | null = null;
  private extra: Diagnostic[] = [];

  constructor(
    private elements: { diagnostics: HTMLElement; outline: HTMLElement; console: HTMLElement },
    private events: ChecksEvents,
  ) {}

  /** Every diagnostic shown: the render's, then what a PDF or an image of it added. */
  all(): Diagnostic[] {
    const seen = new Set<string>();
    const order = (d: Diagnostic) => SEVERITIES.indexOf(d.severity);
    return [...(this.result?.diagnostics ?? []), ...this.extra]
      .filter((d) => {
        const key = `${d.code}|${d.path}|${d.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => order(a) - order(b));
  }

  counts(): Record<Severity, number> {
    const counts = { error: 0, warning: 0, info: 0 };
    for (const d of this.all()) counts[d.severity]++;
    const failure = this.result?.error;
    if (failure && failure.kind !== "template") counts.error++;
    return counts;
  }

  show(result: Result | null, extra: Diagnostic[] = []) {
    this.result = result;
    this.extra = extra;
    this.drawDiagnostics();
    this.drawOutline();
    this.drawConsole();
  }

  private drawDiagnostics() {
    const list = this.elements.diagnostics;
    const all = this.all();
    const counts = this.counts();
    if (this.filter && !counts[this.filter]) this.filter = null;
    const items: HTMLElement[] = [];
    const failure = this.result?.error;
    if (failure && failure.kind !== "template" && !(failure.kind === "internal" && failure.message === "superseded")) {
      const pick: Pick = { line: failure.line, tone: "error" };
      items.push(
        h(
          "li",
          { class: "pg-problem", tabindex: 0, role: "button", onclick: () => this.events.go(pick), onkeydown: (event: KeyboardEvent) => event.key === "Enter" && this.events.go(pick) },
          h("b", null, `${ERROR_TITLES[failure.kind]}${failure.line ? ` · line ${failure.line}` : ""}`),
          h("p", null, failure.message),
        ),
      );
    }
    if (all.length > 5) {
      items.push(
        h(
          "li",
          { class: "pg-diag-filter" },
          ...SEVERITIES.filter((severity) => counts[severity] > 0).map((severity) =>
            h(
              "button",
              {
                type: "button",
                "data-severity": severity,
                "aria-pressed": String(this.filter === severity),
                onclick: () => {
                  this.filter = this.filter === severity ? null : severity;
                  this.drawDiagnostics();
                },
              },
              h("i"),
              plural(all.filter((d) => d.severity === severity).length, ...NAMES[severity]),
            ),
          ),
        ),
      );
    }
    for (const d of all) {
      if (this.filter && d.severity !== this.filter) continue;
      const pick: Pick = { path: d.node ?? d.path, line: d.line, tone: d.severity };
      items.push(
        h(
          "li",
          {
            class: "pg-diag",
            "data-severity": d.severity,
            "data-path": d.node ?? "",
            tabindex: 0,
            role: "button",
            "aria-label": `${d.severity}: ${d.code}. ${d.message}`,
            onmouseenter: () => this.events.point(pick),
            onmouseleave: () => this.events.point(null),
            onfocus: () => this.events.point(pick),
            onblur: () => this.events.point(null),
            onclick: (event: MouseEvent) => !(event.target as HTMLElement).closest("a") && this.events.go(pick),
            onkeydown: (event: KeyboardEvent) => event.key === "Enter" && this.events.go(pick),
          },
          h("span", { class: "pg-diag-mark", title: d.severity }),
          h("span", { class: "pg-diag-head" }, h("span", { class: "pg-diag-code" }, d.code), d.clients?.length ? h("span", { class: "pg-diag-clients" }, ...d.clients.map((client) => h("span", null, clientName(client, this.result?.clientNames)))) : null),
          d.line ? h("span", { class: "pg-diag-line" }, `line ${d.line}`) : h("span"),
          h(
            "div",
            { class: "pg-diag-body" },
            h("p", { class: "pg-diag-message" }, d.message),
            d.fix ? h("p", { class: "pg-diag-fix" }, d.fix) : null,
            h("span", { class: "pg-diag-path" }, d.path, d.see ? h("a", { href: d.see, target: "_blank", rel: "noopener noreferrer" }, "caniemail ↗") : null),
          ),
        ),
      );
    }
    if (!items.length) {
      items.push(
        this.result
          ? h("li", { class: "pg-empty", "data-tone": "ok" }, h("strong", null, "No diagnostics"), "Nothing to fix, nothing degraded.")
          : h("li", { class: "pg-empty", "data-tone": "quiet" }, "What validate() says of the template shows here."),
      );
    }
    list.replaceChildren(...items);
  }

  private drawOutline() {
    const host = this.elements.outline;
    const outline = this.result?.outline;
    if (!outline) {
      host.replaceChildren(h("div", { class: "pg-empty", "data-tone": "quiet" }, this.result ? "outline() prints the template laid out, once it has no errors." : "outline() prints the template laid out: each block, its width, its words."));
      return;
    }
    const paths = this.result?.outlinePaths;
    host.replaceChildren(
      ...outline.split("\n").map((line, index) => {
        // "  Heading h1 536px "Words"": the indent, the component, the rest.
        const [, indent, type, rest] = /^(\s*)([\w.]+)(.*)$/.exec(line) ?? [null, "", line, ""];
        const pick: Pick = { path: paths?.[index], tone: "info" };
        return h(
          "span",
          { class: "pg-outline-line", "data-path": paths?.[index] ?? "", onmouseenter: () => this.events.point(pick), onmouseleave: () => this.events.point(null), onclick: () => this.events.go(pick) },
          indent,
          h("b", null, type),
          ...splitQuoted(rest),
        );
      }),
    );
  }

  private drawConsole() {
    const logs = this.result?.logs ?? [];
    this.elements.console.replaceChildren(
      ...(logs.length ? logs.map((log) => h("li", { "data-level": log.level }, h("span", null, log.level), log.message)) : [h("li", { class: "pg-empty", "data-tone": "quiet", style: "display:grid;grid-template-columns:1fr" }, "What the template logs with console.log shows here.")]),
    );
  }

  /** Mark the diagnostics and the outline line about a block (the one under the pointer in the preview). */
  mark(path: string | null) {
    for (const host of [this.elements.diagnostics, this.elements.outline]) {
      for (const element of host.querySelectorAll<HTMLElement>("[data-active]")) delete element.dataset.active;
      if (!path) continue;
      for (const element of host.querySelectorAll<HTMLElement>("[data-path]")) if (element.dataset.path === path) element.dataset.active = "";
    }
  }
}

/** An outline line's details, with what it measured dimmer than what it says. */
function splitQuoted(rest: string): Array<Node | string> {
  const quote = rest.indexOf(' "');
  if (quote === -1) return [h("i", null, rest)];
  return [h("i", null, rest.slice(0, quote)), rest.slice(quote)];
}
