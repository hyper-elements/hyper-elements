/**
 * A child's watchdog, in a worker thread: its event loop runs even while a template blocks the child's. Every 500 ms
 * it checks whether the parent is gone (the child's parent process changed) or the child has run past its deadline,
 * and if so ends the child and every process in its group (on Windows, its tree).
 */
import { spawnSync } from "node:child_process";
import { workerData } from "node:worker_threads";

const { parent, pid, deadline } = workerData as { parent: number; pid: number; deadline: number };
const started = Date.now();

function end(): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // not a group leader (it should be): the child alone
    }
  }
  process.kill(pid, "SIGKILL");
}

function parentGone(): boolean {
  if (process.ppid !== parent) return true;
  try {
    process.kill(parent, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "EPERM";
  }
}

const timer = setInterval(() => {
  if (parentGone() || Date.now() - started > deadline) {
    clearInterval(timer);
    end();
  }
}, 500);
