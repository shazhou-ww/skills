import { readFileSync } from "node:fs";
import { Command, CommanderError, Option } from "commander";

import { checkRepository } from "./index.js";
import { initRepository } from "./init.js";
import { isTimestamp, TASK_STATES } from "./ledger.js";
import { mutateTask } from "./publication.js";
import { listTasks, statusRepository } from "./status.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

function write(method, value) {
  const text = value.replace(/\n$/, "");
  if (text) method(text);
}

function addCommonOptions(command) {
  return command
    .option("--json", "emit the complete machine-readable report")
    .option("-r, --root <path>", "repository root", process.cwd());
}

function renderDiagnostics(report, io) {
  for (const diagnostic of report.diagnostics) {
    const location = diagnostic.path ? ` ${diagnostic.path}` : "";
    const output = diagnostic.level === "error" ? io.error : io.log;
    output(`${diagnostic.level.toUpperCase()} ${diagnostic.code}${location}: ${diagnostic.message}`);
    output(`  Fix: ${diagnostic.remediation}`);
  }
}

function renderPublication(result, io) {
  io.log(`${result.publication}: ${result.transition}`);
  io.log(`  commit         ${result.commit.slice(0, 12)}`);
  if (result.primaryBefore) {
    io.log(`  primary before  ${result.primaryBefore.slice(0, 12)}`);
  }
  if (result.primaryAfter) {
    io.log(`  primary after   ${result.primaryAfter.slice(0, 12)}`);
  }
  if (result.sourceRepository) {
    io.log(`  source          ${result.sourceRepository}#${result.sourceBranch}`);
    io.log(`  source tip      ${result.sourceTip.slice(0, 12)}`);
  }
}

export function render(report, json, io) {
  if (json) {
    io.log(JSON.stringify(report, null, 2));
    return;
  }
  renderDiagnostics(report, io);
  if (!report.ok) {
    if (report.result?.publication) renderPublication(report.result, io);
    io.error("FAILED");
    return;
  }
  if (report.command === "task list") {
    const tasks = report.result.tasks;
    if (tasks.length === 0) io.log("No tasks.");
    for (const task of tasks) {
      io.log(`${task.task}  ${task.state}  ${task.createdAt}  ${task.updatedAt}`);
      if (task.state === "ongoing") {
        io.log(`  source  ${task.sourceRepository}#${task.sourceBranch}`);
      }
    }
    return;
  }
  if (report.command === "status") {
    const result = report.result;
    io.log(`${result.task}  ${result.state}`);
    io.log(`  created  ${result.createdAt}`);
    io.log(`  updated  ${result.updatedAt}`);
    if (result.state === "ongoing") {
      io.log(`  source   ${result.sourceRepository}#${result.sourceBranch}`);
    }
    if (result.primary) io.log(`  primary  ${result.primary}`);
    return;
  }
  if (report.result?.publication) {
    renderPublication(report.result, io);
    return;
  }
  io.log(`OK: ${report.command}`);
}

function collect(value, previous) {
  return [...previous, value];
}

function positiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) throw new CommanderError(2, "repoledger.invalid-limit", "Limit must be a positive integer");
  return Number(value);
}

function validateTimestampOptions(program, options) {
  for (const key of ["createdSince", "createdBefore", "updatedSince", "updatedBefore"]) {
    if (options[key] !== undefined && !isTimestamp(options[key])) {
      program.error(`error: option --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} requires YYYY-MM-DDTHH:mm:ssZ`, {
        exitCode: 2,
        code: "repoledger.invalid-timestamp",
      });
    }
  }
  for (const field of ["created", "updated"]) {
    if (options[`${field}Since`] && options[`${field}Before`] && options[`${field}Since`] >= options[`${field}Before`]) {
      program.error(`error: --${field}-since must be earlier than --${field}-before`, {
        exitCode: 2,
        code: "repoledger.invalid-time-range",
      });
    }
  }
}

export function createProgram(io = console) {
  const program = new Command();
  program
    .name("repoledger")
    .description("Query and publish repository-owned task lifecycle state.")
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
    .addHelpText("after", `
Examples:
  $ repoledger task list --state ongoing --sort updated
  $ repoledger status <task-name>
  $ repoledger check --remote
  $ repoledger task start <task-name>`);

  addCommonOptions(
    program
      .command("check [task-name]")
      .description("validate task configuration, status, artifacts, and optional remote history")
      .option("--remote", "fetch and validate the configured primary branch"),
  ).action(async (taskName, options) => {
    const report = await checkRepository({ remote: options.remote, root: options.root, taskName });
    render(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  addCommonOptions(
    program
      .command("init")
      .description("initialize and publish a new task ledger")
      .requiredOption("--primary-repository <url>", "canonical HTTPS primary repository URL")
      .requiredOption("--primary-branch <branch>", "shared primary branch")
      .option("--tasks-directory <path>", "repository-relative task directory", "tasks"),
  ).action(async (options) => {
    const report = await initRepository({
      primaryBranch: options.primaryBranch,
      primaryRepository: options.primaryRepository,
      root: options.root,
      tasksDirectory: options.tasksDirectory,
    });
    render(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  addCommonOptions(
    program
      .command("status <task-name>")
      .description("show one task record")
      .option("--local", "read the worktree snapshot without fetching"),
  ).action(async (taskName, options) => {
    const report = await statusRepository({ local: options.local, root: options.root, taskName });
    render(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  const task = program.command("task").description("query or mutate task lifecycle state");
  const list = addCommonOptions(
    task
      .command("list")
      .description("list and filter task records")
      .addOption(new Option("--state <state>", "include a lifecycle state").choices(TASK_STATES).argParser(collect).default([]))
      .option("--created-since <timestamp>", "inclusive creation lower bound")
      .option("--created-before <timestamp>", "exclusive creation upper bound")
      .option("--updated-since <timestamp>", "inclusive update lower bound")
      .option("--updated-before <timestamp>", "exclusive update upper bound")
      .addOption(new Option("--sort <key>", "sort key").choices(["name", "created", "updated"]).default("name"))
      .option("--limit <count>", "maximum result count", positiveInteger)
      .option("--local", "read the worktree snapshot without fetching"),
  );
  list.action(async (options) => {
    validateTimestampOptions(program, options);
    const report = await listTasks({
      filters: {
        states: options.state,
        createdSince: options.createdSince,
        createdBefore: options.createdBefore,
        updatedSince: options.updatedSince,
        updatedBefore: options.updatedBefore,
      },
      limit: options.limit,
      local: options.local,
      root: options.root,
      sort: options.sort,
    });
    render(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  for (const operation of ["register", "abandon"]) {
    addCommonOptions(
      task.command(`${operation} <task-name>`).description(`${operation} one task`),
    ).action(async (taskName, options) => {
      const report = await mutateTask({ operation, root: options.root, taskName });
      render(report, options.json, io);
      program.setOptionValue("resultCode", report.ok ? 0 : 1);
    });
  }

  addCommonOptions(
    task
      .command("start <task-name>")
      .description("start one task and publish its shared source ref")
      .option("--source-repository <url>", "canonical HTTPS source repository URL")
      .option("--source-branch <branch>", "shared source branch"),
  ).action(async (taskName, options) => {
    const report = await mutateTask({
      operation: "start",
      root: options.root,
      sourceBranch: options.sourceBranch,
      sourceRepository: options.sourceRepository,
      taskName,
    });
    render(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  addCommonOptions(
    task
      .command("complete <task-name>")
      .description("complete one approved task")
      .requiredOption("--approved-commit <commit>", "exact primary commit approved for delivery"),
  ).action(async (taskName, options) => {
    const report = await mutateTask({
      approvedCommit: options.approvedCommit,
      operation: "complete",
      root: options.root,
      taskName,
    });
    render(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  return program;
}

export async function runCli(args, io = console) {
  const program = createProgram(io);
  try {
    await program.parseAsync(args.length === 0 ? ["--help"] : args, { from: "user" });
  } catch (caught) {
    if (caught instanceof CommanderError) return caught.exitCode === 0 ? 0 : 2;
    throw caught;
  }
  return program.getOptionValue("resultCode") ?? 0;
}
