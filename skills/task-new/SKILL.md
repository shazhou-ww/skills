---
name: task-new
description: "Discuss, triage, and record a repository implementation task from the current conversation. Use when the user invokes /task-new with or without extra context, proposes an idea, or asks to add accepted work to a backlog."
argument-hint: "[optional task context]"
user-invocable: true
---

# New Repository Task

Use this entry skill for intake. The repository task lifecycle itself belongs
to the `repository-task-ledger` skill.

## Load The Protocol

Before reading or changing task-ledger state:

1. Load the installed `repository-task-ledger` skill by name and follow it as
   the authoritative protocol.
2. Load the repository's local agent instructions and task profile as required
   by that protocol.

If `repository-task-ledger` is unavailable, stop and identify that missing
skill as the blocker. Ask for the complete skill package to be installed. Do
not reconstruct the protocol from memory, invent a substitute workflow, or
create task files without it.

## Route The Intake Intent

- Resolve the candidate from the latest explicit user direction and the settled
  outcome of the active conversation. Text supplied with `/task-new` is
  optional and supplements or overrides older context. When the conversation
  already contains exactly one sufficiently specified outcome, do not ask the
  user to restate it.
- Treat invoking `/task-new` as an explicit request to record that candidate.
  When the outcome is sufficiently specified and passes the core admission
  rule, the invocation counts as acceptance; exploratory discussion without
  that request does not.
- Discuss only enough to identify the owning repository, one testable outcome,
  important boundaries, and observable acceptance criteria.
- Inspect the latest backlog and ongoing task definitions only for an active
  task that plausibly tracks the same implementation outcome. Do not turn
  unrelated claims, dirty files, or implementation-surface overlap into intake
  blockers or questions, and preserve unrelated work during publication.
- When an active task plausibly matches, identify it and ask the user whether
  to merge the new context into that task or create a distinct task. Do not
  choose, mutate the match, or create another task until the user decides.
- Apply the core protocol's admission rule. Create a backlog task only when the
  implementation outcome is accepted and admission passes. Ask only for the
  smallest missing decision when the candidate, repository, boundaries,
  acceptance criteria, or duplicate route remains ambiguous.
- Leave rejected, duplicate, still-unconfirmed, and task-free requests outside
  the task ledger, following the core protocol's intake guidance.
- When a task is admitted, use the core protocol's template, location,
  repository profile, validation, and publication requirements.

Finish by reporting whether the candidate was admitted and whether it was
merged or created. When created, include the task's canonical backlog path and
published state. Do not claim or implement the task unless the user explicitly
changes the intent to execution.