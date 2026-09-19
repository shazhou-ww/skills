import { resolve } from "node:path";

import { loadConfig } from "./config.js";
import { inspectTaskContents } from "./content.js";
import { fetchPrimary, runGit, withTemporaryWorktree } from "./git.js";
import { inspectLayout } from "./layout.js";

function selectionDiagnostic(name) {
  return {
    code: "task.selection.missing",
    level: "error",
    message: `Task ${name} does not exist in the repository ledger.`,
    path: name,
    remediation: "Choose a task name reported by repoledger task list.",
    task: name,
  };
}

function validateProgressHistory(root, config, primary) {
  const statusPath = `${config.tasksDirectory}/status.yaml`;
  const introduced = runGit(root, [
    "log",
    "--diff-filter=A",
    "--format=%H",
    "--reverse",
    primary,
    "--",
    statusPath,
  ]);
  if (!introduced.ok || !introduced.stdout) return [];
  const migration = introduced.stdout.split(/\r?\n/, 1)[0];
  const listed = runGit(root, ["rev-list", "--first-parent", "--reverse", `${migration}..${primary}`]);
  if (!listed.ok || !listed.stdout) return [];
  const diagnostics = [];
  const progressPattern = new RegExp(
    `^${config.tasksDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^/]+/Progress\\.md$`,
  );
  for (const commit of listed.stdout.split(/\r?\n/).filter(Boolean)) {
    const parent = runGit(root, ["rev-parse", `${commit}^1`]);
    if (!parent.ok) continue;
    const changed = runGit(root, [
      "diff",
      "--name-only",
      parent.stdout,
      commit,
      "--",
    ]);
    if (!changed.ok) continue;
    const paths = changed.stdout.split(/\r?\n/).filter(Boolean);
    const changesProgress = paths.some((path) => progressPattern.test(path));
    const changesOutsideTasks = paths.some(
      (path) => path !== config.tasksDirectory && !path.startsWith(`${config.tasksDirectory}/`),
    );
    if (changesProgress && !changesOutsideTasks) {
      diagnostics.push({
        code: "progress.history.bookkeeping-only",
        level: "error",
        message: `Commit ${commit} changes Progress.md without an implementation path outside ${config.tasksDirectory}.`,
        remediation: "Revert the bookkeeping-only change with a forward commit and keep future progress updates with implementation changes.",
        actual: { commit, paths },
      });
    }
  }
  return diagnostics;
}

export async function checkRepository({
  remote = false,
  root = process.cwd(),
  taskName,
} = {}) {
  const repositoryRoot = resolve(root);
  const loaded = await loadConfig({ root: repositoryRoot });
  if (remote && loaded.config) {
    try {
      const primary = fetchPrimary(repositoryRoot, loaded.config);
      const report = await withTemporaryWorktree(repositoryRoot, primary, (worktree) =>
        checkRepository({ root: worktree, taskName }),
      );
      report.root = repositoryRoot;
      report.result = { ...report.result, source: "remote", primary };
      report.diagnostics.push(...validateProgressHistory(repositoryRoot, loaded.config, primary));
      report.ok = report.diagnostics.every(({ level }) => level !== "error");
      return report;
    } catch (caught) {
      return {
        command: "check",
        ok: false,
        root: repositoryRoot,
        diagnostics: [{
          code: "git.fetch.failed",
          level: "error",
          message: caught.message,
          remediation: "Check remote access and retry.",
        }],
        result: null,
      };
    }
  }
  const layout = loaded.config
    ? await inspectLayout({ config: loaded.config, root: repositoryRoot })
    : { diagnostics: [], tasks: [] };
  const matchingTask = taskName
    ? layout.tasks.find(({ name }) => name === taskName)
    : null;
  const selectedTasks = taskName
    ? matchingTask
      ? [matchingTask]
      : []
    : layout.tasks;
  const contents = loaded.config
    ? await inspectTaskContents({ root: repositoryRoot, tasks: selectedTasks })
    : { diagnostics: [] };
  const diagnostics = [
    ...loaded.diagnostics,
    ...layout.diagnostics,
    ...(taskName && !matchingTask ? [selectionDiagnostic(taskName)] : []),
    ...contents.diagnostics,
  ];

  return {
    command: "check",
    ok: diagnostics.every(({ level }) => level !== "error"),
    root: repositoryRoot,
    diagnostics,
    result: {
      checked: selectedTasks.length,
      source: "local",
      total: layout.tasks.length,
    },
  };
}

export { listTasks, statusRepository } from "./status.js";
export { initRepository } from "./init.js";
export { mutateTask } from "./publication.js";
