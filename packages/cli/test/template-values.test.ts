/**
 * What a template design's values are, to the commands that take them: an image's src that isn't a file beside the
 * design is written as it's given; a design's props reach its template; a values file's own folder is an input's.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, exists, LAUNCH_VALUES, launchTemplate, lines, makePng, newsTemplate, noteTemplate, ON_BUN, project, slotModule, valuesFile, WITH_CLIENTS, withFixtures } from "./helpers";

/** An Email template with an image field and a title. */
const promoTemplate = () => `import { Email, Image, Text, prop } from "@hyper-elements/react";
import { field, template } from "@hyper-elements/react/template";

export default template({
  id: "acme.Promo",
  version: "1.0.0",
  label: "Promo",
  root: "Email",
  fields: {
    title: prop.text({ label: "Title", required: true }),
    logo: field.image({ label: "Logo", required: true }),
  },
  example: { title: "Hello", logo: { src: "https://cdn.acme.com/logo.png", width: 600, height: 200 } },
  render(v) {
    return (
      <Email lang="en" previewText="A promotion from the team, this week only">
        <Image field="logo" src={v.logo} alt="Acme" />
        <Text field="title">{v.title}</Text>
      </Email>
    );
  },
});
`;

const promo = (src: string) => valuesFile("../templates/promo.tsx", { title: "Sale", logo: { src, width: 600, height: 200 } }, { id: "acme.Promo", formats: null });
const srcOf = (html: string) => /<img[^>]*\ssrc="([^"]*)"/.exec(html)?.[1];

describe("an image's src in an Email's values", () => {
  it("is written as it's given: a service's tag, cid:, a relative URL, a URL", async () => {
    const sources = { tag: "{{logo_url}}", cid: "cid:logo@acme", relative: "img/logo.png", dot: "./img/logo.png", url: "https://cdn.acme.com/logo.png", host: "//cdn.acme.com/logo.png" };
    const dir = project({
      "templates/promo.tsx": promoTemplate(),
      ...Object.fromEntries(Object.entries(sources).map(([name, src]) => [`designs/${name}.values.json`, promo(src)])),
    });
    const ran = await cli(dir, ["render", "designs", "--out", "out", "--no-lint", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    for (const [name, src] of Object.entries(sources)) expect([name, srcOf(readFileSync(join(dir, `out/designs/${name}.html`), "utf8"))]).toEqual([name, src]);
  });

  it("is the same from a TSX design, and design new --from stores it as given", async () => {
    const dir = project({
      "templates/promo.tsx": promoTemplate(),
      "designs/tag.tsx": `import Promo from "../templates/promo";\nexport default () => <Promo title="Sale" logo={{ src: "{{logo_url}}", width: 600, height: 200 }} />;\n`,
    });
    const ran = await cli(dir, ["render", "designs/tag.tsx", "--out", "out", "--no-lint", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(srcOf(readFileSync(join(dir, "out/designs/tag.html"), "utf8"))).toBe("{{logo_url}}");
    const made = await cli(dir, ["design", "new", "templates/promo.tsx", "--from", "designs/tag.tsx", "-o", "stored/tag.values.json", "--json"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "stored/tag.values.json"), "utf8")).values.logo.src).toBe("{{logo_url}}");
    expect(lines(made)[0]).toMatchObject({ status: "ok" });
  });
});

describe("an image's file, where the design isn't measured", () => {
  /** An Email template whose logo is a transparent PNG. */
  const logoTemplate = () => promoTemplate().replace('logo: field.image({ label: "Logo", required: true })', 'logo: field.image({ label: "Logo", required: true, transparent: "required", accepts: ["png"] })');
  /** A 1×1 PNG with an alpha channel. */
  const CLEAR = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const logo = (src: string, width: number, height: number) => valuesFile("../templates/promo.tsx", { title: "Sale", logo: { src, width, height } }, { id: "acme.Promo", formats: null });
  const found = (line: { diagnostics: Array<{ code: string; severity: string }> }) => line.diagnostics.filter((d) => d.code.startsWith("template/asset")).map((d) => `${d.severity} ${d.code}`);

  it("is read and checked against its rules for an Email too, and render writes nothing it refuses", async () => {
    const dir = project({
      "templates/promo.tsx": logoTemplate(),
      "designs/opaque.values.json": logo("./art/opaque.png", 600, 200),
      "designs/clear.values.json": logo("./art/clear.png", 1, 1),
      "designs/remote.values.json": logo("https://cdn.acme.com/logo.png", 600, 200),
    });
    mkdirSync(join(dir, "designs/art"));
    // An opaque 10×40 file, given as 600×200.
    writeFileSync(join(dir, "designs/art/opaque.png"), makePng(10, 40));
    writeFileSync(join(dir, "designs/art/clear.png"), CLEAR);
    const checked = await cli(dir, ["check", "designs", "--no-lint", "--json"]);
    const [clear, opaque, remote] = lines(checked);
    expect([clear.file, opaque.file, remote.file]).toEqual(["designs/clear.values.json", "designs/opaque.values.json", "designs/remote.values.json"]);
    expect(found(opaque)).toEqual(["error template/asset-size", "error template/asset-alpha"]);
    // Read, and it passes: nothing is left undecided.
    expect([clear.status, found(clear)]).toEqual(["ok", []]);
    // A URL isn't fetched for an Email: what only its file says is said to be undecided, never passed.
    expect([remote.status, found(remote)]).toEqual(["ok", ["info template/asset-unread"]]);
    expect(checked.code).toBe(1);
    const rendered = await cli(dir, ["render", "designs/opaque.values.json", "--out", "out", "--no-lint", "--json"]);
    expect(rendered.code).toBe(1);
    expect(lines(rendered)[0]).toMatchObject({ status: "error", outputs: [] });
  });
});

describe("design set, on a file whose values aren't valid yet", () => {
  const json = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));
  /** A sale: version 2 keeps prices in cents, and migrates version 1's. */
  const saleTemplate = () => `import { Email, Text, prop } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";

export default template({
  id: "acme.Sale",
  version: "2.0.0",
  label: "Sale",
  root: "Email",
  fields: {
    title: prop.text({ label: "Title", required: true }),
    price: prop.number({ label: "Price in cents", required: true }),
  },
  migrate: { 1: (v) => ({ ...v, price: v.price * 100 }) },
  example: { title: "Sale", price: 1000 },
  render(v) {
    return (
      <Email lang="en" previewText="A sale, for a short time, on everything we sell">
        <Text field="title">{v.title}</Text>
        <Text field="price">{String(v.price)}</Text>
      </Email>
    );
  },
});
`;
  const sale = (extra: Record<string, unknown>, values: Record<string, unknown>, version = "1.4.0", id = "acme.Sale") => valuesFile("../templates/sale.tsx", values, { id, version, formats: null, extra });

  it("runs a draft's migrations before a set, as it does a finished file's", async () => {
    const dir = project({
      "templates/sale.tsx": saleTemplate(),
      "designs/draft.values.json": sale({ draft: true, missing: ["title"] }, { price: 10 }),
      "designs/done.values.json": sale({}, { title: "Old", price: 10 }),
    });
    for (const file of ["designs/draft.values.json", "designs/done.values.json"]) {
      const set = await cli(dir, ["design", "set", file, "title=Sale", "--json"]);
      expect(set.code, set.stdout + set.stderr).toBe(0);
      expect([file, json(dir, file).template.version, json(dir, file).values]).toEqual([file, "2.0.0", { title: "Sale", price: 1000 }]);
    }
    expect(json(dir, "designs/draft.values.json").draft).toBeUndefined();
  });

  it("leaves a draft another template's, or a newer version's, as it is", async () => {
    const dir = project({
      "templates/sale.tsx": saleTemplate(),
      "designs/other.values.json": sale({ draft: true, missing: ["title"] }, { price: 10 }, "1.0.0", "acme.Other"),
      "designs/newer.values.json": sale({ draft: true, missing: ["title"] }, { price: 10 }, "3.0.0"),
    });
    for (const [file, code] of [["designs/other.values.json", "template/id"], ["designs/newer.values.json", "template/version"]]) {
      const before = readFileSync(join(dir, file), "utf8");
      const set = await cli(dir, ["design", "set", file, "title=Sale", "--json"]);
      expect([file, set.code, lines(set)[0].diagnostics.map((d: { code: string }) => d.code)]).toEqual([file, 1, [code]]);
      expect(readFileSync(join(dir, file), "utf8")).toBe(before);
    }
  });

  it("repairs a file that isn't a draft: the set that gives what's missing, or replaces what's refused, is taken", async () => {
    const dir = project({
      "templates/note.tsx": noteTemplate(),
      "designs/missing.values.json": valuesFile("../templates/note.tsx", { title: "Hi" }, { id: "acme.Note", formats: null }),
      "designs/long.values.json": valuesFile("../templates/note.tsx", { title: "A title far longer than the forty characters a note's takes", body: "Body" }, { id: "acme.Note", formats: null }),
    });
    // A set that doesn't repair it is still refused, with what's wrong, and the file is left as it was.
    const before = readFileSync(join(dir, "designs/missing.values.json"), "utf8");
    const other = await cli(dir, ["design", "set", "designs/missing.values.json", "title=Hello", "--json"]);
    expect([other.code, lines(other)[0].diagnostics.filter((d: { severity: string }) => d.severity === "error").map((d: { code: string }) => d.code)]).toEqual([1, ["template/required"]]);
    expect(readFileSync(join(dir, "designs/missing.values.json"), "utf8")).toBe(before);
    const given = await cli(dir, ["design", "set", "designs/missing.values.json", "body=Hello", "--json"]);
    expect(given.code, given.stdout + given.stderr).toBe(0);
    expect(json(dir, "designs/missing.values.json").values).toEqual({ title: "Hi", body: "Hello" });
    const replaced = await cli(dir, ["design", "set", "designs/long.values.json", "title=Short", "--json"]);
    expect(replaced.code, replaced.stdout + replaced.stderr).toBe(0);
    expect(json(dir, "designs/long.values.json").values).toEqual({ title: "Short", body: "Body" });
  });
});

describe("a design captured for its template", () => {
  it("is rendered with its props: --props, then its PreviewProps, as any design is", async () => {
    const design = (root: string) => `import { Email, Heading, Text } from "@hyper-elements/react";
import Note from "../templates/note";
export default function Design({ name }: { name: string }) {
  return ${root};
}
Design.PreviewProps = { name: "Ada" };
`;
    const dir = project({
      "templates/note.tsx": noteTemplate(),
      "designs/made.tsx": design('<Note title={"Hello " + name} body="A note." />'),
      "designs/plain.tsx": design('<Email lang="en"><Heading level={1}>{"Hello " + name}</Heading><Text>A note.</Text></Email>'),
      "grace.json": JSON.stringify({ name: "Grace" }),
    });
    const html = (name: string) => readFileSync(join(dir, `out/designs/${name}.html`), "utf8");
    const previewed = await cli(dir, ["render", "designs", "--out", "out", "--no-lint", "--json"]);
    expect(previewed.code, previewed.stdout + previewed.stderr).toBe(0);
    expect([html("made").includes("Hello Ada"), html("plain").includes("Hello Ada")]).toEqual([true, true]);
    const given = await cli(dir, ["render", "designs", "--out", "out", "--props", "grace.json", "--no-lint", "--json"]);
    expect(given.code, given.stdout + given.stderr).toBe(0);
    expect([html("made").includes("Hello Grace"), html("plain").includes("Hello Grace")]).toEqual([true, true]);
    // check, outline and inspect read the same design.
    const outlined = await cli(dir, ["outline", "designs/made.tsx", "--props", "grace.json"]);
    expect(outlined.stdout).toContain("Hello Grace");
  });

  it("captures a slot stored as its module for a template written in JavaScript too", async () => {
    // The newsletter template, as plain JSX: no TypeScript in it.
    const dir = project({
      "templates/news.jsx": newsTemplate(),
      "designs/june.body.tsx": slotModule("<Column><Heading level={2}>June</Heading><Text>From a module</Text></Column>"),
      "designs/june.values.json": valuesFile("../templates/news.jsx", { subject: "June", body: { module: "./june.body.tsx" } }, { id: "acme.News", formats: null }),
    });
    const ran = await cli(dir, ["render", "designs/june.values.json", "--out", "out", "--no-lint", "--json"]);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(readFileSync(join(dir, "out/designs/june.html"), "utf8")).toContain("From a module");
  });
});

describe("--out and a values file", () => {
  it("won't be the folder that holds it, as with any input: its artwork beside it isn't written over", async () => {
    // The launch template's art, beside the values file and named as its render would be.
    const dir = withFixtures(project({ "templates/launch.tsx": launchTemplate() }));
    mkdirSync(join(dir, "cards"));
    const art = readFileSync(join(dir, "images/tide.png"));
    writeFileSync(join(dir, "cards/orbit.square.png"), art);
    writeFileSync(join(dir, "cards/orbit.values.json"), valuesFile("../templates/launch.tsx", { ...LAUNCH_VALUES, art: { src: "./orbit.square.png", width: 64, height: 64 } }, { formats: ["square"] }));
    const ran = await cli(join(dir, "cards"), ["render", "orbit.values.json", "--out", "."]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("--out . is a folder holding an input (orbit.values.json)");
    expect(readFileSync(join(dir, "cards/orbit.square.png")).equals(art)).toBe(true);
    // A folder of its own is fine.
    const own = await cli(join(dir, "cards"), ["render", "orbit.values.json", "--out", "rendered"]);
    expect(own.code, own.stdout + own.stderr).toBe(0);
    expect(exists(join(dir, "cards/rendered/orbit.square.png"))).toBe(true);
  });
});

describe("the trusted list in a package.json Node reads but JSON.parse alone wouldn't", () => {
  const files = (manifest: string) => ({
    "package.json": manifest,
    "templates/note.tsx": noteTemplate().replace('import { template } from "@hyper-elements/react/template";', 'import { template } from "@hyper-elements/react/template";\nimport "../other/helper";'),
    "other/helper.ts": `import { writeFileSync } from "node:fs";\nwriteFileSync(new URL("./HELPER_RAN", import.meta.url), "ran");\nexport {};\n`,
    "designs/a.values.json": valuesFile("../templates/note.tsx", { title: "Hi", body: "Body" }, { id: "acme.Note", formats: null }),
  });
  const MANIFEST = JSON.stringify({ name: "fixture", private: true, type: "module", hyperElements: { templates: ["templates/**"] } });

  // The load guard needs Node (Bun is refused where a list is set).
  it.skipIf(ON_BUN)("is read with its byte-order mark: an unlisted import is still refused, and never runs", async () => {
    const dir = project(files(`﻿${MANIFEST}`), { packageJson: null });
    const ran = await cli(dir, ["check", "designs/a.values.json", "--no-lint", "--json"]);
    expect(lines(ran)[0].diagnostics.filter((d: { severity: string }) => d.severity === "error").map((d: { code: string }) => d.code)).toEqual(["cli/template-untrusted"]);
    expect(ran.code).toBe(1);
    expect(exists(join(dir, "other/HELPER_RAN"))).toBe(false);
  });

  it("stops the run where it can't be read at all: it can't be taken for no list", async () => {
    const dir = project(files(`${MANIFEST.slice(0, -1)},}`), { packageJson: null });
    const ran = await cli(dir, ["check", "designs/a.values.json", "--no-lint"]);
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("package.json isn't JSON");
    expect(ran.stderr).toContain("hyperElements.templates");
    expect(exists(join(dir, "other/HELPER_RAN"))).toBe(false);
  });
});

describe("what counts as a template's design", () => {
  it("--require-template fails a design exported as an element, whose values no template read", async () => {
    const dir = project({
      "templates/note.tsx": noteTemplate(),
      // The required body is missing.
      "designs/element.tsx": `import Note from "../templates/note";\nexport default <Note title="Hi" />;\n`,
      "designs/component.tsx": `import Note from "../templates/note";\nexport default () => <Note title="Hi" />;\n`,
    });
    const ran = await cli(dir, ["check", "designs", "--require-template", "acme.Note", "--no-lint", "--json"]);
    expect(ran.code).toBe(1);
    const [component, element] = lines(ran);
    const errors = (line: { diagnostics: Array<{ code: string; severity: string }> }) => line.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
    expect([component.file, errors(component)]).toEqual(["designs/component.tsx", ["template/required"]]);
    // It's an element, not a component: never taken for the template module, whose example would pass.
    expect([element.file, element.status === "ok", errors(element).includes("cli/template-required")]).toEqual(["designs/element.tsx", false, true]);
  });

  // A trusted list needs Node's load guard (Bun is refused where one is set).
  it.skipIf(ON_BUN)("with a trusted list, a design kept in a listed folder is checked and rendered as a design, not skipped", async () => {
    const dir = project(
      {
        "emails/note.tsx": noteTemplate(),
        "emails/made.tsx": `import Note from "./note";\nexport default () => <Note title="Hi" />;\n`,
        "emails/good.tsx": `import Note from "./note";\nexport default () => <Note title="Hi" body="Listed, and a design" />;\n`,
        "emails/plain.tsx": `import { Email, Text } from "@hyper-elements/react";\nexport default () => <Email lang="en"><Text>Plain</Text><p>markup</p></Email>;\n`,
      },
      { packageJson: { name: "fixture", private: true, type: "module", hyperElements: { templates: ["emails/**"] } } }
    );
    const checked = await cli(dir, ["check", "emails", "--no-lint", "--json"]);
    const byFile = Object.fromEntries(lines(checked).filter((line) => line.file).map((line) => [line.file, [line.status, line.diagnostics.filter((d: { severity: string }) => d.severity === "error").map((d: { code: string }) => d.code)]]));
    expect(byFile).toEqual({
      "emails/good.tsx": ["ok", []],
      "emails/made.tsx": ["error", ["template/required"]],
      "emails/note.tsx": ["ok", []],
      "emails/plain.tsx": ["error", ["jsx/markup"]],
    });
    expect(checked.code).toBe(1);
    const rendered = await cli(dir, ["render", "emails/good.tsx", "--out", "out", "--no-lint", "--json"]);
    expect(rendered.code, rendered.stdout + rendered.stderr).toBe(0);
    expect(readFileSync(join(dir, "out/emails/good.html"), "utf8")).toContain("Listed, and a design");
  });
});

describe("a measured rule its template requires, in a Canvas the CLI measures", () => {
  it("is decided there: said once where it fails, as the template's, and never left as not run", async () => {
    const dir = withFixtures(
      project({
        "templates/launch.tsx": launchTemplate().replace('root: "Canvas",', 'root: "Canvas",\n  rules: { require: { core: ["image/fit", "image/overflow"] } },'),
        "designs/fits.values.json": valuesFile("../templates/launch.tsx", LAUNCH_VALUES, { formats: ["square"] }),
        "designs/long.values.json": valuesFile("../templates/launch.tsx", { ...LAUNCH_VALUES, headline: "A headline far too long for two lines of this little card" }, { formats: ["square"] }),
      })
    );
    const ran = await cli(dir, ["check", "designs", "--json"]);
    const [fits, long] = lines(ran);
    const said = (line: { diagnostics: Array<{ code: string; severity: string; message: string }> }, code: string) => line.diagnostics.filter((d) => d.code === code).map((d) => `${d.severity}${d.message.includes("(required by acme.Launch)") ? " required" : ""}`);
    expect([fits.status, said(fits, "template/rule-not-run"), fits.rules.map((r: { rule: string; status: string }) => `${r.rule} ${r.status}`)]).toEqual(["ok", [], ["image/fit passed", "image/overflow passed"]]);
    expect([long.status, said(long, "template/rule-not-run"), said(long, "image/fit")]).toEqual(["error", [], ["error required"]]);
    expect(ran.code).toBe(1);
  });
});

describe("required text given blank", () => {
  it("is refused as missing: by design set, which leaves the file as it was, and by check of a file that has it", async () => {
    const file = valuesFile("../templates/note.tsx", { title: "Hi", body: "Body" }, { id: "acme.Note", formats: null });
    const dir = project({ "templates/note.tsx": noteTemplate(), "designs/a.values.json": file, "designs/blank.values.json": valuesFile("../templates/note.tsx", { title: "   ", body: "Body" }, { id: "acme.Note", formats: null }) });
    const set = await cli(dir, ["design", "set", "designs/a.values.json", "title=", "--json"]);
    expect(set.code, set.stdout + set.stderr).toBe(1);
    expect(set.stdout).toContain("template/required");
    expect(readFileSync(join(dir, "designs/a.values.json"), "utf8")).toBe(file);
    const checked = await cli(dir, ["check", "designs/blank.values.json", "--no-lint", "--json"]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(lines(checked)[0].diagnostics.filter((d: { severity: string }) => d.severity === "error").map((d: { code: string; path: string }) => `${d.code} ${d.path}`)).toEqual(["template/required values.title"]);
  });
});

describe("a template's design, where the CLI makes the email client checks", () => {
  it("isn't told to install them: the template's own note about where they come from is dropped", async () => {
    const files = { "templates/note.tsx": noteTemplate(), "designs/a.values.json": valuesFile("../templates/note.tsx", { title: "Hi", body: "Body" }, { id: "acme.Note", formats: null }) };
    const noted = (ran: Awaited<ReturnType<typeof cli>>) => lines(ran)[0].diagnostics.filter((d: { code: string }) => d.code === "email/more-checks").length;
    // Without the package, the note stands: nothing made those checks.
    expect(noted(await cli(project(files), ["check", "designs/a.values.json", "--no-lint", "--json"]))).toBe(1);
    expect(noted(await cli(project(files, { modules: WITH_CLIENTS }), ["check", "designs/a.values.json", "--no-lint", "--json"]))).toBe(0);
  });

  it("isn't told where they come from when its template refuses it, or when design writes its file", async () => {
    // A link off the template's domains: the design is refused for that, with or without the package.
    const template = noteTemplate()
      .replace("import { Email, Heading, Text, prop }", "import { Email, Heading, Link, Text, prop }")
      .replace("  example: {", '  rules: { links: { domains: ["acme.example"] } },\n  example: {')
      .replace("{v.body}</Text>", '{v.body} <Link href="https://elsewhere.example/">More</Link></Text>');
    const refused = { "templates/note.tsx": template, "designs/a.values.json": valuesFile("../templates/note.tsx", { title: "Hi", body: "Body" }, { id: "acme.Note", formats: null }) };
    const ran = await cli(project(refused), ["check", "designs/a.values.json", "--no-lint", "--json"]);
    const codes = lines(ran)[0].diagnostics.map((d: { code: string }) => d.code);
    expect(ran.code, ran.stdout + ran.stderr).toBe(1);
    expect(codes).toContain("template/link-domain");
    expect(codes).not.toContain("email/more-checks");
    // design new checks the values and writes the file: it runs no email client checks, and doesn't point at them.
    const dir = project({ "templates/note.tsx": noteTemplate() });
    const made = await cli(dir, ["design", "new", "templates/note.tsx", "-o", "designs/b.values.json", "--set", "title=Hi", "--set", "body=Body", "--json"]);
    expect(made.code, made.stdout + made.stderr).toBe(0);
    expect(made.stdout).not.toContain("email/more-checks");
  });
});
