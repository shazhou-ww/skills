import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";

import { doctorRepository } from "../src/doctor.js";
import { checkRepository } from "../src/index.js";
import { projectConfig } from "../test-support/support.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function git(root, ...args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function isolatedGlobalGit(globalConfig) {
  return (root, args) => {
    const result = spawnSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig },
      windowsHide: true,
    });
    return {
      error: result.error ?? null,
      ok: result.status === 0,
      status: result.status,
      stderr: result.stderr?.trim() ?? "",
      stdout: result.stdout?.trim() ?? "",
    };
  };
}

async function createGitRepository() {
  const base = await mkdtemp(join(tmpdir(), "repoledger-real-git-"));
  temporaryDirectories.push(base);
  const root = join(base, "work");
  const remote = join(base, "remote.git");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "repoledger test");
  git(root, "config", "user.email", "repoledger@example.invalid");
  await writeFile(join(root, "repoledger.json"), JSON.stringify(projectConfig(), null, 2));
  for (const status of ["backlog", "ongoing", "archived"]) {
    const path = join(root, "tasks", status);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, ".gitkeep"), "");
  }
  const lane = join(root, "tasks", "ongoing", "fixture-identity");
  await mkdir(lane);
  await writeFile(join(lane, ".gitkeep"), "");
  git(root, "add", ".");
  git(root, "commit", "-m", "Initialize task ledger");
  git(root, "init", "--bare", "--initial-branch=main", remote);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "--set-upstream", "origin", "main");
  git(root, "config", "extensions.worktreeConfig", "true");
  git(root, "config", "--worktree", "task-ledger.identity", "fixture-identity");
  return { base, remote, root };
}

function commitAndPush(root, message) {
  git(root, "add", "--all");
  git(root, "commit", "-m", message);
  const commit = git(root, "rev-parse", "HEAD");
  git(root, "push", "origin", "HEAD:main");
  return commit;
}

function taskDocument(checked = false) {
  return `# Real Git task

Created: 2026-09-15

## Goal

Exercise real Git history.

## Context

Integration fixture.

## Scope

- Fixture files.

## Out of scope

- Production data.

## Acceptance criteria

- [${checked ? "x" : " "}] The lifecycle is validated.

## Constraints

- Keep commits distinct.

## Human review checkpoints

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | Fixture owner | Fixture scope and acceptance criteria. | Fixture implementation. |
| Interface | Not applicable: the fixture has no interface. | Not applicable | Not applicable. | Not applicable. |
| Business and data model | Not applicable: the fixture has no business data. | Not applicable | Not applicable. | Not applicable. |
| Architecture | Not applicable: the fixture has no architecture change. | Not applicable | Not applicable. | Not applicable. |
| Delivery acceptance | Required | Fixture owner | Published fixture and validation evidence. | Completion and archive. |

## References

- None.
`;
}

function progressDocument({
  archive = false,
  claim,
  deliveryApproved = archive,
  implementation,
}) {
  return `# Progress

Updated: 2026-09-15

## Checklist

- [x] Publish the claim to the shared primary branch.
- [x] Obtain scope approval before substantive implementation.
- [x] Complete conditional human approvals.
- [x] Commit and publish substantive work at meaningful checkpoints.
- [${implementation ? "x" : " "}] Publish implementation completion while the task is still ongoing.
- [x] Complete documented manual user acceptance, if required.
- [${deliveryApproved ? "x" : " "}] Obtain and publish delivery approval.
- [${archive ? "x" : " "}] Archive and publish the task as its final action.

## Current state

${archive ? "Archived." : "In progress."}

## Decisions

- Use real Git commits.

## Human approvals

| Checkpoint | Status | Review artifact and decision evidence |
| --- | --- | --- |
| Scope | Approved | Fixture owner approved the fixture scope on 2026-09-15. |
| Interface | Not applicable | The fixture has no interface. |
| Business and data model | Not applicable | The fixture has no business data. |
| Architecture | Not applicable | The fixture has no architecture change. |
| Delivery acceptance | ${deliveryApproved ? "Approved" : "Pending"} | ${deliveryApproved ? "Fixture owner approved delivery on 2026-09-15." : "Review the integrated fixture after implementation."} |

## Publication milestones

| Milestone | Evidence | Status |
| --- | --- | --- |
| Claim | ${claim ? "Task ownership published to origin/main." : "Pending."} | ${claim ? "Published" : "Pending"} |
| Implementation complete | ${implementation ? "Validated implementation published to origin/main." : "Pending."} | ${implementation ? "Published" : "Pending"} |
| Archive | ${archive ? "Task archived on origin/main." : "Pending."} | ${archive ? "Published" : "Pending"} |

## Validation

- Real Git fixture.

## Blockers

- None.

## Outcome

${archive ? "Completed. The real lifecycle passed." : "In progress."}
`;
}

test("validates a real worktree identity without inspecting remote history", async () => {
  const { root } = await createGitRepository();

  const checked = await checkRepository({ root });
  const doctored = await doctorRepository({ root });

  assert.equal(checked.ok, true);
  assert.equal(doctored.ok, true);
  assert.equal(doctored.identity, "fixture-identity");
  assert.equal(Object.hasOwn(doctored, "remoteFreshness"), false);
});

test("uses real worktree identity precedence over a global fallback", async () => {
  const { base, root } = await createGitRepository();
  const globalConfig = join(base, "global.gitconfig");
  await writeFile(
    globalConfig,
    "[task-ledger]\n\tidentity = global-identity\n",
  );
  const globalLane = join(root, "tasks", "ongoing", "global-identity");
  await mkdir(globalLane);
  await writeFile(join(globalLane, ".gitkeep"), "");
  const isolatedGit = isolatedGlobalGit(globalConfig);

  const overridden = await doctorRepository({ git: isolatedGit, root });

  assert.equal(overridden.ok, true);
  assert.equal(overridden.identity, "fixture-identity");
  assert.equal(overridden.scope.identityScope, "worktree");

  git(root, "config", "--worktree", "--unset", "task-ledger.identity");
  const inherited = await doctorRepository({ git: isolatedGit, root });

  assert.equal(inherited.ok, true);
  assert.equal(inherited.identity, "global-identity");
  assert.equal(inherited.scope.identityScope, "global");
});

test("accepts a real shallow clone without an identity", async () => {
  const { base, remote } = await createGitRepository();
  const shallow = join(base, "shallow");
  const clone = spawnSync(
    "git",
    ["clone", "--depth=1", pathToFileURL(remote).href, shallow],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(clone.status, 0, clone.stderr);

  const report = await checkRepository({ root: shallow });

  assert.equal(report.ok, true);
  assert.equal(report.scope.identity, null);
  assert.deepEqual(report.diagnostics, []);
});

test("validates a real archive move with phased publications and approval", async () => {
  const { root } = await createGitRepository();
  const backlog = join(root, "tasks", "backlog", "real-history-task");
  await mkdir(backlog);
  await writeFile(join(backlog, "Task.md"), taskDocument());
  commitAndPush(root, "Record real history task");

  const ongoing = join(
    root,
    "tasks",
    "ongoing",
    "fixture-identity",
    "real-history-task",
  );
  await rename(backlog, ongoing);
  await writeFile(join(ongoing, "Progress.md"), progressDocument({ claim: true }));
  commitAndPush(root, "Claim real history task");

  await writeFile(join(root, "implementation.txt"), "implemented\n");
  await writeFile(
    join(ongoing, "Progress.md"),
    progressDocument({ claim: true, implementation: true }),
  );
  commitAndPush(root, "Implement real history task");

  await writeFile(
    join(ongoing, "Progress.md"),
    progressDocument({ claim: true, deliveryApproved: true, implementation: true }),
  );
  commitAndPush(root, "Record delivery approval");

  const archived = join(root, "tasks", "archived", "real-history-task");
  await rename(ongoing, archived);
  await writeFile(join(archived, "Task.md"), taskDocument(true));
  await writeFile(
    join(archived, "Progress.md"),
    progressDocument({ archive: true, claim: true, implementation: true }),
  );
  commitAndPush(root, "Archive real history task");

  const report = await checkRepository({ includeArchived: true, root });

  assert.equal(report.ok, true);
  assert.deepEqual(report.diagnostics, []);
});