/** The built entry: no Node built-in, and nothing of Elements or React at run time (their types only). */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = join(__dirname, "../dist");

describe("dist/index.js", () => {
  const read = (file: string) => {
    expect(existsSync(join(DIST, file)), `${file} isn't built: run pnpm build`).toBe(true);
    return readFileSync(join(DIST, file), "utf8");
  };

  it("imports nothing at run time, in either module format", () => {
    for (const file of ["index.js", "index.cjs"]) {
      const code = read(file);
      expect(code, file).not.toMatch(/\bfrom\s*["']|\bimport\s*\(|\brequire\s*\(/);
      expect(code, file).not.toMatch(/["']node:/);
    }
  });

  it("names its version", () => {
    const { version } = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));
    expect(read("index.js")).toContain(JSON.stringify(version));
  });
});
