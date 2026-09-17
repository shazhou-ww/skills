import { lstat, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { DEFAULT_CONFIG_NAME, SCHEMA_URL, loadConfig } from "./config.js";
import { runGit } from "./git.js";
import {
  PORTABLE_IDENTITY,
  readDefaultIdentity,
  readIdentityState,
} from "./identity.js";
import { inspectLayout } from "./layout.js";

const nodeFs = { mkdir, rm, rmdir, writeFile };

function diagnostic(code, level, path, message, remediation) {
  return { code, level, path, message, remediation };
}

function error(code, path, message, remediation) {
  return diagnostic(code, "error", path, message, remediation);
}

function displayPath(root, path) {
  return relative(root, path).replaceAll("\\", "/") || ".";
}

function escapesRoot(root, path) {
  const fromRoot = relative(root, path);
  return fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot);
}

export async function pathKind(path, inspect = lstat) {
  try {
    const metadata = await inspect(path);
    if (metadata.isDirectory()) return "directory";
    if (metadata.isFile()) return "file";
    return "other";
  } catch (caught) {
    if (caught.code === "ENOENT") return "missing";
    if (caught.code === "ENOTDIR") return "invalid-parent";
    throw caught;
  }
}

async function planDirectory({ actions, diagnostics, planned, root, path }) {
  if (planned.has(path)) return;
  const kind = await pathKind(path);
  if (kind === "directory") return;
  if (kind !== "missing") {
    diagnostics.push(
      error(
        "init.path.conflict",
        displayPath(root, path),
        `Initialization requires a directory but found ${kind}: ${displayPath(root, path)}`,
        "Move the conflicting entry or choose a different task directory.",
      ),
    );
    return;
  }
  const parent = dirname(path);
  if (!escapesRoot(root, parent) && parent !== path) {
    await planDirectory({ actions, diagnostics, planned, root, path: parent });
  }
  planned.add(path);
  actions.push({ type: "create-directory", path: displayPath(root, path), absolutePath: path });
}

async function planFile({ actions, diagnostics, root, path, content = "" }) {
  const kind = await pathKind(path);
  if (kind === "missing") {
    actions.push({ type: "write-file", path: displayPath(root, path), absolutePath: path, content });
  } else if (kind !== "file") {
    diagnostics.push(
      error(
        "init.path.conflict",
        displayPath(root, path),
        `Initialization requires a file but found ${kind}: ${displayPath(root, path)}`,
        "Move the conflicting entry before applying initialization.",
      ),
    );
  }
}

function publicChange(action) {
  return {
    action: action.type,
    path: action.path,
    ...(action.key ? { key: action.key, value: action.value } : {}),
  };
}

async function applyActions({ actions, fs, git, root, verify }) {
  const completed = [];
  try {
    for (const action of actions) {
      if (action.type === "create-directory") {
        await fs.mkdir(action.absolutePath);
      } else if (action.type === "write-file") {
        await fs.writeFile(action.absolutePath, action.content, { flag: "wx" });
      } else if (action.type === "set-git-config") {
        const result = git(root, ["config", `--${action.scope}`, action.key, action.value]);
        if (!result.ok) throw new Error(result.stderr || `Could not set ${action.key}`);
      }
      completed.push(action);
    }
    if (verify) await verify();
  } catch (caught) {
    const rollbackErrors = [];
    for (const action of completed.reverse()) {
      try {
        if (action.type === "write-file") await fs.rm(action.absolutePath, { force: true });
        else if (action.type === "create-directory") await fs.rmdir(action.absolutePath);
        else if (action.type === "set-git-config") {
          const args = action.previous === null
            ? ["config", `--${action.scope}`, "--unset", action.key]
            : ["config", `--${action.scope}`, action.key, action.previous];
          const result = git(root, args);
          if (!result.ok) throw new Error(result.stderr || `Could not restore ${action.key}`);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    caught.rollbackErrors = rollbackErrors;
    throw caught;
  }
}

export async function initRepository({
  apply = false,
  configPath = DEFAULT_CONFIG_NAME,
  fs = nodeFs,
  git = runGit,
  identity,
  root = process.cwd(),
  tasksDirectory,
} = {}) {
  const repositoryRoot = resolve(root);
  const diagnostics = [];
  const suggestedIdentity = readDefaultIdentity(repositoryRoot, git);

  const loaded = await loadConfig({ root: repositoryRoot, configPath });
  const missingConfig =
    loaded.config === null &&
    loaded.diagnostics.length === 1 &&
    loaded.diagnostics[0].code === "config.missing";
  if (!loaded.config && !missingConfig) diagnostics.push(...loaded.diagnostics);

  let config = loaded.config;
  if (config) {
    if (
      tasksDirectory !== undefined &&
      tasksDirectory !== config.tasksDirectory
    ) {
      diagnostics.push(
        error(
          "init.config.conflict",
          `${displayPath(repositoryRoot, loaded.configPath)}#tasksDirectory`,
          `Requested tasksDirectory ${tasksDirectory} conflicts with existing value ${config.tasksDirectory}.`,
          "Omit the conflicting option or update the existing configuration deliberately.",
        ),
      );
    }
  } else if (missingConfig && diagnostics.length === 0) {
    const selectedTasksDirectory = tasksDirectory ?? "tasks";
    const tasksPath = resolve(repositoryRoot, selectedTasksDirectory);
    if (
      !selectedTasksDirectory ||
      isAbsolute(selectedTasksDirectory) ||
      escapesRoot(repositoryRoot, tasksPath)
    ) {
      diagnostics.push(
        error(
          "init.tasks-directory.invalid",
          "--tasks-directory",
          "The task directory must be a non-empty repository-relative path.",
          "Use a path such as tasks.",
        ),
      );
    }
    if (diagnostics.length === 0) {
      config = {
        $schema: SCHEMA_URL,
        tasksDirectory: selectedTasksDirectory,
        schemaId: SCHEMA_URL,
      };
    }
  }

  const actions = [];
  const plannedDirectories = new Set();
  let bindsIdentity = false;
  if (config && diagnostics.length === 0) {
    if (missingConfig) {
      const configParent = dirname(loaded.configPath);
      await planDirectory({
        actions,
        diagnostics,
        planned: plannedDirectories,
        root: repositoryRoot,
        path: configParent,
      });
      const persisted = {
        $schema: SCHEMA_URL,
        tasksDirectory: config.tasksDirectory,
      };
      await planFile({
        actions,
        diagnostics,
        root: repositoryRoot,
        path: loaded.configPath,
        content: `${JSON.stringify(persisted, null, 2)}\n`,
      });
    }

    const tasksRoot = resolve(repositoryRoot, config.tasksDirectory);
    await planDirectory({
      actions,
      diagnostics,
      planned: plannedDirectories,
      root: repositoryRoot,
      path: tasksRoot,
    });
    for (const state of ["backlog", "ongoing", "archived"]) {
      const statePath = resolve(tasksRoot, state);
      await planDirectory({
        actions,
        diagnostics,
        planned: plannedDirectories,
        root: repositoryRoot,
        path: statePath,
      });
      await planFile({
        actions,
        diagnostics,
        root: repositoryRoot,
        path: resolve(statePath, ".gitkeep"),
      });
    }

    if (identity !== undefined) {
      if (!PORTABLE_IDENTITY.test(identity)) {
        diagnostics.push(
          error(
            "init.identity.invalid-name",
            "--identity",
            `Identity must use lowercase kebab-case: ${identity}`,
            "Choose an explicit portable identity such as developer-worktree.",
          ),
        );
      } else {
        const identityState = readIdentityState(repositoryRoot, git);
        if (
          identityState.resolvedIdentity &&
          (identityState.scope !== "worktree" || identityState.resolvedIdentity !== identity)
        ) {
          diagnostics.push(
            error(
              "init.identity.conflict",
              ".git/config.worktree",
              `The worktree already resolves identity ${identityState.resolvedIdentity} from ${identityState.scope ?? "an unknown scope"}.`,
              "Use the existing worktree identity or resolve the conflicting Git configuration deliberately.",
            ),
          );
        }

        if (!identityState.extensionEnabled) {
          const coreWorktree = git(repositoryRoot, ["config", "--local", "--get", "core.worktree"]);
          const coreBare = git(repositoryRoot, [
            "config",
            "--local",
            "--type=bool",
            "--get",
            "core.bare",
          ]);
          if (coreWorktree.ok && coreWorktree.stdout) {
            diagnostics.push(
              error(
                "init.worktree-config.unsafe",
                ".git/config",
                "core.worktree is set, so worktree config cannot be enabled automatically.",
                "Follow Git's extensions.worktreeConfig migration guidance manually.",
              ),
            );
          } else if (coreBare.ok && coreBare.stdout === "true") {
            diagnostics.push(
              error(
                "init.worktree-config.unsafe",
                ".git/config",
                "The repository is bare, so worktree identity cannot be initialized.",
                "Run initialization from a non-bare worktree.",
              ),
            );
          } else {
            actions.push({
              type: "set-git-config",
              path: ".git/config",
              scope: "local",
              key: "extensions.worktreeConfig",
              value: "true",
              previous: identityState.extensionValue,
            });
          }
        }

        const lane = resolve(repositoryRoot, config.tasksDirectory, "ongoing", identity);
        await planDirectory({
          actions,
          diagnostics,
          planned: plannedDirectories,
          root: repositoryRoot,
          path: lane,
        });
        await planFile({
          actions,
          diagnostics,
          root: repositoryRoot,
          path: resolve(lane, ".gitkeep"),
        });

        if (
          !identityState.identity &&
          diagnostics.every(({ level }) => level !== "error")
        ) {
          actions.push({
            type: "set-git-config",
            path: ".git/config.worktree",
            scope: "worktree",
            key: "task-ledger.identity",
            value: identity,
            previous: null,
          });
          bindsIdentity = true;
        }
      }
    }
  }

  let applied = false;
  if (apply && diagnostics.every(({ level }) => level !== "error")) {
    try {
      await applyActions({
        actions,
        fs,
        git,
        root: repositoryRoot,
        verify: async () => {
          const verifiedConfig = await loadConfig({ root: repositoryRoot, configPath });
          const verifiedLayout = verifiedConfig.config
            ? await inspectLayout({ config: verifiedConfig.config, root: repositoryRoot })
            : { diagnostics: [] };
          const verification = [...verifiedConfig.diagnostics, ...verifiedLayout.diagnostics];
          if (verification.some(({ level }) => level === "error")) {
            throw new Error(verification.map(({ code }) => code).join(", "));
          }
          if (bindsIdentity) {
            const verifiedIdentity = readIdentityState(repositoryRoot, git);
            if (
              verifiedIdentity.identity !== identity ||
              verifiedIdentity.scope !== "worktree" ||
              verifiedIdentity.resolvedIdentity !== identity
            ) {
              throw new Error("The worktree identity binding could not be verified");
            }
          }
        },
      });
      applied = true;
    } catch (caught) {
      diagnostics.push(
        error(
          "init.apply.failed",
          ".",
          `Initialization failed and was rolled back: ${caught.message}`,
          caught.rollbackErrors?.length
            ? `Resolve rollback failures: ${caught.rollbackErrors.join("; ")}`
            : "Resolve the reported conflict and rerun initialization.",
        ),
      );
    }
  }

  const ok = diagnostics.every(({ level }) => level !== "error");
  return {
    command: "init",
    mode: apply ? "apply" : "preview",
    root: repositoryRoot,
    configPath: loaded.configPath,
    schema: config?.schemaId ?? null,
    ok,
    diagnostics,
    identity: {
      requested: identity ?? null,
      suggested: suggestedIdentity,
      willBind: bindsIdentity,
    },
    changes: actions.map(publicChange),
    applied,
    nextActions: applied && actions.length === 0
      ? []
      : applied
        ? ["Review and commit the initialized repository files."]
      : ok && actions.length > 0
        ? ["Rerun with --apply to create the planned files."]
        : [],
    summary: {
      changes: actions.length,
      errors: diagnostics.filter(({ level }) => level === "error").length,
      infos: diagnostics.filter(({ level }) => level === "info").length,
      warnings: diagnostics.filter(({ level }) => level === "warning").length,
    },
  };
}