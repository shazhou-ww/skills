---
name: task-exec
description: "Claim, resume, and complete an existing repository task, preferably from an attached canonical Task.md. Use when the user invokes /task-exec, attaches a task, or asks to execute backlog or ongoing work."
argument-hint: "[attach Task.md or optionally name a task]"
user-invocable: true
---

# Execute Repository Task

Use this entry skill for execution. The repository task lifecycle itself
belongs to the `repository-task-ledger` skill.

## Load The Protocol

Before resolving, claiming, or changing a task:

1. Load the installed `repository-task-ledger` skill by name and follow it as
   the authoritative protocol.
2. Load the repository's local agent instructions and task profile as required
   by that protocol.

If `repository-task-ledger` is unavailable, stop and identify that missing
skill as the blocker. Ask for the complete skill package to be installed. Do
not reconstruct the protocol from memory, invent a substitute workflow, or
change task or implementation files without it.

## Resolve The Execution Target

- Prefer one attached canonical `Task.md` as the execution locator. Use its
  owning repository and task identity to find the task in the latest ledger;
  treat the attachment as a locator, not as an authoritative content or status
  snapshot.
- When there is no usable task attachment, resolve from an optional supplied
  task name or description, then from explicit conversation context. The
  latest explicit user instruction takes precedence over older context.
- Refresh the shared primary branch and read the latest canonical `Task.md` and
  `Progress.md`, when present, before deciding the task's current backlog,
  ongoing, or archived route.
- Proceed only with one unambiguous task in one owning repository. If there is
  no match, conflicting locators, multiple attachments or plausible matches,
  or ambiguous repository ownership, stop and ask for the smallest
  clarification. Do not silently create a new task; route new intake through
  `task-new`.
- For a backlog match, follow the core protocol to validate identity and
  overlap, claim and publish the task, and only then begin implementation.
- For a task already ongoing under the current worktree identity, refresh its
  shared state and resume from its durable task and progress records.
- For a task owned by another identity, do not take it over implicitly. Follow
  the core protocol's overlap, coordination, and handoff guidance.
- For an archived match, report its recorded outcome and stop rather than
  silently reopening or duplicating it.

## Execute Through The Core Lifecycle

After resolving the route, follow `repository-task-ledger` and the repository
profile as the sole authority for implementation, validation, progress,
publication, acceptance, handoff, abandonment, and archival. Continue until
the task reaches its next genuine external blocker or its completed archive
state; do not pause merely to request permission for routine lifecycle actions
that the core protocol already authorizes.

Finish by reporting the resolved task, resulting ledger state, validation
outcome, and shared-primary-branch publication state. When blocked, preserve
the exact blocker and next action in the task progress record before reporting
it.