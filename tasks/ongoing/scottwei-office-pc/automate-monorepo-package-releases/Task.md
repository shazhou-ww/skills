# Automate monorepo package releases

Created: 2026-09-15

## Goal

Publish the intended workspace package and exact committed version to npm when
an authorized package-specific Git tag is pushed.

## Context

This repository is a private pnpm workspace whose publishable packages live
under `packages/`. The initial `repoledger` release is owned by the active
[`build-repoledger-cli`](/tasks/archived/build-repoledger-cli/Task.md)
task, but subsequent releases need a repeatable path that does not depend on a
maintainer publishing from a development machine.

A monorepo-wide `v1.2.3` tag does not identify which independently versioned
package to publish. Use package-specific tags such as
`npm/repoledger/v0.1.1`, with the tag acting as a release instruction and the
committed package manifest remaining the source of package name and version.

## Scope

- Add a GitHub Actions workflow that recognizes an explicit
  `npm/<release-key>/v<semver>` tag convention and maps supported release keys
  to fixed workspace package directories.
- Reject malformed tags, unknown release keys, private packages, package-name
  mismatches, version mismatches, and tags whose commits are not reachable
  from the refreshed shared primary branch before publication.
- Install the frozen workspace dependencies and run the repository checks and
  package tarball validation before publishing only the selected package.
- Publish through npm trusted publishing with GitHub OIDC and least-privilege
  workflow permissions, without a long-lived npm write token.
- Map prerelease versions to an explicit non-`latest` npm dist-tag while stable
  versions publish to `latest`.
- Document the release-tag procedure, required npm trusted-publisher setup,
  GitHub tag protection, failure behavior, and how another workspace package
  is deliberately added to the release mapping.

## Out of scope

- Repeating or changing the completed initial `repoledger` npm release.
- Automatically choosing versions, editing package manifests, creating Git
  tags, or generating changelogs and GitHub Releases.
- Introducing Changesets, release-please, or coordinated dependency versioning
  before the workspace has multiple packages that require those capabilities.
- Publishing the private workspace root, Agent Skills, or packages to a
  registry other than npmjs.org.
- Replacing the repository's general pull-request and cross-platform CI.

## Acceptance criteria

- [x] Pushing an authorized `npm/repoledger/v<version>` tag whose version
      exactly matches `packages/repoledger/package.json` runs validation and
      publishes only that package at that exact version.
- [x] The workflow fails before `npm publish` for a malformed or unknown tag,
      a tag/package name or version mismatch, a private package, an already
      published version, or a commit outside the refreshed shared primary
      branch.
- [x] Stable releases use the npm `latest` dist-tag, while supported SemVer
      prereleases use an explicitly derived non-`latest` dist-tag.
- [x] npm authentication uses a GitHub-hosted runner and OIDC trusted
      publishing with only `contents: read` and `id-token: write`; no npm write
      token is stored in repository or environment secrets.
- [x] Release validation installs from the frozen pnpm lockfile, passes the
      repository checks, and verifies the selected package tarball before
      publication.
- [x] Automated tests exercise tag parsing, package selection, version
      agreement, primary-branch reachability, and npm dist-tag selection
      without performing a real publication.
- [x] Release documentation gives a maintainer an exact, reproducible sequence
      for preparing and pushing a protected package tag and for registering
      the workflow as the package's npm trusted publisher.
- [x] The initial public `repoledger` release is complete before this workflow
      is enabled for subsequent releases.

## Constraints

- Treat the committed package manifest as authoritative; the release workflow
  must never rewrite a version to make it agree with a tag.
- Resolve package locations through an explicit allowlist rather than using
  untrusted tag text directly as a filesystem path or publish target.
- Keep publication reproducible from the tagged commit and fail closed when
  ancestry, package identity, version, or registry state cannot be verified.
- Use the exact workflow filename registered on npmjs.com, because trusted
  publisher identity is filename-sensitive.
- Preserve unrelated work and the archived CLI task history.

## References

- [Build the repoledger CLI](/tasks/archived/build-repoledger-cli/Task.md)
- [repoledger package manifest](/packages/repoledger/package.json)
- [npm release workflow](/.github/workflows/publish-npm.yml)
- [npm release planner](/scripts/prepare-npm-release.mjs)
- [npm package release guide](/docs/npm-package-releases.md)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)