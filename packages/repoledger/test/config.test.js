import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { DEFAULT_CONFIG_NAME, loadConfig } from "../src/config.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function writeConfig(source) {
  const root = await mkdtemp(join(tmpdir(), "repoledger-config-"));
  temporaryDirectories.push(root);
  await writeFile(join(root, DEFAULT_CONFIG_NAME), source);
  return root;
}

test("loads the strict versioned YAML configuration", async () => {
  const root = await writeConfig(`version: 1
tasksDirectory: tasks
remote: origin
primaryBranch: main
`);

  const loaded = await loadConfig({ root });

  assert.deepEqual(loaded.diagnostics, []);
  assert.deepEqual(loaded.config, {
    version: 1,
    tasksDirectory: "tasks",
    remote: "origin",
    primaryBranch: "main",
  });
  assert.equal(DEFAULT_CONFIG_NAME, "repoledger.yaml");
});

test("requires every property and rejects unknown properties", async () => {
  const root = await writeConfig(`version: 1
tasksDirectory: tasks
remote: origin
extra: true
`);

  const loaded = await loadConfig({ root });
  const codes = loaded.diagnostics.map(({ code }) => code);

  assert.equal(loaded.config, null);
  assert.ok(codes.includes("config.missing-primary-branch"));
  assert.ok(codes.includes("config.unknown-key"));
});

test("rejects unsupported YAML features and duplicate keys", async () => {
  const fixtures = [
    `version: 1\nversion: 1\ntasksDirectory: tasks\nremote: origin\nprimaryBranch: main\n`,
    `version: &version 1\ntasksDirectory: tasks\nremote: origin\nprimaryBranch: main\n`,
    `version: 1\ntasksDirectory: tasks\nremote: origin\nprimaryBranch: main # comment\n`,
    `%YAML 1.2\n---\nversion: 1\ntasksDirectory: tasks\nremote: origin\nprimaryBranch: main\n`,
  ];

  for (const source of fixtures) {
    const root = await writeConfig(source);
    const loaded = await loadConfig({ root });
    assert.equal(loaded.config, null, source);
    assert.ok(
      loaded.diagnostics.some(({ code }) => code === "config.invalid-yaml"),
      source,
    );
  }
});

test("validates version, safe paths, remote names, and primary branches", async () => {
  const root = await writeConfig(`version: 2
tasksDirectory: ../tasks
remote: -origin
primaryBranch: refs/heads/main
`);

  const loaded = await loadConfig({ root });
  const codes = loaded.diagnostics.map(({ code }) => code);

  assert.equal(loaded.config, null);
  assert.ok(codes.includes("config.unsupported-version"));
  assert.ok(codes.includes("config.invalid-tasks-directory"));
  assert.ok(codes.includes("config.invalid-remote"));
  assert.ok(codes.includes("config.invalid-primary-branch"));
});

test("rejects noncanonical YAML", async () => {
  const root = await writeConfig(`remote: origin
version: 1
tasksDirectory: tasks
primaryBranch: main
`);

  const loaded = await loadConfig({ root });

  assert.equal(loaded.config, null);
  assert.equal(loaded.diagnostics[0].code, "config.noncanonical");
});

test("rejects a tasks directory beneath a symlinked segment", async () => {
  const root = await writeConfig(`version: 1
tasksDirectory: linked/tasks
remote: origin
primaryBranch: main
`);
  const outside = await mkdtemp(join(tmpdir(), "repoledger-config-outside-"));
  temporaryDirectories.push(outside);
  await mkdir(join(outside, "tasks"));
  await symlink(
    outside,
    join(root, "linked"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const loaded = await loadConfig({ root });

  assert.equal(loaded.config, null);
  assert.ok(
    loaded.diagnostics.some(({ code }) => code === "config.invalid-tasks-directory"),
  );
});
