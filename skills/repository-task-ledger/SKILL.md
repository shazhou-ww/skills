---
name: repository-task-ledger
description: "Authoritative lifecycle protocol loaded by task-new and task-exec. Use when triaging accepted work expected to change files outside the owning repository's own tasks/**, or when claiming, resuming, handing off, completing, or abandoning an existing repository task."
user-invocable: false
---

# Repository Task Ledger

Manage accepted work as versioned repository content so its state and context
can move across devices, people, agents, worktrees, and hosting platforms.

This workflow is a coordination protocol, not a distributed lock. Its purpose
is to make intent and overlap visible early enough to avoid wasted work when
participants follow the same convention.

## Admit Only Implementation Work

The admission rule governs creating a new repository task. Evaluate it against
the repository that owns the accepted implementation outcome. Create a task
there only when that outcome is expected to add, modify, rename, or delete at
least one file outside that same repository's own `tasks/**` directory. Use
this path boundary rather than complexity, duration, number of steps, or which
skill is involved.

Files outside `tasks/**` include source, tests, documentation, configuration,
workflows, scripts, instructions, and skills. A new file intended to be
tracked also counts.

Do not create a new task solely to:

- learn, read, configure, or use this skill;
- answer a question or perform read-only investigation, planning, or review;
- run commands, tests, validation, inventory, or diagnostics without changing
   repository files outside `tasks/**`;
- create, claim, update, hand off, archive, or otherwise maintain task-ledger
   files; or
- perform external-only operations that do not change repository files.

If task-free work later reveals that an edit outside `tasks/**` is needed,
stop before the first such edit, triage the implementation outcome, and create
or claim its task. Do not create a task retroactively after implementation has
already begun.

This admission rule does not end an existing task during a read-only phase.
Once implementation work has been admitted, continue updating that task until
it is completed, abandoned, or handed off. Repositories may also impose a
separate operational change-management process for external systems.

### Choose The Owning Repository

For work spanning repositories, apply the admission rule to each independently
owned implementation outcome, not mechanically to every checkout touched:

- Create the source task in the repository that owns the primary design and
   implementation change.
- Treat generated files, installed copies, lockfile refreshes, or equivalent
   downstream updates that only consume that source change as part of the source
   task. Reference the source task from the downstream change when practical;
   do not create a mirrored task solely for the synchronization.
- If a downstream repository needs its own design, adaptation, tests,
   configuration, or other independently maintained changes outside its own
   `tasks/**`, create or claim a task in that repository before those edits.
- Work performed only in another repository never admits a task in the current
   repository unless the current repository also owns an implementation change
   outside its own `tasks/**`.

When more than one repository owns implementation, use one task in each owning
repository and link them rather than copying one task between repositories.

## Start With Local Policy

1. Read the repository's agent instructions and `tasks/README.md`, if present.
2. Treat project-specific rules as authoritative where they refine this skill.
3. Resolve and validate the current worktree identity as described below.
4. Inspect `tasks/backlog/` and every identity below `tasks/ongoing/` before
   creating or claiming related work.
5. Preserve unrelated worktree changes. Never move, rewrite, or archive another
   identity's task merely to clear a conflict.

## Publish Through The Shared Primary Branch

The shared primary branch is the repository-declared collaboration branch,
commonly `main` or `master`. The project profile must name the remote and
branch when they cannot be discovered unambiguously. References to the shared
primary branch in this skill mean that declared branch, not a hard-coded branch
name or an agent-created substitute.

Accepted work and repository policy authorize the routine, non-force Git
operations needed to carry that work through its lifecycle. Once those
preconditions are satisfied, do not ask the user whether to commit, push, or
integrate merely because one of those routine operations is the next task
step. Perform it autonomously through the repository's normal direct-push,
merge, or pull-request path.

This autonomy does not bypass authentication, protected branches, required
review, explicit approval rules, failed validation, push rejection, or
unresolved conflicts. Never force-push as a shortcut. When the normal path
cannot be completed autonomously, leave the milestone incomplete, record the
blocker and exact next action in `Progress.md`, and ask only for the user action
that the repository or hosting platform actually requires.

A publication milestone is complete only when its commit is reachable from the
refreshed remote shared primary branch. A local commit, a pushed side branch,
or an open but unmerged pull request does not satisfy it. Before each
publication, refresh the remote branch, reconcile concurrent work without
discarding it, run the relevant focused checks, publish through the normal
integration path, and verify the resulting remote state.

Every completed task requires at least three distinct shared-primary-branch
integrations:

1. **Claim:** publish the move into the current identity lane before
   substantive implementation.
2. **Implementation complete:** publish the finished implementation,
   validation evidence, and any user acceptance guide while the task remains
   ongoing.
3. **Archive:** after all required acceptance is satisfied, publish the move to
   `tasks/archived/` as the task's final recorded action.

Do not combine claim with implementation completion or implementation
completion with archival. A task may and often should have more publications
for meaningful substantive checkpoints, fixes after failed acceptance,
handoffs, or other durable progress.

## Separate Intake From Execution

Keep Issues or another external tracker as the open intake surface. People who
cannot modify the repository must still be able to report bugs and request
work.

Create a repository task only after triage accepts the work and the admission
rule above is satisfied:

1. Create `tasks/backlog/<task-name>/Task.md` from
   [the task template](./assets/Task.md).
2. Rewrite the accepted outcome, boundaries, constraints, and observable
   acceptance criteria; do not merely copy the Issue conversation.
3. Link the Issue and task in both directions when the tracker permits it.
4. Leave rejected, duplicate, still-unconfirmed, and task-free requests outside
   the task ledger.

One Issue may produce several tasks, and several Issues may be consolidated
into one task.

## Establish A Worktree Identity

Each worktree should normally use one stable identity. An identity may name a
person, an agent, a team, or another actor chosen under the team's convention.
The workflow does not require identities to represent humans.

An authoritative worktree identity uses two records with different scopes:

- `tasks/ongoing/<identity>/.gitkeep` on the shared primary branch registers and
  reserves the identity for collaboration.
- `task-ledger.identity` in Git's worktree-scoped config identifies which
  registered identity the current worktree uses.

An optional `task-ledger.defaultIdentity` value in Git's global config may
suggest a candidate during initialization. It is device-local convenience, not
a third identity record: it neither registers the name in a repository nor
binds any worktree, and task work must never fall back to it.

Do not store the local binding in `.env`, an environment variable, a tracked
file, or ordinary repository-local Git config. Application environment files
have the wrong ownership and may contain secrets; ordinary local Git config is
shared by linked worktrees.

### Configure An Optional Device Default

Set a usual identity for this device only when that suggestion is useful across
repositories:

```sh
git config --global task-ledger.defaultIdentity <identity>
```

The value must use lowercase kebab-case. Keep it in global Git config, which is
machine-local, and never copy it into tracked repository configuration. Setting
or changing it does not initialize any worktree. Remove an obsolete suggestion
with `git config --global --unset task-ledger.defaultIdentity`.

### Resolve An Existing Binding

Before task work, run:

```sh
git config --local --get extensions.worktreeConfig
git config --worktree --get task-ledger.identity
```

The first command must return `true`. The second must return one lowercase
kebab-case identity. Fetch the shared primary branch and verify that
`tasks/ongoing/<identity>/.gitkeep` exists there. If the extension, value, or
remote registration is missing or invalid, stop before claiming or resuming a
task. Do not substitute the global default for a missing worktree value, and do
not infer the identity from the worktree path, branch name, operating system
user, agent name, or the only visible identity lane.

To inspect where Git read the value from, use:

```sh
git config --show-origin --show-scope --get task-ledger.identity
```

It must report worktree-scoped configuration. A new clone or worktree must
establish its own binding; the value intentionally does not travel with Git
history. The optional device default is deliberately outside this resolution
path.

### Initialize A New Binding

Before using a new identity:

1. Inspect `core.worktree` and `core.bare` before enabling worktree config:

   ```sh
   git config --local --get core.worktree
   git config --local --type=bool --get core.bare
   ```

   For an ordinary non-bare repository, `core.worktree` is absent and
   `core.bare` is absent or `false`. If `core.worktree` is present or
   `core.bare` is `true`, stop and follow Git's `extensions.worktreeConfig`
   migration requirements before continuing.
2. Enable worktree-specific configuration once for the repository:

   ```sh
   git config --local extensions.worktreeConfig true
   ```

3. Fetch the shared primary branch and inspect the identity directories already
   present under `tasks/ongoing/` on that branch.
4. Choose a short lowercase kebab-case candidate explicitly. As input to this
   choice, initialization may read the device suggestion:

   ```sh
   git config --global --get task-ledger.defaultIdentity
   ```

   An absent value means there is no suggestion. Reject an invalid value rather
   than writing it. An explicit choice overrides the suggestion.
5. Check `tasks/ongoing/<identity>/.gitkeep` on the refreshed shared primary
   branch. A
   matching existing lane satisfies registration only after the initializer
   deliberately confirms it is the identity to bind; the global match alone
   is not confirmation. If another actor reserved the name, choose another.
6. When the selected identity is not registered, add
   `tasks/ongoing/<identity>/.gitkeep` in a clean coordination change.
7. Commit only that reservation and publish it through the repository's normal
   non-force shared-primary-branch integration path before using the identity
   for work.
8. If the push is rejected or the name appeared after the fetch, do not force
   the push. Fetch again, choose another identity, and retry.
9. Only after an existing or newly published registration is confirmed, bind
   the current worktree explicitly and verify the value and its origin:

   ```sh
   git config --worktree task-ledger.identity <identity>
   git config --show-origin --show-scope --get task-ledger.identity
   ```

Repeat registration validation and explicit binding for every worktree. For an
additional worktree on the same device, choose a registered override explicitly
instead of silently reusing the global suggestion; leave the device default
unchanged unless the usual identity for the device itself has changed.

The `.gitkeep` preserves the identity lane when it has no active task and
reserves the name against accidental reuse. Keep the identity stable for the
life of the worktree unless the team deliberately transfers it.

## Claim Accepted Work

Before substantive implementation:

1. Refresh the shared primary branch state.
2. Recheck the backlog, active claims, and nearby affected areas for overlap.
3. Move the whole task folder with Git history preserved:

   ```sh
   git mv tasks/backlog/<task-name> tasks/ongoing/<identity>/<task-name>
   ```

4. Apply the post-move checks in [Verify Every Task Move](#verify-every-task-move).
5. Create `Progress.md` from [the progress template](./assets/Progress.md).
6. Record the current state and the next concrete action.
7. Commit only the claim and its task artifacts, then publish and verify the
   claim milestone through the normal shared-primary-branch integration path
   before investing in substantive implementation.

## Verify Every Task Move

After a claim, handoff, completion, abandonment, or layout migration:

1. Verify that the destination contains every task artifact.
2. Verify that the source task directory no longer exists. Git does not track
   directories, so moving or deleting every tracked file can still leave an
   empty source directory behind. Remove it if it is empty; if it contains
   unexpected files, stop and reconcile them instead of deleting recursively.
3. Re-scan the task positions under `backlog`, every ongoing identity, and
   `archived`. Count every non-hidden directory in a task position even when it
   is empty, and verify that the task name appears in exactly one location.

Never copy a task between status or identity directories. Preserve each
identity lane and its `.gitkeep`; the source task directory beneath the lane is
what must disappear.

## Work And Record Progress

- Keep `Task.md` focused on the durable problem, scope, constraints, and
  acceptance criteria. Do not use it as a chronological log.
- Update `Progress.md` at meaningful checkpoints with the checklist, latest
  verified state, next action, decisions, validation evidence, and blockers.
- Before pausing, make the next action specific enough that another actor can
  resume without reconstructing the session.
- Commit substantive work at meaningful, validated checkpoints rather than
   accumulating one large uncommitted change. Update `Progress.md` with the
   checkpoint state and evidence, then publish each checkpoint that is safe for
   the shared primary branch through the repository's normal integration path.
   Do not publish a known-broken state merely to create a checkpoint.
- Keep task-specific research, inventories, plans, and captures in the task
  folder so they move with it.
- Put only accepted, stable project consensus in `docs/`; link extracted
  documents from `Task.md`.
- Never store credentials, tokens, private keys, private customer data, or
  machine-local secrets in task artifacts.

## Run User Acceptance When Required

Manual user acceptance is required only when an acceptance criterion explicitly
depends on user judgment, user-only access, physical interaction, or another
result the agent cannot validate. Do not invent a confirmation gate for work
whose acceptance criteria can be completed and verified autonomously.

When manual user acceptance is required:

1. Create `UserAcceptance.md` in the task folder from
   [the user acceptance template](./assets/UserAcceptance.md).
2. Replace every placeholder with task-specific prerequisites, exact numbered
   actions, expected results for each action, and an unambiguous way to report
   acceptance or failure. Keep it written for the user, not as an agent log.
3. Publish the guide with the implementation-complete milestone so the user
   tests the integrated shared-primary-branch result rather than unpublished
   local state.
4. Keep the task ongoing while acceptance is pending. Ask the user to follow
   the guide, and record only the result the user actually reports; never infer
   or fabricate acceptance.
5. If acceptance fails, record the observed result, resume implementation,
   publish the fix as another substantive checkpoint and refreshed
   implementation-complete milestone, then repeat the documented acceptance.

Once the user reports acceptance, record it and continue directly to archival.
Do not ask for a separate confirmation to commit or archive unless repository
policy requires one.

### Choose Stable Task Links

Standard Markdown defines file-relative links but does not define a repository
root. A project may use `/path/from/repository/root` for repository-local links
in task artifacts only when its checked-in task profile declares that all
supported renderers resolve a leading `/` from the repository or workspace
root. GitHub and VS Code support this convention. These links stay valid when a
task moves among backlog, identity-scoped ongoing, and archived locations.

When any supported renderer does not provide that behavior, use portable
file-relative Markdown links instead and update them as part of each task move.
Do not translate external URLs or fragment-only links, and do not couple local
links to a repository owner, remote URL, branch, or local filesystem path.

## Handle Overlap And Races

An identity lane and a task claim advertise intent; they do not guarantee
mutual exclusion.

When another claim or overlapping code area appears:

1. Stop before expanding the implementation.
2. Refresh the shared primary branch and compare the two tasks' goals, scope,
   and current state.
3. Coordinate ownership, collaboration, splitting, or sequencing explicitly.
4. Record the resolution and changed assumptions in the affected
   `Progress.md` files.
5. Preserve both actors' work until the owners agree on consolidation.

Early visibility and small coordination commits are the conflict-avoidance
mechanism. Do not claim that this workflow provides an absolute lock.

## Handoff

Before handing work to another identity:

1. Update the checklist, current verified state, decisions, validation,
   blockers, and next concrete action.
2. Ensure the destination identity is already registered on the shared primary
   branch.
3. Move the whole task folder to `tasks/ongoing/<new-identity>/<task-name>`.
4. Apply the post-move checks in [Verify Every Task Move](#verify-every-task-move).
5. Commit and publish the handoff before either identity continues.

## Complete Or Abandon Work

To complete work:

1. Finish the scoped implementation and every agent-verifiable acceptance
   criterion, then run the narrowest required validation.
2. Update `Task.md` and `Progress.md` with the verified state, validation
   evidence, and any still-pending manual user acceptance.
3. Commit and publish the implementation-complete milestone while the task is
   still under `tasks/ongoing/<identity>/`, then verify it on the refreshed
   remote shared primary branch.
4. If manual user acceptance is required, follow
   [Run User Acceptance When Required](#run-user-acceptance-when-required) and
   leave the task ongoing until the user reports acceptance.
5. Check every remaining acceptance criterion and record the actual result.
   Set the outcome to `Completed` only after all required acceptance passes.
6. Mark archive publication as the final task checklist action, move the whole
   task to `tasks/archived/<task-name>`, and apply the post-move checks in
   [Verify Every Task Move](#verify-every-task-move).
7. Commit the archive artifacts separately from implementation completion,
   publish through the normal shared-primary-branch integration path, and
   verify the remote archive state.

To abandon work, preserve the reason, useful findings, validation state, and
follow-up in `Progress.md`; set the outcome to `Abandoned`; move and verify the
task as above; and publish the archive move. Do not falsely record an
implementation-complete milestone for unfinished work.

Archived tasks do not retain an identity layer because they no longer have an
active owner. The Git history preserves prior claims and handoffs.

## Canonical Layout

```text
tasks/
|-- backlog/
|   `-- <task-name>/
|       `-- Task.md
|-- ongoing/
|   `-- <identity>/
|       |-- .gitkeep
|       `-- <task-name>/
|           |-- Task.md
|           |-- Progress.md
|           `-- UserAcceptance.md  # only when manual acceptance is required
`-- archived/
   `-- <task-name>/
      |-- Task.md
      |-- Progress.md
      `-- UserAcceptance.md      # preserved when one was required
```

For project setup, instruction wording, validation invariants, and migration
from a flat `ongoing/`, follow [the adoption guide](./references/adoption.md).