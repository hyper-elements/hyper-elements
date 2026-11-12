/**
 * Whether a child's parent is gone: on macOS and Linux its parent process changes when the parent ends; on Windows,
 * which doesn't give an orphan a new parent, the parent's process id no longer answers.
 */
export function parentGone(parent: number): boolean {
  if (process.ppid !== parent) return true;
  try {
    process.kill(parent, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "EPERM";
  }
}
