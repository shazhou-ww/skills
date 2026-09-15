import { resolve } from "node:path";

import { checkRepository } from "./index.js";
import { loadConfig } from "./config.js";
import { runGit } from "./git.js";

const PORTABLE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function diagnostic(code, level, path, message, remediation) {
  return { code, level, path, message, remediation };
}

function error(code, path, message, remediation) {
  return diagnostic(code, "error", path, message, remediation);
}

function warning(code, path, message, remediation) {
  return diagnostic(code, "warning", path, message, remediation);
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
  offline = false,
  root = process.cwd(),
} = {}) {
  const repositoryRoot = resolve(root);
  const loaded = await loadConfig({ root: repositoryRoot, configPath });
  const diagnostics = [];
  let defaultIdentity = null;
  let identity = null;
  let remoteFreshness = "unavailable";

  if (loaded.config) {
    const config = loaded.config;
    const inside = git(repositoryRoot, ["rev-parse", "--is-inside-work-tree"]);
    if (!inside.ok || inside.stdout !== "true") {
      diagnostics.push(
        error(
          "doctor.git.unavailable",
          ".git",
          "The configured root is not a Git worktree.",
          "Run doctor inside the repository worktree or pass its root with --root.",
        ),
      );
    } else {
      const extension = git(repositoryRoot, [
        "config",
        "--local",
        "--type=bool",
        "--get",
        "extensions.worktreeConfig",
      ]);
      if (!extension.ok || extension.stdout !== "true") {
        diagnostics.push(
          error(
            "doctor.worktree-config.disabled",
            ".git/config",
            "extensions.worktreeConfig is not enabled.",
            "Follow the task-ledger core.worktree/core.bare safety checks before enabling worktree config.",
          ),
        );
      }

      const binding = git(repositoryRoot, [
        "config",
        "--worktree",
        "--get",
        "task-ledger.identity",
      ]);
      if (!binding.ok || !binding.stdout) {
        diagnostics.push(
          error(
            "doctor.identity.missing",
            ".git/config.worktree",
            "The worktree has no authoritative task-ledger.identity binding.",
            "Register an identity lane, then bind this worktree explicitly; do not fall back to the device default.",
          ),
        );
      } else {
        identity = binding.stdout;
        if (!PORTABLE_NAME.test(identity)) {
          diagnostics.push(
            error(
              "doctor.identity.invalid-name",
              ".git/config.worktree",
              `Worktree identity must use lowercase kebab-case: ${identity}`,
              "Choose and explicitly bind a registered portable identity.",
            ),
          );
        }
      }

      const origin = git(repositoryRoot, [
        "config",
        "--show-origin",
        "--show-scope",
        "--get",
        "task-ledger.identity",
      ]);
      const originMatch = /^(\S+)\s+(\S+)\s+(.+)$/.exec(origin.stdout);
      if (
        !origin.ok ||
        originMatch?.[1] !== "worktree" ||
        originMatch?.[3] !== identity
      ) {
        diagnostics.push(
          error(
            "doctor.identity.invalid-scope",
            ".git/config.worktree",
            "task-ledger.identity does not resolve from worktree-scoped Git configuration.",
            "Write the binding with git config --worktree after its remote lane is registered.",
          ),
        );
      }

      const deviceDefault = git(repositoryRoot, [
        "config",
        "--global",
        "--get",
        "task-ledger.defaultIdentity",
      ]);
      if (deviceDefault.ok && deviceDefault.stdout) {
        defaultIdentity = deviceDefault.stdout;
        if (!PORTABLE_NAME.test(defaultIdentity)) {
          diagnostics.push(
            error(
              "doctor.default-identity.invalid-name",
              "global Git config",
              `Device default identity must use lowercase kebab-case: ${defaultIdentity}`,
              "Correct or remove task-ledger.defaultIdentity; it is only an initialization suggestion.",
            ),
          );
        }
      }

      const branch = git(repositoryRoot, ["check-ref-format", "--branch", config.branch]);
      if (!branch.ok) {
        diagnostics.push(
          error(
            "doctor.branch.invalid",
            "repoledger.json#branch",
            `Configured branch is not a valid Git branch name: ${config.branch}`,
            "Correct the shared primary branch in repoledger.json.",
          ),
        );
      }

      if (offline) {
        remoteFreshness = "offline";
        diagnostics.push(
          warning(
            "doctor.remote.offline",
            `${config.remote}/${config.branch}`,
            "Offline mode skipped the required remote refresh.",
            "Run doctor without --offline before claiming or resuming task work.",
          ),
        );
      } else {
        const fetched = git(repositoryRoot, ["fetch", config.remote, config.branch]);
        if (fetched.ok) {
          remoteFreshness = "refreshed";
        } else {
          diagnostics.push(
            error(
              "doctor.remote.fetch-failed",
              `${config.remote}/${config.branch}`,
              `Could not refresh ${config.remote}/${config.branch}.`,
              "Restore network and repository access, then rerun doctor.",
            ),
          );
        }
      }

      if (identity && PORTABLE_NAME.test(identity)) {
        const lane = `${config.remote}/${config.branch}:${config.tasksDirectory}/ongoing/${identity}/.gitkeep`;
        const registered = git(repositoryRoot, ["cat-file", "-e", lane]);
        if (!registered.ok) {
          diagnostics.push(
            error(
              "doctor.identity.unregistered",
              `${config.tasksDirectory}/ongoing/${identity}/.gitkeep`,
              `Identity ${identity} is not registered on ${config.remote}/${config.branch}.`,
              "Publish the identity lane before binding or using it for task work.",
            ),
          );
        }
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
    offline,
    ok: combined.every(({ level }) => level !== "error"),
    remoteFreshness,
    summary: summarize(combined, checked.summary.tasks),
  };
}
