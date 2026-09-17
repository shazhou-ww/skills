import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { statusRepository } from "../src/status.js";
import { projectConfig } from "../test-support/support.js";

const temporaryDirectories = [];

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
  await writeFile(join(root, "repoledger.json"), JSON.stringify(projectConfig()));
  await mkdir(join(root, "tasks", "backlog", "zeta-task"), { recursive: true });
  await mkdir(join(root, "tasks", "ongoing", "fixture-identity", "alpha-task"), {
    recursive: true,
  });
  await writeFile(join(root, "tasks", "ongoing", "fixture-identity", ".gitkeep"), "");
  await mkdir(join(root, "tasks", "archived", "old-task"), { recursive: true });
  return root;
}

test("lists active task positions and the local identity without fetching", async () => {
  const root = await createRepository();
  const calls = [];
  const git = (_repositoryRoot, args) => {
    calls.push(args);
    if (args.join(" ") === "config --get task-ledger.identity") {
      return { ok: true, stdout: "fixture-identity" };
    }
    if (args.join(" ") === "config --show-origin --show-scope --get task-ledger.identity") {
      return {
        ok: true,
        stdout: "worktree\tfile:.git/config.worktree\tfixture-identity",
      };
    }
    return { ok: false, status: 1, stderr: "", stdout: "" };
  };

  const report = await statusRepository({ git, root });

  assert.equal(report.ok, true);
  assert.deepEqual(report.identity, {
    scope: "worktree",
    value: "fixture-identity",
  });
  assert.deepEqual(
    report.tasks.map(({ name, state, identity }) => ({ name, state, identity })),
    [
      { name: "zeta-task", state: "backlog", identity: null },
      { name: "alpha-task", state: "ongoing", identity: "fixture-identity" },
    ],
  );
  assert.equal(report.summary.tasks, 2);
  assert.equal(report.summary.totalTasks, 3);
  assert.ok(!calls.some(([command]) => command === "fetch"));
});

test("optionally includes archived tasks and tolerates an unbound identity", async () => {
  const root = await createRepository();
  const git = () => ({ ok: false, status: 1, stderr: "", stdout: "" });

  const report = await statusRepository({ git, includeArchived: true, root });

  assert.equal(report.ok, true);
  assert.deepEqual(report.identity, { scope: null, value: null });
  assert.deepEqual(report.tasks.map(({ name }) => name), [
    "zeta-task",
    "alpha-task",
    "old-task",
  ]);
});

test("reports a global identity as authoritative", async () => {
  const root = await createRepository();
  const git = (_repositoryRoot, args) => {
    if (args.join(" ") === "config --get task-ledger.identity") {
      return { ok: true, stdout: "inherited-identity" };
    }
    if (args.join(" ") === "config --show-origin --show-scope --get task-ledger.identity") {
      return {
        ok: true,
        stdout: "global\tfile:C:/Users/example/.gitconfig\tinherited-identity",
      };
    }
    return { ok: false, status: 1, stderr: "", stdout: "" };
  };

  const report = await statusRepository({ git, root });

  assert.equal(report.ok, true);
  assert.deepEqual(report.identity, {
    scope: "global",
    value: "inherited-identity",
  });
});