import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, posix, relative, resolve, sep } from "node:path";

import { runGit } from "./git.js";
import { parseStrictYaml, stringifyCanonicalYaml } from "./yaml.js";

export const DEFAULT_CONFIG_NAME = "repoledger.yaml";

const CONFIG_KEYS = ["version", "tasksDirectory", "remote", "primaryBranch"];
const REMOTE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

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

export function validTasksDirectory(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value === "." ||
    isAbsolute(value) ||
    value.includes("\\")
  ) {
    return false;
  }
  const normalized = posix.normalize(value);
  return (
    normalized === value &&
    normalized !== ".." &&
    !normalized.startsWith("../") &&
    !normalized.endsWith("/")
  );
}

export async function safeTasksPath(root, value) {
  if (!validTasksDirectory(value)) return false;
  let current = root;
  for (const segment of value.split("/")) {
    current = resolve(current, segment);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) return false;
      if (!metadata.isDirectory()) return false;
    } catch (caught) {
      if (caught.code === "ENOENT") return true;
      throw caught;
    }
  }
  return true;
}

export function validRemote(value) {
  return (
    typeof value === "string" &&
    REMOTE_PATTERN.test(value) &&
    !value.includes("..") &&
    !value.endsWith(".lock")
  );
}

export function validPrimaryBranch(root, value) {
  if (
    typeof value !== "string" ||
    value.startsWith("refs/") ||
    value.includes("/") && value.startsWith("remotes/")
  ) {
    return false;
  }
  return runGit(root, ["check-ref-format", "--branch", value]).ok;
}

export function serializeConfig(config) {
  return stringifyCanonicalYaml({
    version: config.version,
    tasksDirectory: config.tasksDirectory,
    remote: config.remote,
    primaryBranch: config.primaryBranch,
  });
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
          "Use repoledger.yaml at the repository root.",
        ),
      ],
    };
  }

  let source;
  try {
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw Object.assign(new Error("Configuration must be a regular file"), {
        code: "EINVAL",
      });
    }
    source = await readFile(absolutePath, "utf8");
  } catch (error) {
    const missing = error.code === "ENOENT";
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [
        configDiagnostic(
          missing ? "config.missing" : "config.invalid-file",
          displayPath,
          missing
            ? `Missing repoledger configuration: ${displayPath}`
            : `Cannot read repoledger configuration: ${error.message}`,
          missing
            ? `Create ${DEFAULT_CONFIG_NAME} at the repository root.`
            : `Replace ${displayPath} with a regular repository-owned file.`,
        ),
      ],
    };
  }

  let value;
  const normalizedSource = source.replaceAll("\r\n", "\n");
  try {
    value = parseStrictYaml(normalizedSource);
  } catch (error) {
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [
        configDiagnostic(
          "config.invalid-yaml",
          displayPath,
          `Cannot parse repoledger configuration: ${error.message}`,
          `Use the strict YAML contract in ${DEFAULT_CONFIG_NAME}.`,
        ),
      ],
    };
  }

  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [
        configDiagnostic(
          "config.invalid-type",
          displayPath,
          "The repoledger configuration must be a YAML mapping.",
          `Replace ${displayPath} with the documented mapping.`,
        ),
      ],
    };
  }

  const diagnostics = [];
  for (const key of Object.keys(value).sort()) {
    if (!CONFIG_KEYS.includes(key)) {
      diagnostics.push(
        configDiagnostic(
          "config.unknown-key",
          `${displayPath}#${key}`,
          `Unknown repoledger configuration key: ${key}`,
          `Remove ${key}.`,
        ),
      );
    }
  }

  for (const [key, code] of [
    ["version", "config.missing-version"],
    ["tasksDirectory", "config.missing-tasks-directory"],
    ["remote", "config.missing-remote"],
    ["primaryBranch", "config.missing-primary-branch"],
  ]) {
    if (!Object.hasOwn(value, key)) {
      diagnostics.push(
        configDiagnostic(code, `${displayPath}#${key}`, `Missing required key: ${key}`, `Add ${key} to ${displayPath}.`),
      );
    }
  }

  if (Object.hasOwn(value, "version") && value.version !== 1) {
    diagnostics.push(
      configDiagnostic(
        "config.unsupported-version",
        `${displayPath}#version`,
        `Unsupported repoledger version: ${String(value.version)}`,
        "Use version: 1.",
      ),
    );
  }
  if (
    Object.hasOwn(value, "tasksDirectory") &&
    !(await safeTasksPath(root, value.tasksDirectory))
  ) {
    diagnostics.push(
      configDiagnostic(
        "config.invalid-tasks-directory",
        `${displayPath}#tasksDirectory`,
        "tasksDirectory must be a normalized repository-relative directory.",
        "Use a path such as tasks without backslashes, trailing slashes, or parent traversal.",
      ),
    );
  }
  if (Object.hasOwn(value, "remote") && !validRemote(value.remote)) {
    diagnostics.push(
      configDiagnostic(
        "config.invalid-remote",
        `${displayPath}#remote`,
        "remote must be a safe Git remote name.",
        "Use a name such as origin.",
      ),
    );
  }
  if (
    Object.hasOwn(value, "primaryBranch") &&
    !validPrimaryBranch(root, value.primaryBranch)
  ) {
    diagnostics.push(
      configDiagnostic(
        "config.invalid-primary-branch",
        `${displayPath}#primaryBranch`,
        "primaryBranch must be a valid short Git branch name.",
        "Use a branch such as main without refs/ or remote prefixes.",
      ),
    );
  }

  if (diagnostics.length === 0 && serializeConfig(value) !== normalizedSource) {
    diagnostics.push(
      configDiagnostic(
        "config.noncanonical",
        displayPath,
        "The repoledger configuration is valid but not canonical.",
        "Rewrite properties in version, tasksDirectory, remote, primaryBranch order with LF endings.",
      ),
    );
  }

  return {
    config: diagnostics.length === 0 ? value : null,
    configPath: absolutePath,
    diagnostics,
  };
}
