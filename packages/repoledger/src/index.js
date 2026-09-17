import { resolve } from "node:path";

import { loadConfig } from "./config.js";
import { inspectTaskContents } from "./content.js";
import { selectTask } from "./discovery.js";
import { runGit } from "./git.js";
import { effectiveIdentity, readIdentityState } from "./identity.js";
import { inspectLayout } from "./layout.js";

export async function checkRepository({
  configPath,
  git = runGit,
  includeAllIdentities = false,
  includeArchived = false,
  root = process.cwd(),
  taskName,
} = {}) {
  const repositoryRoot = resolve(root);
  const loaded = await loadConfig({ root: repositoryRoot, configPath });
  const identityState = readIdentityState(repositoryRoot, git);
  const identity = effectiveIdentity(identityState);
  const layout = loaded.config
    ? await inspectLayout({
        checkDuplicatePositions: false,
        config: loaded.config,
        includeArchived,
        ongoingIdentities: includeAllIdentities
          ? null
          : new Set(identity ? [identity] : []),
        root: repositoryRoot,
      })
    : { diagnostics: [], tasks: [] };
  const selected =
    loaded.config && taskName
      ? selectTask(layout.tasks, taskName)
      : { diagnostics: [], selected: layout.tasks, selection: null };
  const contents = loaded.config
    ? await inspectTaskContents({
      root: repositoryRoot,
      tasks: selected.selected,
    })
    : { diagnostics: [] };
  const diagnostics = [
    ...loaded.diagnostics,
    ...layout.diagnostics,
    ...selected.diagnostics,
    ...contents.diagnostics,
  ];

  const report = {
    command: "check",
    configPath: loaded.configPath,
    schema: loaded.config?.schemaId ?? null,
    ok: diagnostics.every(({ level }) => level !== "error"),
    root: repositoryRoot,
    scope: {
      includeAllIdentities,
      includeArchived,
      identity,
      identityScope: identityState.scope,
    },
    diagnostics,
    summary: {
      errors: diagnostics.filter(({ level }) => level === "error").length,
      infos: diagnostics.filter(({ level }) => level === "info").length,
      tasks: selected.selected.length,
      warnings: diagnostics.filter(({ level }) => level === "warning").length,
    },
  };
  if (taskName) {
    report.selection = selected.selection ?? {
      checked: 0,
      matches: 0,
      name: taskName,
    };
    report.summary.totalTasks = layout.tasks.length;
  }
  return report;
}

export { initRepository } from "./init.js";
export { statusRepository } from "./status.js";
export { transitionRepository } from "./transitions.js";
