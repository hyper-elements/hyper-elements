/**
 * The starter templates `@hyper-elements/react` ships (its templates/ folder): each a whole template to copy and
 * change, with `export const meta = { title, description, root }`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Starter {
  name: string;
  file: string;
  root: string;
  description: string;
}

export function starters(engineRoot: string): Starter[] {
  const dir = join(engineRoot, "templates");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".tsx"))
    .sort()
    .map((file) => {
      const source = readFileSync(join(dir, file), "utf8");
      const field = (key: string) => new RegExp(`${key}:\\s*"([^"]*)"`).exec(source)?.[1] ?? "";
      return { name: file.replace(/\.tsx$/, ""), file: join(dir, file), root: field("root"), description: field("description") };
    });
}
