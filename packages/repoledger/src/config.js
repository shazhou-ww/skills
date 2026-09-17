import { lstat, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export const DEFAULT_CONFIG_NAME = "repoledger.json";
export const SCHEMA_URL =
  "https://github.com/shazhou-ww/skills/raw/refs/heads/main/packages/repoledger/schema/v1.json";

const CONFIG_KEYS = new Set([
  "$schema",
  "branch",
  "remote",
  "tasksDirectory",
]);

function configDiagnostic(code, path, message, remediation) {
  return { code, level: "error", path, message, remediation };
}

function escapesRoot(root, path) {
  const pathFromRoot = relative(root, path);
  return (
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  );
}

async function resolveSchemaId(root, configPath, reference) {
  if (reference === SCHEMA_URL) return SCHEMA_URL;
  if (typeof reference !== "string" || /^[a-z][a-z0-9+.-]*:/i.test(reference)) {
    return null;
  }
  const schemaPath = resolve(dirname(configPath), reference);
  if (escapesRoot(root, schemaPath)) return null;
  try {
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));
    return schema.$id === SCHEMA_URL ? schema.$id : null;
  } catch {
    return null;
  }
}

export async function loadConfig({ root, configPath = DEFAULT_CONFIG_NAME }) {
  const absolutePath = resolve(root, configPath);
  const displayPath = relative(root, absolutePath).replaceAll("\\", "/");
  if (escapesRoot(root, absolutePath)) {
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [
        configDiagnostic(
          "config.path.outside-root",
          displayPath,
          "The repoledger configuration path must stay within the repository root.",
          "Use a configuration path relative to the repository root.",
        ),
      ],
    };
  }
  let value;

  try {
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      return {
        config: null,
        configPath: absolutePath,
        diagnostics: [
          configDiagnostic(
            "config.path.symlink",
            displayPath,
            "The repoledger configuration path must not be a symbolic link.",
            "Replace the link with a regular repository-owned configuration file.",
          ),
        ],
      };
    }
    value = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    const diagnostic =
      error.code === "ENOENT"
        ? configDiagnostic(
          "config.missing",
          displayPath,
          `Missing repoledger configuration: ${displayPath}`,
          `Create ${displayPath} from the published configuration schema.`,
        )
        : configDiagnostic(
          "config.invalid-json",
          displayPath,
          `Cannot parse repoledger configuration: ${error.message}`,
          `Fix the JSON syntax in ${displayPath}.`,
        );
    return { config: null, configPath: absolutePath, diagnostics: [diagnostic] };
  }

  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [
        configDiagnostic(
          "config.invalid-type",
          displayPath,
          "The repoledger configuration must be a JSON object.",
          `Replace ${displayPath} with an object that follows the schema.`,
        ),
      ],
    };
  }

  const diagnostics = [];
  for (const key of Object.keys(value).sort()) {
    if (!CONFIG_KEYS.has(key)) {
      diagnostics.push(
        configDiagnostic(
          "config.unknown-key",
          `${displayPath}#${key}`,
          `Unknown repoledger configuration key: ${key}`,
          `Remove ${key} or use a schema version that defines it.`,
        ),
      );
    }
  }

  const schemaId = await resolveSchemaId(root, absolutePath, value.$schema);
  if (schemaId !== SCHEMA_URL) {
    diagnostics.push(
      configDiagnostic(
        "config.unsupported-schema",
        `${displayPath}#$schema`,
        `Unsupported or unavailable repoledger schema: ${String(value.$schema)}`,
        `Reference schema/v1.json from the pinned repoledger package or use ${SCHEMA_URL}.`,
      ),
    );
  }

  const tasksDirectory = value.tasksDirectory ?? "tasks";
  const resolvedTasksDirectory =
    typeof tasksDirectory === "string" ? relative(root, resolve(root, tasksDirectory)) : "";
  if (
    typeof tasksDirectory !== "string" ||
    tasksDirectory.length === 0 ||
    isAbsolute(tasksDirectory) ||
    resolvedTasksDirectory === ".." ||
    resolvedTasksDirectory.startsWith(`..${sep}`) ||
    isAbsolute(resolvedTasksDirectory)
  ) {
    diagnostics.push(
      configDiagnostic(
        "config.invalid-tasks-directory",
        `${displayPath}#tasksDirectory`,
        "tasksDirectory must stay within the repository root.",
        "Use a non-empty repository-relative directory such as tasks.",
      ),
    );
  }

  return {
    config:
      diagnostics.length === 0
        ? { ...value, schemaId, tasksDirectory }
        : null,
    configPath: absolutePath,
    diagnostics,
  };
}
