import { resolve } from "node:path";

import { loadConfig } from "./config.js";
import { taskSummary } from "./discovery.js";
import { runGit } from "./git.js";
import { readIdentityState } from "./identity.js";
import { inspectLayout } from "./layout.js";

export async function statusRepository({
  configPath,
  git = runGit,
  includeArchived = false,
  root = process.cwd(),
} = {}) {
  const repositoryRoot = resolve(root);
  const loaded = await loadConfig({ root: repositoryRoot, configPath });
  const layout = loaded.config
    ? await inspectLayout({ config: loaded.config, root: repositoryRoot })
    : { diagnostics: [], tasks: [] };
  const diagnostics = [...loaded.diagnostics, ...layout.diagnostics];
  const identityState = readIdentityState(repositoryRoot, git);
  const authoritativeIdentity =
    identityState.scope === "worktree" &&
    identityState.identity === identityState.resolvedIdentity
      ? identityState.identity
      : null;
  const tasks = layout.tasks
    .filter(({ state }) => includeArchived || state !== "archived")
    .map(taskSummary);

  return {
    command: "status",
    configPath: loaded.configPath,
    schema: loaded.config?.schemaId ?? null,
    ok: diagnostics.every(({ level }) => level !== "error"),
    root: repositoryRoot,
    diagnostics,
    identity: {
      value: authoritativeIdentity,
      scope: identityState.scope,
    },
    includeArchived,
    tasks,
    summary: {
      errors: diagnostics.filter(({ level }) => level === "error").length,
      infos: diagnostics.filter(({ level }) => level === "info").length,
      tasks: tasks.length,
      totalTasks: layout.tasks.length,
      warnings: diagnostics.filter(({ level }) => level === "warning").length,
    },
  };
}