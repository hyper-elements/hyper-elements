/**
 * `npx @hyper-elements/migrate style-blocks <files or folders>`: Hyper Elements templates' `mobile={…}` and `hover={…}`
 * props moved into their `style` (transform.ts). Nothing is written unless asked: one template is printed, several are
 * listed with what was left as it was; --write replaces them, only where git can give them back (or --allow-dirty).
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { Args } from "../args";
import { styleBlocks } from "./transform";

export interface StyleBlocksIo {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface StyleBlocksHelpers {
  walk(dir: string): Promise<string[]>;
  notRestorable(files: string[]): Promise<Array<{ file: string; why: string }>>;
}

const SOURCE = /\.[cm]?[jt]sx?$/;

export async function styleBlocksCommand(paths: string[], args: Args, io: StyleBlocksIo, helpers: StyleBlocksHelpers): Promise<number> {
  for (const option of ["out", "design", "no-merge-tags", "strict", "force", "overwrite", "from", "report"]) {
    if (args.option(option) !== undefined || args.flag(option)) {
      io.stderr(`--${option} isn't for style-blocks: it prints a template, or replaces templates with --write.\n`);
      return 1;
    }
  }
  if (!paths.length) {
    io.stderr("style-blocks needs the templates or folders to rewrite: npx @hyper-elements/migrate style-blocks <files or folders> [--write]\n");
    return 1;
  }
  const files: string[] = [];
  for (const given of paths) {
    const path = resolve(io.cwd, given);
    const info = await stat(path).catch(() => undefined);
    if (!info) {
      io.stderr(`${given}: no such file or folder.\n`);
      return 1;
    }
    files.push(...(info.isDirectory() ? (await helpers.walk(path)).filter((file) => SOURCE.test(file)) : [path]));
  }
  const name = (file: string) => relative(io.cwd, file);
  const results: Array<{ file: string; code: string; report: string[]; moved: number }> = [];
  const failed: Array<{ file: string; error: string }> = [];
  for (const file of files) {
    try {
      const source = await readFile(file, "utf8");
      const result = styleBlocks(source, file, { typescript: !/\.[cm]?jsx?$/.test(file) });
      if (result.template && (result.moved || result.report.length)) results.push({ file, code: result.code, report: result.report, moved: result.moved });
    } catch (error) {
      failed.push({ file, error: (error as Error).message });
    }
  }
  for (const f of failed) io.stderr(`${name(f.file)}: couldn't be read: ${f.error}\n`);
  if (!results.length) {
    io.stdout("No mobile={…} or hover={…} props on Hyper Elements' components were found: nothing to rewrite.\n");
    return failed.length ? 2 : 0;
  }
  const changed = results.filter((r) => r.moved);

  // One template, not written: the rewritten template itself, on stdout (what stayed, on stderr).
  if (!args.flag("write") && paths.length === 1 && files.length === 1) {
    io.stdout(results[0].code);
    for (const line of results[0].report) io.stderr(`${name(results[0].file)}: ${line}\n`);
    return failed.length ? 2 : 0;
  }
  if (args.flag("write") && changed.length) {
    const unsafe = args.flag("allow-dirty") ? [] : await helpers.notRestorable(changed.map((r) => r.file));
    if (unsafe.length) {
      io.stderr(
        `--write replaces templates in place, and git couldn't restore these:\n${unsafe.map((u) => `  ${name(u.file)} (${u.why})`).join("\n")}\n` +
          "Commit them first (then git can undo the rewrite), or pass --allow-dirty.\n"
      );
      return 1;
    }
    for (const r of changed) await writeFile(r.file, r.code);
  }
  for (const r of results) {
    const did = r.moved ? `${r.moved} prop${r.moved === 1 ? "" : "s"} ${args.flag("write") ? "moved into style" : "would move into style"}` : "nothing moved";
    io.stdout(`${name(r.file)}: ${did}${r.report.length ? `, ${r.report.length} left as ${r.report.length === 1 ? "it is" : "they are"}` : ""}\n`);
    for (const line of r.report) io.stdout(`  - ${line}\n`);
  }
  if (!args.flag("write")) io.stdout("Nothing was written: pass --write to replace them (or give one template to print it).\n");
  return failed.length ? 2 : 0;
}
