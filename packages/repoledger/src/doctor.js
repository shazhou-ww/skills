import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

import { checkRepository } from "./index.js";
import { loadConfig } from "./config.js";
import { runGit } from "./git.js";
import {
  PORTABLE_IDENTITY,
  readDefaultIdentity,
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
  let defaultIdentity = null;
  let identity = null;

  if (loaded.config) {
    const config = loaded.config;
    const identityState = readIdentityState(repositoryRoot, git);
    if (!identityState.extensionEnabled) {
      diagnostics.push(
        error(
          "doctor.worktree-config.disabled",
          ".git/config",
          "extensions.worktreeConfig is not enabled.",
          "Enable worktree config before binding a repoledger identity.",
        ),
      );
    }

    if (!identityState.identity) {
      diagnostics.push(
        error(
          "doctor.identity.missing",
          ".git/config.worktree",
          "The worktree has no authoritative task-ledger.identity binding.",
          "Run repoledger init --identity <identity> --apply for this worktree.",
        ),
      );
    } else {
      identity = identityState.identity;
      if (!PORTABLE_IDENTITY.test(identity)) {
        diagnostics.push(
          error(
            "doctor.identity.invalid-name",
            ".git/config.worktree",
            `Worktree identity must use lowercase kebab-case: ${identity}`,
            "Choose and explicitly bind a portable identity.",
          ),
        );
      }

      if (
        identityState.scope !== "worktree" ||
        identityState.resolvedIdentity !== identity
      ) {
        diagnostics.push(
          error(
            "doctor.identity.invalid-scope",
            ".git/config.worktree",
            "task-ledger.identity does not resolve from worktree-scoped Git configuration.",
            "Write the binding with git config --worktree.",
          ),
        );
      }
    }

    defaultIdentity = readDefaultIdentity(repositoryRoot, git);
    if (defaultIdentity && !PORTABLE_IDENTITY.test(defaultIdentity)) {
      diagnostics.push(
        error(
          "doctor.default-identity.invalid-name",
          "global Git config",
          `Device default identity must use lowercase kebab-case: ${defaultIdentity}`,
          "Correct or remove task-ledger.defaultIdentity; it is only an initialization suggestion.",
        ),
      );
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
    defaultIdentity,
    diagnostics: combined,
    identity,
    ok: combined.every(({ level }) => level !== "error"),
    summary: summarize(combined, checked.summary.tasks),
  };
}
