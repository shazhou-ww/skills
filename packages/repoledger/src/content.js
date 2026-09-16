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
const HUMAN_REVIEW_CHECKPOINTS = [
  "Scope",
  "Interface",
  "Business and data model",
  "Architecture",
  "Delivery acceptance",
];
const REQUIRED_HUMAN_REVIEW_CHECKPOINTS = new Set([
  "Scope",
  "Delivery acceptance",
]);
const HUMAN_APPROVAL_STATUSES = new Set([
  "Pending",
  "Approved",
  "Not applicable",
  "Reopened",
]);

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

function namedTableRows(document, sectionName) {
  const table = document
    .section(sectionName)
    .find(({ type }) => type === "table");
  if (!table) return null;
  return new Map(
    table.rows.map((row) => [
      row[0]?.text.trim(),
      row.map((cell) => cell.text.trim()),
    ]),
  );
}

function hasPlaceholder(value) {
  return !value || /<[^>]+>/.test(value);
}

function validateHumanReviewPlan({ diagnostics, document, filePath, root, state }) {
  const path = displayPath(root, filePath);
  if (!document.headings.has("Human review checkpoints")) {
    if (state !== "archived") {
      diagnostics.push(
        error(
          "task.human-review.missing",
          path,
          "Active task is missing its human review checkpoint plan.",
          "Add the Human review checkpoints section from the current task template.",
        ),
      );
    }
    return null;
  }

  const rows = namedTableRows(document, "Human review checkpoints");
  if (!rows) {
    diagnostics.push(
      error(
        "task.human-review.table-missing",
        path,
        "Human review checkpoints are missing their planning table.",
        "Add the checkpoint, applicability, reviewer, artifact, and approval-gate table from the current task template.",
      ),
    );
    return new Map();
  }

  for (const checkpoint of HUMAN_REVIEW_CHECKPOINTS) {
    const row = rows.get(checkpoint);
    if (!row) {
      diagnostics.push(
        error(
          "task.human-review.row-missing",
          path,
          `Human review plan is missing the ${checkpoint} checkpoint.`,
          `Add the ${checkpoint} row from the current task template.`,
        ),
      );
      continue;
    }

    const applicability = row[1] ?? "";
    const required = applicability === "Required";
    const notApplicable = /^Not applicable:\s+\S/.test(applicability);
    const assessLater = /^Assess during execution:\s+\S/.test(applicability);
    if (
      hasPlaceholder(applicability) ||
      (!required && !notApplicable && !assessLater) ||
      (REQUIRED_HUMAN_REVIEW_CHECKPOINTS.has(checkpoint) && !required)
    ) {
      diagnostics.push(
        error(
          "task.human-review.applicability-invalid",
          path,
          `Human review checkpoint ${checkpoint} has invalid applicability: ${applicability || "missing"}.`,
          REQUIRED_HUMAN_REVIEW_CHECKPOINTS.has(checkpoint)
            ? `Mark ${checkpoint} as Required.`
            : `Use Required, Not applicable: <reason>, or Assess during execution: <decision trigger>.`,
        ),
      );
      continue;
    }

    if (row.slice(2, 5).some(hasPlaceholder)) {
      diagnostics.push(
        error(
          "task.human-review.details-missing",
          path,
          `Human review checkpoint ${checkpoint} contains an unresolved review detail.`,
          notApplicable
            ? "Replace remaining placeholders with Not applicable."
            : "Replace every placeholder with task-specific reviewer, artifact, and gate details.",
        ),
      );
    }
  }

  return rows;
}

function milestoneRows(document) {
  return namedTableRows(document, "Publication milestones");
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

function validateHumanApprovals({
  diagnostics,
  document,
  filePath,
  outcome,
  reviewPlan,
  root,
  state,
}) {
  const path = displayPath(root, filePath);
  const rows = namedTableRows(document, "Human approvals");
  if (!rows) {
    diagnostics.push(
      error(
        "progress.human-approvals.table-missing",
        path,
        "Progress is missing its human approval table.",
        "Copy all five checkpoints from Task.md and record their current status and evidence.",
      ),
    );
    return;
  }

  for (const checkpoint of HUMAN_REVIEW_CHECKPOINTS) {
    const row = rows.get(checkpoint);
    if (!row) {
      diagnostics.push(
        error(
          "progress.human-approvals.row-missing",
          path,
          `Human approvals are missing the ${checkpoint} checkpoint.`,
          `Add the ${checkpoint} row and copy its applicability from Task.md.`,
        ),
      );
      continue;
    }

    const status = row[1] ?? "";
    const evidence = row[2] ?? "";
    if (!HUMAN_APPROVAL_STATUSES.has(status)) {
      diagnostics.push(
        error(
          "progress.human-approvals.status-invalid",
          path,
          `Human approval checkpoint ${checkpoint} has invalid status: ${status || "missing"}.`,
          "Use Pending, Approved, Not applicable, or Reopened.",
        ),
      );
      continue;
    }

    const applicability = reviewPlan.get(checkpoint)?.[1] ?? "";
    if (
      (applicability === "Required" && status === "Not applicable") ||
      (applicability.startsWith("Not applicable:") && status !== "Not applicable")
    ) {
      diagnostics.push(
        error(
          "progress.human-approvals.plan-conflict",
          path,
          `Human approval status for ${checkpoint} conflicts with Task.md applicability.`,
          "Update the task plan and progress status together before proceeding.",
        ),
      );
    }

    if (
      status === "Approved" &&
      (hasPlaceholder(evidence) || !/\b\d{4}-\d{2}-\d{2}\b/.test(evidence))
    ) {
      diagnostics.push(
        error(
          "progress.human-approvals.evidence-invalid",
          path,
          `Approved checkpoint ${checkpoint} lacks dated decision evidence.`,
          "Record the human reviewer, YYYY-MM-DD date, reviewed artifact, and decision evidence.",
        ),
      );
    }
    if (status === "Not applicable" && hasPlaceholder(evidence)) {
      diagnostics.push(
        error(
          "progress.human-approvals.evidence-invalid",
          path,
          `Not-applicable checkpoint ${checkpoint} lacks a rationale.`,
          "Repeat the task-specific reason from Task.md.",
        ),
      );
    }
    if (
      state === "archived" &&
      outcome === "Completed" &&
      !["Approved", "Not applicable"].includes(status)
    ) {
      diagnostics.push(
        error(
          "progress.human-approvals.incomplete",
          path,
          `Completed archived task has unresolved ${checkpoint} approval status: ${status}.`,
          "Obtain and record approval, or mark a conditional checkpoint not applicable with its rationale.",
        ),
      );
    }
  }
}

async function validateProgress({ diagnostics, reviewPlan, root, state, strict, task }) {
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
  const required = [
    ...PROGRESS_HEADINGS,
    ...(usesCurrentSchema ? ["Publication milestones"] : []),
  ];
  if (reviewPlan) required.push("Human approvals");
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
  if (reviewPlan) {
    validateHumanApprovals({
      diagnostics,
      document,
      filePath,
      outcome,
      reviewPlan,
      root,
      state,
    });
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
    const reviewPlan = validateHumanReviewPlan({
      diagnostics,
      document,
      filePath: taskFile,
      root,
      state: task.state,
    });

    const progress = await validateProgress({
      diagnostics,
      reviewPlan,
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
