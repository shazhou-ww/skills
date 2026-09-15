import { readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const PORTABLE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUS_DIRECTORIES = ["backlog", "ongoing", "archived"];

function toPath(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

function error(code, path, message, remediation) {
  return { code, level: "error", path, message, remediation };
}

async function directoryEntries(path) {
  try {
    const metadata = await stat(path);
    if (!metadata.isDirectory()) return { entries: null, kind: "not-directory" };
    const entries = await readdir(path, { withFileTypes: true });
    return {
      entries: entries
        .filter(({ name }) => !name.startsWith("."))
        .sort((left, right) => left.name.localeCompare(right.name)),
      kind: "directory",
    };
  } catch (caught) {
    if (caught.code === "ENOENT") return { entries: null, kind: "missing" };
    throw caught;
  }
}

function validatePortableName({ diagnostics, kind, name, path }) {
  if (!PORTABLE_NAME.test(name)) {
    diagnostics.push(
      error(
        `${kind}.invalid-name`,
        path,
        `${kind === "identity" ? "Identity" : "Task"} names must use lowercase kebab-case: ${name}`,
        `Rename ${name} to a portable lowercase kebab-case name.`,
      ),
    );
  }
}

async function collectTaskEntries({ diagnostics, root, state, statePath }) {
  const result = await directoryEntries(statePath);
  if (result.kind !== "directory") return [];
  const tasks = [];

  for (const entry of result.entries) {
    const path = resolve(statePath, entry.name);
    const displayPath = toPath(root, path);
    if (!entry.isDirectory()) {
      diagnostics.push(
        error(
          "task.not-directory",
          displayPath,
          `Every ${state} entry must be a task directory: ${displayPath}`,
          `Move or remove the non-directory entry at ${displayPath}.`,
        ),
      );
      continue;
    }
    validatePortableName({ diagnostics, kind: "task", name: entry.name, path: displayPath });
    tasks.push({ name: entry.name, path, relativePath: displayPath, state });
  }

  return tasks;
}

async function collectOngoingTasks({ diagnostics, root, statePath }) {
  const result = await directoryEntries(statePath);
  if (result.kind !== "directory") return [];
  const tasks = [];

  for (const identity of result.entries) {
    const identityPath = resolve(statePath, identity.name);
    const displayIdentityPath = toPath(root, identityPath);
    if (!identity.isDirectory()) {
      diagnostics.push(
        error(
          "identity.not-directory",
          displayIdentityPath,
          `Every ongoing entry must be an identity directory: ${displayIdentityPath}`,
          `Move or remove the non-directory entry at ${displayIdentityPath}.`,
        ),
      );
      continue;
    }

    validatePortableName({
      diagnostics,
      kind: "identity",
      name: identity.name,
      path: displayIdentityPath,
    });

    try {
      const marker = await stat(resolve(identityPath, ".gitkeep"));
      if (!marker.isFile()) throw new Error("not a file");
    } catch {
      diagnostics.push(
        error(
          "identity.marker.missing",
          `${displayIdentityPath}/.gitkeep`,
          `Identity lane ${identity.name} is missing its .gitkeep marker.`,
          `Add ${displayIdentityPath}/.gitkeep and publish the registration.`,
        ),
      );
    }

    const identityTasks = await collectTaskEntries({
      diagnostics,
      root,
      state: "ongoing",
      statePath: identityPath,
    });
    tasks.push(
      ...identityTasks.map((task) => ({ ...task, identity: identity.name })),
    );
  }

  return tasks;
}

export async function inspectLayout({ config, root }) {
  const diagnostics = [];
  const tasksRoot = resolve(root, config.tasksDirectory);
  const rootResult = await directoryEntries(tasksRoot);

  if (rootResult.kind !== "directory") {
    diagnostics.push(
      error(
        rootResult.kind === "missing" ? "layout.tasks.missing" : "layout.tasks.not-directory",
        config.tasksDirectory,
        `Configured task path is not a directory: ${config.tasksDirectory}`,
        `Create the task ledger directory at ${config.tasksDirectory}.`,
      ),
    );
    return { diagnostics, tasks: [] };
  }

  for (const entry of rootResult.entries) {
    if (entry.isDirectory() && !STATUS_DIRECTORIES.includes(entry.name)) {
      diagnostics.push(
        error(
          "layout.status.unexpected",
          `${config.tasksDirectory}/${entry.name}`,
          `Unexpected task status directory: ${entry.name}`,
          "Move its tasks into backlog, ongoing, or archived and remove the directory.",
        ),
      );
    }
  }

  const statePaths = Object.fromEntries(
    STATUS_DIRECTORIES.map((state) => [state, resolve(tasksRoot, state)]),
  );
  for (const state of STATUS_DIRECTORIES) {
    const result = await directoryEntries(statePaths[state]);
    if (result.kind !== "directory") {
      const path = `${config.tasksDirectory}/${state}`;
      diagnostics.push(
        error(
          result.kind === "missing" ? "layout.status.missing" : "layout.status.not-directory",
          path,
          `Missing canonical task status directory: ${path}`,
          `Create ${path} before using the task ledger.`,
        ),
      );
    }
  }

  const tasks = [
    ...(await collectTaskEntries({
      diagnostics,
      root,
      state: "backlog",
      statePath: statePaths.backlog,
    })),
    ...(await collectOngoingTasks({ diagnostics, root, statePath: statePaths.ongoing })),
    ...(await collectTaskEntries({
      diagnostics,
      root,
      state: "archived",
      statePath: statePaths.archived,
    })),
  ];

  const positions = new Map();
  for (const task of tasks) {
    const paths = positions.get(task.name) ?? [];
    paths.push(task.relativePath);
    positions.set(task.name, paths);
  }
  for (const [name, paths] of positions) {
    if (paths.length > 1) {
      diagnostics.push(
        error(
          "task.duplicate-position",
          paths.join(", "),
          `Task ${name} appears in ${paths.length} ledger positions.`,
          "Preserve one canonical task directory and reconcile the duplicates without discarding work.",
        ),
      );
    }
  }

  return { diagnostics, tasks };
}
