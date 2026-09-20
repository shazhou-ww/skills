import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
const ledgerSkillPath = fileURLToPath(
  new URL("../skills/repoledger/SKILL.md", import.meta.url),
);

function uiReviewAssetPath(name) {
  return fileURLToPath(
    new URL(`../skills/ui-change-review/assets/${name}`, import.meta.url),
  );
}

function skillPath(name) {
  return fileURLToPath(new URL(`../skills/${name}/SKILL.md`, import.meta.url));
}

async function loadSkill(name) {
  const source = await readFile(skillPath(name), "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  assert.ok(frontmatter, `${name} is missing YAML frontmatter`);
  const document = parseDocument(frontmatter[1]);
  assert.deepEqual(document.errors, []);
  return { metadata: document.toJS(), source };
}

test("review skills expose independent discovery contracts", async () => {
  const expected = {
    "business-data-model-review": {
      description:
        "Create concise business data model review artifacts with Mermaid ER diagrams. Use when a human must review changes to domain entities, ownership, relationships, keys, lifecycle, migration, or compatibility, including append-only and ephemeral immutable semantics.",
      hint: "[model change or review goal]",
    },
    "ui-change-review": {
      description:
        "Create concise before/after HTML review artifacts for proposed changes to an existing user interface. Use when a human needs to compare affected screens, workflows, states, layout, or interaction changes before implementation without requiring a complete prototype.",
      hint: "[affected UI or review goal]",
    },
  };

  for (const [name, contract] of Object.entries(expected)) {
    const { metadata, source } = await loadSkill(name);
    assert.deepEqual(metadata, {
      name,
      description: contract.description,
      "argument-hint": contract.hint,
      "user-invocable": true,
    });
    assert.ok(source.split(/\r?\n/).length < 160, `${name} should stay concise`);
    assert.doesNotMatch(source, /repository-task-ledger|task-new|task-exec/);
  }
});

test("UI review guidance stays focused on a fair visual delta", async () => {
  const { source } = await loadSkill("ui-change-review");
  for (const required of [
    "about five minutes",
    "Inspect the current UI",
    "small review bundle",
    "loads one scenario at a time",
    "Before and After",
    "same scenario, representative data, viewport, shell, and scale",
    "Use static states by default",
    "illustrative review aid, not production UI",
    "keyboard order, visible focus, accessible names",
  ]) {
    assert.ok(source.includes(required), `ui-change-review is missing: ${required}`);
  }
  assert.match(source, /one\s+HTML file per scenario/);
  assert.match(source, /desktop\s+width and one narrow mobile\s+width/);
  assert.match(source, /Do not recreate routing, persistence, backend IO/);
  assert.match(source, /Keep normative behavior in the owning interface/);
  assert.match(source, /explicit approval question/);
});

test("UI review templates separate shared chrome from iframe scenarios", async () => {
  const [entry, scenario] = await Promise.all([
    readFile(uiReviewAssetPath("review-index.html"), "utf8"),
    readFile(uiReviewAssetPath("review-scenario.html"), "utf8"),
  ]);

  for (const required of [
    "{{DECISION}}",
    'role="tablist"',
    'name="scenario-frame"',
    'src="scenarios/01-primary-flow.html"',
    "ui-review:height",
    "{{APPROVAL_QUESTION}}",
  ]) {
    assert.ok(entry.includes(required), `review-index.html is missing: ${required}`);
  }

  for (const required of [
    "{{SCENARIO_TITLE}}",
    "Before",
    "After",
    "{{SHARED_VIEWPORT_AND_DATA}}",
    "ResizeObserver",
    "ui-review:height",
  ]) {
    assert.ok(scenario.includes(required), `review-scenario.html is missing: ${required}`);
  }

  assert.doesNotMatch(scenario, /Decision requested|APPROVAL_QUESTION/);
});

test("business data model guidance makes lifecycle semantics reviewable", async () => {
  const { source } = await loadSkill("business-data-model-review");
  for (const required of [
    "about five",
    "Mermaid `erDiagram`",
    "cardinalities and relationship verbs",
    "Split the model into complementary views",
    "`<<AO>>` - Append Only",
    "`<<EI>>` - Ephemeral Immutable",
    "Unmarked - Mutable",
    "&lt;&lt;EI&gt;&gt;",
    "&lt;&lt;AO&gt;&gt;",
    "compact lifecycle table",
    "Render every Mermaid block",
  ]) {
    assert.ok(
      source.includes(required),
      `business-data-model-review is missing: ${required}`,
    );
  }
  assert.match(source, /A stereotype without[\s\S]*is decoration/);
  assert.match(source, /Do not turn the review artifact into an architecture document/);
  assert.match(source, /explicit approval question/);
});

test("documentation keeps review skills installable and ledger composition optional", async () => {
  const [readme, ledger] = await Promise.all([
    readFile(readmePath, "utf8"),
    readFile(ledgerSkillPath, "utf8"),
  ]);

  for (const required of [
    "[`ui-change-review`](skills/ui-change-review/SKILL.md)",
    "[`business-data-model-review`](skills/business-data-model-review/SKILL.md)",
    "--skill ui-change-review",
    "--skill business-data-model-review",
    "independently",
  ]) {
    assert.ok(readme.includes(required), `README is missing: ${required}`);
  }

  for (const required of [
    "`ui-change-review`",
    "`business-data-model-review`",
    "Their absence never blocks a checkpoint",
  ]) {
    assert.ok(ledger.includes(required), `ledger skill is missing: ${required}`);
  }
  assert.match(ledger, /optional communication\s+aids/);
});

test("Repoledger entry skills keep the core and review contracts aligned", async () => {
  const [core, taskNew, taskExec, readme] = await Promise.all([
    loadSkill("repoledger"),
    loadSkill("task-new"),
    loadSkill("task-exec"),
    readFile(readmePath, "utf8"),
  ]);

  assert.equal(core.metadata.name, "repoledger");
  assert.equal(core.metadata["user-invocable"], false);
  assert.match(taskNew.source, /Load `repoledger`/);
  assert.match(taskExec.source, /Load `repoledger`/);
  assert.match(taskExec.source, /link the canonical `Task\.md`/);
  assert.match(taskExec.source, /do not ask the user to provide or repeat a commit ID/);
  assert.match(core.source, /Delivery\s+approval remains bound to the exact primary commit/);
  assert.match(readme, /--skill repoledger --skill task-new --skill task-exec/);
  assert.doesNotMatch(readme, /--skill repository-task-ledger/);
});