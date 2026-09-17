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
  assert.deepEqual(report.scope, {
    includeAllIdentities: false,
    includeArchived: false,
    worktreeIdentity: "fixture-identity",
  });
  assert.equal(report.summary.tasks, 0);
});

test("checks the archived directory only when requested", async () => {
  const root = await createRepository(["backlog", "ongoing"]);

  const local = await checkRepository({ git: fullHistoryGit, root });
  const withArchived = await checkRepository({
    git: fullHistoryGit,
    includeArchived: true,
    root,
  });

  assert.equal(local.ok, true);
  assert.equal(withArchived.ok, false);
  assert.deepEqual(withArchived.diagnostics.filter(({ level }) => level === "error"), [
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

test("checks other identities only when requested and ignores claim duplication", async () => {
  const root = await createRepository(["backlog", "ongoing", "archived"]);
  await mkdir(join(root, "tasks", "backlog", "same-task"));
  await mkdir(join(root, "tasks", "ongoing", "Invalid Identity", "same-task"), {
    recursive: true,
  });

  const local = await checkRepository({ git: fullHistoryGit, root });
  const allIdentities = await checkRepository({
    git: fullHistoryGit,
    includeAllIdentities: true,
    root,
  });
  const localCodes = local.diagnostics.map(({ code }) => code);
  const allCodes = allIdentities.diagnostics.map(({ code }) => code);

  assert.equal(local.summary.tasks, 1);
  assert.ok(!localCodes.includes("identity.invalid-name"));
  assert.ok(!localCodes.includes("identity.marker.missing"));
  assert.equal(allIdentities.summary.tasks, 2);
  assert.ok(allCodes.includes("identity.invalid-name"));
  assert.ok(allCodes.includes("identity.marker.missing"));
  assert.ok(!allCodes.includes("task.duplicate-position"));
});

test("skips ongoing tasks when the worktree has no identity", async () => {
  const root = await createRepository(["backlog"]);
  const git = () => ({ ok: false, status: 1, stderr: "", stdout: "" });

  const report = await checkRepository({ git, root });

  assert.equal(report.ok, true);
  assert.equal(report.scope.worktreeIdentity, null);
  assert.equal(report.summary.tasks, 0);
  assert.deepEqual(report.diagnostics, []);
});

test("uses Git only to resolve the worktree identity", async () => {
  const root = await createRepository(["backlog", "ongoing", "archived"]);
  const calls = [];
  const git = (_repositoryRoot, args) => {
    calls.push(args);
    const command = args.join(" ");
    if (command === "config --worktree --get task-ledger.identity") {
      return { ok: true, stdout: "fixture-identity" };
    }
    if (command === "config --show-origin --show-scope --get task-ledger.identity") {
      return {
        ok: true,
        stdout: "worktree\tfile:.git/config.worktree\tfixture-identity",
      };
    }
    return { ok: false, status: 1, stderr: "", stdout: "" };
  };

  const report = await checkRepository({ git, root });

  assert.equal(report.ok, true);
  assert.ok(calls.length > 0);
  assert.ok(calls.every(([command]) => command === "config"));
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