# Refine task entry input routing

Created: 2026-09-15

## Goal

Make `task-new` naturally turn the settled outcome of the current conversation
into a repository task without requiring an argument, and make `task-exec`
naturally execute an attached canonical `Task.md` without requiring the user to
restate its name or description.

## Context

The two user-facing entry skills currently present command-style argument hints:
`<implementation idea>` for `task-new` and `<task name or description>` for
`task-exec`. Their routing text likewise starts from supplied prose even though
the agent already has the active conversation and may have an attached task
artifact.

A more natural conversational workflow is to discuss an idea until its outcome
and boundaries are settled, then invoke `/task-new` with no argument to record
that understanding. Existing work has a different durable source of truth: the
user should be able to attach its `Task.md` and invoke `/task-exec` without
translating the artifact back into a textual lookup query.

New-task intake needs only semantic duplicate detection, not execution-time
workspace coordination. An unrelated dirty worktree, implementation change, or
active claim should not distract from recording an admitted outcome. When an
active task already appears to track that outcome, however, the user should
choose whether to add the new context there or create a distinct task.

## Scope

- Revise the `task-new` description, argument hint, and intake routing so direct
  arguments are optional and the latest settled outcome in the active
  conversation is the primary source for a no-argument invocation.
- Limit `task-new` overlap inspection to active backlog and ongoing tasks whose
  outcomes plausibly match the current discussion. When one matches, present it
  and ask whether to merge the new context into that task or create a distinct
  task instead of choosing silently.
- Keep unrelated worktree changes, implementation-surface overlap, and
  nonmatching active claims out of the new-task intake decision.
- Revise the `task-exec` description, argument hint, and target routing so one
  attached canonical `Task.md` is the preferred task locator, with task name,
  description, and explicit conversation context retained as fallbacks.
- Define precedence and ambiguity behavior so stale discussion, rejected
  alternatives, multiple possible outcomes, or multiple task artifacts do not
  cause the agent to guess.
- Add or update focused validation for both entry-routing contracts and skill
  discovery metadata.

## Out of scope

- Changing admission, identity, claim, publication, acceptance, handoff,
  abandonment, archival, or any other core task-lifecycle rule.
- Changing the task-ledger layout, `Task.md` schema, or repository profile.
- Adding a VS Code-specific prompt, custom agent, attachment API, or command
  implementation in place of the portable Agent Skills.
- Reopening or rewriting the archived task that originally introduced the two
  entry skills.

## Acceptance criteria

- [x] `task-new` metadata presents command text as optional, and invoking
      `/task-new` without an argument after a sufficiently specified discussion
      uses the latest settled implementation outcome instead of asking the user
      to restate it.
- [x] A no-argument `/task-new` invocation counts as an explicit request to
      record one sufficiently specified, admitted outcome, while unresolved
      alternatives, missing acceptance boundaries, or multiple plausible
      outcomes produce only the smallest necessary clarification.
- [x] Before creating a task, `task-new` compares that outcome with current
  active task definitions; a plausible match identifies the existing task
  and asks the user to choose between merging the context there and creating
  a separate task.
- [x] Unrelated dirty files, implementation work, and nonmatching claims neither
  block `task-new` nor trigger intake questions, while any resulting ledger
  publication still preserves those unrelated changes.
- [x] `task-exec` metadata presents an attached `Task.md` as the primary input,
      and invoking `/task-exec` with exactly one canonical task attachment
      resolves its owning repository and current ledger position without
      requiring a duplicate name or description.
- [x] The attached task is used as a locator rather than a potentially stale
      snapshot: execution refreshes shared state and reads the latest canonical
      task and progress artifacts before choosing the backlog, current-owner,
      other-owner, or archived route.
- [x] When no usable task attachment is present, `task-exec` still resolves from
      an optional task name or description and explicit conversation context;
      conflicting or multiple targets stop for the smallest clarification.
- [x] Both entry skills continue to load `repository-task-ledger`, fail closed
      when it is unavailable, preserve its sole authority over lifecycle
      policy, and avoid duplicating core implementation details.
- [x] Focused routing checks, skill discovery validation, repository checks,
      local-link validation, and `git diff --check` all pass.

## Constraints

- Keep both entry skills small, portable, and compatible with clients that do
  not support attachments or slash-command presentation.
- Treat the latest explicit user instruction as stronger than older session
  context, and do not turn exploratory or rejected discussion into task scope.
- Preserve the existing admission boundary and autonomous publication rules.
- Preserve unrelated in-progress work and other task-ledger entries.

## References

- [task-new entry skill](/skills/task-new/SKILL.md)
- [task-exec entry skill](/skills/task-exec/SKILL.md)
- [Repository task ledger](/skills/repository-task-ledger/SKILL.md)
- [Original entry-skills task](/tasks/archived/add-task-entry-skills/Task.md)