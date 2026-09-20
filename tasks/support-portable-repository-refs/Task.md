# Support portable repository and task source refs

Created: 2026-09-20

## Goal

Make repoledger state portable across clones by identifying the authoritative
primary repository independently of local Git remote names and recording a
resolvable source repository and branch for every ongoing task, so another
device or collaborator can discover and continue the work.

## Context

The committed `repoledger.yaml` currently stores a Git remote name such as
`origin`. Remote names and their targets are clone-local, so the same committed
configuration can resolve to different repositories or fail in another clone.
The authoritative primary branch instead needs a repository identity shared by
all participants.

The current status contract deliberately excludes task source branches. That
keeps local checkout details out of shared state, but it also removes the
portable rendezvous point needed when work moves between devices or
collaborators. An ongoing task needs to identify a published source ref without
encoding a local remote alias or checkout.

## Scope

- Replace the committed local remote name with a versioned
  `primaryRepository` and `primaryBranch` contract, including an explicit
  migration or compatibility path from the current configuration.
- Define repository URL syntax, validation, credential safety, equivalence,
  and interaction with local Git transport configuration.
- Extend ongoing task records with a required `sourceBranch` and an optional
  `sourceRepository`; an omitted source repository resolves to the configured
  primary repository.
- Define canonical serialization, state-transition rules, and migration for
  the new task source fields.
- Update initialization, task start, status and list reporting, remote checks,
  publication, completion, and abandonment behavior for the new repository
  and source-ref model.
- Define deterministic behavior for a source branch in the primary repository
  and in a fork, including publication ordering, verification, retries, and
  partial-failure reporting.
- Update schemas, CLI documentation, reusable task skills, repository policy,
  package contents, and focused tests to match the approved contract.

## Out of scope

- Depending on GitHub, pull requests, Issues, or another hosting-provider API.
- Storing credentials, access tokens, machine-local paths, or local Git remote
  names in committed repoledger state.
- Managing a contributor's local checkout, upstream configuration, or worktree.
- Automatically merging, rebasing, force-updating, or deleting source branches.
- Changing the four lifecycle states or stable task-directory layout except
  where migration of the new fields requires it.

## Acceptance criteria

- [x] `repoledger.yaml` identifies the primary repository and branch without a
  committed clone-local remote name, with matching runtime validation, schema,
  canonical serialization, documentation, and migration behavior.
- [x] Two clones with different remote names can read, validate, and publish
  against the same configured primary repository without editing committed
  configuration.
- [x] Every ongoing task has a valid `sourceBranch` and may omit
  `sourceRepository` to inherit `primaryRepository`; non-ongoing records cannot
  retain source-ref fields.
- [x] Starting a task records a published, remotely readable source ref, and
  status/list output makes that effective repository and branch discoverable
  to another clone.
- [x] Remote validation detects missing, unreadable, or invalid primary and
  task source refs with actionable structured diagnostics.
- [x] Cross-repository source refs have documented and tested publication,
  retry, conflict, and partial-failure behavior without force-pushing or
  silently targeting a different repository.
- [x] Completion and abandonment remove task source fields from canonical
  status without automatically deleting the referenced branch.
- [x] Existing valid repositories have a documented, tested migration path
  that preserves task state, timestamps, artifacts, and accepted Git history.
- [x] `pnpm check`, `pnpm check:skills`, package checks, Markdown links, and
  whitespace validation pass with the revised contract.

## Constraints

- Keep the protocol Git-native, hosting-provider-neutral, and independent of
  local remote aliases and pull-request mechanics.
- Treat the configured primary repository and branch as the sole authority for
  task lifecycle state while treating an ongoing source ref as a discoverable,
  mutable collaboration location rather than accepted history.
- Never serialize credentials or rely on one participant's SSH, HTTPS, URL
  rewrite, or push-URL preference as shared configuration.
- Preserve non-force publication, optimistic concurrency checks, deterministic
  YAML, isolated Git operations, and unrelated worktree state.
- Resolve URL normalization, default materialization, source-branch creation,
  and cross-repository transaction boundaries at the required design reviews
  before implementing those surfaces.

## Human review checkpoints

Task creation records this plan, not approval. Scope alignment and delivery
acceptance are always required for completed work.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User | Goal, scope, exclusions, constraints, and acceptance criteria in this task. | Substantive implementation. |
| Business and data model | Required | User | Published task design covering configuration and status schemas, repository identity, source-ref invariants, defaults, lifecycle rules, and migration. | Changing parsers, schemas, serializers, transitions, or repository data. |
| Interface | Required | User | Published task design covering CLI grammar, defaults, reports, diagnostics, compatibility, and observable Git effects. | Changing the repoledger CLI or public package contract. |
| Architecture | Required | User | Published task design covering repository resolution, namespaced fetched refs, fetch/push boundaries, cross-repository ordering, retries, and verification. | Changing Git transport, publication, or remote-validation internals. |
| Delivery acceptance | Required | User | Published implementation, migrated repository, final contract diff, and validation evidence. | Running `task complete` for the exact approved primary commit. |

## References

- [Repository task profile](/docs/repository-tasks.md)
- [Current command design](/tasks/redesign-repoledger-state-management/repoledger-command-design.md)
- [Previous state-management task](/tasks/redesign-repoledger-state-management/Task.md)