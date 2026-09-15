import { SCHEMA_URL } from "../src/config.js";

export function projectConfig(overrides = {}) {
  return {
    $schema: SCHEMA_URL,
    remote: "origin",
    branch: "main",
    ...overrides,
  };
}

export function fullHistoryGit(_root, args) {
  const command = args.join(" ");
  if (command === "rev-parse --is-inside-work-tree") return { ok: true, stdout: "true" };
  if (command === "rev-parse --is-shallow-repository") return { ok: true, stdout: "false" };
  if (command === "rev-parse --verify refs/remotes/origin/main^{commit}") {
    return { ok: true, stdout: "f".repeat(40) };
  }
  if (/^rev-parse --verify [0-9a-f]{7,40}\^\{commit\}$/.test(command)) {
    return { ok: true, stdout: "a".repeat(40) };
  }
  if (command.startsWith("merge-base --is-ancestor")) return { ok: true, stdout: "" };
  return { ok: false, status: 128, stderr: `unexpected command: ${command}`, stdout: "" };
}
