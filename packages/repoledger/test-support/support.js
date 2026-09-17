import { SCHEMA_URL } from "../src/config.js";

export function projectConfig(overrides = {}) {
  return {
    $schema: SCHEMA_URL,
    ...overrides,
  };
}

export function fullHistoryGit(_root, args) {
  const command = args.join(" ");
  if (command === "config --local --type=bool --get extensions.worktreeConfig") {
    return { ok: true, stdout: "true" };
  }
  if (command === "config --worktree --get task-ledger.identity") {
    return { ok: true, stdout: "fixture-identity" };
  }
  if (command === "config --show-origin --show-scope --get task-ledger.identity") {
    return {
      ok: true,
      stdout: "worktree\tfile:.git/config.worktree\tfixture-identity",
    };
  }
  return { ok: false, status: 128, stderr: `unexpected command: ${command}`, stdout: "" };
}
