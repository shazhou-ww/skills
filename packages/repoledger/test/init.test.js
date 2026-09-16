import assert from "node:assert/strict";
import * as nodeFs from "node:fs/promises";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { initRepository, pathKind } from "../src/init.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
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
  return { ok: false, status: 1, stderr: `unexpected command: ${command}`, stdout: "" };
}

test("classifies a child below a non-directory parent on every platform", async () => {
  const error = new Error("not a directory");
  error.code = "ENOTDIR";

  const kind = await pathKind("ignored", async () => {
    throw error;
  });

  assert.equal(kind, "invalid-parent");
});

function identityGit({ extensionExplicit = false, registered = false } = {}) {
  const state = {
    binding: null,
    extension: false,
    extensionExplicit,
    fetched: false,
  };
  const git = (_root, args) => {
    const command = args.join(" ");
    if (command === "config --global --get task-ledger.defaultIdentity") {
      return { ok: true, stdout: "suggested-identity" };
    }
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
    if (command === "config --local --type=bool --get extensions.worktreeConfig") {
      return state.extension || state.extensionExplicit
        ? { ok: true, stdout: String(state.extension) }
        : { ok: false, status: 1, stderr: "", stdout: "" };
    }
    if (command === "config --worktree --get task-ledger.identity") {
      return state.binding
        ? { ok: true, stdout: state.binding }
        : { ok: false, status: 1, stderr: "", stdout: "" };
    }
    if (command === "config --show-origin --show-scope --get task-ledger.identity") {
      return state.binding
        ? {
          ok: true,
          stdout: `worktree\tfile:.git/config.worktree\t${state.binding}`,
        }
        : { ok: false, status: 1, stderr: "", stdout: "" };
    }
    if (command === "config --local --get core.worktree") {
      return { ok: false, status: 1, stderr: "", stdout: "" };
    }
    if (command === "config --local --type=bool --get core.bare") {
      return { ok: true, stdout: "false" };
    }
    if (command === "fetch origin main") {
      state.fetched = true;
      return { ok: true, stdout: "" };
    }
    if (
      command ===
      "cat-file -e origin/main:tasks/ongoing/fixture-identity/.gitkeep"
    ) {
      return registered
        ? { ok: true, stdout: "" }
        : { ok: false, status: 128, stderr: "missing", stdout: "" };
    }
    if (command === "config --local extensions.worktreeConfig true") {
      state.extension = true;
      state.extensionExplicit = true;
      return { ok: true, stdout: "" };
    }
    if (command === "config --local extensions.worktreeConfig false") {
      state.extension = false;
      state.extensionExplicit = true;
      return { ok: true, stdout: "" };
    }
    if (command === "config --local --unset extensions.worktreeConfig") {
      state.extension = false;
      return { ok: true, stdout: "" };
    }
    if (command === "config --worktree task-ledger.identity fixture-identity") {
      state.binding = "fixture-identity";
      return { ok: true, stdout: "" };
    }
    if (command === "config --worktree --unset task-ledger.identity") {
      state.binding = null;
      return { ok: true, stdout: "" };
    }
    return { ok: false, status: 1, stderr: `unexpected command: ${command}`, stdout: "" };
  };
  return { git, state };
}

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
  const second = await initRepository({ apply: true, git: repositoryGit, root });

  assert.equal(first.ok, true);
  assert.equal(first.applied, true);
  assert.equal(second.ok, true);
  assert.equal(second.applied, true);
  assert.deepEqual(second.changes, []);
  assert.deepEqual(second.nextActions, []);
  const config = JSON.parse(await readFile(join(root, "repoledger.json"), "utf8"));
  assert.equal(config.remote, "origin");
  assert.equal(config.branch, "main");
  for (const state of ["backlog", "ongoing", "archived"]) {
    await access(join(root, "tasks", state, ".gitkeep"));
  }
});

test("refuses conflicting existing configuration without overwriting it", async () => {
  const root = await createRoot();
  await writeFile(join(root, "repoledger.json"), "{ invalid");

  const report = await initRepository({ apply: true, git: repositoryGit, root });

  assert.equal(report.ok, false);
  assert.equal(report.applied, false);
  assert.ok(report.diagnostics.some(({ code }) => code === "config.invalid-json"));
  assert.equal(await readFile(join(root, "repoledger.json",), "utf8"), "{ invalid");
});

test("refuses a non-directory canonical path before writing files", async () => {
  const root = await createRoot();
  await mkdir(join(root, "tasks"));
  await writeFile(join(root, "tasks", "ongoing"), "conflict");

  const report = await initRepository({ apply: true, git: repositoryGit, root });

  assert.equal(report.ok, false);
  assert.equal(report.applied, false);
  assert.ok(report.diagnostics.some(({ code }) => code === "init.path.conflict"));
  await assert.rejects(access(join(root, "repoledger.json")));
});

test("creates an unregistered identity lane without binding the worktree", async () => {
  const root = await createRoot();
  const { git, state } = identityGit();

  const report = await initRepository({
    apply: true,
    git,
    identity: "fixture-identity",
    root,
  });

  assert.equal(report.ok, true);
  assert.equal(report.applied, true);
  assert.equal(report.identity.registered, false);
  assert.equal(report.identity.willBind, false);
  assert.equal(state.extension, true);
  assert.equal(state.binding, null);
  assert.equal(state.fetched, true);
  await access(join(root, "tasks", "ongoing", "fixture-identity", ".gitkeep"));
  assert.match(report.nextActions[0], /Commit and publish/);
});

test("binds an explicitly selected identity only after remote registration", async () => {
  const root = await createRoot();
  const { git, state } = identityGit({ registered: true });

  const report = await initRepository({
    apply: true,
    git,
    identity: "fixture-identity",
    root,
  });

  assert.equal(report.ok, true);
  assert.equal(report.applied, true);
  assert.equal(report.identity.registered, true);
  assert.equal(report.identity.willBind, true);
  assert.equal(state.extension, true);
  assert.equal(state.binding, "fixture-identity");
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
  assert.ok(report.diagnostics.some(({ code }) => code === "init.apply.failed"));
  await assert.rejects(access(join(root, "repoledger.json")));
  await assert.rejects(access(join(root, "tasks")));
});

test("restores an explicit false worktree-config value during rollback", async () => {
  const root = await createRoot();
  const { git, state } = identityGit({ extensionExplicit: true });
  const fs = {
    mkdir: nodeFs.mkdir,
    rm: nodeFs.rm,
    rmdir: nodeFs.rmdir,
    async writeFile(path, content, options) {
      if (path.endsWith(join("fixture-identity", ".gitkeep"))) {
        throw new Error("injected identity initialization failure");
      }
      return nodeFs.writeFile(path, content, options);
    },
  };

  const report = await initRepository({
    apply: true,
    fs,
    git,
    identity: "fixture-identity",
    root,
  });

  assert.equal(report.ok, false);
  assert.equal(report.applied, false);
  assert.equal(state.extension, false);
  assert.equal(state.extensionExplicit, true);
  await assert.rejects(access(join(root, "repoledger.json")));
});