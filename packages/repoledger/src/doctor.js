import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

import { checkRepository } from "./index.js";
import { loadConfig } from "./config.js";
import { runGit } from "./git.js";
import {
  effectiveIdentity,
  PORTABLE_IDENTITY,
  readIdentityState,
} from "./identity.js";

function diagnostic(code, level, path, message, remediation) {
  return { code, level, path, message, remediation };
}

function error(code, path, message, remediation) {
  return diagnostic(code, "error", path, message, remediation);
}

function summarize(diagnostics, tasks) {
  return {
    errors: diagnostics.filter(({ level }) => level === "error").length,
    infos: diagnostics.filter(({ level }) => level === "info").length,
    tasks,
    warnings: diagnostics.filter(({ level }) => level === "warning").length,
  };
}

export async function doctorRepository({
  configPath,
  git = runGit,
  root = process.cwd(),
} = {}) {
  const repositoryRoot = resolve(root);
  const loaded = await loadConfig({ root: repositoryRoot, configPath });
  const diagnostics = [];
  let identity = null;

  if (loaded.config) {
    const config = loaded.config;
    const identityState = readIdentityState(repositoryRoot, git);
    identity = effectiveIdentity(identityState);

    if (!identityState.identity) {
      diagnostics.push(
        error(
          "doctor.identity.missing",
          "Git config",
          "No task-ledger.identity is configured.",
          "Configure task-ledger.identity globally or for this worktree.",
        ),
      );
    } else if (!identity) {
      diagnostics.push(
        error(
          "doctor.identity.invalid-scope",
          identityState.origin ?? "Git config",
          `task-ledger.identity resolves from unsupported ${identityState.scope ?? "unknown"} scope.`,
          "Configure task-ledger.identity in global or worktree Git config.",
        ),
      );
    } else {
      if (!PORTABLE_IDENTITY.test(identity)) {
        diagnostics.push(
          error(
            "doctor.identity.invalid-name",
            identityState.origin ?? "Git config",
            `Identity must use lowercase kebab-case: ${identity}`,
            "Configure a portable global or worktree identity.",
          ),
        );
      }
    }

    if (identity && PORTABLE_IDENTITY.test(identity)) {
      const lane = resolve(
        repositoryRoot,
        config.tasksDirectory,
        "ongoing",
        identity,
      );
      try {
        if (!(await lstat(lane)).isDirectory()) throw new Error("not a directory");
      } catch {
        diagnostics.push(
          error(
            "doctor.identity.lane-missing",
            `${config.tasksDirectory}/ongoing/${identity}`,
            `The local identity lane does not exist: ${identity}.`,
            `Create ${config.tasksDirectory}/ongoing/${identity}/.gitkeep locally.`,
          ),
        );
      }
    }
  }

  const checked = await checkRepository({
    configPath,
    git,
    root: repositoryRoot,
  });
  const combined = [...checked.diagnostics, ...diagnostics];
  return {
    ...checked,
    command: "doctor",
    diagnostics: combined,
    identity,
    ok: combined.every(({ level }) => level !== "error"),
    summary: summarize(combined, checked.summary.tasks),
  };
}
