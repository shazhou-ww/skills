import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { render, runCli } from "../src/cli.js";

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

test("renders portable repository and source ref options", async () => {
  const init = captureIo();
  const start = captureIo();

  assert.equal(await runCli(["init", "--help"], init.io), 0);
  assert.match(init.output.join("\n"), /--primary-repository <url>/);
  assert.doesNotMatch(init.output.join("\n"), /--remote/);

  assert.equal(await runCli(["task", "start", "--help"], start.io), 0);
  assert.match(start.output.join("\n"), /--source-repository <url>/);
  assert.match(start.output.join("\n"), /--source-branch <branch>/);
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
  assert.match(init.errors.join("\n"), /--primary-repository/);
  assert.equal(await runCli(["task", "complete", "sample-task"], complete.io), 2);
  assert.match(complete.errors.join("\n"), /--approved-commit/);
});

test("renders source and primary coordinates for complete and partial starts", () => {
  const result = {
    task: "sample-task",
    transition: "backlog -> ongoing",
    publication: "published",
    primaryBefore: "1111111111111111111111111111111111111111",
    primaryAfter: "2222222222222222222222222222222222222222",
    sourceRepository: "https://example.com/owner/repository.git",
    sourceBranch: "task/sample-task",
    sourceTip: "2222222222222222222222222222222222222222",
    commit: "2222222222222222222222222222222222222222",
  };
  const complete = captureIo();
  render({ command: "task start", ok: true, diagnostics: [], result }, false, complete.io);
  const output = complete.output.join("\n");
  assert.match(output, /primary before\s+111111111111/);
  assert.match(output, /primary after\s+222222222222/);
  assert.match(output, /source\s+https:\/\/example\.com\/owner\/repository\.git#task\/sample-task/);
  assert.match(output, /source tip\s+222222222222/);

  const partial = captureIo();
  render({
    command: "task start",
    ok: false,
    diagnostics: [{ code: "git.start.primary-pending", level: "error", message: "pending", remediation: "retry" }],
    result: { ...result, publication: "partially-published", primaryAfter: null },
  }, false, partial.io);
  assert.match(partial.output.join("\n"), /partially-published/);
  assert.match(partial.errors.join("\n"), /FAILED/);
});
