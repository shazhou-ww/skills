import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { parseMarkdown, sectionText } from "./markdown.js";

const TASK_HEADINGS = [
  "Goal",
  "Context",
  "Scope",
  "Out of scope",
  "Acceptance criteria",
  "Constraints",
  "References",
];
const PROGRESS_HEADINGS = [
  "Checklist",
  "Current state",
  "Decisions",
  "Validation",
  "Blockers",
  "Outcome",
];
const USER_ACCEPTANCE_HEADINGS = [
  "Purpose",
  "Test target",
  "Preconditions",
  "Steps",
  "Expected results",
  "Report outcome",
  "Status",
];

function diagnostic(code, level, path, message, remediation) {
  return { code, level, path, message, remediation };
}

function error(code, path, message, remediation) {
  return diagnostic(code, "error", path, message, remediation);
}

function info(code, path, message, remediation) {
  return diagnostic(code, "info", path, message, remediation);
}

function displayPath(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch (caught) {
    if (caught.code === "ENOENT") return false;
    throw caught;
  }
}

function missingHeadings(document, required) {
  return required.filter((heading) => !document.headings.has(heading));
}

function firstList(section) {
  return section.find(({ type }) => type === "list");
}

function validateAcceptanceCriteria({
  diagnostics,
  document,
  filePath,
  outcome,
  root,
  state,
}) {
  const list = firstList(document.section("Acceptance criteria"));
  const taskItems = list?.items.filter(({ task }) => task) ?? [];
  if (taskItems.length === 0) {
    diagnostics.push(
      error(
        "task.acceptance.missing-checklist",
        displayPath(root, filePath),
        "Acceptance criteria must contain at least one task-list item.",
        "Express each observable acceptance criterion as a Markdown checkbox.",
      ),
    );
    return;
  }
  if (
    state === "archived" &&
    outcome === "Completed" &&
    taskItems.some(({ checked }) => checked !== true)
  ) {
    diagnostics.push(
      error(
        "task.acceptance.incomplete",
        displayPath(root, filePath),
        "Archived task acceptance criteria contain unchecked items.",
        "Record the actual result before archiving, or mark the task abandoned with its reason.",
      ),
    );
  }
}

function milestoneRows(document) {
  const table = document
    .section("Publication milestones")
    .find(({ type }) => type === "table");
  if (!table) return null;
  return new Map(table.rows.map((row) => [row[0]?.text.trim(), row.map((cell) => cell.text.trim())]));
}

function validateMilestones({ diagnostics, document, filePath, outcome, root, state }) {
  const path = displayPath(root, filePath);
  const rows = milestoneRows(document);
  if (!rows) {
    diagnostics.push(
      error(
        "progress.milestones.missing",
        path,
        "Versioned progress is missing its publication milestone table.",
        "Add Claim, Implementation complete, and Archive milestone rows from the current template.",
      ),
    );
    return;
  }

  for (const milestone of ["Claim", "Implementation complete", "Archive"]) {
    if (!rows.has(milestone)) {
      diagnostics.push(
        error(
          "progress.milestones.missing-row",
          path,
          `Publication milestones are missing the ${milestone} row.`,
          `Add a ${milestone} row with evidence and status.`,
        ),
      );
    }
  }

  const claimStatus = rows.get("Claim")?.[2];
  if (state !== "backlog" && claimStatus !== "Published") {
    diagnostics.push(
      error(
        "progress.milestones.claim-unpublished",
        path,
        `Claim milestone status must be Published, found ${claimStatus ?? "missing"}.`,
        "Publish the claim and record its immutable evidence before implementation.",
      ),
    );
  }

  if (
    state === "archived" &&
    outcome === "Completed" &&
    rows.get("Implementation complete")?.[2] !== "Published"
  ) {
    diagnostics.push(
      error(
        "progress.milestones.incomplete",
        path,
        "Implementation complete milestone status must be Published for a completed archive.",
        "Publish and record implementation completion before archiving.",
      ),
    );
  }
  if (state === "archived" && rows.get("Archive")?.[2] !== "Published") {
    diagnostics.push(
      error(
        "progress.milestones.archive-unpublished",
        path,
        "Archive milestone status must be Published for every archived task.",
        "Publish the archive move and record its shared primary branch evidence.",
      ),
    );
  }
}

function validateProgressChecklist({ diagnostics, document, filePath, outcome, root, state }) {
  if (state !== "archived" || outcome !== "Completed") return;
  const list = firstList(document.section("Checklist"));
  const unchecked = list?.items.filter(({ task, checked }) => task && checked !== true) ?? [];
  if (unchecked.length > 0) {
    diagnostics.push(
      error(
        "progress.checklist.incomplete",
        displayPath(root, filePath),
        "Completed archived progress contains unchecked checklist items.",
        "Complete and record every required lifecycle action before archiving.",
      ),
    );
  }
}

async function validateProgress({ diagnostics, root, state, strict, task }) {
  const filePath = resolve(task.path, "Progress.md");
  const path = displayPath(root, filePath);
  const exists = await isFile(filePath);

  if (state === "backlog") {
    if (exists) {
      diagnostics.push(
        error(
          "progress.unexpected",
          path,
          "Backlog tasks must not contain Progress.md.",
          "Remove Progress.md until the task is claimed.",
        ),
      );
    }
    return { outcome: null, strict: true };
  }
  if (!exists) {
    diagnostics.push(
      error(
        "progress.missing",
        path,
        `${state} tasks must contain Progress.md.`,
        "Create Progress.md from the task-ledger progress template.",
      ),
    );
    return { outcome: null, strict: state !== "archived" };
  }

  const document = parseMarkdown(await readFile(filePath, "utf8"));
  const rows = milestoneRows(document);
  const legacyArchive =
    state === "archived" &&
    (rows === null || [...rows.values()].some((row) => row[2] === "Complete"));
  const usesCurrentSchema =
    strict ?? !legacyArchive;
  const required = usesCurrentSchema
    ? [...PROGRESS_HEADINGS, "Publication milestones"]
    : PROGRESS_HEADINGS;
  for (const heading of missingHeadings(document, required)) {
    diagnostics.push(
      error(
        "progress.heading.missing",
        path,
        `Progress.md is missing the ${heading} heading.`,
        `Add ## ${heading} from the current progress template.`,
      ),
    );
  }

  const outcomeText = sectionText(document.section("Outcome"));
  const outcome = /^(Completed|Abandoned)\./.exec(outcomeText)?.[1] ?? null;
  if (state === "archived" && outcome === null) {
    diagnostics.push(
      error(
        "progress.outcome.invalid",
        path,
        "Archived progress must start its outcome with Completed. or Abandoned.",
        "Record the actual final outcome and concise reason.",
      ),
    );
  }
  validateProgressChecklist({ diagnostics, document, filePath, outcome, root, state });
  if (usesCurrentSchema) {
    validateMilestones({ diagnostics, document, filePath, outcome, root, state });
  }
  return { outcome, strict: usesCurrentSchema };
}

function orderedListLength(document, sectionName) {
  const list = firstList(document.section(sectionName));
  return list?.ordered ? list.items.length : 0;
}

async function validateUserAcceptance({ diagnostics, outcome, root, state, task }) {
  const filePath = resolve(task.path, "UserAcceptance.md");
  if (!(await isFile(filePath))) return;
  const path = displayPath(root, filePath);
  if (state === "backlog") {
    diagnostics.push(
      error(
        "acceptance.unexpected",
        path,
        "Backlog tasks must not contain a user acceptance guide.",
        "Create UserAcceptance.md only after implementation begins and manual acceptance is required.",
      ),
    );
  }

  const document = parseMarkdown(await readFile(filePath, "utf8"));
  for (const heading of missingHeadings(document, USER_ACCEPTANCE_HEADINGS)) {
    diagnostics.push(
      error(
        "acceptance.heading.missing",
        path,
        `UserAcceptance.md is missing the ${heading} heading.`,
        `Add ## ${heading} from the current user-acceptance template.`,
      ),
    );
  }
  const steps = orderedListLength(document, "Steps");
  const expected = orderedListLength(document, "Expected results");
  if (steps === 0 || steps !== expected) {
    diagnostics.push(
      error(
        "acceptance.steps.invalid",
        path,
        `User acceptance has ${steps} numbered step(s) and ${expected} expected result(s).`,
        "Provide at least one numbered step and one matching expected result per step.",
      ),
    );
  }
  const reporting = sectionText(document.section("Report outcome"));
  if (!reporting.includes("Accepted") || !reporting.includes("Failed at step")) {
    diagnostics.push(
      error(
        "acceptance.reporting.invalid",
        path,
        "User acceptance reporting instructions are incomplete.",
        "Provide explicit Accepted and Failed at step <number> outcomes.",
      ),
    );
  }
  const status = sectionText(document.section("Status"));
  if (!status) {
    diagnostics.push(
      error(
        "acceptance.status.missing",
        path,
        "User acceptance status is empty.",
        "Record Pending or the actual user-reported result.",
      ),
    );
  } else if (state === "archived" && outcome === "Completed" && !status.includes("Accepted")) {
    diagnostics.push(
      error(
        "acceptance.status.not-accepted",
        path,
        "Completed archived user acceptance does not record an Accepted result.",
        "Record only the user's actual Accepted result before archiving as completed.",
      ),
    );
  }
}

async function markdownFiles(path, files = []) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) await markdownFiles(entryPath, files);
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(entryPath);
  }
  return files;
}

function escapesRoot(root, path) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot);
}

async function validateLinks({ diagnostics, root, task }) {
  for (const filePath of await markdownFiles(task.path)) {
    const document = parseMarkdown(await readFile(filePath, "utf8"));
    for (const rawTarget of document.links) {
      if (/^[a-z]:[/\\]/i.test(rawTarget)) {
        diagnostics.push(
          error(
            "link.absolute-machine-path",
            displayPath(root, filePath),
            `Link uses a machine-local absolute path: ${rawTarget}`,
            "Use the repository's declared local-link convention.",
          ),
        );
        continue;
      }
      if (
        !rawTarget ||
        rawTarget.startsWith("#") ||
        rawTarget.startsWith("//") ||
        /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
      ) {
        continue;
      }
      const pathTarget = rawTarget.split(/[?#]/, 1)[0].replace(/^<|>$/g, "");
      let decoded;
      try {
        decoded = decodeURIComponent(pathTarget);
      } catch {
        diagnostics.push(
          error(
            "link.encoding.invalid",
            displayPath(root, filePath),
            `Link has invalid percent encoding: ${rawTarget}`,
            "Use valid UTF-8 percent encoding or an unescaped Markdown path.",
          ),
        );
        continue;
      }
      const rootRelative = decoded.startsWith("/");
      const targetPath = rootRelative
        ? resolve(root, decoded.replace(/^[/\\]+/, ""))
        : resolve(dirname(filePath), decoded);
      if (rootRelative && !escapesRoot(task.path, targetPath)) {
        diagnostics.push(
          error(
            "link.task-local.root-relative",
            displayPath(root, filePath),
            `Task-local link uses a repository-root path: ${rawTarget}`,
            "Use a path relative to the linking file so it moves with the task directory.",
          ),
        );
      }
      if (escapesRoot(root, targetPath)) {
        diagnostics.push(
          error(
            "link.repository.escape",
            displayPath(root, filePath),
            `Local link escapes the repository: ${rawTarget}`,
            "Point the link to a repository file or use an external URL.",
          ),
        );
        continue;
      }
      try {
        await access(targetPath);
      } catch {
        diagnostics.push(
          error(
            "link.target.missing",
            displayPath(root, filePath),
            `Local link target does not exist: ${rawTarget}`,
            `Create the target or correct the link in ${displayPath(root, filePath)}.`,
          ),
        );
      }
    }
  }
}

export async function inspectTaskContents({ root, tasks }) {
  const diagnostics = [];

  for (const task of tasks) {
    const taskFile = resolve(task.path, "Task.md");
    const taskPath = displayPath(root, taskFile);
    if (!(await isFile(taskFile))) {
      diagnostics.push(
        error(
          "task.file.missing",
          taskPath,
          `${task.relativePath} is missing Task.md.`,
          "Create Task.md from the task-ledger task template.",
        ),
      );
      await validateProgress({
        diagnostics,
        root,
        state: task.state,
        strict: false,
        task,
      });
      continue;
    }

    const taskText = await readFile(taskFile, "utf8");
    const document = parseMarkdown(taskText);
    for (const heading of missingHeadings(document, TASK_HEADINGS)) {
      diagnostics.push(
        error(
          "task.heading.missing",
          taskPath,
          `Task.md is missing the ${heading} heading.`,
          `Add ## ${heading} from the current task template.`,
        ),
      );
    }

    const progress = await validateProgress({
      diagnostics,
      root,
      state: task.state,
      task,
    });
    if (task.state === "archived" && !progress.strict) {
      diagnostics.push(
        info(
          "task.archive.legacy",
          taskPath,
          "Archived task predates the schema's publication milestone format.",
          "Keep archived history unchanged; current checks still validate universal invariants.",
        ),
      );
    }
    validateAcceptanceCriteria({
      diagnostics,
      document,
      filePath: taskFile,
      outcome: progress.outcome,
      root,
      state: task.state,
    });
    await validateUserAcceptance({
      diagnostics,
      outcome: progress.outcome,
      root,
      state: task.state,
      task,
    });
    await validateLinks({ diagnostics, root, task });
  }

  return { diagnostics };
}
