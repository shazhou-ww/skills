import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { planReferenceUpdates } from "../src/references.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function fixture({ archivedReference = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "repoledger-references-"));
  temporaryDirectories.push(root);
  const source = join(root, "tasks", "backlog", "move-task");
  const destination = join(root, "tasks", "ongoing", "fixture-identity", "move-task");
  await mkdir(source, { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs", "spec.md"), "# Spec\n");
  await writeFile(join(root, "docs", "percent%file.md"), "# Percent\n");
  await writeFile(
    join(source, "Task.md"),
    "[spec](../../../docs/spec.md?q=1#part) [percent](../../../docs/percent%25file.md?raw=1#part) [local](./Notes.md)\n",
  );
  await writeFile(join(source, "Notes.md"), "# Notes\n");
  await writeFile(
    join(root, "docs", "links.md"),
    "[task](../tasks/backlog/move-task/Task.md#goal) ![notes](../tasks/backlog/move-task/Notes.md?raw=1#top)\n\n[root]: /tasks/backlog/move-task/Notes.md\n",
  );
  const files = [
    "docs/links.md",
    "docs/percent%file.md",
    "docs/spec.md",
    "tasks/backlog/move-task/Notes.md",
    "tasks/backlog/move-task/Task.md",
  ];
  if (archivedReference) {
    const archived = join(root, "tasks", "archived", "old-task");
    await mkdir(archived, { recursive: true });
    await writeFile(
      join(archived, "Progress.md"),
      "[task](../../backlog/move-task/Task.md)\n",
    );
    files.push("tasks/archived/old-task/Progress.md");
  }
  const git = (_repositoryRoot, args) => {
    if (args.join(" ") === "ls-files --cached --others --exclude-standard") {
      return { ok: true, stdout: files.sort().join("\n") };
    }
    return { ok: false, status: 1, stderr: "unexpected command", stdout: "" };
  };
  return { destination, git, root, source };
}

test("plans inbound and outbound Markdown rewrites while preserving suffixes", async () => {
  const { destination, git, root, source } = await fixture();

  const result = await planReferenceUpdates({
    destinationPath: destination,
    git,
    root,
    sourcePath: source,
    tasksDirectory: "tasks",
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.edits.length, 2);
  const taskEdit = result.edits.find(({ path }) => path.endsWith("Task.md"));
  const inboundEdit = result.edits.find(({ path }) => path === "docs/links.md");
  assert.match(taskEdit.content, /\.\.\/\.\.\/\.\.\/\.\.\/docs\/spec\.md\?q=1#part/);
  assert.match(
    taskEdit.content,
    /\.\.\/\.\.\/\.\.\/\.\.\/docs\/percent%25file\.md\?raw=1#part/,
  );
  assert.match(taskEdit.content, /\[local\]\(\.\/Notes\.md\)/);
  assert.match(
    inboundEdit.content,
    /\.\.\/tasks\/ongoing\/fixture-identity\/move-task\/Task\.md#goal/,
  );
  assert.match(
    inboundEdit.content,
    /\/tasks\/ongoing\/fixture-identity\/move-task\/Notes\.md/,
  );
  assert.match(
    inboundEdit.content,
    /!\[notes\]\(\.\.\/tasks\/ongoing\/fixture-identity\/move-task\/Notes\.md\?raw=1#top\)/,
  );
});

test("blocks an archived inbound reference", async () => {
  const { destination, git, root, source } = await fixture({ archivedReference: true });

  const result = await planReferenceUpdates({
    destinationPath: destination,
    git,
    root,
    sourcePath: source,
    tasksDirectory: "tasks",
  });

  assert.ok(
    result.diagnostics.some(({ code }) => code === "reference.archived-source"),
  );
  assert.ok(result.references.some(({ blocked }) => blocked));
});

test("blocks archived references with a custom task directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "repoledger-custom-references-"));
  temporaryDirectories.push(root);
  const source = join(root, "backlog", "move-task");
  const destination = join(root, "ongoing", "fixture-identity", "move-task");
  const archived = join(root, "archived", "old-task");
  await mkdir(source, { recursive: true });
  await mkdir(archived, { recursive: true });
  await writeFile(join(source, "Task.md"), "# Task\n");
  await writeFile(
    join(archived, "Progress.md"),
    "[task](../../backlog/move-task/Task.md)\n",
  );
  const git = () => ({
    ok: true,
    stdout: "archived/old-task/Progress.md\nbacklog/move-task/Task.md",
  });

  const result = await planReferenceUpdates({
    destinationPath: destination,
    git,
    root,
    sourcePath: source,
    tasksDirectory: ".",
  });

  assert.ok(
    result.diagnostics.some(({ code }) => code === "reference.archived-source"),
  );
});