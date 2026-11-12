/**
 * The tests run the built CLI: it's built once before they start, so they test the current source.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export default function setup(): void {
  const root = fileURLToPath(new URL("..", import.meta.url));
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/tsup/dist/cli-default.js", import.meta.url))], { cwd: root, stdio: "ignore" });
}
