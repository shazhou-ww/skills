import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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
  assert.ok(
    report.diagnostics.some(
      ({ code, level }) =>
        code === "progress.human-approvals.pending" && level === "warning",
    ),
  );
});

test("preserves an unversioned archived task as legacy", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "archived", "legacy-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace("- [ ] Observable result.", "- [x] Observable result.")
      .replace("[Profile](/tasks/README.md)", "Profile.")
      .replace(`${HUMAN_REVIEW_PLAN}\n\n`, ""),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replaceAll("- [ ]", "- [x]")
      .replace(
        "| Delivery acceptance | Pending | Review the integrated fixture after implementation. |",
        "| Delivery acceptance | Approved | Fixture owner approved delivery on 2026-09-15. |",
      )
      .replace("In progress.\n", "Completed.\n")
      .replace("In progress.\n", "Completed.\n"),
  );

  const report = await checkRepository({
    git: fullHistoryGit,
    includeArchived: true,
    root,
  });

  assert.equal(report.ok, true);
  const legacy = report.diagnostics.find(({ code }) => code === "task.archive.legacy");
  assert.equal(legacy?.level, "info");
});

test("warns for completed archives with pending delivery approval", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "archived", "pending-delivery-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace("- [ ] Observable result.", "- [x] Observable result."),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replaceAll("- [ ]", "- [x]")
      .replace("In progress.\n", "Completed.\n")
      .replace("In progress.\n", "Completed.\n"),
  );

  const report = await checkRepository({
    git: fullHistoryGit,
    includeArchived: true,
    root,
  });

  assert.equal(report.ok, true);
  const approval = report.diagnostics.find(
    ({ code }) => code === "progress.human-approvals.incomplete",
  );
  assert.equal(approval?.level, "warning");
});

test("allows an abandoned legacy archive to retain unchecked acceptance", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "archived", "abandoned-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace("[Profile](/tasks/README.md)", "Profile.").replace(
      `${HUMAN_REVIEW_PLAN}\n\n`,
      "",
    ),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replace("In progress.\n", "Abandoned. No implementation was started.\n")
      .replace("In progress.\n", "Abandoned. No implementation was started.\n"),
  );

  const report = await checkRepository({
    git: fullHistoryGit,
    includeArchived: true,
    root,
  });

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

test("reports task artifacts, acceptance, and local link failures", async () => {
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
  await writeFile(join(task, "Progress.md"), PROGRESS);
  await writeFile(
    join(task, "UserAcceptance.md"),
    "# User acceptance\n\n## Steps\n\n1. Do one thing.\n\n## Expected results\n\nNo list.\n",
  );

  const report = await checkRepository({ git: fullHistoryGit, root });
  const codes = report.diagnostics.map(({ code }) => code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("task.heading.missing"));
  assert.ok(codes.includes("acceptance.heading.missing"));
  assert.ok(codes.includes("acceptance.steps.invalid"));
  assert.ok(codes.includes("acceptance.status.missing"));
  assert.ok(codes.includes("link.target.missing"));
});

test("parses outcome and acceptance facts without phrase matching", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "archived", "accepted-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace("- [ ] Observable result.", "- [x] Observable result."),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replaceAll("- [ ]", "- [x]")
      .replace(
        "| Delivery acceptance | Pending | Review the integrated fixture after implementation. |",
        "| Delivery acceptance | Approved | Fixture owner approved delivery on 2026-09-17. |",
      )
      .replace(
        "| Implementation complete | Pending. | Pending |",
        "| Implementation complete | Published implementation. | Published |",
      )
      .replace("| Archive | Pending. | Pending |", "| Archive | Published archive. | Published |")
      .replace("## Outcome\n\nIn progress.", "## Outcome\n\nCompleted all checks passed"),
  );
  const acceptance = `# User acceptance

## Purpose

Validate the fixture.

## Test target

- Published fixture.

## Preconditions

- Fixture is available.

## Steps

1. Open the fixture.

## Expected results

1. The fixture opens.

## Report outcome

Report success or identify the first failing step and observed result.

## Status

Accepted — verified by the user.
`;
  await writeFile(join(task, "UserAcceptance.md"), acceptance);

  const accepted = await checkRepository({
    git: fullHistoryGit,
    includeArchived: true,
    root,
  });
  assert.equal(accepted.ok, true);

  await writeFile(
    join(task, "UserAcceptance.md"),
    acceptance.replace("Accepted — verified by the user.", "Not Accepted"),
  );
  const rejected = await checkRepository({
    git: fullHistoryGit,
    includeArchived: true,
    root,
  });
  assert.ok(
    rejected.diagnostics.some(({ code }) => code === "acceptance.status.invalid"),
  );
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

test("rejects a local link that escapes through a symbolic directory", async () => {
  const root = await createRepository();
  const external = await mkdtemp(join(tmpdir(), "repoledger-external-link-"));
  temporaryDirectories.push(external);
  await writeFile(join(external, "target.md"), "# External\n");
  await symlink(
    external,
    join(root, "external-link"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const task = join(root, "tasks", "backlog", "symlink-link-task");
  await mkdir(task);
  await writeFile(
    join(task, "Task.md"),
    TASK.replace(
      "[Profile](/tasks/README.md)",
      "[External](/external-link/target.md)",
    ),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "link.target.symlink-escape"),
  );
});

test("parses canonical review facts separately from annotations", async () => {
  const root = await createRepository();
  const lane = join(root, "tasks", "ongoing", "fixture-identity");
  const task = join(lane, "annotated-task");
  await mkdir(task, { recursive: true });
  await writeFile(join(lane, ".gitkeep"), "");
  await writeFile(
    join(task, "Task.md"),
    TASK.replaceAll("Fixture owner", "Fixture owner <owner@example.com>")
      .replaceAll("Not applicable: the fixture", "Not applicable — the fixture"),
  );
  await writeFile(
    join(task, "Progress.md"),
    PROGRESS.replace("| Scope | Approved |", "| Scope | Approved — scope signed |")
      .replace(
        "| Delivery acceptance | Pending |",
        "| Delivery acceptance | Pending — artifact ready |",
      ),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, true);
  assert.deepEqual(
    report.diagnostics.filter(({ level }) => level === "error"),
    [],
  );
});

test("rejects unknown and ambiguous annotated approval facts", async () => {
  const root = await createRepository();
  const lane = join(root, "tasks", "ongoing", "fixture-identity");
  await mkdir(lane, { recursive: true });
  await writeFile(join(lane, ".gitkeep"), "");

  for (const [name, status] of [
    ["unknown", "Done"],
    ["ambiguous", "Pending — now Approved"],
    ["invalid-separator", "Pending / artifact ready"],
  ]) {
    const task = join(lane, `${name}-task`);
    await mkdir(task);
    await writeFile(join(task, "Task.md"), TASK);
    await writeFile(
      join(task, "Progress.md"),
      PROGRESS.replace("| Delivery acceptance | Pending |", `| Delivery acceptance | ${status} |`),
    );
  }

  const report = await checkRepository({ git: fullHistoryGit, root });
  const invalid = report.diagnostics.filter(
    ({ code }) => code === "progress.human-approvals.status-invalid",
  );

  assert.equal(invalid.length, 3);
});