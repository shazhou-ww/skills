import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { checkRepository } from "../src/index.js";
import { fullHistoryGit, projectConfig } from "../test-support/support.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createRepository(statuses, config = {}) {
  const root = await mkdtemp(join(tmpdir(), "repoledger-"));
  temporaryDirectories.push(root);
  await writeFile(
    join(root, "repoledger.json"),
    JSON.stringify(projectConfig(config)),
  );
  for (const status of statuses) {
    await mkdir(join(root, "tasks", status), { recursive: true });
  }
  return root;
}

test("accepts all canonical status directories", async () => {
  const root = await createRepository(["backlog", "ongoing", "archived"]);

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, true);
  assert.deepEqual(
    report.diagnostics.filter(({ level }) => level === "error"),
    [],
  );
  assert.equal(report.capabilities.history, "full");
  assert.equal(report.summary.tasks, 0);
});

test("reports a missing canonical status directory", async () => {
  const root = await createRepository(["backlog", "ongoing"]);

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.deepEqual(report.diagnostics.filter(({ level }) => level === "error"), [
    {
      code: "layout.status.missing",
      level: "error",
      path: "tasks/archived",
      message: "Missing canonical task status directory: tasks/archived",
      remediation: "Create tasks/archived before using the task ledger.",
    },
  ]);
});

test("requires a versioned project configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "repoledger-"));
  temporaryDirectories.push(root);

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.equal(report.diagnostics[0].code, "config.missing");
});

test("reports invalid identities and duplicate task positions", async () => {
  const root = await createRepository(["backlog", "ongoing", "archived"]);
  await mkdir(join(root, "tasks", "backlog", "same-task"));
  await mkdir(join(root, "tasks", "ongoing", "Invalid Identity", "same-task"), {
    recursive: true,
  });

  const report = await checkRepository({ root });
  const codes = report.diagnostics.map(({ code }) => code);

  assert.equal(report.ok, false);
  for (const code of [
    "identity.invalid-name",
    "identity.marker.missing",
    "task.duplicate-position",
  ]) {
    assert.ok(codes.includes(code));
  }
});

test("rejects a symbolic-link task root", async () => {
  const root = await mkdtemp(join(tmpdir(), "repoledger-symlink-root-"));
  temporaryDirectories.push(root);
  const externalTasks = join(root, "external-tasks");
  await writeFile(join(root, "repoledger.json"), JSON.stringify(projectConfig()));
  for (const state of ["backlog", "ongoing", "archived"]) {
    await mkdir(join(externalTasks, state), { recursive: true });
  }
  await symlink(
    externalTasks,
    join(root, "tasks"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const report = await checkRepository({ git: fullHistoryGit, root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "layout.tasks.not-directory"),
  );
});

test("focuses task content checks while retaining repository layout checks", async () => {
  const root = await createRepository(["backlog", "ongoing", "archived"]);
  await mkdir(join(root, "tasks", "backlog", "alpha-task"));
  await mkdir(join(root, "tasks", "backlog", "beta-task"));

  const report = await checkRepository({
    git: fullHistoryGit,
    root,
    taskName: "alpha-task",
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.selection, {
    checked: 1,
    matches: 1,
    name: "alpha-task",
  });
  assert.equal(report.summary.tasks, 1);
  assert.equal(report.summary.totalTasks, 2);
  assert.ok(report.diagnostics.some(({ path }) => path.includes("alpha-task")));
  assert.ok(!report.diagnostics.some(({ path }) => path.includes("beta-task")));
});

test("reports missing and ambiguous focused task selections", async () => {
  const root = await createRepository(["backlog", "ongoing", "archived"]);
  await mkdir(join(root, "tasks", "backlog", "same-task"));
  const lane = join(root, "tasks", "ongoing", "fixture-identity");
  await mkdir(join(lane, "same-task"), { recursive: true });
  await writeFile(join(lane, ".gitkeep"), "");

  const missing = await checkRepository({
    git: fullHistoryGit,
    root,
    taskName: "missing-task",
  });
  const ambiguous = await checkRepository({
    git: fullHistoryGit,
    root,
    taskName: "same-task",
  });

  assert.ok(
    missing.diagnostics.some(({ code }) => code === "task.selection.missing"),
  );
  assert.deepEqual(missing.selection, {
    checked: 0,
    matches: 0,
    name: "missing-task",
  });
  assert.ok(
    ambiguous.diagnostics.some(
      ({ code }) => code === "task.selection.ambiguous",
    ),
  );
  assert.equal(ambiguous.selection.matches, 2);
  assert.equal(ambiguous.summary.tasks, 0);
});