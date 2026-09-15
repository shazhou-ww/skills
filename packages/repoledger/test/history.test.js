import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { inspectHistory } from "../src/history.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createTask() {
  const root = await mkdtemp(join(tmpdir(), "repoledger-history-"));
  temporaryDirectories.push(root);
  const taskPath = join(root, "tasks", "ongoing", "fixture", "history-task");
  await mkdir(taskPath, { recursive: true });
  await writeFile(join(taskPath, "Task.md"), "# History task\n");
  await writeFile(
    join(taskPath, "Progress.md"),
    `## Publication milestones

| Milestone | Evidence | Status |
| --- | --- | --- |
| Claim | origin/main commit abcdef0. | Published |
| Implementation complete | Pending. | Pending |
| Archive | Pending. | Pending |
`,
  );
  return {
    root,
    task: {
      identity: "fixture",
      name: "history-task",
      path: taskPath,
      relativePath: "tasks/ongoing/fixture/history-task",
      state: "ongoing",
    },
  };
}

async function createArchivedTask({ duplicateImplementation = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "repoledger-history-archive-"));
  temporaryDirectories.push(root);
  const taskPath = join(root, "tasks", "archived", "history-task");
  await mkdir(taskPath, { recursive: true });
  await writeFile(join(taskPath, "Task.md"), "# History task\n");
  const claim = "a".repeat(40);
  const implementation = duplicateImplementation ? claim : "b".repeat(40);
  await writeFile(
    join(taskPath, "Progress.md"),
    `## Publication milestones

| Milestone | Evidence | Status |
| --- | --- | --- |
| Claim | origin/main commit ${claim}. | Published |
| Implementation complete | origin/main commit ${implementation}. | Published |
| Archive | origin/main archive commit. | Published |
`,
  );
  return {
    root,
    task: {
      name: "history-task",
      path: taskPath,
      relativePath: "tasks/archived/history-task",
      state: "archived",
    },
  };
}

const config = {
  branch: "main",
  remote: "origin",
  tasksDirectory: "tasks",
};

test("reports unavailable history as an error", async () => {
  const { root, task } = await createTask();
  const git = () => ({ ok: false, status: 128, stderr: "not a repository", stdout: "" });

  const result = await inspectHistory({ config, git, root, tasks: [task] });

  assert.equal(result.capability, "unavailable");
  assert.equal(result.diagnostics[0].code, "history.unavailable");
  assert.equal(result.diagnostics[0].level, "error");
});

test("validates published evidence against a full remote history", async () => {
  const { root, task } = await createTask();
  const git = (_root, args) => {
    const command = args.join(" ");
    if (command === "rev-parse --is-inside-work-tree") return { ok: true, stdout: "true" };
    if (command === "rev-parse --is-shallow-repository") return { ok: true, stdout: "false" };
    if (command === "rev-parse --verify refs/remotes/origin/main^{commit}") {
      return { ok: true, stdout: "f".repeat(40) };
    }
    if (command === "rev-parse --verify abcdef0^{commit}") {
      return { ok: true, stdout: "a".repeat(40) };
    }
    if (command.startsWith("merge-base --is-ancestor")) return { ok: true, stdout: "" };
    return { ok: false, status: 128, stderr: `unexpected command: ${command}`, stdout: "" };
  };

  const result = await inspectHistory({ config, git, root, tasks: [task] });

  assert.equal(result.capability, "full");
  assert.equal(result.remoteRef, "refs/remotes/origin/main");
  assert.deepEqual(result.diagnostics, []);
});

test("rejects an ongoing task that reuses its claim commit for implementation", async () => {
  const { root, task } = await createTask();
  const progressPath = join(task.path, "Progress.md");
  await writeFile(
    progressPath,
    (await readFile(progressPath, "utf8")).replace(
        "| Implementation complete | Pending. | Pending |",
        "| Implementation complete | origin/main commit abcdef0. | Published |",
      ),
  );
  const git = (_root, args) => {
    const command = args.join(" ");
    if (command === "rev-parse --is-inside-work-tree") return { ok: true, stdout: "true" };
    if (command === "rev-parse --is-shallow-repository") return { ok: true, stdout: "false" };
    if (command === "rev-parse --verify refs/remotes/origin/main^{commit}") {
      return { ok: true, stdout: "f".repeat(40) };
    }
    if (command === "rev-parse --verify abcdef0^{commit}") {
      return { ok: true, stdout: "a".repeat(40) };
    }
    if (command.startsWith("merge-base --is-ancestor")) return { ok: true, stdout: "" };
    return { ok: false, status: 128, stderr: `unexpected command: ${command}`, stdout: "" };
  };

  const result = await inspectHistory({ config, git, root, tasks: [task] });

  assert.ok(
    result.diagnostics.some(({ code }) => code === "history.milestones.not-distinct"),
  );
});

test("surfaces shallow history and unavailable published evidence", async () => {
  const { root, task } = await createTask();
  const git = (_root, args) => {
    const command = args.join(" ");
    if (command === "rev-parse --is-inside-work-tree") return { ok: true, stdout: "true" };
    if (command === "rev-parse --is-shallow-repository") return { ok: true, stdout: "true" };
    if (command === "rev-parse --verify refs/remotes/origin/main^{commit}") {
      return { ok: true, stdout: "f".repeat(40) };
    }
    return { ok: false, status: 128, stderr: "missing", stdout: "" };
  };

  const result = await inspectHistory({ config, git, root, tasks: [task] });
  const codes = result.diagnostics.map(({ code }) => code);

  assert.equal(result.capability, "shallow");
  assert.ok(codes.includes("history.shallow"));
  assert.ok(codes.includes("history.evidence.commit-unavailable"));
});

test("fails closed when Git cannot report history completeness", async () => {
  const { root, task } = await createTask();
  const git = (_root, args) => {
    if (args.join(" ") === "rev-parse --is-inside-work-tree") {
      return { ok: true, stdout: "true" };
    }
    return { ok: false, status: 128, stderr: "unsupported", stdout: "" };
  };

  const result = await inspectHistory({ config, git, root, tasks: [task] });

  assert.equal(result.capability, "unavailable");
  assert.equal(result.diagnostics[0].code, "history.completeness-unknown");
  assert.equal(result.diagnostics[0].level, "error");
});

function archivedGit({ copy = false } = {}) {
  const remote = "f".repeat(40);
  const archive = "c".repeat(40);
  const source = "tasks/ongoing/fixture/history-task/Task.md";
  return (_root, args) => {
    const command = args.join(" ");
    if (command === "rev-parse --is-inside-work-tree") return { ok: true, stdout: "true" };
    if (command === "rev-parse --is-shallow-repository") return { ok: true, stdout: "false" };
    if (command === "rev-parse --verify refs/remotes/origin/main^{commit}") {
      return { ok: true, stdout: remote };
    }
    if (/^rev-parse --verify [ab]{40}\^\{commit\}$/.test(command)) {
      return { ok: true, stdout: command.slice(19, 59) };
    }
    if (command.startsWith("merge-base --is-ancestor")) return { ok: true, stdout: "" };
    if (command === "log --format=%H -- tasks/archived/history-task/Task.md") {
      return { ok: true, stdout: archive };
    }
    if (command === `cat-file -e ${archive}:tasks/archived/history-task/Task.md`) {
      return { ok: true, stdout: "" };
    }
    if (command === `cat-file -e ${archive}^:tasks/archived/history-task/Task.md`) {
      return { ok: false, status: 128, stderr: "missing", stdout: "" };
    }
    if (command === `ls-tree -r --name-only ${archive}^ -- tasks/ongoing`) {
      return { ok: true, stdout: source };
    }
    if (command === `cat-file -e ${archive}:${source}`) {
      return copy
        ? { ok: true, stdout: "" }
        : { ok: false, status: 128, stderr: "missing", stdout: "" };
    }
    return { ok: false, status: 128, stderr: `unexpected command: ${command}`, stdout: "" };
  };
}

test("accepts distinct claim, implementation, and archive move commits", async () => {
  const { root, task } = await createArchivedTask();

  const result = await inspectHistory({ config, git: archivedGit(), root, tasks: [task] });

  assert.equal(result.capability, "full");
  assert.deepEqual(result.diagnostics, []);
});

test("rejects copying a task into archived while its ongoing source remains", async () => {
  const { root, task } = await createArchivedTask();

  const result = await inspectHistory({
    config,
    git: archivedGit({ copy: true }),
    root,
    tasks: [task],
  });

  assert.ok(
    result.diagnostics.some(({ code }) => code === "history.archive.commit-unavailable"),
  );
});

test("rejects lifecycle milestones that reuse a commit", async () => {
  const { root, task } = await createArchivedTask({ duplicateImplementation: true });

  const result = await inspectHistory({ config, git: archivedGit(), root, tasks: [task] });

  assert.ok(
    result.diagnostics.some(({ code }) => code === "history.milestones.not-distinct"),
  );
});