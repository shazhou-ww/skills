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
  if (args[0] === "log" && args.includes("-G")) {
    const pattern = args[args.indexOf("-G") + 1];
    return {
      ok: true,
      stdout: pattern.includes("Implementation complete")
        ? "b".repeat(40)
        : "a".repeat(40),
    };
  }
  if (command.startsWith("merge-base --is-ancestor")) return { ok: true, stdout: "" };
  return { ok: false, status: 128, stderr: `unexpected command: ${command}`, stdout: "" };
}
