import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

import { SCHEMA_URL } from "../src/config.js";
import { runCli } from "../src/cli.js";
import { runGit } from "../src/git.js";
import { createClaimProgress, transitionRepository } from "../src/transitions.js";

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
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function commitChanges(root, message) {
  git(root, "add", "--all");
  git(root, "commit", "-m", message);
}

const TASK = `# Move task

Created: 2026-09-16

## Goal

Move one task safely.

## Context

Transition fixture.

## Scope

- Move the task.

## Out of scope

- Publish the move.

## Acceptance criteria

- [ ] The task moves safely.

## Constraints

- Preserve references.

## Human review checkpoints

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | Fixture owner | Fixture scope. | Implementation. |
| Interface | Not applicable: no interface change. | Not applicable | Not applicable. | Not applicable. |
| Business and data model | Not applicable: no model change. | Not applicable | Not applicable. | Not applicable. |
| Architecture | Not applicable: no architecture change. | Not applicable | Not applicable. | Not applicable. |
| Delivery acceptance | Required | Fixture owner | Fixture result. | Archive. |

## References

- [Specification](../../../docs/spec.md#goal)
`;

async function createRepository() {
  const base = await mkdtemp(join(tmpdir(), "repoledger-transition-"));
  temporaryDirectories.push(base);
  const root = join(base, "work");
  await mkdir(root);
  await writeFile(
    join(root, "repoledger.json"),
    `${JSON.stringify({ $schema: SCHEMA_URL, tasksDirectory: "tasks" }, null, 2)}\n`,
  );
  for (const state of ["backlog", "ongoing", "archived"]) {
    const path = join(root, "tasks", state);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, ".gitkeep"), "");
  }
  const lane = join(root, "tasks", "ongoing", "fixture-identity");
  await mkdir(lane);
  await writeFile(join(lane, ".gitkeep"), "");
  const sourceLane = join(root, "tasks", "ongoing", "source-identity");
  await mkdir(sourceLane);
  await writeFile(join(sourceLane, ".gitkeep"), "");
  const task = join(root, "tasks", "backlog", "move-task");
  await mkdir(task);
  await writeFile(join(task, "Task.md"), TASK);
  await mkdir(join(root, "docs"));
  await writeFile(join(root, "docs", "spec.md"), "# Goal\n");
  await writeFile(
    join(root, "docs", "links.md"),
    "[Task](../tasks/backlog/move-task/Task.md)\n",
  );
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "repoledger test");
  git(root, "config", "user.email", "repoledger@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-m", "Initialize transition fixture");
  git(root, "config", "extensions.worktreeConfig", "true");
  git(root, "config", "--worktree", "task-ledger.identity", "fixture-identity");
  return root;
}

async function prepareOngoingTask(root, identity) {
  const source = join(root, "tasks", "backlog", "move-task");
  const destination = join(root, "tasks", "ongoing", identity, "move-task");
  await rename(source, destination);
  await writeFile(
    join(destination, "Task.md"),
    TASK.replace("../../../docs/spec.md", "../../../../docs/spec.md"),
  );
  await writeFile(
    join(root, "docs", "links.md"),
    `[Task](../tasks/ongoing/${identity}/move-task/Task.md)\n`,
  );
  const pending = await createClaimProgress(destination, "2026-09-16");
  const published = pending
    .replace("- [ ] Publish the claim", "- [x] Publish the claim")
    .replace(
      "| Claim | Pending publication of the task move. | Pending |",
      "| Claim | Task ownership published to origin/main. | Published |",
    )
    .replace("Claim publication remains pending.", "None.");
  await writeFile(join(destination, "Progress.md"), published);
  commitChanges(root, `Claim task under ${identity}`);
  return { path: destination };
}

test("previews and applies a claim without rewriting references by default", async () => {
  const root = await createRepository();
  const source = join(root, "tasks", "backlog", "move-task");
  const destination = join(
    root,
    "tasks",
    "ongoing",
    "fixture-identity",
    "move-task",
  );

  const preview = await transitionRepository({
    operation: "claim",
    root,
    taskName: "move-task",
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.applied, false);
  assert.equal(preview.operation, "claim");
  await access(source);

  const applied = await transitionRepository({
    apply: true,
    now: "2026-09-16",
    operation: "claim",
    root,
    taskName: "move-task",
  });

  assert.equal(applied.ok, true);
  assert.equal(applied.applied, true);
  assert.ok(
    applied.diagnostics.some(({ code }) => code === "reference.update-skipped"),
  );
  await assert.rejects(access(source));
  await access(join(destination, "Task.md"));
  const progress = await readFile(join(destination, "Progress.md"), "utf8");
  assert.match(progress, /\| Scope \| Pending \|/);
  assert.match(progress, /\| Interface \| Not applicable \| no interface change\. \|/);
  const taskText = await readFile(join(destination, "Task.md"), "utf8");
  assert.match(taskText, /\.\.\/\.\.\/\.\.\/docs\/spec\.md#goal/);
  const inbound = await readFile(join(root, "docs", "links.md"), "utf8");
  assert.match(inbound, /tasks\/backlog\/move-task\/Task\.md/);
});

test("applies a claim through the CLI with a complete JSON report", async () => {
  const root = await createRepository();
  const output = [];
  const errors = [];
  const io = {
    error: (...values) => errors.push(values.join(" ")),
    log: (...values) => output.push(values.join(" ")),
  };

  const exitCode = await runCli(
    [
      "task",
      "claim",
      "move-task",
      "--root",
      root,
      "--update-all-refs",
      "--apply",
      "--json",
    ],
    io,
  );
  const report = JSON.parse(output.join("\n"));

  assert.equal(exitCode, 0);
  assert.deepEqual(errors, []);
  assert.equal(report.command, "task");
  assert.equal(report.operation, "claim");
  assert.equal(report.mode, "apply");
  assert.equal(report.applied, true);
  assert.equal(report.currentIdentity, "fixture-identity");
  assert.equal(report.source, "tasks/backlog/move-task");
  assert.equal(
    report.destination,
    "tasks/ongoing/fixture-identity/move-task",
  );
  assert.ok(Array.isArray(report.preconditions));
  assert.ok(Array.isArray(report.referenceEdits));
  assert.deepEqual(report.blockers, []);
  assert.match(
    await readFile(join(root, "docs", "links.md"), "utf8"),
    /tasks\/ongoing\/fixture-identity\/move-task\/Task\.md/,
  );
});

test("takes over only from the explicitly named source identity", async () => {
  const root = await createRepository();
  const { path: source } = await prepareOngoingTask(root, "source-identity");
  const destination = join(
    root,
    "tasks",
    "ongoing",
    "fixture-identity",
    "move-task",
  );

  const invalidIdentity = await transitionRepository({
    operation: "claim",
    root,
    takeFrom: "Invalid Identity",
    taskName: "move-task",
  });
  assert.equal(invalidIdentity.ok, false);
  assert.ok(
    invalidIdentity.diagnostics.some(
      ({ code }) => code === "transition.takeover.invalid-identity",
    ),
  );
  await access(source);

  const mismatch = await transitionRepository({
    operation: "claim",
    root,
    takeFrom: "other-identity",
    taskName: "move-task",
  });

  assert.equal(mismatch.ok, false);
  assert.ok(
    mismatch.diagnostics.some(
      ({ code }) => code === "transition.takeover.source-mismatch",
    ),
  );
  await access(source);

  const preview = await transitionRepository({
    operation: "claim",
    root,
    takeFrom: "source-identity",
    taskName: "move-task",
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.applied, false);
  assert.equal(preview.operation, "takeover");
  await access(source);

  const applied = await transitionRepository({
    apply: true,
    operation: "claim",
    root,
    takeFrom: "source-identity",
    taskName: "move-task",
  });

  assert.equal(applied.ok, true);
  assert.equal(applied.operation, "takeover");
  assert.equal(applied.sourceIdentity, "source-identity");
  assert.equal(applied.destinationIdentity, "fixture-identity");
  await assert.rejects(access(source));
  await access(join(destination, "Progress.md"));
  const inbound = await readFile(join(root, "docs", "links.md"), "utf8");
  assert.match(inbound, /tasks\/ongoing\/source-identity\/move-task\/Task\.md/);
});

test("archives a completed current task after prospective content validation", async () => {
  const root = await createRepository();
  const { path: source } = await prepareOngoingTask(root, "fixture-identity");
  const destination = join(root, "tasks", "archived", "move-task");
  const taskText = (await readFile(join(source, "Task.md"), "utf8"))
    .replace("- [ ] The task moves safely.", "- [x] The task moves safely.");
  await writeFile(join(source, "Task.md"), taskText);
  await writeFile(join(root, "implementation.txt"), "implemented\n");
  const progressPath = join(source, "Progress.md");
  const implemented = (await readFile(progressPath, "utf8"))
    .replace("- [ ] Publish implementation completion", "- [x] Publish implementation completion")
    .replace(
      "| Scope | Pending | Review Fixture scope. with Fixture owner. |",
      "| Scope | Approved | Fixture owner approved scope on 2026-09-16. |",
    )
    .replace(
      "| Implementation complete | Pending. | Pending |",
      "| Implementation complete | Validated implementation published to origin/main. | Published |",
    );
  await writeFile(progressPath, implemented);
  commitChanges(root, "Implement move task");

  const accepted = implemented
    .replaceAll("- [ ]", "- [x]")
    .replace(
      "- [x] Archive and publish the task as its final action.",
      "- [ ] Archive and publish the task as its final action.",
    )
    .replace(
      "| Delivery acceptance | Pending | Review Fixture result. with Fixture owner. |",
      "| Delivery acceptance | Approved | Fixture owner approved delivery on 2026-09-16. |",
    )
    .replace("## Outcome\n\nPending.", "## Outcome\n\nCompleted. Fixture work is accepted.");
  await writeFile(progressPath, accepted);
  commitChanges(root, "Prepare task archive");

  const preview = await transitionRepository({
    operation: "archive",
    root,
    taskName: "move-task",
    updateAllReferences: true,
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.applied, false);
  await access(source);

  const applied = await transitionRepository({
    apply: true,
    operation: "archive",
    root,
    taskName: "move-task",
    updateAllReferences: true,
  });

  assert.equal(applied.ok, true);
  assert.equal(applied.operation, "archive");
  await assert.rejects(access(source));
  await access(join(destination, "Progress.md"));
  const archivedTask = await readFile(join(destination, "Task.md"), "utf8");
  assert.match(archivedTask, /\.\.\/\.\.\/\.\.\/docs\/spec\.md#goal/);
});

test("moves a claim while leaving affected references unchanged by default", async () => {
  const root = await createRepository();
  const source = join(root, "tasks", "backlog", "move-task");
  const destination = join(
    root,
    "tasks",
    "ongoing",
    "fixture-identity",
    "move-task",
  );
  const archived = join(root, "tasks", "archived", "historical-task");
  await mkdir(archived);
  const archivedProgress = "[Old task](../../backlog/move-task/Task.md#goal)\n";
  await writeFile(join(archived, "Progress.md"), archivedProgress);
  commitChanges(root, "Add archived inbound reference");

  const report = await transitionRepository({
    apply: true,
    operation: "claim",
    root,
    taskName: "move-task",
  });

  assert.equal(report.ok, true);
  assert.equal(report.applied, true);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "reference.update-skipped"),
  );
  await assert.rejects(access(source));
  await access(destination);
  assert.equal(await readFile(join(archived, "Progress.md"), "utf8"), archivedProgress);
});

test("applies a claim and archived inbound rewrite when explicitly allowed", async () => {
  const root = await createRepository();
  const source = join(root, "tasks", "backlog", "move-task");
  const destination = join(
    root,
    "tasks",
    "ongoing",
    "fixture-identity",
    "move-task",
  );
  const archived = join(root, "tasks", "archived", "historical-task");
  await mkdir(archived);
  await writeFile(
    join(archived, "Progress.md"),
    "[Old task](../../backlog/move-task/Task.md#goal)\n",
  );
  commitChanges(root, "Add archived inbound reference");

  const preview = await transitionRepository({
    operation: "claim",
    root,
    taskName: "move-task",
    updateAllReferences: true,
  });

  assert.equal(preview.ok, true);
  assert.match(preview.nextActions[0], /--update-all-refs --apply/);

  const report = await transitionRepository({
    apply: true,
    now: "2026-09-16",
    operation: "claim",
    root,
    taskName: "move-task",
    updateAllReferences: true,
  });

  assert.equal(report.ok, true);
  assert.equal(report.applied, true);
  await assert.rejects(access(source));
  await access(destination);
  assert.match(
    await readFile(join(archived, "Progress.md"), "utf8"),
    /\.\.\/\.\.\/ongoing\/fixture-identity\/move-task\/Task\.md#goal/,
  );
});

test("applies a claim with a global identity and no worktree config", async () => {
  const root = await createRepository();
  const source = join(root, "tasks", "backlog", "move-task");
  const destination = join(
    root,
    "tasks",
    "ongoing",
    "fixture-identity",
    "move-task",
  );
  const calls = [];
  const configOnlyGit = (repositoryRoot, args) => {
    calls.push(args);
    assert.equal(args[0], "config");
    const command = args.join(" ");
    if (command === "config --get task-ledger.identity") {
      return { ok: true, stdout: "fixture-identity" };
    }
    if (command === "config --show-origin --show-scope --get task-ledger.identity") {
      return {
        ok: true,
        stdout: "global\tfile:C:/Users/example/.gitconfig\tfixture-identity",
      };
    }
    return runGit(repositoryRoot, args);
  };

  const report = await transitionRepository({
    apply: true,
    git: configOnlyGit,
    operation: "claim",
    root,
    taskName: "move-task",
  });

  assert.equal(report.ok, true);
  assert.equal(report.applied, true);
  assert.ok(calls.length > 0);
  assert.ok(calls.every(([command]) => command === "config"));
  assert.ok(
    !report.diagnostics.some(({ code }) => code.includes("worktree-config")),
  );
  await assert.rejects(access(source));
  await access(destination);
});

test("recovers an earlier committed journal before routing a new apply", async () => {
  const root = await createRepository();
  const source = join(root, "tasks", "backlog", "move-task");
  const journal = resolve(root, "tasks", ".repoledger-transaction.json");
  await writeFile(
    journal,
    `${JSON.stringify({
      version: 1,
      id: "previous",
      root,
      taskRoot: join(root, "tasks"),
      source,
      destination: join(
        root,
        "tasks",
        "ongoing",
        "fixture-identity",
        "previous-task",
      ),
      state: "committed",
      moved: true,
      items: [],
    }, null, 2)}\n`,
  );

  const report = await transitionRepository({
    apply: true,
    operation: "claim",
    root,
    taskName: "move-task",
  });

  assert.equal(report.ok, false);
  assert.equal(report.applied, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "transition.recovery.performed"),
  );
  await assert.rejects(access(journal));
  await access(source);
});

test("archives an abandoned current task without implementation publication", async () => {
  const root = await createRepository();
  const { path: source } = await prepareOngoingTask(root, "fixture-identity");
  const destination = join(root, "tasks", "archived", "move-task");
  const progressPath = join(source, "Progress.md");
  const progress = (await readFile(progressPath, "utf8"))
    .replace(
      "## Outcome\n\nPending.",
      "## Outcome\n\nAbandoned. The fixture was intentionally stopped.",
    )
    .replace(
      "Claim publication remains pending.",
      "None. The abandonment reason is recorded.",
    );
  await writeFile(progressPath, progress);
  commitChanges(root, "Record task abandonment");

  const applied = await transitionRepository({
    apply: true,
    operation: "archive",
    root,
    taskName: "move-task",
  });

  assert.equal(applied.ok, true);
  assert.equal(applied.applied, true);
  assert.ok(
    applied.diagnostics.some(({ code }) => code === "reference.update-skipped"),
  );
  await assert.rejects(access(source));
  const archivedProgress = await readFile(join(destination, "Progress.md"), "utf8");
  assert.match(archivedProgress, /Abandoned\. The fixture was intentionally stopped\./);
  const archivedTask = await readFile(join(destination, "Task.md"), "utf8");
  assert.match(archivedTask, /\.\.\/\.\.\/\.\.\/\.\.\/docs\/spec\.md#goal/);
});

test("escapes table delimiters in generated claim progress", async () => {
  const root = await createRepository();
  const taskPath = join(root, "tasks", "backlog", "move-task");
  const taskText = (await readFile(join(taskPath, "Task.md"), "utf8"))
    .replace("Fixture owner", "Fixture \\| owner")
    .replace("Fixture scope.", "Fixture \\| scope.");
  await writeFile(join(taskPath, "Task.md"), taskText);

  const progress = await createClaimProgress(taskPath, "2026-09-16");

  assert.match(progress, /Fixture \\\| owner/);
  assert.match(progress, /Fixture \\\| scope\./);
});