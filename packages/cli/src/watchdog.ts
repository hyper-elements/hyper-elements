/**
 * A child's watchdog, in a worker thread: its event loop runs even while a template blocks the child's. Every 500 ms
 * it checks whether the parent is gone (the child's parent process changed) or the child has run past its deadline,
 * and if so ends the child and every process in its group (on Windows, its tree).
 */
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { workerData } from "node:worker_threads";
import { parentGone } from "./parent";

const { parent, pid, deadline } = workerData as { parent: number; pid: number; deadline: number };
const started = Date.now();

function end(): void {
  if (process.platform === "win32") {
    // (From the temporary folder: not the project's, which it would hold open while it runs.)
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, cwd: tmpdir() });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // not a group leader (it should be): the child alone
    }
  }
  process.kill(pid, "SIGKILL");
}

const timer = setInterval(() => {
  if (parentGone(parent) || Date.now() - started > deadline) {
    clearInterval(timer);
    end();
  }
}, 500);
