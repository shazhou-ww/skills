# Build the repoledger CLI

Created: 2026-09-15

## Goal

Publish a public npm CLI named `repoledger` that gives repositories using the
repository task ledger deterministic `check` and `doctor` commands.

## Context

The task-ledger protocol currently describes deterministic repository,
history, link, and worktree-identity invariants, but agents and repositories
reimplement those checks as one-off shell commands or project tests. UniCAS,
for example, has a passing `pnpm check:tasks` Vitest suite that mixes reusable
ledger checks with UniCAS-specific policy and still does not inspect the real
worktree-scoped identity binding.

On 2026-09-15, the unscoped npm name `repoledger` had no published package or
search collision. The similarly direct `taskledger` name was also unpublished,
but `taskledger-cli` already existed. This repository currently contains no
JavaScript package workspace.

## Scope

- Make this repository a private pnpm workspace and keep the public CLI in
  `packages/repoledger` while retaining the skills under `skills/`.
- Publish an npm package and executable named `repoledger` that works through
  `npx` without requiring pnpm in consuming repositories.
- Add `repoledger check` for CI-safe validation of repository task layout,
  portable names, identity lanes, unique task positions, required artifacts
  and sections, state constraints, declared link behavior, user-acceptance
  guides, publication evidence, and available Git history.
- Add `repoledger doctor` for local task-work readiness, including the static
  checks plus Git worktree configuration, authoritative identity scope and
  syntax, device-default separation, remote-branch freshness, and identity
  registration. Permit an explicitly degraded offline check.
- Provide concise human output, structured JSON output, actionable failures,
  and stable nonzero exit behavior.
- Define a language-neutral `repoledger.json` project configuration and a
  versioned validation contract without parsing natural-language project
  policy from `tasks/README.md`.
- Update the repository-task-ledger skill, templates, adoption guidance, and
  repository profile so new tasks use the versioned contract while existing
  archived history remains valid without bulk rewriting.
- Add cross-platform fixtures and automated tests for healthy repositories,
  malformed ledgers, legacy archives, shallow or incomplete Git history, and
  valid and invalid worktree identities.
- Document and validate the package build, tarball contents, versioning,
  compatibility, and npm publication path.

## Out of scope

- Mutating `init`, task creation, claim, handoff, completion, abandonment, or
  archive subcommands.
- Automatically editing Git configuration, task files, commits, branches, or
  shared remote history; `doctor` may refresh remote refs unless offline mode
  is explicitly requested.
- Encoding UniCAS-specific instruction wording, skill-lock provenance,
  documentation boundaries, or other repository policy in the public CLI.
- Replacing UniCAS's current validator in this source task; that adaptation is
  tracked separately.
- Treating the CLI as a replacement for admission, ownership, acceptance, or
  other decisions that remain in the skills.

## Acceptance criteria

- [ ] The repository is a private pnpm workspace with a publishable
      `packages/repoledger` package and no unintended task or skill artifacts
      in its npm tarball.
- [ ] A pinned published version can run `npx repoledger@<version> --help`,
      `check`, and `doctor` from a consuming repository on every documented
      supported platform and Node.js version.
- [ ] `repoledger check` passes this repository and representative valid
      fixtures, reports every scoped invariant violation with a useful path
      and remediation, emits machine-readable JSON on request, and returns a
      nonzero status for errors.
- [ ] `repoledger doctor` verifies the actual worktree-scoped identity and its
      refreshed shared-branch registration, distinguishes the optional global
      default from the authoritative binding, and gives deterministic errors
      for each missing or invalid prerequisite.
- [ ] CI-safe `check` does not require a developer identity or network access;
      local/remote readiness remains isolated in `doctor` with clearly marked
      offline behavior.
- [ ] The versioned contract strictly validates new and active tasks while
      preserving unversioned archived tasks as legacy records without forcing
      historical rewrites; fixture tests cover both paths.
- [ ] Full-history publication checks have documented behavior for complete,
      shallow, and unavailable Git history and never silently claim evidence
      that was not inspected.
- [ ] The repository-task-ledger skill and adoption guidance consistently
      explain when to use `check` versus `doctor`, while lifecycle decisions
      remain authoritative in the skill.
- [ ] Package tests, workspace validation, skill discovery, local-link checks,
      package packing checks, and diff hygiene all pass before publication.
- [ ] The initial `repoledger` npm release is publicly resolvable at the exact
      version recorded in validation evidence.

## Constraints

- Recheck the npm name immediately before publication. Do not silently rename
  the package or publish under a fallback name if `repoledger` becomes
  unavailable.
- Keep consuming-project behavior independent of pnpm and avoid unnecessary
  runtime dependencies.
- Preserve the protocol's repository-specific profile boundary instead of
  growing a general project-policy test framework.
- Do not weaken remote freshness, worktree-scope, identity-registration, task
  move, publication, or manual-acceptance requirements to simplify the CLI.
- Preserve unrelated work and all existing archived task history.

## References

- [Repository task ledger skill](/skills/repository-task-ledger/SKILL.md)
- [Project adoption guidance](/skills/repository-task-ledger/references/adoption.md)
- [UniCAS adoption task](https://github.com/shazhou-ww/unicas/blob/main/tasks/backlog/adopt-repoledger-cli/Task.md)
