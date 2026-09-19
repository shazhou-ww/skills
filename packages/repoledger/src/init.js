import { lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DEFAULT_CONFIG_NAME,
  safeTasksPath,
  serializeConfig,
  validPrimaryBranch,
  validRemote,
  validTasksDirectory,
} from "./config.js";
import {
  commitPaths,
  fetchPrimary,
  pushPrimary,
  verifyPrimary,
  withTemporaryWorktree,
} from "./git.js";
import { serializeStatusFile } from "./ledger.js";

function error(code, message, remediation, extra = {}) {
  return { code, level: "error", message, remediation, ...extra };
}

export async function initRepository({
  primaryBranch,
  remote,
  root = process.cwd(),
  tasksDirectory = "tasks",
} = {}) {
  const config = { version: 1, tasksDirectory, remote, primaryBranch };
  if (!remote || !primaryBranch) {
    const diagnostics = [
      error("init.arguments.missing", "Remote and primary branch are required.", "Pass --remote and --primary-branch."),
    ];
    return { command: "init", ok: false, root, diagnostics, result: null };
  }
  const invalid = [];
  if (!validTasksDirectory(tasksDirectory) || !(await safeTasksPath(root, tasksDirectory))) {
    invalid.push(error("config.invalid-tasks-directory", "tasksDirectory is not a safe normalized repository-relative path.", "Use a path such as tasks."));
  }
  if (!validRemote(remote)) {
    invalid.push(error("config.invalid-remote", "remote is not a safe Git remote name.", "Use a name such as origin."));
  }
  if (!validPrimaryBranch(root, primaryBranch)) {
    invalid.push(error("config.invalid-primary-branch", "primaryBranch is not a valid short Git branch name.", "Use a branch such as main."));
  }
  if (invalid.length > 0) {
    return { command: "init", ok: false, root, diagnostics: invalid, result: null };
  }

  let primaryBefore;
  try {
    primaryBefore = fetchPrimary(root, config);
  } catch (caught) {
    return {
      command: "init",
      ok: false,
      root,
      diagnostics: [error("git.fetch.failed", caught.message, "Verify the Git repository, remote, and primary branch.")],
      result: null,
    };
  }

  try {
    return await withTemporaryWorktree(root, primaryBefore, async (worktree) => {
      const configPath = resolve(worktree, DEFAULT_CONFIG_NAME);
      const tasksPath = resolve(worktree, tasksDirectory);
      try {
        await lstat(configPath);
        return {
          command: "init",
          ok: false,
          root,
          diagnostics: [error("init.exists", `${DEFAULT_CONFIG_NAME} already exists.`, "Use the existing ledger or the migration procedure.")],
          result: null,
        };
      } catch (caught) {
        if (caught.code !== "ENOENT") throw caught;
      }
      try {
        const metadata = await lstat(tasksPath);
        if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
          return {
            command: "init",
            ok: false,
            root,
            diagnostics: [error("init.tasks-invalid", `${tasksDirectory} must be a regular directory.`, "Remove the conflicting path or use a safe empty directory.")],
            result: null,
          };
        }
        const entries = await readdir(tasksPath);
        if (entries.length > 0) {
          return {
            command: "init",
            ok: false,
            root,
            diagnostics: [error("init.tasks-not-empty", `${tasksDirectory} is not empty.`, "Use the migration procedure for repositories with existing tasks.")],
            result: null,
          };
        }
      } catch (caught) {
        if (caught.code !== "ENOENT") throw caught;
      }

      await mkdir(tasksPath, { recursive: true });
      await writeFile(configPath, serializeConfig(config));
      await writeFile(
        resolve(tasksPath, "status.yaml"),
        serializeStatusFile({ version: 1, tasks: {} }),
      );
      const commit = commitPaths(
        worktree,
        [DEFAULT_CONFIG_NAME, `${tasksDirectory}/status.yaml`],
        "chore: initialize repoledger",
      );
      try {
        pushPrimary(worktree, config);
        verifyPrimary(root, config, commit);
      } catch (caught) {
        return {
          command: "init",
          ok: false,
          root,
          diagnostics: [error("git.publish.failed", caught.message, "Refresh primary and retry without force-pushing.")],
          result: null,
        };
      }
      return {
        command: "init",
        ok: true,
        root,
        diagnostics: [],
        result: {
          publication: "published",
          primaryBefore,
          primaryAfter: commit,
          commit,
        },
      };
    });
  } catch (caught) {
    return {
      command: "init",
      ok: false,
      root,
      diagnostics: [error("git.operation.failed", caught.message, "Resolve the Git failure and retry.")],
      result: null,
    };
  }
}
