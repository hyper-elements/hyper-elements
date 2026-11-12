/**
 * Ending a child and every process it started that stayed with it: on macOS and Linux its process group (each child
 * is started in a group of its own), on Windows its process tree. A process a template deliberately detaches (its
 * own group, a daemon) is out of reach of both.
 */
import { execFile, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

/**
 * Where the processes started to end others run (taskkill, PowerShell): not the project's folder, which they'd hold
 * open while they run (Windows won't remove a folder a process is in).
 */
export const NEUTRAL = tmpdir();

export function killTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, cwd: NEUTRAL });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // ESRCH: the group is empty (everything in it has ended).
  }
}

/**
 * Windows: ends the processes a child started that outlived it (it crashed, or exited on its own). Ending a process
 * there doesn't end its children, and once the child is gone taskkill can't follow its tree; so they're found in the
 * process table (`orphansOf`). Elsewhere a child's group outlives it, and `killTree` ends it. Resolves once they're ended.
 */
export function endOrphans(pid: number, startedAt: number, endedAt: number): Promise<void> {
  if (process.platform !== "win32") return Promise.resolve();
  const script =
    "Get-CimInstance Win32_Process | ForEach-Object { if ($_.CreationDate) { " +
    '"$($_.ProcessId) $($_.ParentProcessId) $(([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds())" } }';
  return new Promise((resolve) => {
    execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, timeout: 20_000, maxBuffer: 16 * 1024 * 1024, cwd: NEUTRAL }, (error, stdout) => {
      if (!error) {
        for (const orphan of orphansOf(stdout, pid, startedAt, endedAt)) {
          try {
            process.kill(orphan, "SIGKILL");
          } catch {
            // ended already
          }
        }
      }
      resolve();
    });
  });
}

/**
 * From a process table (a line per process: its id, its parent's id, when it started in ms), the processes `pid`
 * started while it ran between `startedAt` and `endedAt`, and every process they started. A process whose parent's
 * id is `pid` but that started after it ended is another's: Windows gives a free id to the next process.
 */
export function orphansOf(table: string, pid: number, startedAt: number, endedAt: number): number[] {
  const rows = table
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter((row) => row.length === 3 && row.every(Number.isFinite))
    .map(([id, parent, created]) => ({ id, parent, created }));
  const found: number[] = [];
  let level = rows.filter((row) => row.parent === pid && row.id !== pid && row.created >= startedAt - 1_000 && row.created <= endedAt + 1_000);
  while (level.length) {
    const ids = new Set(level.map((row) => row.id).filter((id) => !found.includes(id)));
    found.push(...ids);
    level = rows.filter((row) => ids.has(row.parent) && !found.includes(row.id) && row.created >= startedAt - 1_000);
  }
  return found;
}
