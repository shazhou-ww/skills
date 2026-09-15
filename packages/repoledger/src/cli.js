import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";

import { doctorRepository } from "./doctor.js";
import { checkRepository } from "./index.js";

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
      `OK: ${report.command} passed at ${report.root} (${report.summary.tasks} task(s), history ${report.capabilities.history}, ${report.summary.infos} info)`,
    );
  } else {
    io.error(`FAILED: ${report.summary.errors} error(s)`);
  }
}

export function createProgram(io = console) {
  const program = new Command();
  program
    .name("repoledger")
    .description("Validate repository-owned task ledgers and worktree identities.")
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
  $ repoledger check
  $ repoledger check --json
  $ repoledger doctor
  $ repoledger doctor --offline`,
    );

  addCommonOptions(
    program
      .command("check")
      .description("validate task files, links, layout, and available publication history")
      .summary("validate repository task state"),
  ).action(async (options) => {
    const report = await checkRepository({
      configPath: options.config,
      root: options.root,
    });
    renderReport(report, options.json, io);
    program.setOptionValue("resultCode", report.ok ? 0 : 1);
  });

  addCommonOptions(
    program
      .command("doctor")
      .description("refresh and validate local Git, worktree identity, and repository task state")
      .summary("validate local task-work readiness")
      .option("--offline", "skip fetch and mark remote freshness as degraded"),
  ).action(async (options) => {
    const report = await doctorRepository({
      configPath: options.config,
      offline: options.offline,
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
