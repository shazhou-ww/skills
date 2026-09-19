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

test("renders the approved command surface without legacy commands", async () => {
  const capture = captureIo();
  const exitCode = await runCli([], capture.io);
  const help = capture.output.join("\n");

  assert.equal(exitCode, 0);
  assert.match(help, /check \[options\] \[task-name\]/);
  assert.match(help, /init \[options\]/);
  assert.match(help, /status \[options\] <task-name>/);
  assert.match(help, /task\s+query or mutate task lifecycle state/);
  assert.doesNotMatch(help, /doctor/);
  assert.doesNotMatch(help, /claim/);
  assert.doesNotMatch(help, /archive/);
  assert.doesNotMatch(help, /--config/);
});

test("renders task list time and state filters", async () => {
  const capture = captureIo();
  const exitCode = await runCli(["task", "list", "--help"], capture.io);
  const help = capture.output.join("\n");

  assert.equal(exitCode, 0);
  for (const option of [
    "--state <state>",
    "--created-since <timestamp>",
    "--created-before <timestamp>",
    "--updated-since <timestamp>",
    "--updated-before <timestamp>",
    "--sort <key>",
    "--limit <count>",
    "--local",
  ]) {
    assert.match(help, new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("rejects invalid time filters as usage errors", async () => {
  const invalid = captureIo();
  const reversed = captureIo();

  assert.equal(
    await runCli(["task", "list", "--created-since", "today"], invalid.io),
    2,
  );
  assert.equal(
    await runCli([
      "task",
      "list",
      "--updated-since",
      "2026-09-20T00:00:00Z",
      "--updated-before",
      "2026-09-19T00:00:00Z",
    ], reversed.io),
    2,
  );
});

test("returns a stable JSON validation report", async () => {
  const root = await mkdtemp(join(tmpdir(), "repoledger-cli-invalid-"));
  temporaryDirectories.push(root);
  const capture = captureIo();

  const exitCode = await runCli(["check", "--root", root, "--json"], capture.io);
  const report = JSON.parse(capture.output.join("\n"));

  assert.equal(exitCode, 1);
  assert.equal(report.command, "check");
  assert.equal(report.ok, false);
  assert.equal(report.result.checked, 0);
  assert.equal(report.diagnostics[0].code, "config.missing");
});

test("requires explicit init coordination target and completion approval", async () => {
  const init = captureIo();
  const complete = captureIo();

  assert.equal(await runCli(["init"], init.io), 2);
  assert.match(init.errors.join("\n"), /--remote/);
  assert.equal(await runCli(["task", "complete", "sample-task"], complete.io), 2);
  assert.match(complete.errors.join("\n"), /--approved-commit/);
});
