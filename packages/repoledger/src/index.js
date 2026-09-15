import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const STATUS_DIRECTORIES = ["backlog", "ongoing", "archived"];

export async function checkRepository({ root = process.cwd() } = {}) {
  const repositoryRoot = resolve(root);
  const diagnostics = [];

  for (const status of STATUS_DIRECTORIES) {
    const relativePath = `tasks/${status}`;
    try {
      await access(resolve(repositoryRoot, relativePath), constants.R_OK);
    } catch {
      diagnostics.push({
        code: "layout.status.missing",
        level: "error",
        path: relativePath,
        message: `Missing canonical task status directory: ${relativePath}`,
        remediation: `Create ${relativePath} before using the task ledger.`,
      });
    }
  }

  return {
    command: "check",
    ok: diagnostics.every(({ level }) => level !== "error"),
    root: repositoryRoot,
    diagnostics,
    summary: {
      errors: diagnostics.filter(({ level }) => level === "error").length,
      warnings: diagnostics.filter(({ level }) => level === "warning").length,
    },
  };
}
