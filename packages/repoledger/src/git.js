import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function runGit(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    error: result.error ?? null,
    ok: result.status === 0,
    status: result.status,
    stderr: result.stderr?.trim() ?? "",
    stdout: result.stdout?.trim() ?? "",
  };
}

function requireGit(root, args, label) {
  const result = runGit(root, args);
  if (!result.ok) {
    const error = new Error(`${label}: ${result.stderr || result.error?.message || "Git failed"}`);
    error.git = result;
    throw error;
  }
  return result.stdout;
}

export function fetchPrimary(root, config) {
  const remoteRef = `refs/remotes/${config.remote}/${config.primaryBranch}`;
  requireGit(
    root,
    [
      "fetch",
      "--no-tags",
      config.remote,
      `+refs/heads/${config.primaryBranch}:${remoteRef}`,
    ],
    "Cannot fetch primary",
  );
  return requireGit(root, ["rev-parse", remoteRef], "Cannot resolve fetched primary");
}

export async function withTemporaryWorktree(root, commit, callback) {
  const directory = await mkdtemp(join(tmpdir(), "repoledger-worktree-"));
  let added = false;
  try {
    requireGit(root, ["worktree", "add", "--detach", "--no-checkout", directory, commit], "Cannot create isolated worktree");
    added = true;
    requireGit(directory, ["reset", "--hard", commit], "Cannot populate isolated worktree");
    return await callback(directory);
  } finally {
    if (added) runGit(root, ["worktree", "remove", "--force", directory]);
    await rm(directory, { recursive: true, force: true });
    runGit(root, ["worktree", "prune"]);
  }
}

export function commitPaths(worktree, paths, message) {
  requireGit(worktree, ["add", "--all", "--", ...paths], "Cannot stage operation-owned paths");
  const staged = runGit(worktree, ["diff", "--cached", "--quiet", "--", ...paths]);
  if (staged.ok) return requireGit(worktree, ["rev-parse", "HEAD"], "Cannot resolve unchanged commit");
  requireGit(worktree, ["commit", "-m", message, "--", ...paths], "Cannot create publication commit");
  return requireGit(worktree, ["rev-parse", "HEAD"], "Cannot resolve publication commit");
}

export function pushPrimary(worktree, config) {
  return requireGit(
    worktree,
    ["push", config.remote, `HEAD:refs/heads/${config.primaryBranch}`],
    "Cannot publish primary",
  );
}

export function verifyPrimary(root, config, expectedCommit) {
  const actual = fetchPrimary(root, config);
  if (!runGit(root, ["merge-base", "--is-ancestor", expectedCommit, actual]).ok) {
    throw new Error(`Published commit ${expectedCommit} is not reachable from primary ${actual}`);
  }
  return actual;
}
