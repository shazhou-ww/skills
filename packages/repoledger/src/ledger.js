import { parseStrictYaml } from "./yaml.js";

export const STATUS_FILE_NAME = "status.yaml";
export const TASK_STATES = ["backlog", "ongoing", "completed", "abandoned"];

const PORTABLE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const STATUS_KEYS = new Set(["version", "tasks"]);
const RECORD_KEYS = new Set(["state", "createdAt", "updatedAt"]);
const TRANSITIONS = new Map([
  ["backlog", new Set(["ongoing", "abandoned"])],
  ["ongoing", new Set(["completed", "abandoned"])],
  ["completed", new Set()],
  ["abandoned", new Set()],
]);

export function isTaskName(value) {
  return typeof value === "string" && PORTABLE_NAME.test(value);
}

function statusError(message) {
  return new Error(`Invalid task status: ${message}`);
}

function isMapping(value) {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

export function isTimestamp(value) {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value.replace("Z", ".000Z");
}

function validateRecord(name, record) {
  if (!isTaskName(name)) {
    throw statusError(`task name must use lowercase kebab-case: ${name}`);
  }
  if (!isMapping(record)) {
    throw statusError(`record for ${name} must be a mapping`);
  }
  for (const key of Object.keys(record)) {
    if (!RECORD_KEYS.has(key)) {
      throw statusError(`unknown field ${key} for ${name}`);
    }
  }
  for (const key of RECORD_KEYS) {
    if (!Object.hasOwn(record, key)) {
      throw statusError(`missing ${key} for ${name}`);
    }
  }
  if (!TASK_STATES.includes(record.state)) {
    throw statusError(`invalid state for ${name}: ${String(record.state)}`);
  }
  if (!isTimestamp(record.createdAt) || !isTimestamp(record.updatedAt)) {
    throw statusError(`invalid timestamp for ${name}`);
  }
  if (record.createdAt > record.updatedAt) {
    throw statusError(`timestamp createdAt must not be later than updatedAt for ${name}`);
  }
}

export function validateStatusFile(value) {
  if (!isMapping(value)) throw statusError("document must be a mapping");
  for (const key of Object.keys(value)) {
    if (!STATUS_KEYS.has(key)) throw statusError(`unknown top-level field: ${key}`);
  }
  if (value.version !== 1) throw statusError("version must be 1");
  if (!isMapping(value.tasks)) throw statusError("tasks must be a mapping");
  for (const [name, record] of Object.entries(value.tasks)) {
    validateRecord(name, record);
  }
  return value;
}

export function serializeStatusFile(value) {
  validateStatusFile(value);
  const names = Object.keys(value.tasks).sort();
  if (names.length === 0) return "version: 1\ntasks: {}\n";

  const lines = ["version: 1", "tasks:"];
  for (const name of names) {
    const record = value.tasks[name];
    lines.push(
      `  ${name}:`,
      `    state: ${record.state}`,
      `    createdAt: \"${record.createdAt}\"`,
      `    updatedAt: \"${record.updatedAt}\"`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function parseStatusFile(source) {
  const normalizedSource = source.replaceAll("\r\n", "\n");
  let value;
  try {
    value = parseStrictYaml(normalizedSource);
  } catch (error) {
    throw statusError(error.message);
  }
  validateStatusFile(value);
  if (serializeStatusFile(value) !== normalizedSource) {
    throw statusError("status.yaml is not canonical");
  }
  return value;
}

export function formatTimestamp(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    throw statusError("invalid current timestamp");
  }
  return date.toISOString().replace(".000Z", "Z");
}

export function nextTimestamp(previous, now = new Date()) {
  if (!isTimestamp(previous)) throw statusError("invalid previous timestamp");
  const currentSecond = new Date(Math.floor(now.valueOf() / 1000) * 1000);
  const minimum = new Date(new Date(previous).valueOf() + 1000);
  return formatTimestamp(currentSecond > minimum ? currentSecond : minimum);
}

export function createRecord(now = new Date()) {
  const timestamp = formatTimestamp(new Date(Math.floor(now.valueOf() / 1000) * 1000));
  return { state: "backlog", createdAt: timestamp, updatedAt: timestamp };
}

export function transitionRecord(record, targetState, now = new Date()) {
  validateRecord("task", record);
  if (!TRANSITIONS.get(record.state)?.has(targetState)) {
    throw statusError(`illegal transition from ${record.state} to ${targetState}`);
  }
  return {
    state: targetState,
    createdAt: record.createdAt,
    updatedAt: nextTimestamp(record.updatedAt, now),
  };
}
