import { createHash } from "node:crypto";
import { cp, lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { loadConfig } from "./config.js";
import {
  commitPaths,
  fetchPrimary,
  pushPrimary,
  runGit,
  verifyPrimary,
  withTemporaryWorktree,
} from "./git.js";
import { checkRepository } from "./index.js";
import {
  createRecord,
  isTaskName,
  serializeStatusFile,
  transitionRecord,
} from "./ledger.js";
import { inspectLayout } from "./layout.js";

function error(code, message, remediation, extra = {}) {
  return { code, level: "error", message, remediation, ...extra };
}

function report(command, root, diagnostics, result = null) {
  return {
    command,
    ok: diagnostics.every(({ level }) => level !== "error"),
    root,
    diagnostics,
    result,
  };
}

async function snapshotDirectory(path, base = path, hash = createHash("sha256")) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = resolve(path, entry.name);
    const relativePath = relative(base, entryPath).replaceAll("\\", "/");
    const metadata = await lstat(entryPath);
    if (metadata.isSymbolicLink()) throw new Error(`Symbolic link is not allowed: ${relativePath}`);
    hash.update(`${entry.isDirectory() ? "d" : "f"}:${relativePath}\0`);
    if (entry.isDirectory()) await snapshotDirectory(entryPath, base, hash);
    else if (entry.isFile()) {
      const content = await readFile(entryPath);
      hash.update(content.includes(0) ? content : content.toString("utf8").replaceAll("\r\n", "\n"));
    }
    else throw new Error(`Unsupported task artifact: ${relativePath}`);
  }
  return hash.digest("hex");
}

export async function remoteSnapshot(root, callback) {
  const loaded = await loadConfig({ root });
  if (!loaded.config) return report("snapshot", root, loaded.diagnostics);
  try {
    const commit = fetchPrimary(root, loaded.config);
    return await withTemporaryWorktree(root, commit, (worktree) =>
      callback({ commit, config: loaded.config, worktree }),
    );
  } catch (caught) {
    return report("snapshot", root, [
      error("git.fetch.failed", caught.message, "Check network access, authentication, remote, and primary branch."),
    ]);
  }
}

function messageFor(operation, taskName) {
  return `task: ${operation} ${taskName}`;
}

function operationCommit(root, primary, operation, taskName, statusRelative) {
  const found = runGit(root, [
    "log",
    "-1",
    "--format=%H",
    "--fixed-strings",
    `--grep=${messageFor(operation, taskName)}`,
    primary,
    "--",
    statusRelative,
  ]);
  return found.ok && found.stdout ? found.stdout : primary;
}

function cleanInternal(reportValue) {
  const { _observed, _retryable, ...publicReport } = reportValue;
  return publicReport;
}

async function attemptMutation({
  _beforePush,
  attempt,
  approvedCommit,
  baseline,
  now = new Date(),
  operation,
  root = process.cwd(),
  taskName,
} = {}) {
  if (!isTaskName(taskName)) {
    return report(`task ${operation}`, root, [
      error("task.name.invalid", `Task name must use lowercase kebab-case: ${String(taskName)}`, "Use a name such as example-task.", { task: taskName }),
    ]);
  }
  const loaded = await loadConfig({ root });
  if (!loaded.config) return report(`task ${operation}`, root, loaded.diagnostics);
  const config = loaded.config;
  let primaryBefore;
  try {
    primaryBefore = fetchPrimary(root, config);
  } catch (caught) {
    return report(`task ${operation}`, root, [
      error("git.fetch.failed", caught.message, "Check network access, authentication, remote, and primary branch."),
    ]);
  }

  try {
    return await withTemporaryWorktree(root, primaryBefore, async (worktree) => {
      const remoteConfig = await loadConfig({ root: worktree });
      if (!remoteConfig.config || JSON.stringify(remoteConfig.config) !== JSON.stringify(config)) {
        return report(`task ${operation}`, root, [
          ...remoteConfig.diagnostics,
          error("config.remote-mismatch", "Local configuration does not match fetched primary.", "Refresh the local primary branch before retrying."),
        ]);
      }
      const layout = await inspectLayout({ config, root: worktree });
      if (layout.diagnostics.some(({ level }) => level === "error")) {
        return report(`task ${operation}`, root, layout.diagnostics);
      }

      const existing = layout.status.tasks[taskName];
      const taskRelative = `${config.tasksDirectory}/${taskName}`;
      const taskPath = resolve(worktree, taskRelative);
      const statusRelative = `${config.tasksDirectory}/status.yaml`;
      const remoteHash = existing ? await snapshotDirectory(taskPath) : null;
      const observed = { record: existing ?? null, taskHash: remoteHash };
      let sourceHash;
      if (operation === "register") {
        const sourcePath = resolve(root, taskRelative);
        try {
          const metadata = await lstat(sourcePath);
          if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("source is not a regular directory");
          sourceHash = await snapshotDirectory(sourcePath);
        } catch (caught) {
          return report(`task ${operation}`, root, [
            error("task.register.invalid-source", `Cannot import ${taskRelative}: ${caught.message}`, "Prepare a stable task directory containing Task.md before registration.", { task: taskName, path: taskRelative }),
          ]);
        }
        if (existing) {
          if (existing.state === "backlog" && sourceHash === remoteHash) {
            const commit = operationCommit(root, primaryBefore, operation, taskName, statusRelative);
            return report(`task ${operation}`, root, [], {
              task: taskName,
              transition: "absent -> backlog",
              publication: "already-published",
              primaryBefore,
              primaryAfter: primaryBefore,
              commit,
            });
          }
          return report(`task ${operation}`, root, [
            error("task.register.exists", `Task ${taskName} is already registered.`, "Choose a new task name or inspect the existing task.", { task: taskName }),
          ]);
        }
        if (baseline && JSON.stringify(observed) !== JSON.stringify(baseline)) {
          return report(`task ${operation}`, root, [
            error("task.concurrent-conflict", `Task ${taskName} changed during publication.`, "Refresh the task and coordinate the same-task change before retrying.", { expected: baseline, actual: observed, task: taskName }),
          ]);
        }
        await cp(sourcePath, taskPath, { recursive: true, errorOnExist: true, force: false });
        layout.status.tasks[taskName] = createRecord(now);
      } else {
        if (!existing) {
          return report(`task ${operation}`, root, [
            error("task.selection.missing", `Task ${taskName} does not exist.`, "Choose a task reported by repoledger task list.", { task: taskName }),
          ]);
        }
        const target = operation === "start"
          ? "ongoing"
          : operation === "complete"
            ? "completed"
            : operation === "abandon"
              ? "abandoned"
              : null;
        if (!target) {
          return report(`task ${operation}`, root, [
            error("task.operation.invalid", `Unknown task operation: ${operation}`, "Use register, start, complete, or abandon."),
          ]);
        }
        if (existing.state === target) {
          const commit = operationCommit(root, primaryBefore, operation, taskName, statusRelative);
          if (operation !== "complete" || !approvedCommit) {
            return report(`task ${operation}`, root, [], {
              task: taskName,
              transition: `${baseline?.record?.state ?? existing.state} -> ${target}`,
              publication: "already-published",
              primaryBefore,
              primaryAfter: primaryBefore,
              commit,
            });
          }
          const resolved = runGit(root, ["rev-parse", "--verify", `${approvedCommit}^{commit}`]);
          const parents = runGit(root, ["show", "-s", "--format=%P", commit]);
          if (resolved.ok && parents.ok && parents.stdout.split(" ").includes(resolved.stdout)) {
            return report(`task ${operation}`, root, [], {
              task: taskName,
              transition: "ongoing -> completed",
              publication: "already-published",
              primaryBefore,
              primaryAfter: primaryBefore,
              commit,
            });
          }
        }
        if (baseline && JSON.stringify(observed) !== JSON.stringify(baseline)) {
          return report(`task ${operation}`, root, [
            error("task.concurrent-conflict", `Task ${taskName} changed during publication.`, "Refresh the task and coordinate the same-task change before retrying.", { expected: baseline, actual: observed, task: taskName }),
          ]);
        }
        if (operation === "complete") {
          const resolved = approvedCommit
            ? runGit(root, ["rev-parse", "--verify", `${approvedCommit}^{commit}`])
            : { ok: false };
          if (!resolved.ok || resolved.stdout !== primaryBefore) {
            return report(`task ${operation}`, root, [
              error("task.complete.approval-mismatch", "The approved commit is not the fetched primary tip.", "Obtain delivery approval for the current primary commit and retry with --approved-commit.", { expected: primaryBefore, actual: resolved.stdout ?? null, task: taskName }),
            ]);
          }
        }
        try {
          layout.status.tasks[taskName] = transitionRecord(existing, target, now);
        } catch (caught) {
          return report(`task ${operation}`, root, [
            error("task.state.conflict", caught.message, "Refresh task status and choose a legal lifecycle operation.", { actual: existing, task: taskName }),
          ]);
        }
      }

      await writeFile(resolve(worktree, statusRelative), serializeStatusFile(layout.status));
      const prospective = await checkRepository({ root: worktree });
      if (prospective.diagnostics.some(({ level }) => level === "error")) {
        return report(`task ${operation}`, root, prospective.diagnostics);
      }

      if (operation === "register") {
        const sourcePath = resolve(root, taskRelative);
        if (await snapshotDirectory(sourcePath) !== sourceHash) {
          return report(`task ${operation}`, root, [
            error("task.register.source-changed", `Task ${taskName} changed during publication.`, "Review the local task directory and retry registration."),
          ]);
        }
      }

      const ownedPaths = operation === "register"
        ? [statusRelative, taskRelative]
        : [statusRelative];
      const commit = commitPaths(worktree, ownedPaths, messageFor(operation, taskName));
      try {
        if (_beforePush) await _beforePush({ attempt, primaryBefore });
        pushPrimary(worktree, config);
        verifyPrimary(root, config, commit);
      } catch (caught) {
        return {
          ...report(`task ${operation}`, root, [
          error("git.publish.failed", caught.message, "Refresh primary, resolve the reported conflict, and retry without force-pushing.", { task: taskName }),
          ]),
          _observed: observed,
          _retryable: true,
        };
      }

      return report(`task ${operation}`, root, prospective.diagnostics, {
        task: taskName,
        transition: operation === "register" ? "absent -> backlog" : `${existing.state} -> ${layout.status.tasks[taskName].state}`,
        publication: "published",
        primaryBefore,
        primaryAfter: commit,
        commit,
      });
    });
  } catch (caught) {
    return report(`task ${operation}`, root, [
      error("git.operation.failed", caught.message, "Resolve the Git or filesystem failure and retry."),
    ]);
  }
}

export async function mutateTask(options = {}) {
  let baseline = null;
  let lastReport;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    lastReport = await attemptMutation({ ...options, attempt, baseline });
    if (!baseline && lastReport._observed) baseline = lastReport._observed;
    if (!lastReport._retryable) return cleanInternal(lastReport);
  }
  return cleanInternal(lastReport);
}
