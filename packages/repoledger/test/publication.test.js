import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { checkRepository } from "../src/index.js";
import { initRepository } from "../src/init.js";
import { mutateTask } from "../src/publication.js";
import { statusRepository } from "../src/status.js";

const temporaryDirectories = [];

function git(root, ...args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createRemoteRepository() {
  const base = await mkdtemp(join(tmpdir(), "repoledger-publication-"));
  temporaryDirectories.push(base);
  const root = join(base, "work");
  const remote = join(base, "remote.git");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "repoledger test");
  git(root, "config", "user.email", "repoledger@example.invalid");
  await writeFile(join(root, "README.md"), "fixture\n");
  git(root, "add", "README.md");
  git(root, "commit", "-m", "Initialize fixture");
  git(root, "init", "--bare", "--initial-branch=main", remote);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "--set-upstream", "origin", "main");
  return { base, remote, root };
}

const TASK = `# Publication task

Created: 2026-09-19

## Goal

Exercise primary-only publication.

## Context

Integration fixture.

## Scope

- Publish lifecycle state.

## Out of scope

- Provider APIs.

## Acceptance criteria

- [ ] The lifecycle completes.

## Constraints

- Preserve caller state.

## Human review checkpoints

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | Fixture owner | Fixture scope. | Implementation. |
| Interface | Not applicable: no interface. | Not applicable | Not applicable. | Not applicable. |
| Business and data model | Not applicable: no model. | Not applicable | Not applicable. | Not applicable. |
| Architecture | Not applicable: no architecture. | Not applicable | Not applicable. | Not applicable. |
| Delivery acceptance | Required | Fixture owner | Published fixture. | Completion. |

## References

- None.
`;

const PROGRESS = `# Progress

Updated: 2026-09-19

## Current state

Implemented and accepted.

## Decisions

- Use primary-only publication.

## Human approvals

| Checkpoint | Status | Review artifact and decision evidence |
| --- | --- | --- |
| Scope | Approved | Fixture owner approved scope on 2026-09-19. |
| Interface | Not applicable | No interface. |
| Business and data model | Not applicable | No model. |
| Architecture | Not applicable | No architecture. |
| Delivery acceptance | Approved | Fixture owner approved delivery on 2026-09-19. |

## Validation

- Integration test passed.

## Blockers

- None.

## Outcome

Completed. Fixture accepted.
`;

test("initializes and publishes a complete task lifecycle without touching caller dirt", async () => {
  const { root } = await createRemoteRepository();
  await writeFile(join(root, "caller-dirt.txt"), "preserve me\n");

  const initialized = await initRepository({
    primaryBranch: "main",
    remote: "origin",
    root,
  });
  assert.equal(initialized.ok, true, JSON.stringify(initialized.diagnostics));
  assert.equal(await readFile(join(root, "caller-dirt.txt"), "utf8"), "preserve me\n");
  assert.match(git(root, "status", "--short"), /\?\? caller-dirt\.txt/);

  git(root, "pull", "--ff-only");
  const taskPath = join(root, "tasks", "publication-task");
  await mkdir(taskPath);
  await writeFile(join(taskPath, "Task.md"), TASK);

  const registered = await mutateTask({
    now: new Date("2026-09-19T10:00:00Z"),
    operation: "register",
    root,
    taskName: "publication-task",
  });
  assert.equal(registered.ok, true, JSON.stringify(registered.diagnostics));
  assert.equal(registered.result.transition, "absent -> backlog");
  assert.match(git(root, "status", "--short"), /\?\? caller-dirt\.txt/);
  const registeredAgain = await mutateTask({
    operation: "register",
    root,
    taskName: "publication-task",
  });
  assert.equal(registeredAgain.ok, true, JSON.stringify(registeredAgain.diagnostics));
  assert.equal(registeredAgain.result.publication, "already-published");

  const started = await mutateTask({
    now: new Date("2026-09-19T10:00:01Z"),
    operation: "start",
    root,
    taskName: "publication-task",
  });
  assert.equal(started.ok, true, JSON.stringify(started.diagnostics));
  assert.equal(started.result.transition, "backlog -> ongoing");

  const remoteStatus = await statusRepository({ root, taskName: "publication-task" });
  assert.equal(remoteStatus.ok, true, JSON.stringify(remoteStatus.diagnostics));
  assert.equal(remoteStatus.result.state, "ongoing");
  assert.equal(remoteStatus.result.source, "remote");

  await rm(taskPath, { recursive: true });
  git(root, "pull", "--ff-only");
  await writeFile(join(root, "implementation.txt"), "implemented\n");
  await writeFile(join(taskPath, "Task.md"), TASK.replace("- [ ]", "- [x]"));
  await writeFile(join(taskPath, "Progress.md"), PROGRESS);
  git(root, "add", "implementation.txt", "tasks/publication-task");
  git(root, "commit", "-m", "Implement publication task");
  git(root, "push", "origin", "main");
  const approvedCommit = git(root, "rev-parse", "HEAD");

  const completed = await mutateTask({
    approvedCommit,
    now: new Date("2026-09-19T10:00:02Z"),
    operation: "complete",
    root,
    taskName: "publication-task",
  });
  assert.equal(completed.ok, true, JSON.stringify(completed.diagnostics));
  assert.equal(completed.result.transition, "ongoing -> completed");
  assert.match(git(root, "status", "--short"), /\?\? caller-dirt\.txt/);
  const completedAgain = await mutateTask({
    approvedCommit,
    operation: "complete",
    root,
    taskName: "publication-task",
  });
  assert.equal(completedAgain.ok, true, JSON.stringify(completedAgain.diagnostics));
  assert.equal(completedAgain.result.publication, "already-published");
  const checked = await checkRepository({ remote: true, root });
  assert.equal(checked.ok, true, JSON.stringify(checked.diagnostics));
});

test("rejects completion for a commit other than fetched primary", async () => {
  const { root } = await createRemoteRepository();
  const initialized = await initRepository({ primaryBranch: "main", remote: "origin", root });
  assert.equal(initialized.ok, true);
  git(root, "pull", "--ff-only");

  const report = await mutateTask({
    approvedCommit: git(root, "rev-parse", "HEAD"),
    operation: "complete",
    root,
    taskName: "missing-task",
  });

  assert.equal(report.ok, false);
  assert.equal(report.diagnostics[0].code, "task.selection.missing");
});

test("remote check rejects a bookkeeping-only Progress commit", async () => {
  const { root } = await createRemoteRepository();
  const initialized = await initRepository({ primaryBranch: "main", remote: "origin", root });
  assert.equal(initialized.ok, true);
  git(root, "pull", "--ff-only");
  await mkdir(join(root, "tasks", "ghost-task"));
  await writeFile(join(root, "tasks", "ghost-task", "Progress.md"), "# Progress\n");
  git(root, "add", "tasks/ghost-task/Progress.md");
  git(root, "commit", "-m", "Add bookkeeping-only progress");
  git(root, "push", "origin", "main");

  const checked = await checkRepository({ remote: true, root });

  assert.equal(checked.ok, false);
  assert.ok(
    checked.diagnostics.some(({ code }) => code === "progress.history.bookkeeping-only"),
  );
});

test("rejects unsafe init paths and task names before filesystem access", async () => {
  const { root } = await createRemoteRepository();

  const initialized = await initRepository({
    primaryBranch: "main",
    remote: "origin",
    root,
    tasksDirectory: "../outside",
  });
  assert.equal(initialized.ok, false);
  assert.equal(initialized.diagnostics[0].code, "config.invalid-tasks-directory");

  await writeFile(
    join(root, "repoledger.yaml"),
    "version: 1\ntasksDirectory: tasks\nremote: origin\nprimaryBranch: main\n",
  );
  const mutation = await mutateTask({ operation: "register", root, taskName: "../escape" });
  assert.equal(mutation.ok, false);
  assert.equal(mutation.diagnostics[0].code, "task.name.invalid");
});

test("recomposes an unrelated concurrent task update", async () => {
  const { base, remote, root } = await createRemoteRepository();
  assert.equal(
    (await initRepository({ primaryBranch: "main", remote: "origin", root })).ok,
    true,
  );
  git(root, "pull", "--ff-only");
  const taskPath = join(root, "tasks", "publication-task");
  await mkdir(taskPath);
  await writeFile(join(taskPath, "Task.md"), TASK);
  assert.equal(
    (await mutateTask({ operation: "register", root, taskName: "publication-task" })).ok,
    true,
  );

  const concurrent = join(base, "concurrent");
  git(base, "clone", remote, concurrent);
  git(concurrent, "config", "user.name", "concurrent test");
  git(concurrent, "config", "user.email", "concurrent@example.invalid");
  const unrelated = join(concurrent, "tasks", "unrelated-task");
  await mkdir(unrelated);
  await writeFile(join(unrelated, "Task.md"), TASK.replaceAll("Publication task", "Unrelated task"));

  const started = await mutateTask({
    _beforePush: async ({ attempt }) => {
      if (attempt !== 0) return;
      const published = await mutateTask({
        operation: "register",
        root: concurrent,
        taskName: "unrelated-task",
      });
      assert.equal(published.ok, true, JSON.stringify(published.diagnostics));
    },
    operation: "start",
    root,
    taskName: "publication-task",
  });

  assert.equal(started.ok, true, JSON.stringify(started.diagnostics));
  assert.equal(started.result.transition, "backlog -> ongoing");
  const targetStatus = await statusRepository({ root, taskName: "publication-task" });
  const unrelatedStatus = await statusRepository({ root, taskName: "unrelated-task" });
  assert.equal(targetStatus.result.state, "ongoing");
  assert.equal(unrelatedStatus.result.state, "backlog");
});
