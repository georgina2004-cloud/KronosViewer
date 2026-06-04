import { execSync } from "child_process";
import fs from "fs";

const CLEANUP_RETRIES = 12;
const CLEANUP_RETRY_DELAY_MS = 500;
const WINDOWS_RELEASE_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExecShell(): string {
  return process.platform === "win32"
    ? process.env.ComSpec ?? "cmd.exe"
    : "/bin/sh";
}

export async function removeWorkDirectory(workDir: string): Promise<void> {
  if (!fs.existsSync(workDir)) return;

  if (process.platform === "win32") {
    await sleep(WINDOWS_RELEASE_DELAY_MS);
  }

  for (let attempt = 1; attempt <= CLEANUP_RETRIES; attempt += 1) {
    try {
      await fs.promises.rm(workDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: CLEANUP_RETRY_DELAY_MS,
      });
      return;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as NodeJS.ErrnoException).code)
          : "";

      const retriable =
        code === "EBUSY" ||
        code === "EPERM" ||
        code === "EACCES" ||
        code === "ENOTEMPTY" ||
        code === "ENOENT";

      if (!retriable || attempt === CLEANUP_RETRIES) {
        if (process.platform === "win32") {
          const removed = tryWindowsForceRemove(workDir);
          if (removed) return;
        }
        scheduleDeferredCleanup(workDir);
        return;
      }

      await sleep(CLEANUP_RETRY_DELAY_MS * attempt);
    }
  }
}

function tryWindowsForceRemove(targetPath: string): boolean {
  try {
    execSync(`rmdir /s /q "${targetPath}"`, {
      stdio: "ignore",
      shell: getExecShell(),
      timeout: 120_000,
    });
    return !fs.existsSync(targetPath);
  } catch {
    try {
      const escaped = targetPath.replace(/'/g, "''");
      execSync(
        `powershell -NoProfile -Command "Remove-Item -LiteralPath '${escaped}' -Recurse -Force -ErrorAction Stop"`,
        { stdio: "ignore", shell: getExecShell(), timeout: 120_000 },
      );
      return !fs.existsSync(targetPath);
    } catch {
      return false;
    }
  }
}

function scheduleDeferredCleanup(workDir: string): void {
  const runLater = async () => {
    await sleep(5000);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        if (!fs.existsSync(workDir)) return;
        await fs.promises.rm(workDir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 1000,
        });
        return;
      } catch {
        if (process.platform === "win32") {
          tryWindowsForceRemove(workDir);
          if (!fs.existsSync(workDir)) return;
        }
        await sleep(2000 * (attempt + 1));
      }
    }
  };

  void runLater();
}
