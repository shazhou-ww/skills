import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { doctorRepository } from "../src/doctor.js";
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
  const root = await mkdtemp(join(tmpdir(), "repoledger-doctor-"));
  temporaryDirectories.push(root);
  await writeFile(
    join(root, "repoledger.json"),
    JSON.stringify(projectConfig()),
  );
  for (const status of ["backlog", "ongoing", "archived"]) {
    await mkdir(join(root, "tasks", status), { recursive: true });
  }
  await mkdir(join(root, "tasks", "ongoing", "fixture-identity"));
  await writeFile(join(root, "tasks", "ongoing", "fixture-identity", ".gitkeep"), "");
  return root;
}

function successfulGit(calls) {
  return (_root, args) => {
    calls.push(args);
    const command = args.join(" ");
    if (command === "rev-parse --is-inside-work-tree") return { ok: true, stdout: "true" };
    if (command === "rev-parse --is-shallow-repository") return { ok: true, stdout: "false" };
    if (command === "rev-parse --verify refs/remotes/origin/main^{commit}") {
      return { ok: true, stdout: "f".repeat(40) };
    }
    if (command.includes("extensions.worktreeConfig")) return { ok: true, stdout: "true" };
    if (command === "config --worktree --get task-ledger.identity") {
      return { ok: true, stdout: "fixture-identity" };
    }
    if (command === "config --show-origin --show-scope --get task-ledger.identity") {
      return {
        ok: true,
        stdout: "worktree\tfile:.git/config.worktree\tfixture-identity",
      };
    }
    if (command === "config --global --get task-ledger.defaultIdentity") {
      return { ok: true, stdout: "fixture-default" };
    }
    if (command === "check-ref-format --branch main") return { ok: true, stdout: "main" };
    if (command === "fetch origin main") return { ok: true, stdout: "" };
    if (
      command ===
      "cat-file -e origin/main:tasks/ongoing/fixture-identity/.gitkeep"
    ) {
      return { ok: true, stdout: "" };
    }
    return { ok: false, status: 128, stderr: `unexpected command: ${command}`, stdout: "" };
  };
}

test("validates and refreshes an authoritative worktree identity", async () => {
  const root = await createRepository();
  const calls = [];

  const report = await doctorRepository({ git: successfulGit(calls), root });

  assert.equal(report.ok, true);
  assert.equal(report.identity, "fixture-identity");
  assert.equal(report.defaultIdentity, "fixture-default");
  assert.equal(report.remoteFreshness, "refreshed");
  assert.ok(calls.some((args) => args.join(" ") === "fetch origin main"));
});

test("offline mode is explicit and does not fetch", async () => {
  const root = await createRepository();
  const calls = [];

  const report = await doctorRepository({
    git: successfulGit(calls),
    offline: true,
    root,
  });

  assert.equal(report.ok, true);
  assert.equal(report.remoteFreshness, "offline");
  assert.ok(report.diagnostics.some(({ code }) => code === "doctor.remote.offline"));
  assert.ok(!calls.some((args) => args[0] === "fetch"));
});

test("does not substitute a device default for a missing binding", async () => {
  const root = await createRepository();
  const base = successfulGit([]);
  const git = (repositoryRoot, args) => {
    if (args.join(" ") === "config --worktree --get task-ledger.identity") {
      return { ok: false, status: 1, stderr: "", stdout: "" };
    }
    return base(repositoryRoot, args);
  };

  const report = await doctorRepository({ git, root });
  const codes = report.diagnostics.map(({ code }) => code);

  assert.equal(report.ok, false);
  assert.equal(report.identity, null);
  assert.equal(report.defaultIdentity, "fixture-default");
  assert.ok(codes.includes("doctor.identity.missing"));
  assert.ok(codes.includes("doctor.identity.invalid-scope"));
});

test("reports an identity missing from the shared branch", async () => {
  const root = await createRepository();
  const base = successfulGit([]);
  const git = (repositoryRoot, args) => {
    if (args[0] === "cat-file") {
      return { ok: false, status: 128, stderr: "missing", stdout: "" };
    }
    return base(repositoryRoot, args);
  };

  const report = await doctorRepository({ git, root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "doctor.identity.unregistered"),
  );
});