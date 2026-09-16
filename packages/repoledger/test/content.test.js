import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { checkRepository } from "../src/index.js";
import { fullHistoryGit, projectConfig } from "../test-support/support.js";

const temporaryDirectories = [];
const HUMAN_REVIEW_PLAN = `## Human review checkpoints

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | Fixture owner | Fixture scope and acceptance criteria. | Fixture implementation. |
| Interface | Not applicable: the fixture has no interface. | Not applicable | Not applicable. | Not applicable. |
| Business and data model | Not applicable: the fixture has no business data. | Not applicable | Not applicable. | Not applicable. |
| Architecture | Not applicable: the fixture has no architecture change. | Not applicable | Not applicable. | Not applicable. |
| Delivery acceptance | Required | Fixture owner | Integrated fixture and validation evidence. | Completion and archive. |`;
const TASK = `# Fixture task

Created: 2026-09-15

## Goal

Validate one outcome.

## Context

Fixture context.

## Scope

- Included.

## Out of scope

- Excluded.

## Acceptance criteria

- [ ] Observable result.

## Constraints

- Preserve fixture state.

${HUMAN_REVIEW_PLAN}

## References

- [Profile](/tasks/README.md)
`;
const HUMAN_APPROVALS = `## Human approvals

| Checkpoint | Status | Review artifact and decision evidence |
| --- | --- | --- |
| Scope | Approved | Fixture owner approved the fixture scope on 2026-09-15. |
| Interface | Not applicable | The fixture has no interface. |
| Business and data model | Not applicable | The fixture has no business data. |
| Architecture | Not applicable | The fixture has no architecture change. |
| Delivery acceptance | Pending | Review the integrated fixture after implementation. |`;
const PROGRESS = `# Progress

Updated: 2026-09-15

## Checklist

- [x] Publish the claim to the shared primary branch.
- [x] Obtain scope approval before substantive implementation.
- [x] Complete conditional human approvals.
- [ ] Publish implementation completion while the task is still ongoing.
- [ ] Obtain and publish delivery approval.
- [ ] Archive and publish the task as its final action.

## Current state

In progress.

## Decisions

- None.

${HUMAN_APPROVALS}

## Publication milestones

| Milestone | Evidence | Status |
| --- | --- | --- |
| Claim | origin/main commit abcdef0. | Published |
| Implementation complete | Pending. | Pending |
| Archive | Pending. | Pending |

## Validation

- Fixture validation.

## Blockers

- None.

## Outcome

In progress.
`;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createRepository() {
  const root = await mkdtemp(join(tmpdir(), "repoledger-content-"));
  temporaryDirectories.push(root);
  await writeFile(
    join(root, "repoledger.json"),
    JSON.stringify(projectConfig()),
  );
  for (const status of ["backlog", "ongoing", "archived"]) {
    await mkdir(join(root, "tasks", status), { recursive: true });
  }
  await writeFile(join(root, "tasks", "README.md"), "# Tasks\n");
  return root;
}

test("validates a versioned ongoing task", async () => {
  const root = await createRepository();
  const lane = join(root, "tasks", "ongoing", "fixture-identity");
  const task = join(lane, "fixture-task");
  await mkdir(task, { recursive: true });
  await writeFile(join(lane, ".gitkeep"), "");
  await writeFile(join(task, "Task.md"), TASK);
  await writeFile(join(task, "Progress.md"), PROGRESS);

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, true);
  assert.deepEqual(
    report.diagnostics.filter(({ level }) => level === "error"),
    [],
  );
});

test("preserves an unversioned archived task as legacy", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "archived", "legacy-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace("- [ ] Observable result.", "- [x] Observable result.").replace(
      "[Profile](/tasks/README.md)",
      "Profile.",
    ),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replace("## Publication milestones\n\n| Milestone | Evidence | Status |\n| --- | --- | --- |\n| Claim | origin/main commit abcdef0. | Published |\n| Implementation complete | Pending. | Pending |\n| Archive | Pending. | Pending |\n\n", "")
      .replaceAll("- [ ]", "- [x]")
      .replace(
        "| Delivery acceptance | Pending | Review the integrated fixture after implementation. |",
        "| Delivery acceptance | Approved | Fixture owner approved delivery on 2026-09-15. |",
      )
      .replace("In progress.\n", "Completed.\n")
      .replace("In progress.\n", "Completed.\n"),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, true);
  const legacy = report.diagnostics.find(({ code }) => code === "task.archive.legacy");
  assert.equal(legacy?.level, "info");
  assert.equal(report.capabilities.history, "full");
});

test("rejects completed archives with pending delivery approval", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "archived", "pending-delivery-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace("- [ ] Observable result.", "- [x] Observable result."),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replace("## Publication milestones\n\n| Milestone | Evidence | Status |\n| --- | --- | --- |\n| Claim | origin/main commit abcdef0. | Published |\n| Implementation complete | Pending. | Pending |\n| Archive | Pending. | Pending |\n\n", "")
      .replaceAll("- [ ]", "- [x]")
      .replace("In progress.\n", "Completed.\n")
      .replace("In progress.\n", "Completed.\n"),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(
      ({ code }) => code === "progress.human-approvals.incomplete",
    ),
  );
});

test("allows an abandoned legacy archive to retain unchecked acceptance", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "archived", "abandoned-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace("[Profile](/tasks/README.md)", "Profile."),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replace("## Publication milestones\n\n| Milestone | Evidence | Status |\n| --- | --- | --- |\n| Claim | origin/main commit abcdef0. | Published |\n| Implementation complete | Pending. | Pending |\n| Archive | Pending. | Pending |\n\n", "")
      .replace("In progress.\n", "Abandoned. No implementation was started.\n")
      .replace("In progress.\n", "Abandoned. No implementation was started.\n"),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, true);
  assert.ok(report.diagnostics.some(({ code }) => code === "task.archive.legacy"));
  assert.ok(!report.diagnostics.some(({ code }) => code === "task.acceptance.incomplete"));
});

test("requires a human review plan for active tasks", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "backlog", "unplanned-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace(`${HUMAN_REVIEW_PLAN}\n\n`, ""),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "task.human-review.missing"),
  );
});

test("rejects unresolved placeholders in a human review plan", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "backlog", "placeholder-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace(
      "| Interface | Not applicable: the fixture has no interface. | Not applicable | Not applicable. | Not applicable. |",
      "| Interface | Not applicable: the fixture has no interface. | `<Reviewer or role>` | Not applicable. | Not applicable. |",
    ),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(
      ({ code }) => code === "task.human-review.details-missing",
    ),
  );
});

test("rejects approval states that conflict with the task review plan", async () => {
  const root = await createRepository();
  const lane = join(root, "tasks", "ongoing", "fixture-identity");
  const task = join(lane, "conflicting-review-task");
  await mkdir(task, { recursive: true });
  await writeFile(join(lane, ".gitkeep"), "");
  await writeFile(join(task, "Task.md"), TASK);
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replace(
      "| Scope | Approved | Fixture owner approved the fixture scope on 2026-09-15. |",
      "| Scope | Not applicable | Scope approval was skipped. |",
    ),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(
      ({ code }) => code === "progress.human-approvals.plan-conflict",
    ),
  );
});

test("reports task artifacts, milestones, acceptance, and local link failures", async () => {
  const root = await createRepository();
  const lane = join(root, "tasks", "ongoing", "fixture-identity");
  const task = join(lane, "broken-task");
  await mkdir(task, { recursive: true });
  await writeFile(join(lane, ".gitkeep"), "");
  await writeFile(
    join(task, "Task.md"),
    TASK.replace("## Constraints\n", "").replace(
      "[Profile](/tasks/README.md)",
      "[Missing](missing.md)",
    ),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replace("| Claim | origin/main commit abcdef0. | Published |", ""),
  );
  await writeFile(
    join(task, "UserAcceptance.md"),
    "# User acceptance\n\n## Steps\n\n1. Do one thing.\n\n## Expected results\n\nNo list.\n",
  );

  const report = await checkRepository({ git: fullHistoryGit, root });
  const codes = report.diagnostics.map(({ code }) => code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("task.heading.missing"));
  assert.ok(codes.includes("progress.milestones.missing-row"));
  assert.ok(codes.includes("progress.milestones.claim-unpublished"));
  assert.ok(codes.includes("acceptance.heading.missing"));
  assert.ok(codes.includes("acceptance.steps.invalid"));
  assert.ok(codes.includes("acceptance.reporting.invalid"));
  assert.ok(codes.includes("acceptance.status.missing"));
  assert.ok(codes.includes("link.target.missing"));
});

test("accepts repository-root, task-local, encoded, and external URI references", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "backlog", "linked-task");
  await mkdir(task);
  await writeFile(join(task, "notes file.md"), "# Notes\n");
  await writeFile(
    join(task, "Task.md"),
    TASK.replace(
      "[Profile](/tasks/README.md)",
      "[Root](/tasks/README.md), [relative](../../../tasks/README.md), [task-local](./notes%20file.md), [web](https://example.com/tasks), [mail](mailto:owner@example.com), and [protocol-relative](//example.com/tasks).",
    ),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, true);
  assert.deepEqual(report.diagnostics, []);
});

test("rejects repository-root links within the current task directory", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "backlog", "root-linked-task");
  await mkdir(task);
  await writeFile(join(task, "notes.md"), "# Notes\n");
  await writeFile(
    join(task, "Task.md"),
    TASK.replace(
      "[Profile](/tasks/README.md)",
      "[Notes](/tasks/backlog/root-linked-task/notes.md)",
    ),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(
      ({ code }) => code === "link.task-local.root-relative",
    ),
  );
  assert.ok(!report.diagnostics.some(({ code }) => code === "link.target.missing"));
});

test("rejects machine paths, repository escapes, and invalid encoding", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "backlog", "unsafe-links");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace(
      "[Profile](/tasks/README.md)",
      "[drive](C:/private/file.md), [escape](../../../../outside.md), and [encoding](bad%ZZ.md).",
    ),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });
  const codes = report.diagnostics.map(({ code }) => code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("link.absolute-machine-path"));
  assert.ok(codes.includes("link.repository.escape"));
  assert.ok(codes.includes("link.encoding.invalid"));
});