# Shared agent skills

Reusable Agent Skills maintained for projects under `shazhou-ww`.

## Review communication skills

### ui-change-review

[`ui-change-review`](skills/ui-change-review/SKILL.md) creates a focused,
standalone before/after HTML comparison for an existing UI change. It keeps the
current and proposed states comparable, implements only decision-relevant
interaction, and validates the rendered desktop and mobile result without
turning the artifact into a full prototype.

```text
/ui-change-review [affected UI or review goal]
```

Install it independently with:

```sh
npx skills add shazhou-ww/skills --skill ui-change-review
```

### business-data-model-review

[`business-data-model-review`](skills/business-data-model-review/SKILL.md)
creates a compact Mermaid ER review centered on business ownership,
relationships, invariants, migration, and lifecycle. It defines append-only
`<<AO>>` and ephemeral immutable `<<EI>>` stereotypes and requires their
concrete lifecycle rules to accompany the diagram.

```text
/business-data-model-review [model change or review goal]
```

Install it independently with:

```sh
npx skills add shazhou-ww/skills --skill business-data-model-review
```

Both skills optimize the primary artifact for a five-minute human review. They
can be used independently of each other and of the repository task ledger.

## User-facing entry skills

### task-new

[`task-new`](skills/task-new/SKILL.md) turns the settled implementation outcome
of the active conversation into a backlog task after admission passes. It runs
only when the user explicitly selects this entry; ordinary implementation
requests and agent recommendations never trigger it. Invoke it once the
discussion is ready to record; extra command text is optional:

```text
/task-new
```

Before creating anything, it checks active task definitions for the same
outcome. A plausible match prompts the user to choose between merging the new
context into that task and creating a distinct task; unrelated workspace work
does not block intake.

### task-exec

[`task-exec`](skills/task-exec/SKILL.md) resolves one existing task, then claims
or resumes it and follows the repository lifecycle to completion or a genuine
external blocker. Prefer attaching its canonical `Task.md` and invoking:

```text
/task-exec
```

The attachment locates the task; execution refreshes the shared ledger and
reads its latest canonical artifacts rather than trusting an attached snapshot.
When attachments are unavailable, a task name, description, or explicit
conversation context remains a supported fallback.

## Protocol core

### repository-task-ledger

[`repository-task-ledger`](skills/repository-task-ledger/SKILL.md) is the single
authoritative protocol shared by both entry skills. It keeps implementation
work that the user explicitly opts into in a repository-owned `tasks/` ledger
when that repository owns changes outside its own `tasks/**`. Issues remain the
open intake surface, while task state, worktree claims, decisions, handoffs,
and validation travel with the code.

Claims, review artifacts, human approval evidence, meaningful implementation
checkpoints, implementation completion, and archival are published through the
repository's shared primary branch. Every task plans scope and delivery gates,
plus interface, business and data model, and architecture gates when relevant.
Tasks that need manual user testing carry a standalone, user-facing guide while
they remain ongoing; final delivery approval remains a separate explicit
decision.

Install all three skills together with:

```sh
npx skills add shazhou-ww/skills --skill repository-task-ledger --skill task-new --skill task-exec
```

Each skill remains independently discoverable and installable, but the entry
skills deliberately stop when the core is missing. Agent Skills do not define
runtime-enforced dependencies: each entry asks the agent to load
`repository-task-ledger` by name, so composition is model-mediated. The core
uses `user-invocable: false`; clients that honor this extension hide its direct
slash entry while retaining model loading, and other clients may ignore it or
present skills without slash commands.

Projects should still require the core skill from their checked-in agent
instructions after a user selects an entry flow or asks to manage an existing
task. Installation makes the skills discoverable; project instructions must
preserve explicit opt-in rather than turning ordinary natural-language
implementation requests into tasks.

## Deterministic validation

[`repoledger`](packages/repoledger/README.md) is the npm-distributed companion
CLI for filterable task inventory, strict YAML validation, stable lifecycle
state, and isolated publication to the configured primary branch. It does not
replace the skill's judgment about admission, overlap, or human approval.

```sh
npx repoledger@0.6.1 check
npx repoledger@0.6.1 task list --state ongoing
```

Repositories should pin the package for CI and run `check --remote`. The
versioned configuration and task-record contract is the GitHub-hosted
[`schema/v1.json`](packages/repoledger/schema/v1.json).

The lifecycle commands are `task register`, `task start`, `task complete`, and
`task abandon`. Task paths remain stable and records never contain an identity
or source branch. Mutations fetch primary, construct and validate an isolated
commit, push without force, and verify publication while preserving the
caller's branch, index, and unrelated worktree files.

## Project release skill

Repository maintainers can invoke the project-only release workflow with:

```text
/publish repoledger minor
```

The [`publish` skill](.github/skills/publish/SKILL.md) prepares and validates
the release commit, creates the protected `npm/repoledger/v<version>` tag on
`origin/main`, follows the GitHub Actions trusted-publishing run, and verifies
the immutable npm result. It never runs `npm publish` locally.
