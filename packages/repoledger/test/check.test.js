import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { checkRepository } from "../src/index.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createRepository(statuses) {
  const root = await mkdtemp(join(tmpdir(), "repoledger-"));
  temporaryDirectories.push(root);
  for (const status of statuses) {
    await mkdir(join(root, "tasks", status), { recursive: true });
  }
  return root;
}

test("accepts all canonical status directories", async () => {
  const root = await createRepository(["backlog", "ongoing", "archived"]);

  const report = await checkRepository({ root });

  assert.equal(report.ok, true);
  assert.deepEqual(report.diagnostics, []);
});

test("reports a missing canonical status directory", async () => {
  const root = await createRepository(["backlog", "ongoing"]);

  const report = await checkRepository({ root });

  assert.equal(report.ok, false);
  assert.deepEqual(report.diagnostics, [
    {
      code: "layout.status.missing",
      level: "error",
      path: "tasks/archived",
      message: "Missing canonical task status directory: tasks/archived",
      remediation: "Create tasks/archived before using the task ledger.",
    },
  ]);
});