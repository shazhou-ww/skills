# Progress

Updated: 2026-09-15

## Checklist

- [x] Publish the claim to the shared primary branch.
- [x] Commit and publish substantive work at meaningful checkpoints.
- [ ] Publish implementation completion while the task is still ongoing.
- [ ] Complete documented user acceptance, if required.
- [ ] Archive and publish the task as its final action.

## Current state

The claim, initial pnpm workspace, and complete source implementation are
published on `origin/main`. GitHub Actions passed the Node 22/24 matrix on
Windows, macOS, and Linux plus Agent Skills discovery. The only remaining
implementation blocker is npm authentication on this device. The next action
is for the maintainer to run
`npm login --registry=https://registry.npmjs.org/` directly in a terminal;
after `npm whoami` succeeds, recheck the package name, publish
`repoledger@0.1.0`, verify exact-version npx execution, and record the
implementation-complete milestone.

## Decisions

- Keep `repoledger` source in `packages/repoledger` and the repository root
  private, so npm publication does not package task history or unrelated
  skills.
- Use pnpm as the workspace package manager, pinned through the root
  `packageManager` field. Consuming repositories remain able to invoke the
  published package with npm/npx.
- Preserve the repository's current absence of an explicit software license;
  package metadata is `UNLICENSED` unless the owner makes a separate licensing
  decision before publication.
- Use Commander 14 for command routing and professional generated help while
  preserving Node 22 compatibility, and use Marked for Markdown structure
  rather than regex-only document parsing.
- Use `schema/v1.json` as the sole configuration contract; do not duplicate
  that version in config fields or task metadata. Config files reference the
  schema from the pinned local package for offline editor support, while its
  canonical `$id` links to GitHub. Archived tasks with an older publication
  format remain immutable legacy records with informational diagnostics.
- Require complete Git history and the configured remote ref for every
  `check`; this core protocol invariant is not project-configurable. `check`
  never fetches, while `doctor` refreshes the configured branch unless
  explicitly offline.
- Validate both repository-root and ordinary relative local links by default,
  while leaving URI references external. Do not add a link-policy setting.
- Limit the initial CLI to non-lifecycle `check` and `doctor` commands. Task
  admission, claims, handoffs, completion, and archival remain skill-owned.
- Keep CI-safe repository validation in `check`; isolate local worktree,
  identity, fetch, and remote-registration checks in `doctor`.
- Treat the linked UniCAS migration as a separate downstream adaptation task
  that starts only after a compatible public package version exists.
- No manual user acceptance is currently required because the package,
  platform behavior, npm resolution, and documentation can be verified
  autonomously.

## Publication milestones

| Milestone | Evidence | Status |
| --- | --- | --- |
| Claim | `origin/main` commit `1366493bf210fd23493b95708d56c9e38f9ff556`. | Published |
| Implementation complete | Pending. | Pending |
| Archive | Pending. | Pending |

## Validation

- Refreshed `origin/main` at `8f700df` and verified the worktree-scoped
  `scottwei-office-pc` identity and its registered remote lane.
- Enumerated the refreshed ledger: this was the only backlog task, with no
  ongoing task or archived task of the same name.
- Verified the claim move preserved `Task.md`, removed the backlog source
  directory, and left exactly one task position.
- Verified claim commit `1366493bf210fd23493b95708d56c9e38f9ff556` is
  reachable from refreshed `origin/main`, with both ongoing artifacts present
  and the backlog source absent.
- `pnpm install --lockfile-only` created the workspace lockfile with pnpm
  `11.22.0`.
- `pnpm --filter repoledger check` passed syntax validation and 4 focused tests
  covering canonical directories, missing-directory diagnostics, package
  version output, and unknown-command usage errors.
- Published the private workspace and initial CLI checkpoint as `origin/main`
  commit `93da1e7a64871cb2e60a1930db9c3387d403402f`.
- `pnpm --filter repoledger check` now passes 19 tests covering config, layout,
  Markdown, legacy archives, UAT, history capability, worktree identity,
  offline mode, Commander help, and failure diagnostics.
- The real repository passes `repoledger check` with full history, 8 task
  positions, zero errors, and 7 expected legacy informational records.
- `pnpm --filter repoledger pack:check` reports `PACK_OK` for the 13-file
  `repoledger@0.1.0` tarball and rejects files outside the public allowlist.
- An independent read-only review identified archive-copy acceptance and
  unknown shallow-state handling as high-risk gaps. The implementation now
  requires one parent-tree ongoing source to disappear in the archive commit
  and fails closed when Git cannot prove history completeness.
- `pnpm --filter repoledger test` passes 36 tests, including actual local Git
  remotes, worktree-scoped identity, a real shallow clone, a complete
  intake-to-archive history, copy rejection, distinct commits, schema-only
  config, link boundaries, Commander exit codes, and legacy archives.
- `npm --prefix packages/repoledger run smoke:pack` creates and installs the
  real tarball in a clean npm/Git consumer, then reports `PACK_SMOKE_OK` after
  running help, version, `check`, and online `doctor` through npm exec.
- Added a GitHub Actions matrix for Node 22 and 24 on Windows, macOS, and Linux,
  plus a separate Agent Skills discovery job. Remote CI evidence is pending the
  checkpoint publication.
- Added the workspace package as a root `workspace:*` development dependency;
  `pnpm exec repoledger doctor --json` now resolves the actual package binary,
  refreshes `origin/main`, and validates `scottwei-office-pc` successfully.
- Reviewed the concurrent `automate-monorepo-package-releases` backlog task. It
  explicitly leaves the initial release to this task and owns only subsequent
  tag-driven trusted publication, so no implementation scope overlaps.
- Final pre-checkpoint validation passed `pnpm install --frozen-lockfile`,
  `pnpm check`, online `pnpm exec repoledger doctor --json`,
  `pnpm check:skills`, all 29 Markdown files, editor diagnostics, and
  `git diff --check` on Windows with Node 24.11.1 and pnpm 11.22.0.
- Published the complete CLI, schema, tests, CI, docs, and skill integration as
  `origin/main` commit `473ffad71c2a85d567fc736cfa1b13d9cd2fb5ef`.
- [GitHub Actions run 34950524537](https://github.com/shazhou-ww/skills/actions/runs/34950524537)
  completed successfully: Node 22 and 24 passed on Ubuntu, Windows, and macOS,
  and the separate Agent Skills discovery job passed.
- `npm ping` reached `https://registry.npmjs.org/`, and an anonymous registry
  lookup confirmed the unscoped `repoledger` name remains unpublished.
- `npm whoami --registry=https://registry.npmjs.org/` found no active npm
  publishing identity, so no publication was attempted.

## Blockers

- Initial npm publication requires the maintainer to authenticate directly in
  a terminal. Credentials, one-time codes, and tokens must not pass through the
  task artifact or agent conversation. Resume after `npm whoami` succeeds.

## Outcome

In progress.