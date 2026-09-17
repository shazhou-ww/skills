export const PORTABLE_IDENTITY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDENTITY_SCOPES = new Set(["global", "worktree"]);

export function effectiveIdentity(state) {
  return IDENTITY_SCOPES.has(state.scope) &&
    state.identity === state.resolvedIdentity
    ? state.identity
    : null;
}

export function readIdentityState(root, git) {
  const binding = git(root, [
    "config",
    "--get",
    "task-ledger.identity",
  ]);
  const origin = git(root, [
    "config",
    "--show-origin",
    "--show-scope",
    "--get",
    "task-ledger.identity",
  ]);
  const originMatch = /^(\S+)\s+(\S+)\s+(.+)$/.exec(origin.stdout);

  return {
    identity: binding.ok && binding.stdout ? binding.stdout : null,
    origin: originMatch?.[2] ?? null,
    resolvedIdentity: originMatch?.[3] ?? null,
    scope: originMatch?.[1] ?? null,
  };
}
