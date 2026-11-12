// The playground's code editor: CodeMirror, on the site's dark code surface with a color theme of its own (the site's
// static code blocks are greyscale; code someone is writing reads better in color), and the template's diagnostics on
// the lines they're about.
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic as Mark } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, type DecorationSet } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/** The editor is a code surface: dark in both of the site's themes, as its code blocks are. */
const theme = EditorView.theme(
  {
    "&": { height: "100%", color: "#d6d6d6", backgroundColor: "transparent", fontSize: "13px" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.7", overflow: "auto" },
    ".cm-content": { padding: "14px 0 40px", caretColor: "#ffffff" },
    ".cm-line": { padding: "0 18px 0 6px" },
    ".cm-gutters": { backgroundColor: "transparent", color: "#4f4f4f", border: "none", paddingLeft: "6px" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 8px", minWidth: "34px", fontSize: "12px" },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.035)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#a1a1a1" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#ffffff", borderLeftWidth: "1.5px" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "rgba(255, 255, 255, 0.16)" },
    ".cm-selectionMatch": { backgroundColor: "rgba(255, 255, 255, 0.09)" },
    "&.cm-focused .cm-matchingBracket": { backgroundColor: "rgba(255, 255, 255, 0.14)", outline: "none" },
    ".cm-searchMatch": { backgroundColor: "rgba(245, 185, 113, 0.25)" },
    ".cm-panels": { backgroundColor: "#161616", color: "#ededed", borderTop: "1px solid rgba(255,255,255,0.08)" },
    ".cm-panels input, .cm-panels button": { font: "inherit" },
    ".cm-tooltip": { backgroundColor: "#161616", border: "1px solid rgba(255,255,255,0.13)", borderRadius: "10px", color: "#ededed", boxShadow: "0 18px 40px -18px rgba(0,0,0,0.9)", overflow: "hidden" },
    ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--mono)", fontSize: "12.5px", maxHeight: "16em" },
    ".cm-tooltip-autocomplete > ul > li": { padding: "4px 10px" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "rgba(255,255,255,0.1)", color: "#ffffff" },
    ".cm-completionDetail": { color: "#6e6e6e", fontStyle: "normal", marginLeft: "12px" },
    ".cm-tooltip-lint": { padding: "0" },
    ".cm-diagnostic": { padding: "8px 12px", borderLeft: "2px solid #6e6e6e", font: "400 12.5px/1.5 var(--sans)", maxWidth: "46ch", whiteSpace: "normal" },
    ".cm-diagnostic-error": { borderLeftColor: "#ff7b6e" },
    ".cm-diagnostic-warning": { borderLeftColor: "#f5b971" },
    ".cm-diagnostic-info": { borderLeftColor: "#6e6e6e" },
    ".cm-diagnosticSource": { font: "500 11px var(--mono)", color: "#a1a1a1", opacity: "1" },
    ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy #ff7b6e", textDecorationSkipInk: "none", textUnderlineOffset: "4px" },
    ".cm-lintRange-warning": { backgroundImage: "none", textDecoration: "underline wavy #f5b971", textDecorationSkipInk: "none", textUnderlineOffset: "4px" },
    // Notes mark their line in the gutter only: an email has many, and none is a mistake.
    ".cm-lintRange-info, .cm-lintRange-hint": { backgroundImage: "none" },
    ".cm-gutter-lint": { width: "12px" },
    ".cm-lint-marker": { width: "6px", height: "6px", borderRadius: "50%", margin: "8px 3px 0", content: "none" },
    ".cm-lint-marker-error": { content: "none", backgroundColor: "#ff7b6e" },
    ".cm-lint-marker-warning": { content: "none", backgroundColor: "#f5b971" },
    ".cm-lint-marker-info": { content: "none", backgroundColor: "#5a5a5a" },
    ".cm-pg-line": { backgroundColor: "rgba(255, 255, 255, 0.07)", boxShadow: "inset 2px 0 0 #ffffff" },
    ".cm-pg-line-error": { backgroundColor: "rgba(255, 123, 110, 0.1)", boxShadow: "inset 2px 0 0 #ff7b6e" },
    ".cm-pg-line-warning": { backgroundColor: "rgba(245, 185, 113, 0.1)", boxShadow: "inset 2px 0 0 #f5b971" },
    ".cm-pg-flash": { animation: "pg-flash 1.1s ease-out" },
  },
  { dark: true },
);

/**
 * The code's colors (the same in the HTML tab, `.pg-source` in playground.css). Four hues on the panel's near-black:
 * blue for components and calls, lavender for keywords, sand for strings, sky for numbers. Coral and mint stay out of
 * it: on this site they mean an error and a success, and a diagnostic's mark has to read as one.
 */
export const SYNTAX = {
  text: "#d6d6d6",
  comment: "#6b6b6b",
  keyword: "#c4a7e7",
  component: "#7ab8ff",
  call: "#9cc8ff",
  name: "#b9c3d4",
  string: "#e4cfa1",
  value: "#89dceb",
  mark: "#727272",
};

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: SYNTAX.comment, fontStyle: "italic" },
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.self], color: SYNTAX.keyword },
  { tag: [t.string, t.special(t.string), t.regexp, t.attributeValue], color: SYNTAX.string },
  { tag: [t.number, t.bool, t.null, t.atom], color: SYNTAX.value },
  // A component's tag is what a template is made of: the brightest hue.
  { tag: [t.tagName, t.standard(t.tagName)], color: SYNTAX.component },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.typeName, t.className, t.namespace], color: SYNTAX.call },
  // A prop's name and a style's key read alike: they're the same kind of thing.
  { tag: [t.attributeName, t.propertyName, t.definition(t.propertyName)], color: SYNTAX.name },
  { tag: [t.variableName, t.definition(t.variableName)], color: SYNTAX.text },
  { tag: [t.punctuation, t.bracket, t.angleBracket, t.separator, t.operator, t.derefOperator], color: SYNTAX.mark },
  { tag: t.invalid, color: "#ff7b6e" },
]);

// A line the page points at (a diagnostic hovered, a block under the pointer in the preview), and a change it made.
type Pointed = { line: number; tone: "plain" | "error" | "warning" } | null;
const point = StateEffect.define<Pointed>();
const flash = StateEffect.define<{ from: number; to: number } | null>();

const lineClass = { plain: "cm-pg-line", error: "cm-pg-line cm-pg-line-error", warning: "cm-pg-line cm-pg-line-warning" };
const pointed = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    marks = marks.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(point)) {
        const value = effect.value;
        marks = value && value.line >= 1 && value.line <= transaction.state.doc.lines ? Decoration.set([Decoration.line({ class: lineClass[value.tone] }).range(transaction.state.doc.line(value.line).from)]) : Decoration.none;
      }
    }
    return marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});
const flashed = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    marks = marks.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(flash)) continue;
      const value = effect.value;
      marks = value && value.to > value.from ? Decoration.set([Decoration.mark({ class: "cm-pg-flash" }).range(value.from, Math.min(value.to, transaction.state.doc.length))]) : Decoration.none;
    }
    return marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export interface Problem {
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  source?: string;
}

/** What the editor completes: each component, and inside a tag its props. Given once the runtime describes them. */
export interface Vocabulary {
  components: Array<{ name: string; summary: string; props: Array<{ name: string; detail: string }>; styles: Array<{ name: string; detail: string }> }>;
}

export interface EditorOptions {
  parent: HTMLElement;
  code: string;
  onChange(code: string): void;
  /** The line the cursor is on, as it moves. */
  onCursor(line: number): void;
  onRun(): void;
}

export class Editor {
  readonly view: EditorView;
  private vocabulary: Vocabulary = { components: [] };
  private quiet = false;

  constructor(private options: EditorOptions) {
    this.view = new EditorView({
      parent: options.parent,
      state: EditorState.create({
        doc: options.code,
        extensions: [
          lineNumbers(),
          lintGutter(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          EditorState.tabSize.of(2),
          indentUnit.of("  "),
          javascript({ jsx: true, typescript: true }),
          syntaxHighlighting(highlight),
          autocompletion({ override: [(context) => this.complete(context)], icons: false }),
          theme,
          pointed,
          flashed,
          keymap.of([
            { key: "Mod-Enter", run: () => (options.onRun(), true) },
            { key: "Mod-s", run: () => (options.onRun(), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.contentAttributes.of({ "aria-label": "Template code", spellcheck: "false", autocapitalize: "off", autocorrect: "off" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !this.quiet) options.onChange(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) options.onCursor(update.state.doc.lineAt(update.state.selection.main.head).number);
          }),
        ],
      }),
    });
  }

  get code(): string {
    return this.view.state.doc.toString();
  }

  /** Replace the code. `silent` for code the page itself puts in (it renders it itself). */
  setCode(code: string, options: { silent?: boolean; flash?: { from: number; to: number } } = {}) {
    this.quiet = options.silent ?? false;
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: code },
      effects: [point.of(null), flash.of(options.flash ?? null)],
      selection: options.flash ? { anchor: Math.min(options.flash.from, code.length) } : { anchor: 0 },
      scrollIntoView: Boolean(options.flash),
    });
    this.quiet = false;
    if (!options.flash) this.view.scrollDOM.scrollTop = 0;
  }

  setProblems(problems: Problem[]) {
    const doc = this.view.state.doc;
    const marks: Mark[] = problems
      .filter((problem) => problem.line >= 1 && problem.line <= doc.lines)
      .map((problem) => {
        const line = doc.line(problem.line);
        const indent = /^\s*/.exec(line.text)?.[0].length ?? 0;
        return { from: line.from + Math.min(indent, line.length), to: line.to, severity: problem.severity, message: problem.message, source: problem.source };
      });
    this.view.dispatch(setDiagnostics(this.view.state, marks));
  }

  /** Mark a line without moving to it (null: none). */
  pointAt(line: number | null, tone: "plain" | "error" | "warning" = "plain", reveal = false) {
    const effects: StateEffect<unknown>[] = [point.of(line ? { line, tone } : null)];
    if (line && reveal && line <= this.view.state.doc.lines) effects.push(EditorView.scrollIntoView(this.view.state.doc.line(line).from, { y: "center" }));
    this.view.dispatch({ effects });
  }

  /** Put the cursor on a line and bring it into view. */
  goTo(line: number, column = 1, focus = true) {
    const doc = this.view.state.doc;
    if (line < 1 || line > doc.lines) return;
    const at = doc.line(line);
    const indent = /^\s*/.exec(at.text)?.[0].length ?? 0;
    const anchor = Math.min(at.from + Math.max(column - 1, indent), at.to);
    this.view.dispatch({ selection: { anchor }, effects: EditorView.scrollIntoView(anchor, { y: "center" }) });
    if (focus) this.view.focus();
  }

  setVocabulary(vocabulary: Vocabulary) {
    this.vocabulary = vocabulary;
  }

  /** A component's name after `<`; a prop's inside that component's tag. */
  private complete(context: CompletionContext) {
    const { components } = this.vocabulary;
    if (!components.length) return null;
    const before = context.state.sliceDoc(Math.max(0, context.pos - 2000), context.pos);
    const tag = /<([A-Z][\w.]*)?$/.exec(before);
    if (tag) {
      const options: Completion[] = components.map((component) => ({ label: component.name, type: "class", detail: component.summary.length > 46 ? `${component.summary.slice(0, 45)}…` : component.summary, boost: component.name.includes(".") ? -1 : 0 }));
      return { from: context.pos - (tag[1]?.length ?? 0), options, validFor: /^[\w.]*$/ };
    }
    const short = (detail: string) => (detail.length > 52 ? `${detail.slice(0, 51)}…` : detail);
    // Inside a tag's style={{ … }}, where a key goes: its styles, and the phone and hover blocks.
    const style = /<([A-Z][\w.]*)\b[^<>]*?\sstyle=\{\{([^<>]*)$/.exec(before);
    if (style) {
      const inner = style[2];
      const depth = 1 + (inner.match(/\{/g)?.length ?? 0) - (inner.match(/\}/g)?.length ?? 0);
      const key = /(?:^|[{,])\s*([A-Za-z]*)$/.exec(inner);
      const component = components.find((each) => each.name === style[1]);
      if (depth >= 1 && key && component && (key[1] || context.explicit)) {
        const given = new Set([...inner.matchAll(/([A-Za-z]+)\s*:/g)].map((match) => match[1]));
        const blocks: Completion[] = depth === 1 ? ["mobile", "hover", "apply"].filter((name) => !given.has(name)).map((name) => ({ label: name, type: "keyword", detail: name === "apply" ? "the theme's named styles" : `styles ${name === "mobile" ? "on phones" : "under the pointer"}`, apply: name === "apply" ? "apply: []" : `${name}: {  }` })) : [];
        return {
          from: context.pos - key[1].length,
          options: [...component.styles.filter((each) => depth > 1 || !given.has(each.name)).map((each): Completion => ({ label: each.name, type: "property", detail: short(each.detail), apply: `${each.name}: ` })), ...blocks],
          validFor: /^[A-Za-z]*$/,
        };
      }
    }
    // Inside an opening tag: after the tag's name and any complete attributes, a word being typed.
    const open = /<([A-Z][\w.]*)((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}))?)*)\s+([\w-]*)$/.exec(before);
    if (!open || (!open[3] && !context.explicit)) return null;
    const component = components.find((each) => each.name === open[1]);
    if (!component) return null;
    const given = new Set([...open[2].matchAll(/\s([\w-]+)/g)].map((match) => match[1]));
    const props: Completion[] = component.props.filter((prop) => !given.has(prop.name)).map((prop) => ({ label: prop.name, type: "property", detail: short(prop.detail) }));
    if (component.styles.length && !given.has("style")) props.unshift({ label: "style", type: "property", detail: "its styles: a number is px", apply: "style={{  }}", boost: 1 });
    return { from: context.pos - open[3].length, options: props, validFor: /^[\w-]*$/ };
  }
}
