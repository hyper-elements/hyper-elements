import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic as Marker } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { Diagnostic } from "../../playground/protocol";

const colors = HighlightStyle.define([
  { tag: tags.tagName, color: "#7ab8ff" },
  { tag: [tags.attributeName, tags.propertyName], color: "#9cc8ff" },
  { tag: [tags.attributeValue, tags.string], color: "#e4cfa1" },
  { tag: [tags.number, tags.unit, tags.atom, tags.bool], color: "#89dceb" },
  { tag: [tags.keyword, tags.meta], color: "#c4a7e7" },
  { tag: tags.comment, color: "#8a8a8a", fontStyle: "italic" },
  { tag: [tags.angleBracket, tags.punctuation], color: "#a1a1a1" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "#d4d4d4", fontSize: "12px" },
  "&.cm-focused": { outline: "1px solid #555", outlineOffset: "-1px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--mono)", lineHeight: "1.85" },
  ".cm-content": { padding: "6px 0 16px", caretColor: "#fff" },
  ".cm-line": { padding: "0 16px 0 6px" },
  ".cm-gutters": { backgroundColor: "#101010", color: "#8a8a8a", border: "none", paddingLeft: "4px" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px", minWidth: "30px" },
  ".cm-gutter-lint": { width: "16px" },
  ".cm-gutter-lint .cm-gutterElement": { display: "flex", alignItems: "center", justifyContent: "center", padding: "0" },
  ".cm-cursor": { borderLeftColor: "#fff" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#ffffff29" },
  ".cm-tooltip": { backgroundColor: "#1c1c1c", color: "#eee", border: "1px solid #444", borderRadius: "6px" },
  ".cm-diagnostic": { maxWidth: "48ch", padding: "8px 12px", font: "12px/1.5 var(--sans)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  ".cm-diagnosticSource": { color: "#aaa" },
}, { dark: true });

/** Enhance the server-rendered textarea; keep its value in sync for the preview and browser agents. */
export class HtmlEditor {
  private readonly view: EditorView;
  private quiet = false;
  private diagnosticsVersion = 0;

  constructor(private readonly source: HTMLTextAreaElement, options: { onChange(): void; onRun(): void }) {
    const host = document.createElement("div");
    host.className = "et-html-editor";
    const label = source.labels?.[0];
    if (label && !label.id) label.id = `${source.id}-label`;
    source.before(host);
    this.view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: source.value,
        extensions: [
          html({ autoCloseTags: false }),
          syntaxHighlighting(colors),
          theme,
          lineNumbers(),
          lintGutter(),
          history(),
          drawSelection(),
          EditorState.tabSize.of(2),
          keymap.of([
            { key: "Mod-Enter", run: () => (options.onRun(), true) },
            { key: "Ctrl-Enter", run: () => (options.onRun(), true) },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.contentAttributes.of({
            "aria-label": "Email HTML",
            ...(label ? { "aria-labelledby": label.id } : {}),
            "aria-describedby": source.getAttribute("aria-describedby") ?? "",
            spellcheck: "false", autocapitalize: "off", autocorrect: "off", autocomplete: "off",
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            source.value = update.state.doc.toString();
            if (!this.quiet) options.onChange();
          }),
        ],
      }),
    });
    source.hidden = true;
    label?.addEventListener("click", () => this.view.focus());
  }

  /** The caller already schedules a preview when loading the example or an agent's HTML. */
  setCode(code: string) {
    if (this.view.state.doc.toString() === code) return;
    this.quiet = true;
    try {
      this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: code }, selection: { anchor: 0 } });
      this.view.scrollDOM.scrollTop = this.view.scrollDOM.scrollLeft = 0;
    } finally {
      this.quiet = false;
    }
  }

  setProblems(problems: Diagnostic[]) {
    const version = ++this.diagnosticsVersion;
    // An edit clears old findings from inside an editor update; apply them after that update finishes.
    queueMicrotask(() => {
      if (version !== this.diagnosticsVersion) return;
      const doc = this.view.state.doc;
      const marks: Marker[] = problems.flatMap((problem) => {
        if (!problem.line || problem.line < 1 || problem.line > doc.lines) return [];
        const line = doc.line(problem.line);
        const from = line.from + (/^\s*/.exec(line.text)?.[0].length ?? 0);
        return [{
          from, to: line.to, severity: problem.severity,
          message: `${problem.message}${problem.fix ? `\nFix: ${problem.fix}` : ""}${problem.clients?.length ? `\nClients: ${problem.clients.join(", ")}` : ""}`,
          source: problem.code.startsWith("lint/") ? "Hyper Elements lint" : problem.code === "email/html-input" ? "HTML validation" : "Email client compatibility",
        }];
      });
      this.view.dispatch(setDiagnostics(this.view.state, marks));
    });
  }
}
