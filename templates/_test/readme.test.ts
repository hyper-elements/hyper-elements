import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../_scripts/assets";
import { readme } from "../_scripts/readme";

it("has a README.md the script wrote (pnpm --filter ./templates readme)", async () => {
  expect(readFileSync(join(ROOT, "README.md"), "utf8")).toBe(await readme());
});
