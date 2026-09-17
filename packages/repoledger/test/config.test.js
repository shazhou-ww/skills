import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { loadConfig, SCHEMA_URL } from "../src/config.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function writeConfig(value) {
  const root = await mkdtemp(join(tmpdir(), "repoledger-config-"));
  temporaryDirectories.push(root);
  await writeFile(join(root, "repoledger.json"), JSON.stringify(value));
  return root;
}

test("uses the GitHub schema URL as the sole contract version", async () => {
  const root = await writeConfig({ $schema: SCHEMA_URL });

  const loaded = await loadConfig({ root });

  assert.deepEqual(loaded.diagnostics, []);
  assert.equal(loaded.config.$schema, SCHEMA_URL);
  assert.equal(loaded.config.tasksDirectory, "tasks");
});

test("rejects an unsupported schema and removed policy fields", async () => {
  const root = await writeConfig({
    $schema: "https://example.com/schema.json",
    remote: "origin",
    branch: "main",
    contractVersion: 1,
    history: "available",
    linkConvention: "relative",
  });

  const loaded = await loadConfig({ root });
  const codes = loaded.diagnostics.map(({ code }) => code);

  assert.equal(loaded.config, null);
  assert.equal(codes.filter((code) => code === "config.unknown-key").length, 3);
  assert.ok(codes.includes("config.unsupported-schema"));
});

test("resolves a local pinned schema to its canonical GitHub ID", async () => {
  const root = await writeConfig({
    $schema: "./schema/v1.json",
    remote: "origin",
    branch: "main",
  });
  await mkdir(join(root, "schema"));
  await writeFile(
    join(root, "schema", "v1.json"),
    JSON.stringify({ $id: SCHEMA_URL }),
  );

  const loaded = await loadConfig({ root });

  assert.deepEqual(loaded.diagnostics, []);
  assert.equal(loaded.config.schemaId, SCHEMA_URL);
});

test("rejects config and local schema paths outside the repository", async () => {
  const root = await writeConfig({
    $schema: "../schema.json",
    remote: "origin",
    branch: "main",
  });

  const schemaEscape = await loadConfig({ root });
  const configEscape = await loadConfig({ root, configPath: "../repoledger.json" });

  assert.ok(
    schemaEscape.diagnostics.some(({ code }) => code === "config.unsupported-schema"),
  );
  assert.equal(configEscape.diagnostics[0].code, "config.path.outside-root");
});

test("rejects paths outside the repository without validating legacy transport fields", async () => {
  const root = await writeConfig({
    $schema: SCHEMA_URL,
    remote: "-origin",
    branch: "feature branch",
    tasksDirectory: "../tasks",
  });

  const loaded = await loadConfig({ root });
  const codes = loaded.diagnostics.map(({ code }) => code);

  assert.ok(codes.includes("config.invalid-tasks-directory"));
  assert.ok(!codes.includes("config.invalid-remote"));
  assert.ok(!codes.includes("config.invalid-branch"));
});

test("published schema matches the loader contract", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../schema/v1.json", import.meta.url), "utf8"),
  );

  assert.equal(schema.$id, SCHEMA_URL);
  assert.equal(schema.properties.$schema.type, "string");
  assert.equal(schema.properties.$schema.minLength, 1);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["$schema"]);
  assert.equal(schema.properties.remote.deprecated, true);
  assert.equal(schema.properties.branch.deprecated, true);
});
