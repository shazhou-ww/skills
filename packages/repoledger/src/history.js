import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { runGit } from "./git.js";
import { parseMarkdown } from "./markdown.js";

function diagnostic(code, level, path, message, remediation) {
  return { code, level, path, message, remediation };
}

function error(code, path, message, remediation) {
  return diagnostic(code, "error", path, message, remediation);
}

function rowsByMilestone(document) {
  const table = document
    .section("Publication milestones")
    .find(({ type }) => type === "table");
  return new Map(
    (table?.rows ?? []).map((row) => [
      row[0]?.text.trim(),
      { evidence: row[1]?.text.trim() ?? "", status: row[2]?.text.trim() ?? "" },
    ]),
  );
}

function commitReference(evidence) {
  return /(?:^|[^0-9a-f])([0-9a-f]{7,40})(?=$|[^0-9a-f])/i.exec(evidence)?.[1] ?? null;
}

function historyRequirementDiagnostic(status, detail) {
  return diagnostic(
    `history.${status}`,
    "error",
    ".git",
    detail,
    status === "shallow"
      ? "Fetch full Git history before relying on publication validation."
      : "Run the check in a Git worktree with the configured remote branch available.",
  );
}

function resolveCommit({ diagnostics, evidence, git, milestone, path, remoteRef, root }) {
  const reference = commitReference(evidence);
  if (!reference) {
    diagnostics.push(
      error(
        "history.evidence.commit-missing",
        path,
        `${milestone} is Published but its evidence has no commit reference.`,
        `Record an immutable ${milestone} commit hash from the shared primary branch.`,
      ),
    );
    return null;
  }
  const resolved = git(root, ["rev-parse", "--verify", `${reference}^{commit}`]);
  if (!resolved.ok) {
    diagnostics.push(
      error(
        "history.evidence.commit-unavailable",
        path,
        `${milestone} commit ${reference} is unavailable in local Git history.`,
        "Fetch full shared-branch history or correct the recorded evidence.",
      ),
    );
    return null;
  }
  if (remoteRef) {
    const ancestor = git(root, ["merge-base", "--is-ancestor", resolved.stdout, remoteRef]);
    if (!ancestor.ok) {
      diagnostics.push(
        error(
          "history.evidence.not-published",
          path,
          `${milestone} commit ${resolved.stdout} is not reachable from ${remoteRef}.`,
          "Publish the milestone through the shared primary branch and refresh the remote ref.",
        ),
      );
    }
  }
  return resolved.stdout;
}

function findArchiveCommit({ config, git, root, task }) {
  const log = git(root, ["log", "--format=%H", "--", `${task.relativePath}/Task.md`]);
  if (!log.ok) return null;
  for (const commit of log.stdout.split(/\r?\n/).filter(Boolean)) {
    const current = git(root, ["cat-file", "-e", `${commit}:${task.relativePath}/Task.md`]);
    if (!current.ok) continue;
    const parent = git(root, ["cat-file", "-e", `${commit}^:${task.relativePath}/Task.md`]);
    if (parent.ok) continue;
    const ongoingRoot = `${config.tasksDirectory}/ongoing`;
    const parentTasks = git(root, [
      "ls-tree",
      "-r",
      "--name-only",
      `${commit}^`,
      "--",
      ongoingRoot,
    ]);
    if (!parentTasks.ok) continue;
    const suffix = `/${task.name}/Task.md`;
    const sources = parentTasks.stdout
      .split(/\r?\n/)
      .filter((path) => {
        if (!path.startsWith(`${ongoingRoot}/`) || !path.endsWith(suffix)) return false;
        return path.slice(ongoingRoot.length + 1).split("/").length === 3;
      });
    if (sources.length !== 1) continue;
    const sourceRemains = git(root, ["cat-file", "-e", `${commit}:${sources[0]}`]);
    if (!sourceRemains.ok) return { commit, sourcePath: sources[0] };
  }
  return null;
}

export async function inspectHistory({ config, git = runGit, root, tasks }) {
  const diagnostics = [];
  const inside = git(root, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.stdout !== "true") {
    diagnostics.push(
      historyRequirementDiagnostic(
        "unavailable",
        "Git history is unavailable; publication evidence was not inspected.",
      ),
    );
    return { capability: "unavailable", diagnostics };
  }

  const shallowResult = git(root, ["rev-parse", "--is-shallow-repository"]);
  if (!shallowResult.ok) {
    diagnostics.push(
      historyRequirementDiagnostic(
        "completeness-unknown",
        "Git could not determine whether repository history is complete.",
      ),
    );
    return { capability: "unavailable", diagnostics };
  }
  const shallow = shallowResult.ok && shallowResult.stdout === "true";
  if (shallow) {
    diagnostics.push(
      historyRequirementDiagnostic(
        "shallow",
        "Git history is shallow; publication evidence may be incomplete.",
      ),
    );
  }

  const remoteRef = `refs/remotes/${config.remote}/${config.branch}`;
  const remote = git(root, ["rev-parse", "--verify", `${remoteRef}^{commit}`]);
  const verifiedRemoteRef = remote.ok ? remoteRef : null;
  if (!verifiedRemoteRef) {
    diagnostics.push(
      historyRequirementDiagnostic(
        "remote-ref-unavailable",
        `Configured remote branch ${config.remote}/${config.branch} is unavailable; reachability was not verified.`,
      ),
    );
  }

  for (const task of tasks) {
    if (task.state === "backlog") continue;

    let progressText;
    try {
      progressText = await readFile(resolve(task.path, "Progress.md"), "utf8");
    } catch {
      continue;
    }
    const progressPath = `${task.relativePath}/Progress.md`;
    const document = parseMarkdown(progressText);
    if (task.state === "archived" && !document.headings.has("Publication milestones")) {
      continue;
    }
    const rows = rowsByMilestone(document);
    const commits = [];
    for (const milestone of ["Claim", "Implementation complete"]) {
      const row = rows.get(milestone);
      if (row?.status !== "Published") continue;
      const commit = resolveCommit({
        diagnostics,
        evidence: row.evidence,
        git,
        milestone,
        path: progressPath,
        remoteRef: verifiedRemoteRef,
        root,
      });
      if (commit) commits.push(commit);
    }

    if (task.state === "archived") {
      const archiveMove = findArchiveCommit({ config, git, root, task });
      if (!archiveMove) {
        diagnostics.push(
          error(
            "history.archive.commit-unavailable",
            progressPath,
            "The archive move commit could not be identified in local Git history.",
            "Fetch full history and verify the task was moved rather than copied into archived.",
          ),
        );
      } else {
        const archiveCommit = archiveMove.commit;
        commits.push(archiveCommit);
        if (verifiedRemoteRef) {
          const ancestor = git(root, ["merge-base", "--is-ancestor", archiveCommit, verifiedRemoteRef]);
          if (!ancestor.ok) {
            diagnostics.push(
              error(
                "history.archive.not-published",
                progressPath,
                `Archive commit ${archiveCommit} is not reachable from ${remoteRef}.`,
                "Publish the archive move through the shared primary branch.",
              ),
            );
          }
        }
      }
    }
    if (new Set(commits).size !== commits.length) {
      diagnostics.push(
        error(
          "history.milestones.not-distinct",
          progressPath,
          "Lifecycle publication milestones do not resolve to distinct commits.",
          "Publish claim, implementation completion, and archive as separate integrations.",
        ),
      );
    }
  }

  return {
    capability: shallow ? "shallow" : "full",
    diagnostics,
    remoteRef: verifiedRemoteRef,
  };
}
