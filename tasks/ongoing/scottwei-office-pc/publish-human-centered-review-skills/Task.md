# Publish human-centered UI and data review skills

Created: 2026-09-17

## Goal

Publish two independently usable Agent Skills that help agents prepare concise,
decision-ready UI change and business data model review artifacts for human
reviewers.

## Context

A UniCAS identity task demonstrated two useful review techniques: a focused
standalone HTML comparison for affected UI before/after states, and Mermaid ER
views that mark append-only (`<<AO>>`) and ephemeral immutable (`<<EI>>`)
entities. These techniques reduced ambiguity without requiring a complete UI
prototype or forcing reviewers to infer lifecycle semantics from prose.

Human attention is the limiting resource in these reviews. The reusable skills
must optimize for a short review rather than exhaustive documentation: lead
with the decision, isolate material changes, explain only the governing
principles and reasons, and move implementation detail or evidence to links or
appendices.

## Scope

- Add an independently discoverable `ui-change-review` skill for producing a
  compact, standalone before/after HTML comparison of only the affected UI
  surfaces and decision-relevant states.
- Require the UI comparison to be grounded in the current interface, preserve
  a fair scenario and data baseline, implement only interactions needed for
  review, and remain illustrative rather than replacing normative contracts or
  production UI.
- Add an independently discoverable `business-data-model-review` skill for
  communicating business entities, ownership, cardinality, invariants,
  lifecycle, migration, and compatibility through concise Mermaid ER views and
  supporting text.
- Define and visibly apply `<<AO>>` as append only and `<<EI>>` as ephemeral
  immutable, while treating unmarked entities as mutable and requiring the
  artifact to state the concrete lifecycle semantics behind each stereotype.
- Give both skills a default five-minute human review budget and a
  decision-first structure covering the requested decision, material changes,
  rationale, key visual or model, risks or open questions, and approval entry.
- Provide only the reusable templates, examples, or references needed to make
  each workflow reliable without imposing one product-specific visual style or
  data model.
- Document independent installation and discovery, and let
  `repository-task-ledger` recommend the relevant skill at applicable review
  checkpoints without making either skill a hard dependency.
- Add focused validation for skill discovery, frontmatter, local links,
  composition boundaries, and the required review-artifact guidance.

## Out of scope

- Changing the repository task lifecycle, approval semantics, or checkpoint
  applicability rules.
- Making either review skill mandatory for task-ledger users or requiring the
  ledger skill in order to use them.
- Building a full interactive prototype framework, production UI, database
  schema, migration, or product-specific review artifact.
- Requiring exhaustive field-by-field prose, implementation logs, or repeated
  task background in the human-facing review document.
- Publishing a new `repoledger` npm package version solely for these skill and
  documentation changes.

## Acceptance criteria

- [ ] Skill discovery lists `ui-change-review` and
      `business-data-model-review` as valid, independently installable Agent
      Skills with descriptions that reliably match their intended review
      scenarios.
- [ ] `ui-change-review` directs an agent to create a concise, standalone,
      responsive before/after HTML artifact grounded in the current UI, scoped
      to material changes, and explicit about its illustrative status.
- [ ] The UI workflow requires only decision-relevant interaction and states,
      plus focused desktop/mobile, overflow, keyboard, focus, and accessibility
      checks when applicable; it does not require a complete mock application.
- [ ] `business-data-model-review` directs an agent to create legible Mermaid
      ER views with keys, ownership, cardinalities, and material invariants,
      splitting large models by review question when that improves readability.
- [ ] The data-model workflow defines and renders `<<AO>>` and `<<EI>>`, states
      that unmarked entities are mutable, and pairs stereotypes with concise
      lifecycle rules so they are semantic rather than decorative labels.
- [ ] Both skills enforce a default five-minute human review budget, put the
      requested decision and key deltas first, avoid repeating source-task
      context, and move exhaustive derivation, implementation detail, and
      validation evidence out of the primary narrative.
- [ ] The two skills remain self-contained and independently useful;
      `repository-task-ledger` may recommend them at relevant checkpoints but
      does not fail when they are absent.
- [ ] Repository documentation explains purpose, invocation, installation,
      independence, and optional task-ledger composition without implying
      runtime-enforced dependencies.
- [ ] `pnpm check`, `pnpm check:skills`, focused skill contract tests, local
      Markdown link checks, and `git diff --check` pass.

## Constraints

- Keep the primary review artifact optimized for human scanning and approval;
  completeness belongs in linked source material or a clearly secondary
  appendix.
- Preserve a sharp boundary between communication artifacts and normative
  product contracts, production implementation, task state, and approval
  evidence.
- Use standard Agent Skills structure and portable Markdown/standalone HTML;
  optional client metadata and task-ledger composition must degrade safely.
- Keep the skills domain-neutral and avoid copying UniCAS-specific names,
  entities, credentials, or visual styling into reusable templates.
- Spell the lifecycle term as `Ephemeral Immutable` and ensure rendered Mermaid
  output preserves literal stereotype labels.

## Human review checkpoints

Task creation records this plan, not approval. Scope alignment and delivery
acceptance are always required for completed work.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User or accountable owner | This task's goal, scope, out of scope, constraints, and acceptance criteria. | Substantive implementation. |
| Interface | Required | User or delegated skill consumer | A compact skill contract covering names, discovery descriptions, invocation, outputs, human review budget, and examples. | Finalizing the public skill interfaces and user-facing documentation. |
| Business and data model | Not applicable: this task teaches model review but introduces no repository business entities, persistence schema, or migration. | Not applicable | Not applicable | Not applicable |
| Architecture | Required | User or delegated skill maintainer | The same compact skill contract covering independent ownership, bundled assets, optional ledger composition, and validation boundaries. | Adding cross-skill composition or shared assets. |
| Delivery acceptance | Required | User or accountable owner | Integrated skills, discovery and contract-test results, documentation, and concise example-output review. | Marking the task completed and archiving it. |

## References

- [Repository task ledger](/skills/repository-task-ledger/SKILL.md)
- [Skills repository profile](/tasks/README.md)
- [Repository overview](/README.md)