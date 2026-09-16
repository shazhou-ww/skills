function error(code, path, message, remediation) {
  return { code, level: "error", path, message, remediation };
}

export function selectTask(tasks, name) {
  const matches = tasks.filter((task) => task.name === name);
  const diagnostics = [];

  if (matches.length === 0) {
    diagnostics.push(
      error(
        "task.selection.missing",
        name,
        `Task ${name} does not exist in the repository ledger.`,
        "Choose a task name reported by repoledger status.",
      ),
    );
  } else if (matches.length > 1) {
    diagnostics.push(
      error(
        "task.selection.ambiguous",
        matches.map(({ relativePath }) => relativePath).join(", "),
        `Task ${name} appears in ${matches.length} ledger positions.`,
        "Reconcile the duplicate positions before running a focused check.",
      ),
    );
  }

  return {
    diagnostics,
    selected: matches.length === 1 ? matches : [],
    selection: {
      checked: matches.length === 1 ? 1 : 0,
      matches: matches.length,
      name,
    },
  };
}

export function taskSummary(task) {
  return {
    name: task.name,
    state: task.state,
    identity: task.identity ?? null,
    path: task.relativePath,
  };
}