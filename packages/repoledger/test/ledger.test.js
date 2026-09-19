import assert from "node:assert/strict";
import { test } from "node:test";

import {
  nextTimestamp,
  parseStatusFile,
  serializeStatusFile,
  transitionRecord,
} from "../src/ledger.js";

const status = {
  version: 1,
  tasks: {
    "alpha-task": {
      state: "ongoing",
      createdAt: "2026-09-18T08:30:00Z",
      updatedAt: "2026-09-19T10:15:42Z",
    },
    "zeta-task": {
      state: "backlog",
      createdAt: "2026-09-19T12:00:00Z",
      updatedAt: "2026-09-19T12:00:00Z",
    },
  },
};

test("parses and serializes canonical status YAML", () => {
  const source = `version: 1
tasks:
  alpha-task:
    state: ongoing
    createdAt: "2026-09-18T08:30:00Z"
    updatedAt: "2026-09-19T10:15:42Z"
  zeta-task:
    state: backlog
    createdAt: "2026-09-19T12:00:00Z"
    updatedAt: "2026-09-19T12:00:00Z"
`;

  assert.deepEqual(parseStatusFile(source), status);
  assert.equal(serializeStatusFile(status), source);
});

test("supports an empty canonical task map", () => {
  const source = "version: 1\ntasks: {}\n";
  assert.deepEqual(parseStatusFile(source), { version: 1, tasks: {} });
  assert.equal(serializeStatusFile({ version: 1, tasks: {} }), source);
});

test("rejects unknown fields, branch fields, and noncanonical order", () => {
  const fixtures = [
    `version: 1\ntasks:\n  alpha-task:\n    state: ongoing\n    branch: task/alpha-task\n    createdAt: "2026-09-18T08:30:00Z"\n    updatedAt: "2026-09-19T10:15:42Z"\n`,
    `version: 1\ntasks:\n  zeta-task:\n    state: backlog\n    createdAt: "2026-09-19T12:00:00Z"\n    updatedAt: "2026-09-19T12:00:00Z"\n  alpha-task:\n    state: ongoing\n    createdAt: "2026-09-18T08:30:00Z"\n    updatedAt: "2026-09-19T10:15:42Z"\n`,
  ];

  for (const source of fixtures) {
    assert.throws(() => parseStatusFile(source), /status/i);
  }
});

test("rejects invalid states, names, and timestamps", () => {
  const invalid = structuredClone(status);
  invalid.tasks["alpha-task"].state = "archived";
  assert.throws(() => serializeStatusFile(invalid), /state/i);

  const invalidName = structuredClone(status);
  invalidName.tasks["Alpha Task"] = invalidName.tasks["alpha-task"];
  delete invalidName.tasks["alpha-task"];
  assert.throws(() => serializeStatusFile(invalidName), /name/i);

  const invalidTime = structuredClone(status);
  invalidTime.tasks["alpha-task"].updatedAt = "2026-09-17T00:00:00Z";
  assert.throws(() => serializeStatusFile(invalidTime), /timestamp/i);
});

test("maintains monotonic timestamps and legal transitions", () => {
  assert.equal(
    nextTimestamp("2026-09-19T10:15:42Z", new Date("2026-09-19T10:15:41Z")),
    "2026-09-19T10:15:43Z",
  );
  assert.deepEqual(
    transitionRecord(status.tasks["zeta-task"], "ongoing", new Date("2026-09-19T12:00:00Z")),
    {
      state: "ongoing",
      createdAt: "2026-09-19T12:00:00Z",
      updatedAt: "2026-09-19T12:00:01Z",
    },
  );
  assert.throws(
    () => transitionRecord(status.tasks["zeta-task"], "completed", new Date()),
    /transition/i,
  );
});
