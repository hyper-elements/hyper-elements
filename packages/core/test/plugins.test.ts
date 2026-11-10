/**
 * Plugins (plan email-client-models, D5): what a package outside core adds to validate and render. Core runs each hook
 * once, on copies; checks every diagnostic a plugin returns and drops what doesn't fit; maps paths to the template's;
 * merges equal ones; keeps the order; and never fails a render because of a plugin.
 */
import { COMPONENTS, PLUGIN_API, type ElementsPlugin, type PluginDiagnostic, type PluginInput, type PluginOutput } from "../src";
import { prepareTemplate, renderTemplate, validateTemplate } from "../src/writers";

const email = (children: unknown[], props: Record<string, unknown> = {}) => ({ root: { type: "Email", props: { width: 600, ...props }, children } });
const page = (children: unknown[]) => ({ root: { type: "Page", props: { width: 600 }, children } });
const text = (words: string, extra: Record<string, unknown> = {}) => ({ type: "Text", children: [words], ...extra });
const plugin = (name: string, hooks: Partial<Pick<ElementsPlugin, "check" | "checkOutput">>): ElementsPlugin => ({ name, api: PLUGIN_API, ...hooks });
const note = (path: string, extra: Partial<PluginDiagnostic> = {}): PluginDiagnostic => ({ code: "email/example", severity: "info", message: "An example", path, ...extra });
const codes = (diagnostics: { code: string }[]) => diagnostics.map((d) => d.code);

describe("plugins", () => {
  it("adds a plugin's check diagnostics after core's, plugins in the order passed, each in the order returned", () => {
    const template = email([text("a", { style: { letterSpacing: 2 } }), { type: "Row", style: { justifyContent: "space-between" }, children: [{ type: "Column" }] }]);
    const first = plugin("first", { check: () => [note("root.children[0]", { message: "one" }), note("root", { message: "two" })] });
    const second = plugin("second", { check: () => [note("root.children[1]", { message: "three" })] });
    const { diagnostics } = validateTemplate(template, { plugins: [first, second] });
    const core = validateTemplate(template).diagnostics;
    expect(diagnostics.slice(0, core.length)).toEqual(core);
    expect(diagnostics.slice(core.length).map((d) => d.message)).toEqual(["one", "two", "three"]);
  });

  it("gives check a frozen copy of the laid-out tree, with defaults, and touches neither the caller's objects nor the definitions", () => {
    const attrs = { "data-x": "1" };
    const template = email([{ type: "Text", children: [{ type: "Link", props: { href: "https://example.com", attrs }, children: ["go"] }] }]);
    let seen: PluginInput | undefined;
    validateTemplate(template, { plugins: [plugin("look", { check: (input) => ((seen = input), []) })] });
    expect(seen!.root.type).toBe("Email");
    expect(seen!.root.path).toBe("root");
    expect(Object.isFrozen(seen!.root)).toBe(true);
    const link = (seen!.root.children[0] as unknown as { children: Array<{ props: { attrs: Record<string, string> } }> }).children[0]!;
    expect(Object.isFrozen(link.props.attrs)).toBe(true);
    expect(() => {
      (link.props.attrs as Record<string, string>)["data-y"] = "2";
    }).toThrow();
    // The caller's object and the shared definitions stay as they were.
    expect(Object.isFrozen(attrs)).toBe(false);
    attrs["data-x"] = "changed";
    expect(Object.isFrozen(COMPONENTS.Text!)).toBe(false);
    expect(Object.isFrozen(COMPONENTS.Text!.style)).toBe(false);
    expect((seen!.root.children[0] as { defaults: { style: unknown } }).defaults).toBeDefined();
    expect("definition" in seen!.root).toBe(false);
    expect(seen!.templatePath("root.children[0]")).toBe("root.children[0]");
    expect(seen!.builtIn("root.children[0](Menu).children[1]")).toBe(true);
  });

  it("gives checkOutput the root's type, the compact output and the Email's stylesheet, even with pretty", () => {
    let seen: PluginOutput | undefined;
    const { head } = renderTemplate(email([text("Hi", { mobile: { fontSize: 12 } })]), { pretty: true, plugins: [plugin("out", { checkOutput: (o) => ((seen = o), []) })] });
    expect(seen!.root).toBe("Email");
    expect(seen!.html.startsWith("<!DOCTYPE")).toBe(true);
    expect(seen!.html).not.toContain("\n  ");
    expect(head).toContain("\n");
    expect(seen!.stylesheet.length).toBeGreaterThan(0);
    expect(seen!.head).toContain(`<style>${seen!.stylesheet}</style>`);
    expect(Object.isFrozen(seen)).toBe(true);
    let pageOutput: PluginOutput | undefined;
    renderTemplate(page([text("Hi")]), { plugins: [plugin("out", { checkOutput: (o) => ((pageOutput = o), []) })] });
    expect(pageOutput!.root).toBe("Page");
    expect(pageOutput!.stylesheet).toBe("");
  });

  it("adds checkOutput's diagnostics after the writer's, only in render", () => {
    const sizes = plugin("sizes", { checkOutput: (o) => [note("root", { code: "email/size", severity: "warning", message: `${o.html.length} characters` })] });
    expect(codes(renderTemplate(email([text("x")]), { plugins: [sizes] }).diagnostics)).toEqual(["email/size"]);
    expect(codes(validateTemplate(email([text("x")]), { plugins: [sizes] }).diagnostics)).toEqual([]);
  });

  it("maps paths to the template's: a Grid's cells", () => {
    const grid = { type: "Grid", props: { columns: 2 }, children: [text("a"), text("b"), text("c")] };
    const at = plugin("at", { check: (input) => [note(`${(input.root.children[0] as unknown as { children: Array<{ path: string }> }).children[0]!.path}`)] });
    const { diagnostics } = validateTemplate(email([grid]), { plugins: [at] });
    const mapped = diagnostics.find((d) => d.code === "email/example")!;
    expect(mapped.path.startsWith("root.children[0]")).toBe(true);
    expect(mapped.path).not.toContain("(");
  });

  it("merges equal diagnostics that both name clients, joining them; keeps those without clients apart", () => {
    const a = plugin("a", { check: () => [note("root", { clients: ["gmail"] }), note("root")] });
    const b = plugin("b", { check: () => [note("root", { clients: ["outlook", "gmail"] }), note("root")] });
    const found = validateTemplate(email([text("x")]), { plugins: [a, b] }).diagnostics.filter((d) => d.code === "email/example");
    expect(found.map((d) => d.clients)).toEqual([["gmail", "outlook"], undefined, undefined]);
  });

  it("drops what doesn't fit, with one warning per hook: codes, severities, messages, paths, fields", () => {
    const bad = [
      note("root", { code: "nope" }),
      note("root", { code: "page/example" }),
      note("root", { severity: "error" as never }),
      note("root", { message: "" }),
      note("root.children[9]"),
      note("root.children[0].nothing.here"),
      note("root", { clients: "gmail" as never }),
      note("root", { clients: [] }),
      note("root", { clients: ["gmail", "gmail"] }),
      note("root", { see: "http://example.com" }),
      note("root", { nodeId: 3 as never }),
      "not a diagnostic" as never,
    ];
    const good = [
      note("root"),
      note("root.children[0]"),
      note("root.children[0].style.letterSpacing"),
      note("root.children[0].style.width"),
      note("root.children[0].props.anything"),
      note("root.children[0].hover"),
      note("root.children[0].mobile.fontSize"),
      note("root", { code: "email/clients-ignored", clients: ["gmail"], fix: "x", see: "https://example.com", unknown: 1 } as never),
    ];
    const { diagnostics } = validateTemplate(email([text("x")]), { plugins: [plugin("mixed", { check: () => [...bad, ...good] })] });
    expect(diagnostics.filter((d) => d.code === "email/example" || d.code === "email/clients-ignored")).toHaveLength(good.length);
    expect(diagnostics.filter((d) => d.code === "plugin/invalid").map((d) => d.message)).toEqual([
      `The plugin "mixed" returned ${bad.length} diagnostics from check that core can't show (a code, severity, message or path it doesn't take)`,
    ]);
    expect("unknown" in diagnostics.find((d) => d.code === "email/clients-ignored")!).toBe(false);
  });

  it("takes email/clients-ignored on any root, and no other email/ code on a Page", () => {
    const p = plugin("p", { check: () => [note("root", { code: "email/clients-ignored" }), note("root"), note("root", { code: "page/example" })] });
    expect(codes(validateTemplate(page([text("x")]), { plugins: [p] }).diagnostics)).toEqual(["email/clients-ignored", "page/example", "plugin/invalid"]);
  });

  it("never fails a render: a hook that throws or returns something else is a warning", () => {
    const throws = plugin("throws", {
      check: () => {
        throw new Error("boom");
      },
    });
    const odd = plugin("odd", { check: () => ({ not: "a list" }) as never });
    const result = renderTemplate(email([text("x")]), { plugins: [throws, odd] });
    expect(result.html).toContain("x");
    expect(result.diagnostics.filter((d) => d.code === "plugin/failed").map((d) => d.message)).toEqual([
      'The plugin "throws" failed in check: boom',
      'The plugin "odd" returned an object without a name and api from check, not a list of diagnostics',
    ]);
  });

  it("checks the entries before any hook: a Promise, a non-plugin, another api, a duplicate name", () => {
    let calls = 0;
    const counted = plugin("counted", { check: () => (calls++, []) });
    const entries = [Promise.resolve(counted), 42, { name: "no-api" }, { name: "future", api: 2 }, counted, { ...counted }];
    const { diagnostics } = validateTemplate(email([text("x")]), { plugins: entries as never });
    expect(calls).toBe(1);
    expect(diagnostics.map((d) => [d.code, d.message])).toEqual([
      ["plugin/invalid", "plugins[0] got a Promise: pass `await emailClients()`, not `emailClients()`"],
      ["plugin/invalid", "plugins[1] isn't a plugin: it got number"],
      ["plugin/invalid", "plugins[2] isn't a plugin: it got an object without a name and api"],
      ["plugin/unsupported", 'The plugin "future" is written for plugin api 2; this core reads api 1'],
      ["plugin/duplicate", 'The plugin "counted" is passed twice; the second is ignored'],
    ]);
    expect(() => validateTemplate(email([text("x")]), { plugins: {} as never })).toThrow(TypeError);
  });

  it("doesn't run check on a template with errors", () => {
    let ran = false;
    const p = plugin("p", { check: () => ((ran = true), []) });
    const broken = email([{ type: "Text", style: { nope: 1 }, children: ["x"] }]);
    expect(validateTemplate(broken, { plugins: [p] }).valid).toBe(false);
    expect(ran).toBe(false);
    expect(prepareTemplate(broken, { plugins: [p] }).resolved).toBe(null);
  });

  it("keeps a plugin's message as text: markup in it adds nothing to the output", () => {
    const hostile = plugin("hostile", { check: () => [note("root", { message: '<script>alert(1)</script><img src=x onerror="x">', fix: "</style>" })] });
    const with_ = renderTemplate(email([text("x")]), { plugins: [hostile] });
    const without = renderTemplate(email([text("x")]));
    expect(with_.html).toBe(without.html);
    expect(with_.diagnostics.find((d) => d.code === "email/example")!.message).toBe('<script>alert(1)</script><img src=x onerror="x">');
  });

  it("is the same every time: the same template and plugins give the same output and diagnostics", () => {
    const counter = { n: 0 };
    const stateful = plugin("stateful", { check: () => [note("root", { message: `call ${++counter.n}` })] });
    const pure = plugin("pure", { check: (input) => [note("root", { message: input.root.type })], checkOutput: (o) => [note("root", { message: String(o.stylesheet.length) })] });
    const a = renderTemplate(email([text("x")]), { plugins: [pure] });
    const b = renderTemplate(email([text("x")]), { plugins: [pure] });
    expect(a).toEqual(b);
    // A plugin's own state is its own: core runs check once per render.
    renderTemplate(email([text("x")]), { plugins: [stateful] });
    expect(counter.n).toBe(1);
  });

  it("gives core's estimates by path, on its own tree", () => {
    let widths: [number, number | null] | undefined;
    const row = { type: "Row", props: { stackOnMobile: false }, children: [{ type: "Column", children: [text("short")] }] };
    validateTemplate(email([row]), { plugins: [plugin("e", { check: (input) => ((widths = [input.estimate.oneLineWidth("root.children[0]"), input.estimate.wrapsPastIts("root.children[0]")]), []) })] });
    expect(typeof widths![0]).toBe("number");
    expect(widths![1]).toBe(null);
  });
});
