/**
 * The docs the package ships for writing templates, from the components' definitions (`describeComponents()`), so
 * they can't fall behind (a test checks the files are what this writes):
 *
 * - GUIDE.md, the guide: how a template is written, a whole one, and each component on a line (what it holds,
 *   its props and styles), short enough to read whole before writing one. It's what an agent needs.
 * - REFERENCE.md: every prop and style, with the values it takes, its default and what it does.
 * - skills/hyper-elements/SKILL.md, at the repository's root: the guide as an agent skill.
 */
import {
  describeComponents,
  describeConditions,
  pageBackgroundStyle,
  pageBorderStyle,
  pageEffectsStyle,
  pageLayoutStyle,
  pageObjectStyle,
  pagePlacementStyle,
  pagePositionStyle,
  pageSizeStyle,
  pageSpacingStyle,
  pageTextStyle,
  PAGE_STYLE_KEYS,
  ROOT_NAMES,
  type ComponentDescription,
  type PropertyDescription,
} from "@unlayer-internal/elements-core";

/** How a template writes a component whose definition is named otherwise. */
const JSX: Record<string, string> = { DocumentPage: "Document.Page" };
const name = (type: string) => JSX[type] ?? type;

/** The roots with phones: a component only under others has no phone styles (they're mobile/not-supported there). */
const PHONE_ROOTS = describeConditions().find((condition) => condition.name === "mobile")!.roots;
const hasPhones = (c: ComponentDescription) => c.roots.some((root) => PHONE_ROOTS.includes(root));
const article = (type: string) => `${/^[AEIOU]/.test(type) ? "an" : "a"} ${type}`;
/** The roots a component goes in, said where it isn't every root: "Not in an Email.", "Only in a Document." */
function rootsNote(c: ComponentDescription): string {
  if (c.categories.includes("root") || c.roots.length === ROOT_NAMES.length) return "";
  const missing = ROOT_NAMES.filter((root) => !c.roots.includes(root));
  const list = (roots: readonly string[]) => roots.map(article).join(missing.length === 1 ? "" : " or ").replace(/ or (?=.* or )/g, ", ");
  return missing.length === 1 ? `Not in ${list(missing)}.` : `Only in ${list(c.roots)}.`;
}
/**
 * The guide's note: only where what holds it doesn't already say so (a shape goes only in an Svg, which says it; a
 * Document's parts only in a Document), so the guide stays short. REFERENCE.md gives every one.
 */
function guideRootsNote(c: ComponentDescription): string {
  const holders = describeComponents().filter((h) => h.children.types.includes(c.type) || c.categories.some((category) => h.children.categories.includes(category)));
  const reached = new Set(holders.flatMap((h) => (h.categories.includes("root") ? [h.type] : h.roots)));
  const implied = holders.length > 0 && [...reached].every((root) => (c.roots as string[]).includes(root));
  return implied ? "" : rootsNote(c);
}

const GROUPS: Array<{ title: string; about: string; has: (c: ComponentDescription) => boolean }> = [
  {
    title: "Roots",
    about: "A template is one of these, and the root decides the output: `render()` writes an Email's HTML, a Page's HTML, and a Document's print HTML. `renderPdf()` (`@hyper-elements/react/pdf`) writes a Document's PDF, and `renderImage()` (`@hyper-elements/react/image`) a Canvas's PNG or SVG (`render()` writes a Canvas's HTML, to look at).",
    has: (c) => c.categories.includes("root"),
  },
  { title: "Sections and layout", about: "Bands and boxes that arrange blocks. None is required: a root stacks its children.", has: (c) => c.categories.includes("section") || c.categories.includes("layout") },
  { title: "Blocks", about: "Content, stacked down whatever holds it.", has: (c) => c.categories.includes("block") && !c.categories.includes("layout") && !c.categories.includes("inline") },
  { title: "Inline", about: "Inside text: a styled run, a link, a line break, a merge tag.", has: (c) => c.categories.includes("inline") },
  { title: "Parts", about: "Only inside the component named: a list's items, a table's rows and cells, a document's pages, header and footer.", has: (c) => c.categories.length === 0 },
  { title: "Shapes", about: "Only inside an Svg, in its viewBox's units.", has: (c) => c.categories.includes("shape") },
];

/** Value kinds described once, in "Values", rather than on every property that takes one. */
function glossary(all: ComponentDescription[]): Map<string, string> {
  const accepts = new Map<string, Set<string>>();
  for (const p of all.flatMap((c) => c.properties)) accepts.set(p.kind, (accepts.get(p.kind) ?? new Set()).add(p.accepts));
  return new Map([...accepts].filter(([, texts]) => texts.size === 1 && [...texts][0].length > 30).map(([kind, texts]) => [kind, [...texts][0]]));
}

const code = (value: unknown) => `\`${JSON.stringify(value)}\``;

/** The note at the top of each file this writes, naming this file as `from` the file's own folder. */
const generated = (from: string) => `<!-- Written from the component definitions by ${from}: don't edit by hand. Regenerate with UPDATE_REFERENCE=1 pnpm --filter @hyper-elements/react test reference -->`;
const GENERATED = generated("src/primitives/reference.ts");

function property(p: PropertyDescription, named: Map<string, string>, c: ComponentDescription): string {
  const key = p.path.slice(p.path.indexOf(".") + 1);
  const takes = named.has(p.kind) ? `*${p.kind}*` : p.accepts;
  const notes = [
    p.required ? "required" : "",
    p.default !== undefined ? `default ${code(p.default)}` : "",
    p.inherited ? "inherited" : "",
    p.roots.length < c.roots.length ? `only in ${p.roots.join(", ")}` : "",
    p.group ?? "",
  ].filter(Boolean);
  // What a Page takes beyond it (rem, em, calc(), more keywords), where the component goes in one.
  const page = p.onPage && c.roots.includes("Page") ? `; on a Page, ${p.onPage.accepts}` : "";
  return `- \`${key}\`: ${takes}${page}${notes.length ? ` (${notes.join(", ")})` : ""}${p.description ? `. ${p.description.replace(/\.$/, "")}.` : ""}`;
}

function component(c: ComponentDescription, all: ComponentDescription[], named: Map<string, string>): string {
  const inCategory = (category: string) => all.filter((other) => other.categories.includes(category as never)).map((other) => name(other.type));
  const holds = [...new Set([...c.children.categories.flatMap(inCategory), ...c.children.types.map(name)])];
  const children = [c.children.text ? "text" : "", holds.join(", ")].filter(Boolean).join("; ");
  const props = c.properties.filter((p) => p.path.startsWith("props."));
  const style = c.properties.filter((p) => p.path.startsWith("style."));
  const hover = c.properties.filter((p) => p.path.startsWith("hover.")).map((p) => `\`${p.path.slice(6)}\``);
  const phone = hasPhones(c) ? style.filter((p) => p.mobile).map((p) => `\`${p.path.slice(6)}\``) : [];
  return [
    `### ${name(c.type)}`,
    "",
    c.description,
    "",
    [`Holds: ${children || "nothing"}.`, rootsNote(c)].filter(Boolean).join(" "),
    ...(props.length ? ["", "Props:", ...props.map((p) => property(p, named, c))] : []),
    ...(style.length ? ["", "`style`:", ...style.map((p) => property(p, named, c))] : []),
    ...(hover.length ? ["", `\`style.hover\`: ${hover.join(", ")}.`] : []),
    ...(phone.length ? ["", `\`style.mobile\` (on phones): ${phone.join(", ")}.`] : []),
  ].join("\n");
}

export function primitivesReference(): string {
  const all = describeComponents();
  const named = glossary(all);
  const placed = new Set<string>();
  const sections = GROUPS.map((group) => {
    const members = all.filter((c) => !placed.has(c.type) && group.has(c));
    for (const c of members) placed.add(c.type);
    return [`## ${group.title}`, "", group.about, "", members.map((c) => component(c, all, named)).join("\n\n")].join("\n");
  });
  const missing = all.filter((c) => !placed.has(c.type)).map((c) => c.type);
  if (missing.length) throw new Error(`[Elements] The reference has no section for ${missing.join(", ")}`);
  return [
    "# Components reference (`@hyper-elements/react`)",
    "",
    GENERATED,
    "",
    "Every component, what it holds, and every prop and style it takes, with its default and what it does. [GUIDE.md](./GUIDE.md) shows how a template is written; `validate()` checks one against what's here.",
    "",
    "Every component also takes:",
    "",
    "- `style={{ … }}`: the styles listed under it. A number is px (`padding: 16` is `16px`).",
    "- `style={{ mobile: { … } }}`: style overrides on phones, in an `Email` or a `Page`, for the styles listed under \"`style.mobile`\".",
    "- `style={{ hover: { … } }}`: styles on hover, for the ones listed under \"`style.hover`\".",
    "- `hidden={{ mobile: true }}` or `hidden={{ desktop: true }}`: shown on one only.",
    "- `id`: an id of your own, written into the HTML.",
    "",
    "## Values",
    "",
    "What a property takes, where it says *kind*:",
    "",
    ...[...named].map(([kind, accepts]) => `- *${kind}*: ${accepts}`),
    "",
    sections.join("\n\n"),
    "",
    BLOCK_MAP,
    "",
  ].join("\n");
}

/** render()'s `blockMap`, a low-level option for tools: in the reference, not the guide. */
const BLOCK_MAP = [
  "## For tools: where each block is in an Email's HTML",
  "",
  "`await render(email, { blockMap: true })` also gives `blocks`, for a tool that previews an Email and needs to know which block of the template it's looking at: `{ version, unit: \"utf8\", entries: [{ path, nodeId?, type, offset }] }`.",
  "",
  "- Each block written as an element has an entry: its place in the template (`root.children[2]`, as diagnostics give it), its `id` where it has one, its component (`type`, as laid out: a Grid's rows are `Row`s), and the UTF-8 byte offset in `html` just after its outermost element's tag name (`<table`, `<div`). That's the first element every email client but classic Outlook reads, else its first in Outlook's own markup.",
  "- Entries are in the order of their offsets; at one offset, the outer block comes first. A `LineBreak` and a `MergeTag` have none, nor a `Layer`'s `Image` (drawn as the Layer's background).",
  "- The HTML is the same bytes as without the option. Merge tags are written before the offsets are taken, and the offsets count the whole document, `<head>` included.",
  "- `version` is `BLOCK_MAP_VERSION`, which changes only when this format does.",
  "- Not with `pretty`, which indents the HTML after the offsets are taken (`render/block-map-pretty`). Another root than an Email has no `blocks`.",
].join("\n");

// ─── The guide ─────────────────────────────────────────────────────────────

/** Styles most components share, named as a group on a component's line. */
const TEXT = ["color", "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textAlign", "textTransform"];
const BOX = ["width", "maxWidth", "padding", "backgroundColor", "border", "borderRadius"];
/** A Page's styles (Decision 5 of the plan), by the group the guide names them as: a component lists its groups. */
const PAGE_GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["layout", Object.keys(pageLayoutStyle)],
  ["place", Object.keys(pagePlacementStyle)],
  ["size", Object.keys(pageSizeStyle)],
  ["picture", Object.keys(pageObjectStyle)],
  ["position", Object.keys(pagePositionStyle)],
  ["sides", Object.keys(pageSpacingStyle)],
  ["wrap", Object.keys(pageTextStyle)],
  ["background", Object.keys(pageBackgroundStyle)],
  ["border", Object.keys(pageBorderStyle)],
  ["effects", Object.keys(pageEffectsStyle)],
];
/** A style for a Page only: listed in the guide by its group, under "Page". */
const pageOnly = (p: PropertyDescription) => p.path.startsWith("style.") && PAGE_STYLE_KEYS.has(p.path.slice(6)) && p.roots.length === 1 && p.roots[0] === "Page";
/** The text styles that may be set on phones, named `text` among a component's phone styles. */
const PHONE_TEXT = ["fontSize", "lineHeight", "letterSpacing", "textAlign"];
const CATEGORY: Record<string, string> = { section: "sections", layout: "layout", block: "blocks", inline: "inline", shape: "shapes" };

/**
 * A value as short as it can be said: an enum's options, a kind the Values section names, else what it takes in
 * full (a Menu's items are `{ text, href }`, a Social's icons `{ name, href }`: the shape is what gets written wrong).
 */
function short(p: PropertyDescription, named: Map<string, string>): string {
  const options = /^one of (.*)$/.exec(p.accepts)?.[1];
  if (options) return options.replace(/"/g, "").split(", ").join("|");
  return named.has(p.kind) ? p.kind : p.accepts;
}

/** Keys, with the shared groups named where all of a group's keys are there. */
function keys(found: string[], describe: (key: string) => string = (key) => key, groups: ReadonlyArray<readonly [string, readonly string[]]> = [["text", TEXT], ["box", BOX]]): string {
  const out: string[] = [];
  let rest = found;
  for (const [group, members] of groups) {
    if (members.every((key) => rest.includes(key))) {
      out.push(group);
      rest = rest.filter((key) => !members.includes(key));
    }
  }
  return [...out, ...rest.map(describe)].join(", ");
}

function line(c: ComponentDescription, named: Map<string, string>): string {
  const of = (prefix: string) => c.properties.filter((p) => p.path.startsWith(prefix));
  const byKey = new Map(c.properties.map((p) => [p.path, p]));
  const enumOf = (prefix: string) => (key: string) => {
    const p = byKey.get(`${prefix}${key}`)!;
    return /^one of /.test(p.accepts) ? `${key} (${short(p, named)})` : key;
  };
  const props = of("props.").map((p) => `${p.path.slice(6)}${p.required ? "*" : ""} (${short(p, named)})`);
  const style = of("style.").filter((p) => !pageOnly(p)).map((p) => p.path.slice(6));
  const page = of("style.").filter(pageOnly).map((p) => p.path.slice(6));
  const hover = of("hover.").map((p) => p.path.slice(6));
  const phone = hasPhones(c) ? of("style.").filter((p) => p.mobile).map((p) => p.path.slice(6)) : [];
  const holds = [c.children.text ? "text" : "", ...c.children.categories.map((category) => CATEGORY[category] ?? category), ...c.children.types.map(name)].filter(Boolean);
  const parts = [
    `${c.description.replace(/\.$/, "")}.`,
    guideRootsNote(c),
    holds.length ? `Holds ${holds.join(", ")}.` : "",
    props.length ? `Props: ${props.join(", ")}.` : "",
    style.length ? `Style: ${keys(style, enumOf("style."))}.` : "",
    page.length ? `On a Page: ${keys(page, undefined, PAGE_GROUPS)}.` : "",
    hover.length ? `Hover: ${hover.join(", ")}.` : "",
    phone.length ? `Phones: ${keys(phone, undefined, [["text", PHONE_TEXT]])}.` : "",
  ].filter(Boolean);
  return `- **${name(c.type)}**: ${parts.join(" ")}`;
}

/** GUIDE.md: how a template is written, the README's template (`example`, as an author imports it), and each component on a line. */
export function primitivesGuide(example: string): string {
  return [
    "# Writing templates with the new components (`@hyper-elements/react`)",
    "",
    GENERATED,
    "",
    "Everything needed to write a template, in short. Every prop's and style's details: [REFERENCE.md](./REFERENCE.md).",
    "",
    guide(example),
  ].join("\n");
}

/** What the skill's frontmatter says, which is how an agent decides to load it. */
const SKILL_DESCRIPTION =
  "Write emails, web pages, printed documents, PDFs and images in code with Hyper Elements (@hyper-elements/react), React components that render email-safe HTML, responsive page HTML, print HTML, PDFs and PNG or SVG images. Use when writing or changing an Elements template, or when asked to build an email, page, document, PDF or image in code with Elements.";

/**
 * skills/hyper-elements/SKILL.md, at the repository's root, which `npx skills add hyper-elements/hyper-elements` installs: the
 * guide, as GUIDE.md has it, under the frontmatter a skill needs and a few lines for projects with Unlayer Elements'
 * components. An agent given the guide before writing a template gets it right on the first try far more often.
 */
export function primitivesSkill(example: string): string {
  return [
    "---",
    "name: hyper-elements",
    `description: ${SKILL_DESCRIPTION}`,
    "---",
    "",
    "# Hyper Elements",
    "",
    generated("packages/react/src/primitives/reference.ts"),
    "",
    "Write emails, web pages, printed documents, PDFs and images in code with Hyper Elements (`npm install @hyper-elements/react`). This is the package's own guide to its components at `@hyper-elements/react` (GUIDE.md in the package), written from their definitions: everything needed to write a template, in short. Every prop's and style's details, with its default: `node_modules/@hyper-elements/react/REFERENCE.md`.",
    "",
    "## Templates from Unlayer Elements",
    "",
    "A project may have templates written with Unlayer Elements: they import `Body`, `ColumnLayouts` or `renderToHtml()` from `@unlayer/react-elements`, and use `values`, `layout`, `html` and style props such as `backgroundColor=\"#fff\"`. Those components aren't in Hyper Elements, a new package: these are its components.",
    "",
    "- Move them with the codemod: `npx @hyper-elements/migrate src/emails --from unlayer-elements` lists what it would change, `--write` replaces the files (only those git can restore) and `--report notes.md` writes what it noted. It rewrites the imports and the JSX, and keeps props, loops and conditions. The new components render with `await render(element)`, which is async, in place of `renderToHtml()`. More: `npx @hyper-elements/migrate --help`.",
    "- What the codemod can't move is listed, and the file is left as it was: rewrite that part by hand with these components.",
    "- Then `npm install @hyper-elements/react`, and remove `@unlayer/react-elements` once nothing imports it.",
    "- Templates in React Email: `npx @hyper-elements/migrate src/emails` writes them in these components and checks each against its original.",
    "",
    guide(example),
  ].join("\n");
}

/** An Email rendered to a file, printing its problems, in the guide. */
const RENDER_EXAMPLE = `import { writeFile } from "node:fs/promises";
import { ElementsError, formatDiagnostics, render } from "@hyper-elements/react";
import Welcome from "./welcome";

try {
  const { html, diagnostics } = await render(<Welcome />);
  await writeFile("welcome.html", html);
  console.log(formatDiagnostics(diagnostics)); // warnings and notes, each with what to change
} catch (e) {
  if (!(e instanceof ElementsError)) throw e;
  console.error(formatDiagnostics(e.diagnostics));
  process.exitCode = 1;
}`;

/** A Canvas written as a PNG, in the guide. */
const CANVAS_EXAMPLE = `import { readFile } from "node:fs/promises";
import { Canvas, Heading, Image } from "@hyper-elements/react";
import { renderImage } from "@hyper-elements/react/image";

const { image, diagnostics } = await renderImage(
  <Canvas width={1200} height={630} style={{ padding: 64, gap: 24, fontFamily: "Inter", textAlign: "center", justifyContent: "center" }}>
    <Image src={{ src: "https://example.com/logo.png", width: 240, height: 80 }} alt="Acme" style={{ width: 120 }} />
    <Heading level={1} style={{ fontSize: 64 }}>Launch week</Heading>
  </Canvas>,
  {
    fonts: [{ family: "Inter", src: await readFile("Inter-Bold.ttf"), weight: 700 }],
    images: { "https://example.com/logo.png": await readFile("logo.png") },
  }
);`;

/** The guide itself, from "How a template is written" on: the same in GUIDE.md and the skill. */
function guide(example: string): string {
  const all = describeComponents();
  // The guide lists a Page's styles by group, not each with its kind: its Values are the other properties' kinds.
  const named = glossary(all.map((c) => ({ ...c, properties: c.properties.filter((p) => !pageOnly(p)) })));
  const placed = new Set<string>();
  const sections = GROUPS.map((group) => {
    const members = all.filter((c) => !placed.has(c.type) && group.has(c));
    for (const c of members) placed.add(c.type);
    return [`### ${group.title}`, "", ...members.map((c) => line(c, named))].join("\n");
  });
  return [
    "## How a template is written",
    "",
    "- Import from `@hyper-elements/react`. A template has one root: `Email`, `Page`, `Document` or `Canvas`.",
    "- Styles go in `style={{ … }}`, never as props: `<Heading style={{ fontSize: 24, color: \"#111827\" }}>`. A number is px; `padding` takes `16`, `[12, 24]` or `\"12px 24px\"`. A box's text styles are inherited by what it holds.",
    "- There are no margins: space between blocks is their parent's `gap` (`<Column style={{ gap: 16 }}>`), space inside a box its `padding`.",
    "- A root, a `Section` and a `Column` stack their children. A `Row` puts its children side by side (each `Column` at its `style.width`, or an equal share) and stacks them on phones. `Grid columns={3}` makes rows of three. A `Section` is a band whose background spans the window; a `Column` with a background is a card.",
    "- Text is components, not HTML: `Heading level={1}` and `Text` hold text; inside them `Span` styles a run, `Link href` links one, `LineBreak` breaks the line and `MergeTag name` writes a merge tag. No raw HTML (`<b>`, `<br>`, `<div>`) and no `html` prop.",
    "- `Image src={{ src, width, height }}` (the file's size in px) with `alt`; `style.width` sets the size shown.",
    "- Lists: `<List type=\"number\">` of `ListItem`s. Tables: a `Table` of `TableRow`s (`header` on the first) of `TableCell`s, with `cellPadding` and `rowBorder` in the Table's `style`.",
    "- Phones: `style={{ fontSize: 24, mobile: { fontSize: 20 } }}` (the styles listed under \"Phones\", where `text` is fontSize, lineHeight, letterSpacing and textAlign), `hidden={{ mobile: true }}`; in an Email or a Page. Hover: `style={{ hover: { backgroundColor: \"#374151\" } }}` (those under \"Hover\").",
    "- `await render(element)` gives `{ html, text, diagnostics }`; errors throw an `ElementsError` with the same `diagnostics`. `validate(element)` runs the checks without rendering; `outline(element)` prints the laid-out template (each block, its width, its text).",
    "- Email clients: `@hyper-elements/email-clients`. `validate(email, { plugins: [await emailClients()] })` adds what classic Outlook, Gmail, Apple Mail and others remove or change, naming its `clients`, with a `fix` (without it, one note: `email/more-checks`). To test an email in them, `await renderInEmailClients(email)` gives a preview per client: HTML that shows the email as that client does, in Chromium.",
    "",
    "```tsx",
    RENDER_EXAMPLE,
    "```",
    "",
    "From the shell (`@hyper-elements/cli`): `npx hyper-elements check emails/welcome.tsx` runs these checks on the module's default export and exits 1 on errors (`--json` for JSON); `render` writes the HTML and text to `out/`.",
    "",
    "## Common mistakes",
    "",
    "Each of these made an agent's first try fail:",
    "",
    "- `<Email backgroundColor=\"#fff\">` → `<Email style={{ backgroundColor: \"#fff\" }}>`. Styles never go as props.",
    "- `<Email style={{ width: 600, padding: 24 }}>` → `<Email width={600}>`, with the padding on a `Column` (a card) or a `Section` (a band) inside it. A root's width is a prop, and a root has no padding.",
    "- `items={[{ text: \"Home\", link: \"/\" }]}` → `items={[{ text: \"Home\", href: \"/\" }]}`. A `Menu`'s items are `{ text, href }`, a `Social`'s icons `{ name, href }`.",
    "- `style={{ marginBottom: 16 }}` → `gap: 16` on the parent. There are no margins.",
    "- `ColumnLayouts`, `layout`, `headingType`, `altText`, `html` are Unlayer Elements' props, not these: a `Row` of `Column`s, `level`, `alt`, and text as children.",
    "- `<Image src=\"https://example.com/logo.png\">` → `src={{ src: \"https://example.com/logo.png\", width: 240, height: 80 }}`, the file's size. Without it, Outlook shows the file at its own size.",
    "- `mobile={{ fontSize: 20 }}`, `hover={{ … }}`, `_hover` or `md: { … }` → `style={{ fontSize: 24, mobile: { fontSize: 20 }, hover: { … } }}`. Phone and hover styles are blocks of `style`, and there's one breakpoint: phones.",
    "- `className=\"secondary\"` or `sx={…}` → `variant=\"secondary\"` (the theme's) or `style={{ apply: [\"card\"] }}`.",
    "",
    "## Themes",
    "",
    "A theme is the brand, written once: `defineTheme({ colors, spacing, fontSizes, lineHeights, fonts, radii, components, styles, formats })`, given to a root as `theme`.",
    "",
    "- In a template `token(\"colors.primary\")` is a token's value, or part of one (`border: { width: 1, style: \"solid\", color: token(\"colors.border\") }`); inside a theme, and only there, a token is `\"{colors.primary}\"`: everywhere in a template (a root's `style`, a scope's `tokens`) it is `token()`. Names are letters and digits: nest `gray.900`.",
    "- Roles: `colors.background` is the root's background; `colors.foreground`, `fonts.body`, `fontSizes.body` and `lineHeights.body` are its body text (color, font, size and line height), which Text, table cells and list items inherit: set body text here, not on `Text` (a style on `Text` misses table cells). `fonts.heading` is a Heading's font, `colors.primary` and `colors.primaryForeground` a Button's (`colors.primary` a Link's) and `fontSizes.body` its size too, `colors.border` a Divider's.",
    "- `components.Button: { … }` is every Button's default style; `by: { level: { 1: { fontSize: 40 } } }` sets one by a prop's value (a type scale); `variants: { secondary: { … } }` are picked with `variant=\"secondary\"` (a list merges in order).",
    "- `styles: { card: { … } }` are named styles: `style={{ apply: [\"card\"], padding: 8 }}`. A key an element sets itself also replaces the theme's phone and hover values for it.",
    "- `tokens` on a Section, Row, Column, Grid or Box overrides tokens inside it: an inverted band is `<Section tokens={{ colors: { background: \"#111827\", foreground: \"#ffffff\" } }}>`.",
    "- `formats: { email: { … } }` overrides it for one kind of root; `extendTheme(base, overrides)` makes a brand's or a customer's theme from a shared one; `declare module \"@hyper-elements/react\" { interface Register { theme: typeof brand } }` types every name.",
    "",
    "## Pages",
    "",
    "A `Page` takes CSS's own layout, with typed styles: on a Page only (elsewhere they're `style/not-supported`).",
    "",
    "- `<Box as=\"header\">` is its general element (`as`: div, section, header, footer, nav, main, article, aside, figure, figcaption, blockquote, address, ul, ol, li). A flex column with its `gap` until its styles say otherwise: `display: \"grid\", gridTemplateColumns: \"repeat(auto-fill, minmax(16rem, 1fr))\"`, or `flexDirection: \"row\"` (a flex box is a column unless it says row). Directly in a Page it spans the window, like a Section; give it `maxWidth` and `padding` for its content.",
    "- Lengths on a Page also take rem, em, %, vw, vh and calc(), min(), max(), clamp(): `fontSize: \"clamp(2rem, 5vw, 3.5rem)\"`, `padding: \"4rem 1.5rem\"`. A number is still px.",
    "- Page style groups, as components list them: " + PAGE_GROUPS.map(([group, members]) => `*${group}* ${members.join(", ")}`).join("; ") + ".",
    "- `Span as=\"strong\"` (strong, em, code, kbd, time, mark, abbr, sup, sub, small, cite, q) gives a run its meaning.",
    "- Section, Row, Column and Grid still work on a Page, and stay the way to write an email.",
    "",
    "## A whole template",
    "",
    "```tsx",
    example.trim(),
    "```",
    "",
    "## A Canvas as an image",
    "",
    "`renderImage(element, options)` (`@hyper-elements/react/image`) writes a `Canvas` as a PNG (`format: \"svg\"` an SVG, `scale: 2` twice the pixels). Nothing is fetched: `fonts` gives each font file by the family the template names (TTF, OTF or WOFF, not WOFF2; one per weight and style used), `images` each image file by the `src` the template gives. It gives `{ image, width, height, diagnostics }` (what it drew otherwise: a weight not given, a hover); errors throw an `ElementsError`.",
    "",
    "```tsx",
    CANVAS_EXAMPLE,
    "```",
    "",
    "## Components",
    "",
    `\\* required. *text* styles: ${TEXT.join(", ")}. *box* styles: ${BOX.join(", ")}. "On a Page": its page styles, by group (Pages, above).`,
    "",
    sections.join("\n\n"),
    "",
    "## Values",
    "",
    ...[...named].map(([kind, accepts]) => `- *${kind}*: ${accepts}`),
    "",
  ].join("\n");
}
