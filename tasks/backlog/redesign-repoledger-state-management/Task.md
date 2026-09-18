# Redesign repoledger state management

Created: 2026-09-18

## Goal

Replace path- and worktree-identity-based task tracking with stable task
directories, a canonical YAML status ledger, branch-based collaboration, and a
repoledger CLI that queries and publishes validated state transitions through
Git.

## Context

The current lifecycle encodes backlog, ownership, and archival state by moving
task directories through identity-specific paths. That requires identity
configuration, move transactions, recovery journals, and reference rewrites,
while human review performed from another device cannot inspect unpublished
work.

The accepted direction keeps every task at one stable path, records lifecycle
state and the active collaboration branch in `tasks/status.yaml`, and uses the
remote Git branch as the cross-device review surface. The current consolidated
discussion draft at `docs/task-collaboration-workflow.md` must be split into
focused storage, use-case, and command-design artifacts before implementation.

## Scope

- Create `docs/repoledger-storage-model.md` covering the stable directory
  layout, `repoledger.yaml` and `tasks/status.yaml` formats, TypeScript schema
  definitions, invariants, timestamps, lifecycle transitions, and migration.
- Create `docs/repoledger-use-cases.md` covering human and agent use cases and
  the repository checks, Git operations, conflict handling, and review flow for
  each use case.
- Create `docs/repoledger-command-design.md` covering every repoledger
  subcommand, options, preconditions, execution logic, structured results,
  idempotency, and failure behavior.
- Replace worktree identity lanes and movable backlog, ongoing, and archived
  task paths with stable `tasks/<task-name>/` directories and a canonical,
  sorted `tasks/status.yaml` ledger.
- Replace `repoledger.json` with the specified `repoledger.yaml` repository
  configuration and implement strict YAML parsing and validation.
- Refocus repoledger on task registration, state queries, validation, legal
  lifecycle transitions, timestamp maintenance, collaboration-ref checks, and
  automatic Git commit and publication.
- Make task mutations refresh remote state, recompute on the latest primary
  branch, commit only owned paths, publish with non-force and atomic ref
  updates where required, verify publication, and report conflicts without
  overwriting concurrent work.
- Update the reusable task-ledger skills, templates, repository profile, CLI
  documentation, schemas, tests, and package contents for the new model.
- Migrate this repository's configuration and all existing task artifacts to
  the stable layout without losing task content or historical Git reachability.

## Out of scope

- Depending on GitHub pull requests, Issues, or another hosting-provider API.
- Automatically resolving content conflicts or treating the status ledger as a
  distributed lock.
- Inferring human approval from Git activity or storing detailed checkpoint
  evidence in `tasks/status.yaml`.
- Preserving the former identity, directory-move, or archive command model as a
  permanent compatibility surface.
- Migrating repositories other than this repository as part of the initial
  implementation.

## Acceptance criteria

- [ ] The three planned design documents exist, agree on terminology and
  behavior, and contain no unresolved contract contradictions.
- [ ] `repoledger.yaml` and `tasks/status.yaml` have strict documented and
  machine-validated schemas matching their TypeScript definitions.
- [ ] Task records use only `backlog`, `ongoing`, `completed`, or `abandoned`;
  ongoing records uniquely name a collaboration branch, and repoledger alone
  maintains immutable `createdAt` and mutation-based `updatedAt` timestamps.
- [ ] Every task has one stable `tasks/<task-name>/` directory and exactly one
  alphabetically ordered `tasks/status.yaml` record, with all existing task
  artifacts migrated intact.
- [ ] The implemented CLI exposes the approved initialization, status, check,
  registration, start, completion, and abandonment commands with documented
  text and JSON results.
- [ ] Every task write command performs its required fetch, optimistic state
  check, deterministic YAML update, validation, commit, non-force push, and
  post-publication verification without modifying unrelated worktree state.
- [ ] Multi-ref start and terminal transitions fail rather than partially
  publish when atomic publication is unavailable or rejected.
- [ ] Concurrent unrelated task updates can be recomposed, while same-task,
  owned-path, validation, ref-tip, authentication, and push conflicts stop with
  actionable structured diagnostics and never force-push.
- [ ] Identity lanes, directory-move transactions, recovery journals, and
  move-sensitive reference rewriting are removed from the active protocol and
  implementation.
- [ ] The reusable skills, templates, repository instructions, package README,
  schemas, tests, and release contents consistently describe and enforce the
  new workflow.
- [ ] `pnpm check`, `pnpm check:skills`, package checks, Markdown links,
  Mermaid rendering, and whitespace validation pass after migration.

## Constraints

- Keep the protocol Git-native, hosting-provider-neutral, and independent of
  pull-request mechanics.
- Never force-push, discard concurrent commits, overwrite unrelated local
  changes, or infer a conflict resolution.
- Bind every human approval to an immutable reviewed commit and reopen a
  checkpoint when reconciliation materially changes the approved result.
- Keep canonical YAML deterministic: task keys are alphabetically ordered,
  record fields have a fixed order, unknown properties are rejected, and UTC
  timestamps use the documented second-precision format.
- Preserve historical task artifacts and accepted collaboration commits during
  migration; delete a collaboration ref only after required history is proven
  reachable from the refreshed primary branch.
- Obtain the applicable data-model, interface, and architecture approvals
  before implementing their protected surfaces.

## Human review checkpoints

Task creation records this plan, not approval. Scope alignment and delivery
acceptance are always required for completed work.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User | Goal, scope, exclusions, constraints, acceptance criteria, and three-document delivery plan in this task. | Substantive implementation beyond preparing the review documents. |
| Business and data model | Required | User | `docs/repoledger-storage-model.md` with YAML and TypeScript schemas, invariants, lifecycle, timestamps, and migration mapping. | Implementing parsers, schemas, status transitions, or repository data migration. |
| Interface | Required | User | `docs/repoledger-command-design.md` with command grammar, outputs, Git side effects, compatibility, idempotency, and failures. | Changing the repoledger CLI or its public package contract. |
| Architecture | Required | User | The three design documents together, including use-case flows, module responsibilities, Git transaction boundaries, and removal of legacy subsystems. | Replacing identity, layout, transition, transaction, and publication internals or changing task-ledger skills. |
| Delivery acceptance | Required | User | Published implementation, migrated repository, validation evidence, and final diff against the approved designs. | Marking the task completed and archiving it. |

## References

- [Repository task ledger skill](/skills/repository-task-ledger/SKILL.md)
- [Repository task profile](/tasks/README.md)