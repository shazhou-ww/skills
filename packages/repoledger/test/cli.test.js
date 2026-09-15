import assert from "node:assert/strict";
import { test } from "node:test";

import { runCli } from "../src/cli.js";

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
  assert.deepEqual(capture.output, ["0.1.0"]);
  assert.deepEqual(capture.errors, []);
});

test("returns a usage error for an unknown command", async () => {
  const capture = captureIo();

  const exitCode = await runCli(["repair"], capture.io);

  assert.equal(exitCode, 2);
  assert.deepEqual(capture.output, []);
  assert.deepEqual(capture.errors, ["Unknown command: repair"]);
});