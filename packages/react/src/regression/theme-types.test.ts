// @vitest-environment node

/**
 * A theme's types, as an app sees them: two programs compiled against the built declarations (`pnpm build` first),
 * one that registers its theme and one that doesn't, under each moduleResolution an app may use. Registering is
 * global to a program, so each state is a program of its own.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import ts from "typescript";

const PACKAGE = resolve(__dirname, "../..");
const BUILT = existsSync(join(PACKAGE, "dist/primitives.d.ts"));

const REGISTERED = `
import { component, defineTheme, prop, token, Button, Email, Heading, Text } from "@hyper-elements/react";

export const brand = defineTheme({
  colors: { primary: "#000000", link: "{colors.primary}", gray: { 900: "#111111" } },
  radii: { card: { topLeft: 4, topRight: 4 } },
  styles: { card: { padding: 8 } },
  components: { Button: { variants: { secondary: { color: "{colors.primary}" } } }, Heading: { by: { level: { 1: { fontSize: 40 } } } } },
});

declare module "@hyper-elements/react" {
  interface Register {
    theme: typeof brand;
  }
}

export const nested = token("colors.gray.900");
export const corners = token("radii.card");
export const fromTheme = brand.tokens.colors.link;
// @ts-expect-error Not one of the theme's tokens.
export const typo = token("colors.primry");

export const ok = (
  <Email theme={brand}>
    <Heading>a</Heading>
    <Button href="https://example.com" variant="secondary">a</Button>
    <Text style={{ apply: ["card"], color: fromTheme, padding: [token("colors.primary"), 4] }}>b</Text>
  </Email>
);
// @ts-expect-error Not one of the Button's variants.
export const variant = <Button href="https://example.com" variant="tertiary">a</Button>;
// @ts-expect-error Not one of the theme's named styles.
export const named = <Text style={{ apply: ["crad"] }}>a</Text>;

export const Card = component({
  type: "acme.Card",
  label: "Card",
  props: { tint: prop.color({ label: "Tint" }) },
  render: ({ tint }, { theme }) => <Text style={{ color: tint ?? String(theme.colors?.primary) }}>a</Text>,
});
export const card = <Card tint={token("colors.primary")} />;
`;

const UNREGISTERED = `
import { component, defineTheme, prop, token, Button, Email, Text } from "@hyper-elements/react";

export const brand = defineTheme({ colors: { primary: "#000000" } });
export const anything = token("any.path");
export const ok = (
  <Email theme={brand}>
    <Button href="https://example.com" variant="whatever">a</Button>
    <Text style={{ apply: ["anything"], color: token("colors.primary") }}>b</Text>
  </Email>
);

export const OneArgument = component({ type: "acme.One", label: "One", props: { title: prop.text({ label: "Title" }) }, render: ({ title }) => <Text>{title}</Text> });
export const TwoArguments = component({ type: "acme.Two", label: "Two", props: {}, render: (_, { theme }) => <Text>{String(theme.colors?.primary)}</Text> });
// @ts-expect-error A number isn't a text prop's value.
export const notAProp = <OneArgument title={42} />;
// @ts-expect-error A text prop takes no token: only a color's, a length's or a font's does.
export const textToken = <OneArgument title={token("colors.primary")} />;
export const Sized = component({ type: "acme.Sized", label: "Sized", props: { gap: prop.length({ label: "Gap" }), font: prop.fontFamily({ label: "Font" }) }, render: () => <Text>a</Text> });
export const sized = <Sized gap={token("spacing.md")} font={token("fonts.body")} />;
`;

const EXTENDED = `
import { extendTheme, defineTheme, token, Button, Email, Text } from "@hyper-elements/react";

const base = defineTheme({
  colors: { primary: "#000000", muted: "#71717a", gray: { 100: "#f4f4f5", 900: "#111111" } },
  radii: { card: { topLeft: 4, topRight: 4 } },
  styles: { card: { padding: 8 } },
  components: { Button: { variants: { secondary: { color: "{colors.primary}" } } } },
});
// Values overridden (a string by another, a list by a list), groups nested, and keys added.
export const brand = extendTheme(base, {
  colors: { primary: "#ffffff", gray: { 900: "#000000" }, accent: "#ff0000" },
  fonts: { body: ["Inter", "Arial"] },
  radii: { card: { topLeft: 8 } },
  components: { Button: { variants: { ghost: { color: "{colors.accent}" } } } },
});

declare module "@hyper-elements/react" {
  interface Register {
    theme: typeof brand;
  }
}

export const overridden = token("colors.primary");
export const untouched = token("colors.muted");
export const nested = [token("colors.gray.100"), token("colors.gray.900")];
export const added = [token("colors.accent"), token("fonts.body"), token("radii.card")];
export const ref = brand.tokens.colors.accent;
// @ts-expect-error Not one of the theme's tokens.
export const typo = token("colors.primry");
export const ok = (
  <Email theme={brand}>
    <Button href="https://example.com" variant={["secondary", "ghost"]}>a</Button>
    <Text style={{ apply: ["card"], color: ref }}>b</Text>
  </Email>
);
// @ts-expect-error Not one of the Button's variants.
export const variant = <Button href="https://example.com" variant="tertiary">a</Button>;
`;

const SETTINGS: Array<[string, ts.CompilerOptions]> = [
  ["node10", { moduleResolution: ts.ModuleResolutionKind.Node10, module: ts.ModuleKind.CommonJS }],
  ["node16", { moduleResolution: ts.ModuleResolutionKind.Node16, module: ts.ModuleKind.Node16 }],
  ["bundler", { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext }],
];

/** A program's errors, its file in a project with this package installed (and React's types from the package's own). */
function errorsOf(source: string, options: ts.CompilerOptions): string[] {
  const project = mkdtempSync(join(PACKAGE, ".theme-types-"));
  try {
    mkdirSync(join(project, "node_modules", "@hyper-elements"), { recursive: true });
    symlinkSync(PACKAGE, join(project, "node_modules", "@hyper-elements", "react"), "dir");
    const file = join(project, "app.tsx");
    writeFileSync(file, source);
    const program = ts.createProgram([file], { ...options, strict: true, jsx: ts.JsxEmit.ReactJSX, noEmit: true, skipLibCheck: true, esModuleInterop: true, types: ["react"], target: ts.ScriptTarget.ES2020 });
    return ts.getPreEmitDiagnostics(program).map((d) => `${d.file ? `${d.file.fileName.slice(project.length + 1)}:${d.file.getLineAndCharacterOfPosition(d.start!).line + 1}: ` : ""}${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

describe.skipIf(!BUILT)("a theme's types in an app, against the built declarations", () => {
  it.each(SETTINGS)("type the registered theme's names, under %s", (_, options) => {
    expect(errorsOf(REGISTERED, options)).toEqual([]);
  });

  it.each(SETTINGS)("type a theme made with extendTheme(), its overridden values too, under %s", (_, options) => {
    expect(errorsOf(EXTENDED, options)).toEqual([]);
  });

  it.each(SETTINGS)("take strings where no theme is registered, under %s", (_, options) => {
    expect(errorsOf(UNREGISTERED, options)).toEqual([]);
  });
});
