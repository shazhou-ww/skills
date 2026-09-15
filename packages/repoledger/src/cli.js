import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { checkRepository } from "./index.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const HELP = `repoledger validates repository-owned task ledgers.

Usage:
  repoledger check [--root <path>] [--json]
  repoledger --help
  repoledger --version
`;

export async function runCli(args, io = console) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        json: { type: "boolean" },
        root: { type: "string" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    io.error(error.message);
    return 2;
  }

  if (parsed.values.version) {
    io.log(VERSION);
    return 0;
  }

  if (parsed.values.help || parsed.positionals.length === 0) {
    io.log(HELP.trimEnd());
    return 0;
  }

  const [command, ...extraPositionals] = parsed.positionals;
  if (command !== "check" || extraPositionals.length > 0) {
    io.error(`Unknown command: ${parsed.positionals.join(" ")}`);
    return 2;
  }

  const report = await checkRepository({ root: parsed.values.root });
  if (parsed.values.json) {
    io.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    io.log(`OK: task ledger is valid at ${report.root}`);
  } else {
    for (const diagnostic of report.diagnostics) {
      io.error(
        `${diagnostic.level.toUpperCase()} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`,
      );
      io.error(`  Fix: ${diagnostic.remediation}`);
    }
    io.error(`FAILED: ${report.summary.errors} error(s)`);
  }

  return report.ok ? 0 : 1;
}
