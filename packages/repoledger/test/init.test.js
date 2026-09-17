import assert from "node:assert/strict";
import * as nodeFs from "node:fs/promises";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { initRepository, pathKind } from "../src/init.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), "repoledger-init-"));
  temporaryDirectories.push(root);
  return root;
}

function repositoryGit(_root, args) {
  const command = args.join(" ");
  if (command === "rev-parse --is-inside-work-tree") {
    return { ok: true, stdout: "true" };
  }
  if (command === "remote") return { ok: true, stdout: "origin" };
  if (command === "symbolic-ref --quiet --short refs/remotes/origin/HEAD") {
    return { ok: true, stdout: "origin/main" };
  }
  if (command === "check-ref-format --branch main") {
    return { ok: true, stdout: "main" };
  }
  return {
    ok: false,
    status: 1,
    stderr: `unexpected command: ${command}`,
    stdout: "",
  };
}

test("classifies a child below a non-directory parent on every platform", async () => {
  const error = new Error("not a directory");
  error.code = "ENOTDIR";

  const kind = await pathKind("ignored", async () => {
    throw error;
  });

  assert.equal(kind, "invalid-parent");
});

test("previews initialization without changing the repository", async () => {
  const root = await createRoot();

  const report = await initRepository({ git: repositoryGit, root });

  assert.equal(report.ok, true);
  assert.equal(report.mode, "preview");
  assert.equal(report.applied, false);
  assert.ok(report.changes.some(({ path }) => path === "repoledger.json"));
  await assert.rejects(access(join(root, "repoledger.json")));
  await assert.rejects(access(join(root, "tasks")));
});

test("applies initialization idempotently without staging or publishing", async () => {
  const root = await createRoot();

  const first = await initRepository({ apply: true, git: repositoryGit, root });
  const second = await initRepository({
    apply: true,
    git: repositoryGit,
    root,
  });

  assert.equal(first.ok, true);
  assert.equal(first.applied, true);
  assert.equal(second.ok, true);
  assert.equal(second.applied, true);
  assert.deepEqual(second.changes, []);
  assert.deepEqual(second.nextActions, []);
  const config = JSON.parse(
    await readFile(join(root, "repoledger.json"), "utf8"),
  );
  assert.equal(config.tasksDirectory, "tasks");
  assert.equal(Object.hasOwn(config, "remote"), false);
  assert.equal(Object.hasOwn(config, "branch"), false);
  for (const state of ["backlog", "ongoing", "archived"]) {
    await access(join(root, "tasks", state, ".gitkeep"));
  }
});

test("refuses conflicting existing configuration without overwriting it", async () => {
  const root = await createRoot();
  await writeFile(join(root, "repoledger.json"), "{ invalid");

  const report = await initRepository({
    apply: true,
    git: repositoryGit,
    root,
  });

  assert.equal(report.ok, false);
  assert.equal(report.applied, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "config.invalid-json"),
  );
  assert.equal(
    await readFile(join(root, "repoledger.json"), "utf8"),
    "{ invalid",
  );
});

test("refuses a non-directory canonical path before writing files", async () => {
  const root = await createRoot();
  await mkdir(join(root, "tasks"));
  await writeFile(join(root, "tasks", "ongoing"), "conflict");

  const report = await initRepository({
    apply: true,
    git: repositoryGit,
    root,
  });

  assert.equal(report.ok, false);
  assert.equal(report.applied, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "init.path.conflict"),
  );
  await assert.rejects(access(join(root, "repoledger.json")));
});

test("creates an identity lane without modifying Git config", async () => {
  const root = await createRoot();
  let gitCalls = 0;

  const report = await initRepository({
    apply: true,
    git: () => {
      gitCalls += 1;
      throw new Error("Git must not be called");
    },
    identity: "fixture-identity",
    root,
  });

  assert.equal(report.ok, true);
  assert.equal(report.applied, true);
  assert.deepEqual(report.identity, { requested: "fixture-identity" });
  assert.equal(gitCalls, 0);
  assert.ok(!report.changes.some(({ action }) => action === "set-git-config"));
  await access(join(root, "tasks", "ongoing", "fixture-identity", ".gitkeep"));
  assert.match(report.nextActions[0], /Review and commit/);
});

test("rolls back every created file and directory after an apply failure", async () => {
  const root = await createRoot();
  const fs = {
    mkdir: nodeFs.mkdir,
    rm: nodeFs.rm,
    rmdir: nodeFs.rmdir,
    async writeFile(path, content, options) {
      if (path.endsWith(join("tasks", "backlog", ".gitkeep"))) {
        throw new Error("injected initialization failure");
      }
      return nodeFs.writeFile(path, content, options);
    },
  };

  const report = await initRepository({
    apply: true,
    fs,
    git: repositoryGit,
    root,
  });

  assert.equal(report.ok, false);
  assert.equal(report.applied, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "init.apply.failed"),
  );
  await assert.rejects(access(join(root, "repoledger.json")));
  await assert.rejects(access(join(root, "tasks")));
});

test("rejects an invalid identity lane without writing files", async () => {
  const root = await createRoot();

  const report = await initRepository({
    apply: true,
    identity: "Invalid Identity",
    root,
  });

  assert.equal(report.ok, false);
  assert.equal(report.applied, false);
  assert.ok(
    report.diagnostics.some(
      ({ code }) => code === "init.identity.invalid-name",
    ),
  );
  await assert.rejects(access(join(root, "repoledger.json")));
  await assert.rejects(access(join(root, "tasks")));
});
