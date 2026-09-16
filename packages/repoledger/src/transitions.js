import { lstat, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { loadConfig } from "./config.js";
import { inspectTaskContents } from "./content.js";
import { selectTask } from "./discovery.js";
import { runGit } from "./git.js";
import { inspectHistory } from "./history.js";
import {
  PORTABLE_IDENTITY,
  identityRegistered,
  readIdentityState,
} from "./identity.js";
import { inspectLayout } from "./layout.js";
import { parseMarkdown } from "./markdown.js";
import { planReferenceUpdates } from "./references.js";
import {
  applyMoveTransaction,
  recoverMoveTransaction,
  snapshotDirectory,
} from "./transaction.js";

function error(code, path, message, remediation) {
  return { code, level: "error", path, message, remediation };
}

function warning(code, path, message, remediation) {
  return { code, level: "warning", path, message, remediation };
}

function displayPath(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

function escapeTableCell(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (caught) {
    if (caught.code === "ENOENT") return false;
    throw caught;
  }
}

function approvalRows(taskText) {
  const table = parseMarkdown(taskText)
    .section("Human review checkpoints")
    .find(({ type }) => type === "table");
  return (table?.rows ?? []).map((row) => {
    const checkpoint = row[0]?.text.trim() ?? "";
    const applicability = row[1]?.text.trim() ?? "";
    const reviewer = row[2]?.text.trim() ?? "";
    const artifact = row[3]?.text.trim() ?? "";
    if (applicability.startsWith("Not applicable:")) {
      return [checkpoint, "Not applicable", applicability.slice("Not applicable:".length).trim()]
        .map(escapeTableCell);
    }
    return [checkpoint, "Pending", `Review ${artifact} with ${reviewer}.`]
      .map(escapeTableCell);
  });
}

export async function createClaimProgress(taskPath, date = new Date().toISOString().slice(0, 10)) {
  const taskText = await readFile(resolve(taskPath, "Task.md"), "utf8");
  const rows = approvalRows(taskText)
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
  return `# Progress

Updated: ${date}

## Checklist

- [ ] Publish the claim to the shared primary branch.
- [ ] Obtain scope approval before substantive implementation.
- [ ] Complete each applicable interface, business and data model, and
  architecture approval before the affected implementation.
- [ ] Commit and publish substantive work at meaningful checkpoints.
- [ ] Publish implementation completion while the task is still ongoing.
- [ ] Complete documented manual user acceptance, if required.
- [ ] Obtain and publish delivery approval.
- [ ] Archive and publish the task as its final action.

## Current state

The task has been moved into the current worktree identity. Review this record,
publish the claim, and replace the pending claim milestone with its immutable
shared-branch commit before substantive implementation.

## Decisions

- None recorded during the mechanical claim move.

## Human approvals

| Checkpoint | Status | Review artifact and decision evidence |
| --- | --- | --- |
${rows}

## Publication milestones

| Milestone | Evidence | Status |
| --- | --- | --- |
| Claim | Pending publication of the task move. | Pending |
| Implementation complete | Pending. | Pending |
| Archive | Pending. | Pending |

## Validation

- Repoledger verified the claim source, destination, identity, references, and
  unique post-move task position.

## Blockers

- Claim publication and immutable evidence remain pending.

## Outcome

Pending.
`;
}

function identityDiagnostics({ config, git, root }) {
  const diagnostics = [];
  const state = readIdentityState(root, git);
  if (!state.extensionEnabled) {
    diagnostics.push(
      error(
        "transition.worktree-config.disabled",
        ".git/config",
        "extensions.worktreeConfig is not enabled.",
        "Run repoledger init --identity <identity> --apply before planning a task move.",
      ),
    );
  }
  if (!state.identity || !PORTABLE_IDENTITY.test(state.identity)) {
    diagnostics.push(
      error(
        "transition.identity.invalid",
        ".git/config.worktree",
        "The worktree has no valid task-ledger identity binding.",
        "Initialize and explicitly bind a lowercase kebab-case worktree identity.",
      ),
    );
  } else if (state.scope !== "worktree" || state.resolvedIdentity !== state.identity) {
    diagnostics.push(
      error(
        "transition.identity.invalid-scope",
        ".git/config.worktree",
        "The task-ledger identity does not resolve from worktree-scoped Git configuration.",
        "Bind the identity with git config --worktree after registration.",
      ),
    );
  } else if (!identityRegistered({ config, git, identity: state.identity, root })) {
    diagnostics.push(
      error(
        "transition.identity.unregistered",
        `${config.tasksDirectory}/ongoing/${state.identity}/.gitkeep`,
        `Identity ${state.identity} is not registered on ${config.remote}/${config.branch}.`,
        "Publish the identity lane before applying a task move.",
      ),
    );
  }
  return { diagnostics, state };
}

function addStateDiagnostic({ currentIdentity, diagnostics, operation, takeFrom, task }) {
  if (operation === "claim" && !takeFrom && task.state !== "backlog") {
    const remediation = task.state === "ongoing" && task.identity
      ? `Coordinate the transfer, then use plan claim ${task.name} --take-from ${task.identity}.`
      : "Choose a backlog task to claim.";
    diagnostics.push(
      error(
        "transition.claim.wrong-state",
        task.relativePath,
        `Task ${task.name} is ${task.state}, not backlog.`,
        remediation,
      ),
    );
  }
  if (operation === "claim" && takeFrom) {
    if (task.state !== "ongoing" || task.identity !== takeFrom) {
      diagnostics.push(
        error(
          "transition.takeover.source-mismatch",
          task.relativePath,
          `Task ${task.name} is not owned by expected identity ${takeFrom}.`,
          "Refresh status and repeat the takeover only with the task's current source identity.",
        ),
      );
    }
  }
  if (
    operation === "archive" &&
    (task.state !== "ongoing" || task.identity !== currentIdentity)
  ) {
    diagnostics.push(
      error(
        "transition.archive.wrong-owner",
        task.relativePath,
        `Task ${task.name} is not ongoing under current identity ${currentIdentity ?? "unbound"}.`,
        "Archive only a task owned by the current worktree identity.",
      ),
    );
  }
}

export async function transitionRepository({
  apply = false,
  configPath,
  git = runGit,
  now,
  operation,
  root = process.cwd(),
  takeFrom,
  taskName,
} = {}) {
  const repositoryRoot = resolve(root);
  const loaded = await loadConfig({ root: repositoryRoot, configPath });
  const diagnostics = [...loaded.diagnostics];
  const config = loaded.config;
  let refreshedHead = null;
  let refreshedRemote = null;

  if (!["claim", "archive"].includes(operation)) {
    diagnostics.push(
      error(
        "transition.operation.invalid",
        "operation",
        `Unsupported task transition: ${String(operation)}`,
        "Use claim or archive.",
      ),
    );
  }
  if (takeFrom && operation !== "claim") {
    diagnostics.push(
      error(
        "transition.takeover.invalid-operation",
        "--take-from",
        "Expected-source takeover is valid only with the claim transition.",
        "Use plan claim <task-name> --take-from <identity>.",
      ),
    );
  }
  if (takeFrom && !PORTABLE_IDENTITY.test(takeFrom)) {
    diagnostics.push(
      error(
        "transition.takeover.invalid-identity",
        "--take-from",
        `Source identity must use lowercase kebab-case: ${takeFrom}`,
        "Use the exact portable identity reported by repoledger status.",
      ),
    );
  }

  if (config && apply) {
    try {
      const recovery = await recoverMoveTransaction({
        git,
        root: repositoryRoot,
        taskRoot: resolve(repositoryRoot, config.tasksDirectory),
      });
      if (recovery.recovered) {
        diagnostics.push(
          error(
            "transition.recovery.performed",
            recovery.journal,
            `Recovered a previous ${recovery.state} repoledger transaction.`,
            "Review the recovered state, then rerun the transition so it is planned from current files.",
          ),
        );
      }
    } catch (caught) {
      diagnostics.push(
        error(
          "transition.recovery.failed",
          caught.journal ?? ".git",
          `A previous repoledger transaction could not be recovered: ${caught.message}`,
          "Preserve the journal and resolve its reported recovery errors before another move.",
        ),
      );
    }
  }

  if (config && apply) {
    const fetched = git(repositoryRoot, ["fetch", config.remote, config.branch]);
    if (!fetched.ok) {
      diagnostics.push(
        error(
          "transition.remote.fetch-failed",
          `${config.remote}/${config.branch}`,
          `Could not refresh ${config.remote}/${config.branch}.`,
          "Restore network and repository access, then rerun the apply command.",
        ),
      );
    } else {
      const head = git(repositoryRoot, ["rev-parse", "--verify", "HEAD^{commit}"]);
      const remoteHead = git(repositoryRoot, [
        "rev-parse",
        "--verify",
        `refs/remotes/${config.remote}/${config.branch}^{commit}`,
      ]);
      if (head.ok && remoteHead.ok) {
        refreshedHead = head.stdout;
        refreshedRemote = remoteHead.stdout;
      } else {
        diagnostics.push(
          error(
            "transition.branch.unavailable",
            `${config.remote}/${config.branch}`,
            "The refreshed local or shared branch commit could not be resolved.",
            "Restore complete Git refs and recompute the transition plan.",
          ),
        );
      }
      const synchronized = git(repositoryRoot, [
        "rev-list",
        "--left-right",
        "--count",
        `HEAD...refs/remotes/${config.remote}/${config.branch}`,
      ]);
      if (!synchronized.ok || !/^0\s+0$/.test(synchronized.stdout)) {
        diagnostics.push(
          error(
            "transition.branch.unsynchronized",
            `${config.remote}/${config.branch}`,
            "The worktree HEAD is not synchronized with the refreshed shared branch.",
            "Reconcile the shared branch without discarding work, then recompute the plan.",
          ),
        );
      }
    }
  }

  const layout = config
    ? await inspectLayout({ config, root: repositoryRoot })
    : { diagnostics: [], tasks: [] };
  diagnostics.push(...layout.diagnostics);
  const selected = config
    ? selectTask(layout.tasks, taskName)
    : { diagnostics: [], selected: [], selection: { checked: 0, matches: 0, name: taskName } };
  diagnostics.push(...selected.diagnostics);
  const task = selected.selected[0] ?? null;
  const identityResult = config
    ? identityDiagnostics({ config, git, root: repositoryRoot })
    : { diagnostics: [], state: readIdentityState(repositoryRoot, git) };
  diagnostics.push(...identityResult.diagnostics);
  const currentIdentity = identityResult.state.identity;

  if (takeFrom && takeFrom === currentIdentity) {
    diagnostics.push(
      error(
        "transition.takeover.same-identity",
        "--take-from",
        "The expected source identity is already the current worktree identity.",
        "Omit --take-from when claiming backlog work; no transfer is needed for locally owned work.",
      ),
    );
  }
  if (task) {
    addStateDiagnostic({
      currentIdentity,
      diagnostics,
      operation,
      takeFrom,
      task,
    });
  }

  let destinationPath = null;
  let destinationRelativePath = null;
  if (config && task && currentIdentity) {
    destinationRelativePath = operation === "archive"
      ? `${config.tasksDirectory}/archived/${task.name}`
      : `${config.tasksDirectory}/ongoing/${currentIdentity}/${task.name}`;
    destinationPath = resolve(repositoryRoot, destinationRelativePath);
    if (await exists(destinationPath)) {
      diagnostics.push(
        error(
          "transition.destination.exists",
          destinationRelativePath,
          `Transition destination already exists: ${destinationRelativePath}`,
          "Reconcile the duplicate or conflicting destination before applying the move.",
        ),
      );
    }
  }

  if (task && config) {
    const contents = await inspectTaskContents({ root: repositoryRoot, tasks: [task] });
    const history = await inspectHistory({
      config,
      git,
      root: repositoryRoot,
      tasks: [task],
    });
    diagnostics.push(...contents.diagnostics, ...history.diagnostics);
    if (operation === "archive" && destinationRelativePath) {
      const prospective = await inspectTaskContents({
        allowPendingArchive: true,
        root: repositoryRoot,
        tasks: [{ ...task, state: "archived", relativePath: destinationRelativePath }],
      });
      diagnostics.push(...prospective.diagnostics);
    }
  }

  let referencePlan = { diagnostics: [], edits: [], references: [] };
  if (task && destinationPath && config) {
    referencePlan = await planReferenceUpdates({
      destinationPath,
      git,
      root: repositoryRoot,
      sourcePath: task.path,
      tasksDirectory: config.tasksDirectory,
    });
    diagnostics.push(...referencePlan.diagnostics);
  }

  let progressContent = null;
  if (task && operation === "claim" && !takeFrom) {
    progressContent = await createClaimProgress(task.path, now);
  }
  let sourceSnapshot = null;
  if (task) {
    try {
      sourceSnapshot = await snapshotDirectory(task.path);
      const symbolicArtifact = sourceSnapshot.find(({ type }) => type === "symlink");
      if (symbolicArtifact) {
        diagnostics.push(
          error(
            "transition.source.symlink-artifact",
            `${task.relativePath}/${symbolicArtifact.path}`,
            "Task artifacts must not be symbolic links.",
            "Replace the symbolic link with a regular repository-owned artifact before moving the task.",
          ),
        );
      }
    } catch (caught) {
      diagnostics.push(
        error(
          "transition.source.snapshot-failed",
          task.relativePath,
          `Task artifacts could not be snapshotted: ${caught.message}`,
          "Resolve unreadable or unsupported task artifacts before moving the task.",
        ),
      );
    }
  }

  const actualOperation = takeFrom ? "takeover" : operation;
  const changes = [];
  if (task && destinationRelativePath) {
    changes.push({
      action: "move-directory",
      from: task.relativePath,
      to: destinationRelativePath,
    });
    if (progressContent) {
      changes.push({
        action: "create-file",
        path: `${destinationRelativePath}/Progress.md`,
      });
    }
    for (const edit of referencePlan.edits) {
      changes.push({ action: "rewrite-markdown", path: edit.path });
    }
  }

  let applied = false;
  if (
    apply &&
    refreshedHead &&
    refreshedRemote &&
    diagnostics.every(({ level }) => level !== "error")
  ) {
    const refreshedAgain = git(repositoryRoot, ["fetch", config.remote, config.branch]);
    const currentHead = git(repositoryRoot, ["rev-parse", "--verify", "HEAD^{commit}"]);
    const currentRemote = git(repositoryRoot, [
      "rev-parse",
      "--verify",
      `refs/remotes/${config.remote}/${config.branch}^{commit}`,
    ]);
    if (
      !refreshedAgain.ok ||
      !currentHead.ok ||
      !currentRemote.ok ||
      currentHead.stdout !== refreshedHead ||
      currentRemote.stdout !== refreshedRemote
    ) {
      diagnostics.push(
        error(
          "transition.branch.changed",
          `${config.remote}/${config.branch}`,
          "The local or shared branch changed while the transition was being planned.",
          "Review the new state and recompute the transition plan.",
        ),
      );
    }
  }
  if (
    apply &&
    task &&
    destinationPath &&
    diagnostics.every(({ level }) => level !== "error")
  ) {
    const creates = progressContent
      ? [{
        absolutePath: resolve(task.path, "Progress.md"),
        postMovePath: resolve(destinationPath, "Progress.md"),
        content: progressContent,
      }]
      : [];
    try {
      const transaction = await applyMoveTransaction({
        creates,
        destinationPath,
        edits: referencePlan.edits,
        git,
        root: repositoryRoot,
        sourcePath: task.path,
        sourceSnapshot,
        taskRoot: resolve(repositoryRoot, config.tasksDirectory),
        verify: async () => {
          const verified = await inspectLayout({ config, root: repositoryRoot });
          const matches = verified.tasks.filter(({ name }) => name === task.name);
          if (
            verified.diagnostics.some(({ level }) => level === "error") ||
            matches.length !== 1 ||
            matches[0].relativePath !== destinationRelativePath
          ) {
            throw new Error("The post-move task position could not be verified");
          }
          for (const edit of referencePlan.edits) {
            if (await readFile(edit.postMovePath, "utf8") !== edit.content) {
              throw new Error(`Rewritten Markdown could not be verified: ${edit.path}`);
            }
          }
        },
      });
      if (transaction.cleanupErrors.length > 0) {
        diagnostics.push(
          warning(
            "transition.cleanup.pending",
            transaction.journal,
            "The task move committed, but transaction backup cleanup is incomplete.",
            "Inspect the committed transaction journal and remove only its recorded stale backups before another move.",
          ),
        );
      }
      applied = true;
    } catch (caught) {
      if (caught.recovered) {
        diagnostics.push(
          error(
            "transition.recovery.performed",
            caught.recovered.journal,
            caught.message,
            "Review the recovered state, then rerun the transition so it is planned from current files.",
          ),
        );
      } else {
        diagnostics.push(
          error(
            "transition.apply.failed",
            task.relativePath,
            `Transition failed and rollback was attempted: ${caught.message}`,
            caught.rollbackErrors?.length
              ? `Recover the journal at ${caught.journal}; rollback failures: ${caught.rollbackErrors.join("; ")}`
              : "Resolve the reported failure and recompute the transition plan.",
          ),
        );
      }
    }
  }

  const ok = diagnostics.every(({ level }) => level !== "error");
  const nextActions = [];
  if (applied) {
    if (actualOperation === "claim") {
      nextActions.push("Review Progress.md, commit and publish the claim, then record its immutable commit hash.");
    } else if (actualOperation === "takeover") {
      nextActions.push("Commit and publish the coordinated ownership transfer before continuing work.");
    } else {
      nextActions.push("Record the archive action in Progress.md, then commit and publish the move as the task's final lifecycle integration.");
    }
  } else if (ok && changes.length > 0) {
    const takeover = takeFrom ? ` --take-from ${takeFrom}` : "";
    nextActions.push(`Rerun plan ${operation} ${taskName}${takeover} --apply to apply this recomputed plan.`);
  }

  return {
    command: "plan",
    operation: actualOperation,
    mode: apply ? "apply" : "preview",
    task: taskName,
    root: repositoryRoot,
    source: task?.relativePath ?? null,
    destination: destinationRelativePath,
    currentIdentity,
    sourceIdentity: takeFrom ?? task?.identity ?? null,
    destinationIdentity: operation === "archive" ? null : currentIdentity,
    preconditions: [
      "Unique task position",
      "Expected source state and identity",
      "Registered worktree identity",
      "Valid task content and publication history",
      "Conflict-free destination and references",
    ],
    blockers: diagnostics.filter(({ level }) => level === "error"),
    changes,
    referenceEdits: referencePlan.references,
    applied,
    nextActions,
    ok,
    diagnostics,
    summary: {
      changes: changes.length,
      errors: diagnostics.filter(({ level }) => level === "error").length,
      infos: diagnostics.filter(({ level }) => level === "info").length,
      referenceEdits: referencePlan.references.length,
      warnings: diagnostics.filter(({ level }) => level === "warning").length,
    },
  };
}