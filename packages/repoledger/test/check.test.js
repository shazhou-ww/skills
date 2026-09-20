import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { checkRepository } from "../src/index.js";
import { serializeStatusFile } from "../src/ledger.js";

const temporaryDirectories = [];

const config = `version: 2
tasksDirectory: tasks
primaryRepository: https://example.com/owner/repository.git
primaryBranch: main
`;

function record(state, createdAt = "2026-09-18T08:30:00Z") {
  return { state, createdAt, updatedAt: createdAt };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createRepository(tasks = {}) {
  const root = await mkdtemp(join(tmpdir(), "repoledger-check-"));
  temporaryDirectories.push(root);
  await writeFile(join(root, "repoledger.yaml"), config);
  await mkdir(join(root, "tasks"));
  await writeFile(
    join(root, "tasks", "status.yaml"),
    serializeStatusFile({ version: 2, tasks }),
  );
  for (const name of Object.keys(tasks)) {
    await mkdir(join(root, "tasks", name));
  }
  return root;
}

test("accepts an empty stable task ledger", async () => {
  const root = await createRepository();

  const report = await checkRepository({ root });

  assert.equal(report.ok, true);
  assert.equal(report.command, "check");
  assert.equal(report.result.checked, 0);
  assert.deepEqual(report.diagnostics, []);
});

test("requires one directory for every record and one record for every directory", async () => {
  const root = await createRepository({ "missing-directory": record("backlog") });
  await rm(join(root, "tasks", "missing-directory"), { recursive: true });
  await mkdir(join(root, "tasks", "missing-record"));

  const report = await checkRepository({ root });
  const codes = report.diagnostics.map(({ code }) => code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("task.directory.missing"));
  assert.ok(codes.includes("task.record.missing"));
});

test("rejects duplicate source refs and primary as a source branch", async () => {
  const root = await createRepository({
    "alpha-task": {
      ...record("ongoing"),
      sourceBranch: "task/shared",
    },
    "beta-task": {
      ...record("ongoing"),
      sourceBranch: "task/shared",
    },
    "primary-task": {
      ...record("ongoing"),
      sourceBranch: "main",
    },
  });

  const report = await checkRepository({ root });
  const codes = report.diagnostics.map(({ code }) => code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("task.source.duplicate"));
  assert.ok(codes.includes("task.source.primary-branch"));
});

test("focuses content checks while retaining repository structure checks", async () => {
  const root = await createRepository({
    "alpha-task": record("backlog"),
    "beta-task": record("backlog"),
  });

  const report = await checkRepository({ root, taskName: "alpha-task" });

  assert.equal(report.ok, false);
  assert.equal(report.result.checked, 1);
  assert.equal(report.result.total, 2);
  assert.ok(report.diagnostics.some(({ path }) => path.includes("alpha-task")));
  assert.ok(!report.diagnostics.some(({ path }) => path.includes("beta-task")));
});

test("reports a missing focused task", async () => {
  const root = await createRepository();

  const report = await checkRepository({ root, taskName: "missing-task" });

  assert.equal(report.ok, false);
  assert.equal(report.diagnostics[0].code, "task.selection.missing");
});

test("rejects a symbolic-link task root", async () => {
  const root = await mkdtemp(join(tmpdir(), "repoledger-symlink-root-"));
  temporaryDirectories.push(root);
  const externalTasks = join(root, "external-tasks");
  await writeFile(join(root, "repoledger.yaml"), config);
  await mkdir(externalTasks);
  await writeFile(
    join(externalTasks, "status.yaml"),
    serializeStatusFile({ version: 2, tasks: {} }),
  );
  await symlink(
    externalTasks,
    join(root, "tasks"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const report = await checkRepository({ root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "config.invalid-tasks-directory"),
  );
});
