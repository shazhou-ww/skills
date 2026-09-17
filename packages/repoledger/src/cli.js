import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";

import { doctorRepository } from "./doctor.js";
import { checkRepository } from "./index.js";
import { initRepository } from "./init.js";
import { statusRepository } from "./status.js";
import { transitionRepository } from "./transitions.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

function write(method, value) {
  const text = value.replace(/\n$/, "");
  if (text) method(text);
}

function addCommonOptions(command) {
  return command
    .option("-c, --config <path>", "configuration path relative to the repository root")
    .option("--json", "emit the complete machine-readable report")
    .option("-r, --root <path>", "repository root", process.cwd());
}

function renderReport(report, json, io) {
  if (json) {
    io.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const diagnostic of report.diagnostics.filter(
    ({ level }) => level === "error" || level === "warning",
  )) {
    const output = diagnostic.level === "error" ? io.error : io.log;
    output(
      `${diagnostic.level.toUpperCase()} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`,
    );
    output(`  Fix: ${diagnostic.remediation}`);
  }
  if (report.ok) {
    io.log(
      `OK: ${report.command} passed at ${report.root} (${report.summary.tasks} task(s), ${report.summary.warnings} warning(s), ${report.summary.infos} info)`,
    );
  } else {
    io.error(`FAILED: ${report.summary.errors} error(s)`);
  }
}

function renderStatus(report, json, io) {
  if (json) {
    io.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const diagnostic of report.diagnostics.filter(
    ({ level }) => level === "error" || level === "warning",
  )) {
    const output = diagnostic.level === "error" ? io.error : io.log;
    output(
      `${diagnostic.level.toUpperCase()} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`,
    );
    output(`  Fix: ${diagnostic.remediation}`);
  }
  if (report.command === "task") {
    io.log(`Operation: ${report.operation}`);
    if (report.source) io.log(`Source: ${report.source}`);
    if (report.destination) io.log(`Destination: ${report.destination}`);
    if (report.sourceIdentity) io.log(`Source identity: ${report.sourceIdentity}`);
    if (report.destinationIdentity) {
      io.log(`Destination identity: ${report.destinationIdentity}`);
    }
    for (const reference of report.referenceEdits) {
      const action = reference.updated ? "UPDATE" : "SKIP";
      io.log(`Reference ${action}: ${reference.file} ${reference.from} -> ${reference.to}`);
    }
  }
  if (!report.ok) {
    io.error(`FAILED: ${report.summary.errors} error(s)`);
    return;
  }

  const identity = report.identity.value
    ? `${report.identity.value} (${report.identity.scope})`
    : "unbound";
  io.log(`Identity: ${identity}`);
  if (report.tasks.length === 0) {
    io.log("No tasks.");
    return;
  }
  for (const task of report.tasks) {
    const owner = task.identity ? ` [${task.identity}]` : "";
    io.log(`${task.state.toUpperCase()} ${task.name}${owner} ${task.path}`);
  }
}

function renderOperation(report, json, io) {
  if (json) {
    io.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const diagnostic of report.diagnostics.filter(
    ({ level }) => level === "error" || level === "warning",
  )) {
    const output = diagnostic.level === "error" ? io.error : io.log;
    output(
      `${diagnostic.level.toUpperCase()} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`,
    );
    output(`  Fix: ${diagnostic.remediation}`);
  }
  if (!report.ok) {
    io.error(`FAILED: ${report.summary.errors} error(s)`);
    return;
  }

  io.log(`${report.mode === "apply" ? "Applied" : "Preview"}: ${report.command}`);
  for (const change of report.changes) {
    const detail = change.key ? ` ${change.key}=${change.value}` : "";
    const target = change.from
      ? `${change.from} -> ${change.to}`
      : change.path;
    io.log(`  ${change.action} ${target}${detail}`);
  }
  for (const reference of report.referenceEdits ?? []) {
    const action = reference.updated ? "UPDATE" : "SKIP";
    io.log(`  reference-${action.toLowerCase()} ${reference.file} ${reference.from} -> ${reference.to}`);
  }
  if (report.mode === "preview" && report.changes.length > 0) {
    io.log("Preview only; rerun with --apply to apply these changes.");
  }
  for (const nextAction of report.nextActions) io.log(`Next: ${nextAction}`);
}

export function createProgram(io = console) {
  const program = new Command();
  program
    .name("repoledger")
    .description("Inspect, validate, initialize, and safely move repository-owned task ledgers.")
    .version(VERSION, "-v, --version", "display the installed version")
    .showHelpAfterError("(run with --help for usage)")
    .showSuggestionAfterError()
    .configureHelp({ sortOptions: true, sortSubcommands: true })
    .configureOutput({
      outputError: (value, output) => output(value),
      writeErr: (value) => write(io.error, value),
      writeOut: (value) => write(io.log, value),
    })
    .exitOverride()
    .addHelpText(
      "after",
      `
Examples:
  $ repoledger status
  $ repoledger init
  $ repoledger check
  $ repoledger check --task <task-name>
  $ repoledger check --json
  $ repoledger task claim <task-name>
  $ repoledger task claim <task-name> --take-from <identity>
  $ repoledger task archive <task-name>
  $ repoledger doctor`,
    );

  addCommonOptions(
    program
      .command("check")
      .description("validate local task files, links, and layout")
      .summary("validate repository task state")
      .option("--all-identities", "include ongoing tasks from every identity")
      .option("--archived", "include archived tasks")
      .option("--task <name>", "validate one unambiguously named task"),
  ).action(async (options) => {
    const report = await checkRepository({
      configPath: options.config,
      includeAllIdentities: options.allIdentities,
      includeArchived: options.archived,
      root: options.root,
      taskName: options.task,
    });
    renderReport(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  addCommonOptions(
    program
      .command("init")
      .description("plan or apply safe repository task-ledger initialization")
      .summary("initialize repository task state")
      .option("--apply", "apply the recomputed initialization plan")
      .option("--dry-run", "explicitly preview without changing local state")
      .option("--identity <identity>", "identity lane to initialize")
      .option("--tasks-directory <path>", "repository-relative task directory"),
  ).action(async (options) => {
    if (options.apply && options.dryRun) {
      program.error(
        "error: options '--apply' and '--dry-run' cannot be used together",
        { exitCode: 2, code: "repoledger.init.conflicting-mode" },
      );
    }
    const report = await initRepository({
      apply: options.apply,
      configPath: options.config,
      identity: options.identity,
      root: options.root,
      tasksDirectory: options.tasksDirectory,
    });
    renderOperation(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  addCommonOptions(
    program
      .command("status")
      .description("list canonical task positions and the effective identity")
      .summary("show repository task status")
      .option("--archived", "include archived task positions"),
  ).action(async (options) => {
    const report = await statusRepository({
      configPath: options.config,
      includeArchived: options.archived,
      root: options.root,
    });
    renderStatus(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  const task = program
    .command("task")
    .description("preview or apply a validated local task transition")
    .summary("manage a task transition");

  addCommonOptions(
    task
      .command("claim <task-name>")
      .description("plan a backlog claim or explicit ownership takeover")
      .summary("plan a task claim")
      .option("--apply", "apply the recomputed transition plan")
      .option(
        "--update-all-refs",
        "update all affected references, including archived task history",
      )
      .option(
        "--take-from <identity>",
        "take an ongoing task only from this expected source identity",
      ),
  ).action(async (taskName, options) => {
    const report = await transitionRepository({
      apply: options.apply,
      configPath: options.config,
      operation: "claim",
      root: options.root,
      takeFrom: options.takeFrom,
      taskName,
      updateAllReferences: options.updateAllRefs,
    });
    renderOperation(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  addCommonOptions(
    task
      .command("archive <task-name>")
      .description("plan archival of a completed or abandoned current task")
      .summary("plan task archival")
      .option("--apply", "apply the recomputed transition plan")
      .option(
        "--update-all-refs",
        "update all affected references, including archived task history",
      ),
  ).action(async (taskName, options) => {
    const report = await transitionRepository({
      apply: options.apply,
      configPath: options.config,
      operation: "archive",
      root: options.root,
      taskName,
      updateAllReferences: options.updateAllRefs,
    });
    renderOperation(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  addCommonOptions(
    program
      .command("doctor")
      .description("validate the effective identity and repository task state")
      .summary("validate local task-work readiness"),
  ).action(async (options) => {
    const report = await doctorRepository({
      configPath: options.config,
      root: options.root,
    });
    renderReport(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  return program;
}

export async function runCli(args, io = console) {
  const program = createProgram(io);
  try {
    await program.parseAsync(args.length === 0 ? ["--help"] : args, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 2;
    throw error;
  }
  return program.getOptionValue("resultCode") ?? 0;
}
