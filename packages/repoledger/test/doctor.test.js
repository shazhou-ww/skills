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
    if (command === "config --get task-ledger.identity") {
      return { ok: true, stdout: "fixture-identity" };
    }
    if (command === "config --show-origin --show-scope --get task-ledger.identity") {
      return {
        ok: true,
        stdout: "worktree\tfile:.git/config.worktree\tfixture-identity",
      };
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

test("validates an authoritative worktree identity using only Git config", async () => {
  const root = await createRepository();
  const calls = [];

  const report = await doctorRepository({ git: successfulGit(calls), root });

  assert.equal(report.ok, true);
  assert.equal(report.identity, "fixture-identity");
  assert.equal(report.scope.identityScope, "worktree");
  assert.equal(Object.hasOwn(report, "remoteFreshness"), false);
  assert.ok(calls.every(([command]) => command === "config"));
});

test("does not access remotes", async () => {
  const root = await createRepository();
  const calls = [];

  const report = await doctorRepository({ git: successfulGit(calls), root });

  assert.equal(report.ok, true);
  assert.ok(!calls.some(([command]) => command === "fetch"));
  assert.ok(!calls.some(([command]) => command === "cat-file"));
  assert.ok(!calls.some(([command]) => command === "rev-parse"));
});

test("reports a missing effective identity", async () => {
  const root = await createRepository();
  const base = successfulGit([]);
  const git = (repositoryRoot, args) => {
    if (args.join(" ") === "config --get task-ledger.identity") {
      return { ok: false, status: 1, stderr: "", stdout: "" };
    }
    return base(repositoryRoot, args);
  };

  const report = await doctorRepository({ git, root });
  const codes = report.diagnostics.map(({ code }) => code);

  assert.equal(report.ok, false);
  assert.equal(report.identity, null);
  assert.ok(codes.includes("doctor.identity.missing"));
  assert.ok(!codes.includes("doctor.identity.invalid-scope"));
});

test("reports a missing local identity lane", async () => {
  const root = await createRepository();
  await rm(join(root, "tasks", "ongoing", "fixture-identity"), {
    recursive: true,
  });

  const report = await doctorRepository({ git: successfulGit([]), root });

  assert.equal(report.ok, false);
  assert.ok(
    report.diagnostics.some(({ code }) => code === "doctor.identity.lane-missing"),
  );
});

test("accepts a global identity without worktree config", async () => {
  const root = await createRepository();
  const calls = [];
  const git = (_repositoryRoot, args) => {
    calls.push(args);
    const command = args.join(" ");
    if (command === "config --get task-ledger.identity") {
      return { ok: true, stdout: "fixture-identity" };
    }
    if (command === "config --show-origin --show-scope --get task-ledger.identity") {
      return {
        ok: true,
        stdout: "global\tfile:C:/Users/example/.gitconfig\tfixture-identity",
      };
    }
    return { ok: false, status: 1, stderr: "", stdout: "" };
  };

  const report = await doctorRepository({ git, root });

  assert.equal(report.ok, true);
  assert.equal(report.identity, "fixture-identity");
  assert.equal(report.scope.identityScope, "global");
  assert.ok(!report.diagnostics.some(({ code }) => code.includes("worktree-config")));
});