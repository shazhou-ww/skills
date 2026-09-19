# Progress

Updated: 2026-09-15

## Checklist

- [x] Publish the claim to the shared primary branch.
- [x] Commit and publish substantive work at meaningful checkpoints.
- [x] Publish implementation completion while the task is still ongoing.
- [x] Complete documented user acceptance, if required. Not required because
  every acceptance criterion is agent-verifiable.
- [x] Archive and publish the task as its final action.

## Current state

The implementation-complete milestone is published and cross-platform CI is
green. The task is now archived by this final `origin/main` integration.
[`repoledger@0.1.0`](https://www.npmjs.com/package/repoledger/v/0.1.0) is now
public with `latest` pointing to `0.1.0`; its registry tarball exactly matches
the candidate exercised by the test matrix. Exact-version npx execution of
help, version, `check`, and online `doctor` passed from outside the workspace.
Every acceptance criterion is complete, and implementation-complete commit
`77e3a2119c58ad0e1bf1831e1d25a213d768b402` is published on `origin/main`.

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
| Implementation complete | `origin/main` commit `77e3a2119c58ad0e1bf1831e1d25a213d768b402`. | Published |
| Archive | This final archive commit on `origin/main`; remote Git history supplies its immutable ID. | Published |

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
- After the maintainer authenticated, `npm whoami` returned `shazhou.ww`, and a
  final registry lookup confirmed `repoledger@0.1.0` was still available.
- `npm publish --access public --registry=https://registry.npmjs.org/`
  published `repoledger@0.1.0` with 13 files, the `latest` dist-tag, and tarball
  SHA-1 `4c625adc7e8745a5ccd3ba706b88bbc9a4cb33a5`.
- Registry metadata reports `repoledger@0.1.0` and `latest=0.1.0`; its SHA-1
  and integrity values exactly match a fresh local dry-run candidate.
- From outside the workspace, exact-version `npx repoledger@0.1.0` returned
  version `0.1.0`, rendered Commander help, passed `check` over 10 task
  positions, and passed online `doctor` with identity
  `scottwei-office-pc` and refreshed remote state.
- [GitHub Actions run 34950800032](https://github.com/shazhou-ww/skills/actions/runs/34950800032)
  passed for the current published source commit before npm publication.
- Verified implementation-complete commit
  `77e3a2119c58ad0e1bf1831e1d25a213d768b402` is reachable from refreshed
  `origin/main`, both task artifacts remain under the ongoing identity, and no
  premature archive exists.
- [GitHub Actions run 34951316381](https://github.com/shazhou-ww/skills/actions/runs/34951316381)
  passed the implementation-complete commit across Node 22 and 24 on Ubuntu,
  Windows, and macOS, plus Agent Skills discovery.
- The pre-commit archive move check found both task artifacts under
  `tasks/archived/build-repoledger-cli`, confirmed the ongoing source is absent,
  preserved the `scottwei-office-pc` identity marker, and found exactly one
  canonical task position.

## Blockers

- None.

## Outcome

Completed. The public `repoledger@0.1.0` CLI now provides deterministic
repository and worktree validation for the task-ledger skills, with verified
cross-platform behavior and a separate linked UniCAS adoption task.