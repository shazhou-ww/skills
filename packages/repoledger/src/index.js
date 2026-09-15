import { resolve } from "node:path";

import { loadConfig } from "./config.js";
import { inspectTaskContents } from "./content.js";
import { inspectHistory } from "./history.js";
import { inspectLayout } from "./layout.js";

export async function checkRepository({
  configPath,
  git,
  root = process.cwd(),
} = {}) {
  const repositoryRoot = resolve(root);
  const loaded = await loadConfig({ root: repositoryRoot, configPath });
  const layout = loaded.config
    ? await inspectLayout({ config: loaded.config, root: repositoryRoot })
    : { diagnostics: [], tasks: [] };
  const contents = loaded.config
    ? await inspectTaskContents({
      root: repositoryRoot,
      tasks: layout.tasks,
    })
    : { diagnostics: [] };
  const history = loaded.config
    ? await inspectHistory({
      config: loaded.config,
      git,
      root: repositoryRoot,
      tasks: layout.tasks,
    })
    : { capability: "unavailable", diagnostics: [], remoteRef: null };
  const diagnostics = [
    ...loaded.diagnostics,
    ...layout.diagnostics,
    ...contents.diagnostics,
    ...history.diagnostics,
  ];

  return {
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
      tasks: layout.tasks.length,
      warnings: diagnostics.filter(({ level }) => level === "warning").length,
    },
  };
}
