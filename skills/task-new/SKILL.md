---
name: task-new
description: "Discuss, triage, and record a new repository implementation task. Use when the user proposes an idea, asks to add accepted work to a task backlog, or invokes /task-new."
argument-hint: "<implementation idea>"
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

- Treat the user's input as a candidate implementation idea, not automatically
  as accepted work.
- Discuss only enough to identify the owning repository, one testable outcome,
  important boundaries, and observable acceptance criteria.
- Inspect the latest backlog and all ongoing claims before creating related
  work. Surface duplicates, overlap, or ownership ambiguity instead of
  guessing.
- Apply the core protocol's admission rule. Create a backlog task only when the
  implementation outcome is accepted and admission passes. An explicit request
  to record a sufficiently specified, admitted task counts as acceptance;
  otherwise ask for the smallest missing decision.
- Leave rejected, duplicate, still-unconfirmed, and task-free requests outside
  the task ledger, following the core protocol's intake guidance.
- When a task is admitted, use the core protocol's template, location,
  repository profile, validation, and publication requirements.

Finish by reporting whether the idea was admitted and, when created, the task's
canonical backlog path and published state. Do not claim or implement the task
unless the user explicitly changes the intent to execution.