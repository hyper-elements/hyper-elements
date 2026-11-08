/**
 * The starter templates the package ships (templates/, which `hyper-elements new` copies and the site's gallery
 * shows): each says what it is, renders with no errors or warnings (notes about Outlook are fine) and passes the
 * design checks, since an agent copies what it starts from.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { ComponentType } from "react";
import { render } from "./render";
import { check } from "../check";

const dir = join(__dirname, "../../templates");
const files = readdirSync(dir).filter((file) => file.endsWith(".tsx")).sort();
const modules = import.meta.glob<{ default: ComponentType; meta?: { title?: string; description?: string; root?: string } }>("../../templates/*.tsx", { eager: true });
const starter = (file: string) => modules[`../../templates/${file}`];

describe("the starter templates", () => {
  it("are there, at least one for each root", () => {
    const roots = new Set(files.map((file) => starter(file).meta?.root));
    expect([...roots].sort()).toEqual(["Canvas", "Document", "Email", "Page"]);
  });

  it.each(files)("%s says what it is", (file) => {
    const { meta } = starter(file);
    expect(meta?.title).toBeTruthy();
    expect(meta?.description).toBeTruthy();
  });

  it.each(files)("%s renders with no errors or warnings", async (file) => {
    const Template = starter(file).default;
    const { diagnostics } = await render(<Template />);
    expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it.each(files)("%s passes the design checks", (file) => {
    const Template = starter(file).default;
    expect(check(<Template />).diagnostics.map((d) => `${d.code} ${d.path}: ${d.message.slice(0, 80)}`)).toEqual([]);
  });
});
