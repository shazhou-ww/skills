import { resolve } from "node:path";

import { loadConfig } from "./config.js";
import { inspectTaskContents } from "./content.js";
import { selectTask } from "./discovery.js";
import { inspectHistory } from "./history.js";
import { inspectLayout } from "./layout.js";

export async function checkRepository({
  configPath,
  git,
  root = process.cwd(),
  taskName,
} = {}) {
  const repositoryRoot = resolve(root);
  const loaded = await loadConfig({ root: repositoryRoot, configPath });
  const layout = loaded.config
    ? await inspectLayout({ config: loaded.config, root: repositoryRoot })
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
  const history = loaded.config
    ? await inspectHistory({
      config: loaded.config,
      git,
      root: repositoryRoot,
      tasks: selected.selected,
    })
    : { capability: "unavailable", diagnostics: [], remoteRef: null };
  const diagnostics = [
    ...loaded.diagnostics,
    ...layout.diagnostics,
    ...selected.diagnostics,
    ...contents.diagnostics,
    ...history.diagnostics,
  ];

  const report = {
    command: "check",
    capabilities: {
      history: history.capability,
      remoteRef: history.remoteRef ?? null,
    },
    configPath: loaded.configPath,
    schema: loaded.config?.schemaId ?? null,
    ok: diagnostics.every(({ level }) => level !== "error"),
    root: repositoryRoot,
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
