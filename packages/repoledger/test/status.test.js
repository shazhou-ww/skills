import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { serializeStatusFile } from "../src/ledger.js";
import { listTasks, statusRepository } from "../src/status.js";

const temporaryDirectories = [];

const tasks = {
  "alpha-task": {
    state: "ongoing",
    createdAt: "2026-09-17T08:00:00Z",
    updatedAt: "2026-09-19T10:00:00Z",
  },
  "beta-task": {
    state: "backlog",
    createdAt: "2026-09-19T09:00:00Z",
    updatedAt: "2026-09-19T09:00:00Z",
  },
  "done-task": {
    state: "completed",
    createdAt: "2026-09-15T08:00:00Z",
    updatedAt: "2026-09-18T18:00:00Z",
  },
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createRepository() {
  const root = await mkdtemp(join(tmpdir(), "repoledger-status-"));
  temporaryDirectories.push(root);
  await writeFile(
    join(root, "repoledger.yaml"),
    "version: 1\ntasksDirectory: tasks\nremote: origin\nprimaryBranch: main\n",
  );
  await mkdir(join(root, "tasks"));
  await writeFile(
    join(root, "tasks", "status.yaml"),
    serializeStatusFile({ version: 1, tasks }),
  );
  for (const name of Object.keys(tasks)) await mkdir(join(root, "tasks", name));
  return root;
}

test("returns one local task status", async () => {
  const root = await createRepository();

  const report = await statusRepository({ local: true, root, taskName: "alpha-task" });

  assert.equal(report.ok, true);
  assert.equal(report.command, "status");
  assert.deepEqual(report.result, {
    source: "local",
    task: "alpha-task",
    ...tasks["alpha-task"],
  });
});

test("filters list state and half-open update interval before sorting and limiting", async () => {
  const root = await createRepository();

  const report = await listTasks({
    filters: {
      states: ["backlog", "ongoing"],
      updatedSince: "2026-09-19T00:00:00Z",
      updatedBefore: "2026-09-20T00:00:00Z",
    },
    limit: 1,
    local: true,
    root,
    sort: "updated",
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.result.filters, {
    states: ["backlog", "ongoing"],
    updatedSince: "2026-09-19T00:00:00Z",
    updatedBefore: "2026-09-20T00:00:00Z",
  });
  assert.deepEqual(report.result.tasks, [
    { task: "alpha-task", ...tasks["alpha-task"] },
  ]);
});

test("applies exclusive before bounds", async () => {
  const root = await createRepository();

  const report = await listTasks({
    filters: { updatedBefore: "2026-09-19T09:00:00Z" },
    local: true,
    root,
  });

  assert.deepEqual(report.result.tasks.map(({ task }) => task), ["done-task"]);
});

test("rejects invalid and reversed filter intervals", async () => {
  const root = await createRepository();

  const report = await listTasks({
    filters: {
      createdSince: "2026-09-20T00:00:00Z",
      createdBefore: "2026-09-19T00:00:00Z",
    },
    local: true,
    root,
  });

  assert.equal(report.ok, false);
  assert.equal(report.diagnostics[0].code, "task.list.invalid-created-range");
});
