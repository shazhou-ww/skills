import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { runCli } from "../src/cli.js";
import { projectConfig } from "../test-support/support.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function captureIo() {
  const output = [];
  const errors = [];
  return {
    errors,
    io: {
      error: (...values) => errors.push(values.join(" ")),
      log: (...values) => output.push(values.join(" ")),
    },
    output,
  };
}

test("prints the package version without requiring a command", async () => {
  const capture = captureIo();

  const exitCode = await runCli(["--version"], capture.io);

  assert.equal(exitCode, 0);
  assert.deepEqual(capture.output, ["0.2.0"]);
  assert.deepEqual(capture.errors, []);
});

test("returns a usage error for an unknown command", async () => {
  const capture = captureIo();

  const exitCode = await runCli(["repair"], capture.io);

  assert.equal(exitCode, 2);
  assert.deepEqual(capture.output, []);
  assert.match(capture.errors.join("\n"), /unknown command 'repair'/);
  assert.match(capture.errors.join("\n"), /--help for usage/);
});

test("renders command-oriented root help with examples", async () => {
  const capture = captureIo();

  const exitCode = await runCli([], capture.io);
  const help = capture.output.join("\n");

  assert.equal(exitCode, 0);
  assert.match(help, /Usage: repoledger \[options\] \[command\]/);
  assert.match(help, /check \[options\]\s+validate repository task state/);
  assert.match(help, /doctor \[options\]\s+validate local task-work readiness/);
  assert.match(help, /init \[options\]\s+initialize repository task state/);
  assert.match(help, /plan\s+plan a task transition/);
  assert.match(help, /status \[options\]\s+show repository task status/);
  assert.match(help, /Examples:/);
});

test("renders focused doctor help", async () => {
  const capture = captureIo();

  const exitCode = await runCli(["doctor", "--help"], capture.io);
  const help = capture.output.join("\n");

  assert.equal(exitCode, 0);
  assert.match(help, /Usage: repoledger doctor \[options\]/);
  assert.match(help, /--offline/);
  assert.match(help, /--json/);
  assert.match(help, /--config <path>/);
});

test("returns exit code one with a complete JSON validation report", async () => {
  const root = await mkdtemp(join(tmpdir(), "repoledger-cli-invalid-"));
  temporaryDirectories.push(root);
  const capture = captureIo();

  const exitCode = await runCli(["check", "--root", root, "--json"], capture.io);
  const report = JSON.parse(capture.output.join("\n"));

  assert.equal(exitCode, 1);
  assert.equal(report.ok, false);
  assert.equal(report.command, "check");
  assert.equal(report.summary.errors, 1);
  assert.equal(report.diagnostics[0].code, "config.missing");
  assert.deepEqual(capture.errors, []);
});

test("renders focused check help", async () => {
  const capture = captureIo();

  const exitCode = await runCli(["check", "--help"], capture.io);
  const help = capture.output.join("\n");

  assert.equal(exitCode, 0);
  assert.match(help, /--task <name>/);
});

test("emits machine-readable status without requiring a Git identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "repoledger-cli-status-"));
  temporaryDirectories.push(root);
  await writeFile(join(root, "repoledger.json"), JSON.stringify(projectConfig()));
  for (const state of ["backlog", "ongoing", "archived"]) {
    await mkdir(join(root, "tasks", state), { recursive: true });
  }
  const capture = captureIo();

  const exitCode = await runCli(["status", "--root", root, "--json"], capture.io);
  const report = JSON.parse(capture.output.join("\n"));

  assert.equal(exitCode, 0);
  assert.equal(report.command, "status");
  assert.deepEqual(report.identity, { scope: null, value: null });
  assert.deepEqual(report.tasks, []);
  assert.deepEqual(capture.errors, []);
});

test("renders initialization help and rejects conflicting modes", async () => {
  const helpCapture = captureIo();
  const conflictCapture = captureIo();

  const helpExitCode = await runCli(["init", "--help"], helpCapture.io);
  const conflictExitCode = await runCli(
    ["init", "--apply", "--dry-run"],
    conflictCapture.io,
  );

  assert.equal(helpExitCode, 0);
  assert.match(helpCapture.output.join("\n"), /--identity <identity>/);
  assert.match(helpCapture.output.join("\n"), /--tasks-directory <path>/);
  assert.equal(conflictExitCode, 2);
  assert.match(conflictCapture.errors.join("\n"), /cannot be used together/);
});

test("renders takeover grammar and machine-readable operation semantics", async () => {
  const helpCapture = captureIo();
  const reportCapture = captureIo();
  const root = await mkdtemp(join(tmpdir(), "repoledger-cli-plan-"));
  temporaryDirectories.push(root);

  const helpExitCode = await runCli(["plan", "claim", "--help"], helpCapture.io);
  const reportExitCode = await runCli(
    [
      "plan",
      "claim",
      "move-task",
      "--take-from",
      "source-identity",
      "--root",
      root,
      "--json",
    ],
    reportCapture.io,
  );
  const report = JSON.parse(reportCapture.output.join("\n"));

  assert.equal(helpExitCode, 0);
  assert.match(helpCapture.output.join("\n"), /--take-from <identity>/);
  assert.equal(reportExitCode, 1);
  assert.equal(report.command, "plan");
  assert.equal(report.operation, "takeover");
  assert.equal(report.sourceIdentity, "source-identity");
});

test("renders move and reference details for human transition reports", async () => {
  const capture = captureIo();
  const root = await mkdtemp(join(tmpdir(), "repoledger-cli-plan-human-"));
  temporaryDirectories.push(root);

  const exitCode = await runCli(
    ["plan", "claim", "move-task", "--root", root],
    capture.io,
  );

  assert.equal(exitCode, 1);
  assert.match(capture.errors.join("\n"), /config\.missing/);
  assert.doesNotMatch(capture.output.join("\n"), /undefined/);
});