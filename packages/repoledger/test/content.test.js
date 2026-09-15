import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { checkRepository } from "../src/index.js";
import { fullHistoryGit, projectConfig } from "../test-support/support.js";

const temporaryDirectories = [];
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

## References

- [Profile](/tasks/README.md)
`;
const PROGRESS = `# Progress

Updated: 2026-09-15

## Checklist

- [x] Publish the claim to the shared primary branch.
- [ ] Publish implementation completion while the task is still ongoing.
- [ ] Archive and publish the task as its final action.

## Current state

In progress.

## Decisions

- None.

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
      .replace("In progress.\n", "Completed.\n")
      .replace("In progress.\n", "Completed.\n"),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, true);
  const legacy = report.diagnostics.find(({ code }) => code === "task.archive.legacy");
  assert.equal(legacy?.level, "info");
  assert.equal(report.capabilities.history, "full");
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

test("accepts repository-root, relative, encoded, and external URI references", async () => {
  const root = await createRepository();
  const task = join(root, "tasks", "backlog", "linked-task");
  await mkdir(task);
  await writeFile(join(task, "notes file.md"), "# Notes\n");
  await writeFile(
    join(task, "Task.md"),
    TASK.replace(
      "[Profile](/tasks/README.md)",
      "[Root](/tasks/README.md), [relative](../../../tasks/README.md), [encoded](notes%20file.md), [web](https://example.com/tasks), [mail](mailto:owner@example.com), and [protocol-relative](//example.com/tasks).",
    ),
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, true);
  assert.deepEqual(report.diagnostics, []);
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