// @vitest-environment node

/**
 * Properties are data: `prop`'s helpers, `defineProperty()` and `checkValue()` import only each other and the engine, never React or
 * the render that collects a design, so the same limits can check a value where nothing renders. Each file they
 * import, and each file those import (type imports too), is in this folder, and their one package is the engine. Used
 * where React can't load, they make and check props as they do anywhere.
 */
import { existsSync, readFileSync, statSync } from "fs";
import { dirname, relative, resolve, sep } from "path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { checkValue, defineProperty, prop } from ".";

// Loading React, or the render that collects a design, fails this file.
vi.mock("react", () => {
  throw new Error("React was loaded");
});
vi.mock("react-dom/server", () => {
  throw new Error("react-dom was loaded");
});
vi.mock("../collect", () => {
  throw new Error("The render that collects a design was loaded");
});

const HERE = __dirname;
const name = (file: string) => relative(HERE, file).split(sep).join("/");

function resolveImport(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier);
  const file = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((end) => base + end).find((path) => existsSync(path) && statSync(path).isFile());
  if (!file) throw new Error(`${name(from)} imports ${specifier}, which isn't a file`);
  return file;
}

/** Each file `entry` imports, and each those import, with a file that imports it; each package, with a file that imports it. */
function importsOf(entry: string): { files: Map<string, string | null>; packages: Map<string, string> } {
  const files = new Map<string, string | null>();
  const packages = new Map<string, string>();
  const visit = (file: string, from: string | null) => {
    if (files.has(file)) return;
    files.set(file, from);
    for (const { fileName } of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      if (fileName.startsWith(".")) visit(resolveImport(file, fileName), file);
      else if (!packages.has(fileName)) packages.set(fileName, file);
    }
  };
  visit(entry, null);
  return { files, packages };
}

describe("properties' imports", () => {
  const { files, packages } = importsOf(resolve(HERE, "index.ts"));

  it("are this folder's files", () => {
    const outside = [...files].filter(([file]) => name(file).startsWith(".."));
    expect(outside.map(([file, from]) => `${name(from!)} → ${name(file)}`)).toEqual([]);
    expect([...files.keys()].map(name)).toEqual(expect.arrayContaining(["index.ts", "prop.ts", "define.ts", "check.ts"]));
  });

  it("import the engine and no other package", () => {
    const others = [...packages].filter(([specifier]) => specifier !== "@hyper-elements/core");
    expect(others.map(([specifier, file]) => `${name(file)} → ${specifier}`)).toEqual([]);
    expect([...packages.keys()]).toEqual(["@hyper-elements/core"]);
  });
});

describe("properties where React can't load", () => {
  it("make a team's own property on one of prop's helpers, with its options checked and defaulted", () => {
    const accentColor = defineProperty({
      name: "acme.accentColor",
      base: prop.color,
      options: { palette: prop.text({ enum: ["soft", "bold"], default: "soft" }) },
    });
    const background = accentColor({ label: "Background", default: "#fff4bf", transparency: false });
    expect(background).toMatchObject({ label: "Background", default: "#fff4bf", editor: { name: "acme.accentColor", options: { palette: "soft" } } });
    expect(background.kind.parse("#123456")).toMatchObject({ ok: true, value: "#123456" });
    expect(background.kind.parse("transparent").ok).toBe(false);
    expect(() => accentColor({ label: "Background", palette: "loud" as "soft" })).toThrow(/acme\.accentColor: its palette/);
  });

  it("check a list's items by their own limits", () => {
    const items = prop.list(prop.text({ label: "Item", maxLength: 3 }), { label: "Items", max: 2 });
    expect(items.kind.parse(["abc", "de"])).toMatchObject({ ok: true });
    expect(items.kind.parse(["abcd"]).ok).toBe(false);
    expect(items.kind.parse(["a", "b", "c"]).ok).toBe(false);
  });

  it("check what a field holds as its prop does, the same in any editing app: its value, or why it isn't one", () => {
    const price = prop.number({ label: "Price", min: 0 });
    expect(checkValue(price, "-5")).toEqual({ ok: false, message: "expected a number from 0, not -5" });
    // A number's field holds its digits as text.
    expect(checkValue(price, "129.50")).toEqual({ ok: true, value: 129.5 });
    expect(checkValue(price, 12)).toEqual({ ok: true, value: 12 });
    expect(checkValue(price, "12p")).toEqual({ ok: false, message: 'expected a number from 0, not "12p"' });
    // As it's written in decimal: an exponent is, hex isn't; and a number that isn't one isn't a number.
    expect(checkValue(price, "1e3")).toEqual({ ok: true, value: 1000 });
    expect(checkValue(price, "0x10")).toEqual({ ok: false, message: 'expected a number from 0, not "0x10"' });
    expect(checkValue(price, Number("1e"))).toEqual({ ok: false, message: "isn't a number" });
    // An empty field is the prop not given, which one its element needs isn't.
    expect(checkValue(price, "")).toEqual({ ok: true, value: undefined });
    expect(checkValue(prop.number({ label: "Price", required: true }), "")).toEqual({ ok: false, message: "is needed" });
    // Unless the empty text is one of the values the prop lists.
    expect(checkValue(prop.choice(["", "urgent"], { label: "Badge", required: true }), "")).toEqual({ ok: true, value: "" });
    // Text is what's typed: "A&lt;B" is six characters, never "A<B".
    const code = prop.text({ label: "Code", maxLength: 3 });
    expect(checkValue(code, "A<B")).toEqual({ ok: true, value: "A<B" });
    expect(checkValue(code, "A&lt;B")).toEqual({ ok: false, message: "is longer than 3 characters" });
    // A property of a team's own is checked by its base's limits.
    const currency = defineProperty({ name: "acme.currency", base: prop.number });
    expect(checkValue(currency({ label: "Price", min: 1 }), 0)).toEqual({ ok: false, message: "expected a number from 1, not 0" });
  });
});
