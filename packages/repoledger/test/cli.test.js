import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { runCli } from "../src/cli.js";

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