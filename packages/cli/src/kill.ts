/**
 * Ending a child and every process it started that stayed with it: on macOS and Linux its process group (each child
 * is started in a group of its own), on Windows its process tree. A process a template deliberately detaches (its
 * own group, a daemon) is out of reach of both.
 */
import { spawnSync } from "node:child_process";

export function killTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // ESRCH: the group is empty (everything in it has ended).
  }
}
