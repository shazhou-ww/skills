import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SCHEMA_URL } from "../src/config.js";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const npmCli = process.env.npm_execpath;

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    windowsHide: true,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed:\n${result.stderr || result.error?.message}`,
  );
  return result.stdout.trim();
}

function npm(args, cwd) {
  assert.ok(
    npmCli && /^npm-cli\.js$/i.test(basename(npmCli)),
    "smoke:pack must run through npm so npm_execpath identifies npm-cli.js",
  );
  const stage = args[0] === "exec" ? args.slice(2).join(" ") : args[0];
  process.stdout.write(`SMOKE_NPM ${stage}\n`);
  return run(process.execPath, [npmCli, ...args], cwd);
}

function git(args, cwd) {
  return run("git", args, cwd);
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "repoledger-pack-smoke-"));
try {
  const packed = JSON.parse(
    npm(["pack", "--json", "--pack-destination", temporaryRoot], packageRoot),
  )[0];
  const tarball = join(temporaryRoot, packed.filename);
  const consumer = join(temporaryRoot, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "repoledger.json"),
    JSON.stringify(
      { $schema: SCHEMA_URL, tasksDirectory: "tasks" },
      null,
      2,
    ),
  );
  for (const status of ["backlog", "ongoing", "archived"]) {
    const directory = join(consumer, "tasks", status);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, ".gitkeep"), "");
  }
  const identity = join(consumer, "tasks", "ongoing", "smoke-identity");
  await mkdir(identity);
  await writeFile(join(identity, ".gitkeep"), "");

  git(["init", "--initial-branch=main"], consumer);
  git(["config", "user.name", "repoledger smoke"], consumer);
  git(["config", "user.email", "repoledger@example.invalid"], consumer);
  git(["add", "."], consumer);
  git(["commit", "-m", "Initialize smoke ledger"], consumer);
  git(["config", "extensions.worktreeConfig", "true"], consumer);
  git(["config", "--worktree", "task-ledger.identity", "smoke-identity"], consumer);

  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumer);
  const help = npm(["exec", "--", "repoledger", "--help"], consumer);
  assert.match(help, /Usage: repoledger \[options\] \[command\]/);
  const version = npm(["exec", "--", "repoledger", "--version"], consumer);
  assert.equal(version, packed.version);
  const exported = run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import { checkRepository, initRepository, statusRepository, transitionRepository } from 'repoledger'; console.log([checkRepository, initRepository, statusRepository, transitionRepository].map((value) => typeof value).join(','));",
    ],
    consumer,
  );
  assert.equal(exported, "function,function,function,function");
  const checked = JSON.parse(
    npm(["exec", "--", "repoledger", "check", "--json"], consumer),
  );
  assert.equal(checked.ok, true);
  assert.equal(checked.scope.worktreeIdentity, "smoke-identity");
  assert.equal(checked.scope.includeArchived, false);
  const status = JSON.parse(
    npm(["exec", "--", "repoledger", "status", "--json"], consumer),
  );
  assert.equal(status.ok, true);
  assert.equal(status.identity.value, "smoke-identity");
  const initialized = JSON.parse(
    npm(["exec", "--", "repoledger", "init", "--json"], consumer),
  );
  assert.equal(initialized.ok, true);
  assert.equal(initialized.mode, "preview");
  assert.deepEqual(initialized.changes, []);
  const taskHelp = npm(
    ["exec", "--", "repoledger", "task", "claim", "--help"],
    consumer,
  );
  assert.match(taskHelp, /--take-from <identity>/);
  assert.match(taskHelp, /--update-all-refs/);
  const doctored = JSON.parse(
    npm(["exec", "--", "repoledger", "doctor", "--json"], consumer),
  );
  assert.equal(doctored.ok, true);
  assert.equal(doctored.identity, "smoke-identity");
  assert.equal(Object.hasOwn(doctored, "remoteFreshness"), false);
  process.stdout.write(
    `PACK_SMOKE_OK name=${packed.name} version=${packed.version} identity=${doctored.identity}\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}